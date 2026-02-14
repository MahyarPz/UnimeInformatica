'use client';

import React from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/layout/Navigation';
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner';
import { PresenceWrapper } from '@/components/layout/PresenceWrapper';
import { EmailVerificationGuard } from '@/components/layout/EmailVerificationGuard';
import { MaintenanceGuard } from '@/components/layout/MaintenanceGuard';
import { SessionExpiredDialog } from '@/components/layout/SessionExpiredDialog';
import { ParticleTrail } from '@/components/ui/ParticleTrail';
import { useSessionGuard } from '@/lib/hooks/useSessionGuard';
import { SiteSettingsProvider, useSiteSettingsContext } from '@/contexts/SiteSettingsContext';
import { SiteContentProvider, useSiteContentContext } from '@/contexts/SiteContentContext';

function Footer() {
  const { appName } = useSiteSettingsContext();
  const { footer: footerData } = useSiteContentContext();

  const columns = footerData?.columns ?? [];
  const socials = footerData?.socials ?? {};
  const copyrightTemplate = footerData?.copyright?.en || `© {year} ${appName}. All rights reserved.`;
  const copyright = copyrightTemplate.replace('{year}', String(new Date().getFullYear()));

  const hasSocials = !!socials.instagram || !!socials.telegram || !!socials.github || !!socials.website;
  const hasColumns = columns.length > 0;

  if (!hasColumns && !hasSocials) {
    // Simple footer
    return (
      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        <div className="container">
          <p>{copyright}</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border/50 bg-muted/30 py-12">
      <div className="container">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col, i) => (
            <div key={i}>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-foreground/80 mb-4">{col.title?.en || ''}</h4>
              <ul className="space-y-2.5">
                {(col.links || [])
                  .filter((l) => l.enabled)
                  .sort((a, b) => a.order - b.order)
                  .map((link, j) => (
                    <li key={j}>
                      <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                        {link.label?.en || ''}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

          {hasSocials && (
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-foreground/80 mb-4">Connect</h4>
              <ul className="space-y-2.5">
                {socials.instagram && (
                  <li><a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Instagram</a></li>
                )}
                {socials.telegram && (
                  <li><a href={socials.telegram} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Telegram</a></li>
                )}
                {socials.github && (
                  <li><a href={socials.github} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">GitHub</a></li>
                )}
                {socials.website && (
                  <li><a href={socials.website} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Website</a></li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { loading } = useSiteSettingsContext();

  return (
    <div
      className="min-h-screen flex flex-col transition-opacity duration-300"
      style={{ opacity: loading ? 0 : 1 }}
    >
      <ParticleTrail particleCount={2} colors={[210, 250, 280]} />
      <Navigation />
      <AnnouncementBanner />
      <main className="flex-1 page-enter">{children}</main>
      <Footer />
    </div>
  );
}

function SessionGuardWrapper() {
  useSessionGuard();
  return null;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteSettingsProvider>
      <SiteContentProvider>
        <MaintenanceGuard>
          <EmailVerificationGuard>
            <SessionGuardWrapper />
            <PresenceWrapper />
            <SessionExpiredDialog />
            <AppShell>{children}</AppShell>
          </EmailVerificationGuard>
        </MaintenanceGuard>
      </SiteContentProvider>
    </SiteSettingsProvider>
  );
}
