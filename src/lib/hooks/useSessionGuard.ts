'use client';

import { useEffect, useRef, useCallback } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { dispatchSessionInvalid } from '@/lib/utils/session';
import { UserRole } from '@/lib/types';

/** Routes that require admin/moderator role */
const ADMIN_ROUTES = ['/admin'];
/** Routes that require paid plan (supporter/pro) */
const PAID_ROUTES = ['/ai'];

interface UseSessionGuardOptions {
  /** Required role(s) for the current page */
  requiredRole?: UserRole[];
  /** Whether the current page requires a paid plan */
  requiresPaidPlan?: boolean;
}

/**
 * Hook that monitors Firebase ID token changes and reacts to role/plan changes.
 * Uses `onIdTokenChanged` to detect custom claims changes (role, plan).
 * If the current route is no longer allowed, dispatches session:invalid.
 *
 * Should be called once at the app shell level (ClientLayout).
 */
export function useSessionGuard(options: UseSessionGuardOptions = {}) {
  const { user, claims, userProfile } = useAuth();
  const pathname = usePathname();
  const prevClaimsRef = useRef(claims);
  const initializedRef = useRef(false);

  // Check if current route requires admin
  const isOnAdminRoute = ADMIN_ROUTES.some((r) => pathname?.startsWith(r));
  // Check if current route requires paid plan
  const isOnPaidRoute = PAID_ROUTES.some((r) => pathname?.startsWith(r));

  const checkRouteAccess = useCallback(() => {
    if (!initializedRef.current) return;
    if (!user) return; // onAuthStateChanged handles null user

    const role = (claims?.role || userProfile?.role || 'user') as UserRole;

    // Admin route check
    if (isOnAdminRoute && role !== 'admin' && role !== 'moderator') {
      dispatchSessionInvalid('access_changed', pathname || '/admin');
      return;
    }

    // Custom required role check
    if (options.requiredRole && options.requiredRole.length > 0) {
      if (!options.requiredRole.includes(role)) {
        dispatchSessionInvalid('access_changed', pathname || '/');
        return;
      }
    }
  }, [user, claims, userProfile, isOnAdminRoute, pathname, options.requiredRole]);

  // Listen for token changes (role/claims changes)
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // User signed out — only dispatch if we were previously signed in
        if (initializedRef.current && prevClaimsRef.current !== null) {
          dispatchSessionInvalid('session_expired', pathname || '/');
        }
        prevClaimsRef.current = null;
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        const newRole = tokenResult.claims?.role as string | undefined;
        const prevRole = prevClaimsRef.current?.role;

        prevClaimsRef.current = { role: newRole as UserRole };

        // After initial load, check if role changed
        if (initializedRef.current && prevRole && newRole !== prevRole) {
          // Role changed — re-check current route
          if (isOnAdminRoute && newRole !== 'admin' && newRole !== 'moderator') {
            dispatchSessionInvalid('access_changed', pathname || '/admin');
          }
        }

        initializedRef.current = true;
      } catch {
        // Token refresh failed hard — session expired
        dispatchSessionInvalid('session_expired', pathname || '/');
      }
    });

    return () => unsubscribe();
  }, [pathname, isOnAdminRoute]);

  // Re-check access when claims change via AuthContext
  useEffect(() => {
    if (initializedRef.current) {
      checkRouteAccess();
    }
  }, [claims, checkRouteAccess]);
}

/**
 * Generic auth guard hook for pages.
 * Waits for auth loading then checks access.
 * Returns { authorized, loading } for the page to render accordingly.
 */
export function useAuthGuard(options: {
  requireAuth?: boolean;
  requireRole?: UserRole[];
  requirePaidPlan?: boolean;
} = { requireAuth: true }) {
  const { user, loading, claims, userProfile } = useAuth();
  const pathname = usePathname();
  const checkedRef = useRef(false);

  const role = (claims?.role || userProfile?.role || 'user') as UserRole;

  useEffect(() => {
    if (loading || checkedRef.current) return;

    if (options.requireAuth && !user) {
      checkedRef.current = true;
      dispatchSessionInvalid('session_expired', pathname || '/');
      return;
    }

    if (options.requireRole && options.requireRole.length > 0) {
      if (!options.requireRole.includes(role)) {
        checkedRef.current = true;
        dispatchSessionInvalid('access_changed', pathname || '/');
        return;
      }
    }
  }, [loading, user, role, pathname, options.requireAuth, options.requireRole]);

  // Reset when user changes (re-login)
  useEffect(() => {
    if (user) checkedRef.current = false;
  }, [user]);

  const authorized =
    !loading &&
    (!options.requireAuth || !!user) &&
    (!options.requireRole || options.requireRole.length === 0 || options.requireRole.includes(role));

  return { authorized, loading };
}
