'use client';

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { SiteSettings } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

/**
 * MaintenanceGuard
 *
 * Listens to site_settings/global in real-time.
 * When maintenance.enabled === true, blocks non-bypass users with a
 * full-screen maintenance message. Bypass roles (admin / moderator)
 * pass through normally.
 *
 * Placed in the root layout, wrapping the app content.
 */
export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [maintenance, setMaintenance] = useState<SiteSettings['maintenance'] | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Real-time listener on site_settings/global
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'site_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SiteSettings;
          setMaintenance(data.maintenance ?? null);
        } else {
          setMaintenance(null);
        }
        setSettingsLoading(false);
      },
      () => {
        // On error (e.g. unauthenticated reads blocked), don't block the app
        setSettingsLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // While auth or settings are loading, render nothing extra — just pass through
  if (authLoading || settingsLoading) {
    return <>{children}</>;
  }

  // If maintenance is not enabled, pass through
  if (!maintenance?.enabled) {
    return <>{children}</>;
  }

  // Check if user's role is in the bypass list
  const userRole = userProfile?.role;
  const bypassRoles = maintenance.allowedRolesBypass ?? ['admin', 'moderator'];
  if (userRole && bypassRoles.includes(userRole as 'admin' | 'moderator')) {
    return <>{children}</>;
  }

  // Show maintenance page
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
        <h1 className="text-2xl font-bold">Under Maintenance</h1>
        <p className="text-muted-foreground">
          {maintenance.message ||
            'We are currently performing scheduled maintenance. Please check back soon.'}
        </p>
        <p className="text-xs text-muted-foreground">
          If you are an admin or moderator, please log in to bypass this screen.
        </p>
      </div>
    </div>
  );
}
