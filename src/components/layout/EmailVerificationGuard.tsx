'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { SiteSettings } from '@/lib/types';

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
 * Respects site_settings/global → auth.requireEmailVerification.
 * If that flag is false, the guard is effectively disabled.
 *
 * Unauthenticated users and verified users pass through freely.
 */
export function EmailVerificationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { addToast } = useToast();
  const [requireVerification, setRequireVerification] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Listen to site_settings/global for the requireEmailVerification flag
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'site_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SiteSettings;
          setRequireVerification(data.auth?.requireEmailVerification ?? true);
        } else {
          // Default to true if doc doesn't exist yet
          setRequireVerification(true);
        }
        setSettingsLoaded(true);
      },
      () => {
        // On error, default to requiring verification (safe fallback)
        setSettingsLoaded(true);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    // Wait until auth and settings are loaded
    if (loading || !settingsLoaded) return;

    // If verification is not required via site settings, skip
    if (!requireVerification) return;

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
  }, [loading, settingsLoaded, requireVerification, user, pathname, router, addToast]);

  return <>{children}</>;
}
