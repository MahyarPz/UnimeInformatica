/**
 * Session management utilities for handling expired/revoked sessions.
 * Centralizes session invalidation logic, redirect policies, and event dispatch.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/lib/firebase/config';

// ─── Types ────────────────────────────────────────────────
export type SessionInvalidReason = 'session_expired' | 'access_changed';

export interface SessionInvalidEvent {
  reason: SessionInvalidReason;
  message: string;
  route?: string;
}

// ─── Custom Event Name ────────────────────────────────────
export const SESSION_INVALID_EVENT = 'session:invalid';

// ─── Guard against infinite loops ─────────────────────────
const PUBLIC_ROUTES = ['/login', '/signup', '/verify-email'];
let lastInvalidationTime = 0;
const DEBOUNCE_MS = 2000;

/**
 * Dispatch a session invalid event globally. All listeners (SessionExpiredDialog)
 * will react. Debounced to prevent loops.
 */
export function dispatchSessionInvalid(
  reason: SessionInvalidReason,
  route?: string
): void {
  const now = Date.now();
  if (now - lastInvalidationTime < DEBOUNCE_MS) return;
  lastInvalidationTime = now;

  // Don't trigger if already on a public auth route
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (PUBLIC_ROUTES.some((r) => currentPath.startsWith(r))) return;
  }

  const message =
    reason === 'session_expired'
      ? 'Your session has expired. Please log in again.'
      : 'Your access has changed. Please log in again.';

  const event = new CustomEvent<SessionInvalidEvent>(SESSION_INVALID_EVENT, {
    detail: { reason, message, route: route || (typeof window !== 'undefined' ? window.location.pathname : '/') },
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(event);
    // Best-effort audit log
    logClientSessionEvent(reason, route || window.location.pathname);
  }
}

/**
 * Build the redirect URL for session invalid scenarios.
 */
export function buildSessionRedirectUrl(reason: SessionInvalidReason, currentPath?: string): string {
  const path = currentPath || '/';
  const params = new URLSearchParams();
  params.set('reason', reason);
  if (path && path !== '/' && path !== '/login' && path !== '/signup') {
    params.set('next', path);
  }
  return `/login?${params.toString()}`;
}

/**
 * Check if a path is a public/auth route that doesn't need protection.
 */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((r) => path.startsWith(r)) || path === '/';
}

/**
 * Check if a Firebase/Firestore error is a permission-denied or unauthenticated error.
 */
export function classifyFirebaseError(error: any): SessionInvalidReason | null {
  if (!error) return null;
  const code: string = error?.code || error?.errorInfo?.code || '';

  if (code === 'permission-denied' || code === 'PERMISSION_DENIED') {
    return 'access_changed';
  }
  if (
    code === 'unauthenticated' ||
    code === 'UNAUTHENTICATED' ||
    code === 'auth/id-token-expired' ||
    code === 'auth/user-token-expired' ||
    code === 'auth/user-disabled'
  ) {
    return 'session_expired';
  }
  return null;
}

/**
 * Handle a Firestore/Firebase error by dispatching session invalid if applicable.
 * Returns true if the error was a session error (caller should stop processing).
 */
export function handleFirebaseError(error: any): boolean {
  const reason = classifyFirebaseError(error);
  if (reason) {
    dispatchSessionInvalid(reason);
    return true;
  }
  return false;
}

/**
 * Log a client-side session event for audit purposes.
 * Best-effort, non-blocking. Only logs if user is still partially authenticated.
 */
export function logClientSessionEvent(
  type: SessionInvalidReason,
  route: string
): void {
  try {
    const uid = firebaseAuth.currentUser?.uid;
    addDoc(collection(db, 'client_events'), {
      uid: uid || 'unknown',
      type,
      route,
      createdAt: serverTimestamp(),
    }).catch(() => {
      // Best-effort — user may already be signed out
    });
  } catch {
    // Ignore — non-critical
  }
}
