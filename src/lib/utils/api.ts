/**
 * Standardized fetch wrapper that handles 401/403 responses globally.
 * All API calls should use this instead of raw fetch().
 */

import { auth } from '@/lib/firebase/config';
import { dispatchSessionInvalid } from '@/lib/utils/session';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Set to false to skip auto-attaching the Bearer token */
  authenticated?: boolean;
  /** Max retries for transient network errors (default: 2) */
  retries?: number;
}

interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Authenticated fetch wrapper with automatic 401/403 handling.
 *
 * - Attaches Firebase ID token automatically
 * - Retries on transient network errors (max 2)
 * - Dispatches session:invalid event on 401/403
 * - Returns typed response data
 */
export async function apiFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const {
    authenticated = true,
    retries = MAX_RETRIES,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Attach bearer token if authenticated
  if (authenticated) {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        dispatchSessionInvalid('session_expired');
        return { ok: false, status: 401, data: { error: 'Not authenticated' } as T };
      }
      headers['Authorization'] = `Bearer ${token}`;
    } catch {
      dispatchSessionInvalid('session_expired');
      return { ok: false, status: 401, data: { error: 'Token refresh failed' } as T };
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...fetchOptions, headers });

      // Handle auth errors — no retry
      if (res.status === 401) {
        const data = await res.json().catch(() => ({ error: 'Unauthorized' }));
        dispatchSessionInvalid('session_expired');
        return { ok: false, status: 401, data };
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({ error: 'Forbidden' }));
        dispatchSessionInvalid('access_changed');
        return { ok: false, status: 403, data };
      }

      // Parse response
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (error: any) {
      lastError = error;
      // Only retry on network errors, not on other failures
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
    }
  }

  // All retries exhausted
  return {
    ok: false,
    status: 0,
    data: { error: lastError?.message || 'Network error' } as T,
  };
}
