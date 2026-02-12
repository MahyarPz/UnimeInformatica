'use client';

import React from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner';
import { PresenceWrapper } from '@/components/layout/PresenceWrapper';
import { EmailVerificationGuard } from '@/components/layout/EmailVerificationGuard';
import { MaintenanceGuard } from '@/components/layout/MaintenanceGuard';
import { SiteSettingsProvider, useSiteSettingsContext } from '@/contexts/SiteSettingsContext';

function Footer() {
  const { appName } = useSiteSettingsContext();
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <div className="container">
        <p>© {new Date().getFullYear()} {appName}. All rights reserved.</p>
      </div>
    </footer>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { loading } = useSiteSettingsContext();

  return (
    <div
      className="min-h-screen flex flex-col transition-opacity duration-200"
      style={{ opacity: loading ? 0 : 1 }}
    >
      <Navigation />
      <AnnouncementBanner />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteSettingsProvider>
      <MaintenanceGuard>
        <EmailVerificationGuard>
          <PresenceWrapper />
          <AppShell>{children}</AppShell>
        </EmailVerificationGuard>
      </MaintenanceGuard>
    </SiteSettingsProvider>
  );
}
