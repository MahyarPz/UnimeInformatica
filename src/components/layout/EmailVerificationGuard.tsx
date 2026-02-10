'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';

/**
 * Routes that unverified users ARE allowed to visit.
 * Everything else requires a verified email.
 */
const ALLOWED_UNVERIFIED_ROUTES = [
  '/verify-email',
  '/login',
  '/signup',
  '/profile',
];

/**
 * Check if a pathname is allowed for unverified users.
 * Uses prefix matching so `/profile/...` sub-routes are also allowed.
 */
function isAllowedUnverified(pathname: string): boolean {
  // Home page is always accessible
  if (pathname === '/') return true;
  return ALLOWED_UNVERIFIED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
}

/**
 * EmailVerificationGuard
 *
 * Wraps the app content and redirects authenticated-but-unverified users
 * away from protected routes (practice sessions, labs, admin, etc.)
 * to the /verify-email page.
 *
 * Unauthenticated users and verified users pass through freely.
 */
export function EmailVerificationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    // Wait until auth is loaded
    if (loading) return;

    // Only applies to logged-in users who haven't verified their email
    if (!user) return;
    if (user.emailVerified) return;

    // If on an allowed route, do nothing
    if (isAllowedUnverified(pathname)) return;

    // Redirect to verify-email
    addToast({
      title: 'Email not verified',
      description: 'Please verify your email before accessing this page.',
      variant: 'destructive',
    });
    router.replace('/verify-email');
  }, [loading, user, pathname, router, addToast]);

  return <>{children}</>;
}
