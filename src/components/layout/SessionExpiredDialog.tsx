'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import {
  SESSION_INVALID_EVENT,
  SessionInvalidEvent,
  SessionInvalidReason,
  buildSessionRedirectUrl,
} from '@/lib/utils/session';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, Home, ShieldAlert, Clock } from 'lucide-react';

const MESSAGES: Record<SessionInvalidReason, { title: string; description: string; icon: typeof Clock }> = {
  session_expired: {
    title: 'Session Expired',
    description: 'Your session has expired. Please log in again to continue.',
    icon: Clock,
  },
  access_changed: {
    title: 'Access Changed',
    description: 'Your access permissions have changed. Please log in again.',
    icon: ShieldAlert,
  },
};

/**
 * Global dialog that appears when a session becomes invalid (401/403).
 * Listens to the custom `session:invalid` event dispatched by session utilities.
 * Must be rendered once, near the root of the app (e.g., in ClientLayout).
 */
export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SessionInvalidReason>('session_expired');
  const [currentRoute, setCurrentRoute] = useState('/');
  const router = useRouter();
  const pathname = usePathname();

  const handleSessionInvalid = useCallback((e: Event) => {
    const detail = (e as CustomEvent<SessionInvalidEvent>).detail;
    setReason(detail.reason);
    setCurrentRoute(detail.route || pathname || '/');
    setOpen(true);
  }, [pathname]);

  useEffect(() => {
    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    return () => window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
  }, [handleSessionInvalid]);

  const handleLogin = useCallback(async () => {
    setOpen(false);
    try {
      await signOut(auth);
    } catch {
      // Already signed out
    }
    const url = buildSessionRedirectUrl(reason, currentRoute);
    router.push(url);
  }, [reason, currentRoute, router]);

  const handleGoHome = useCallback(async () => {
    setOpen(false);
    try {
      await signOut(auth);
    } catch {
      // Already signed out
    }
    router.push('/');
  }, [router]);

  const config = MESSAGES[reason];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleLogin(); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{config.title}</DialogTitle>
          </div>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleGoHome} className="w-full sm:w-auto">
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
          <Button onClick={handleLogin} className="w-full sm:w-auto">
            <LogIn className="h-4 w-4 mr-2" />
            Log In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
