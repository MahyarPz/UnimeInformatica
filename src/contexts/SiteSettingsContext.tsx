'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { SiteSettings, DEFAULT_SITE_SETTINGS } from '@/lib/types';

interface SiteSettingsContextValue {
  settings: SiteSettings | null;
  loading: boolean;
  /** Convenience: resolved branding app name (never empty) */
  appName: string;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: null,
  loading: true,
  appName: DEFAULT_SITE_SETTINGS.branding.appName,
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'site_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as SiteSettings);
        }
        setLoading(false);
      },
      () => {
        // On error, keep defaults
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const appName =
    settings?.branding?.appName?.trim() || DEFAULT_SITE_SETTINGS.branding.appName;

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, appName }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettingsContext() {
  return useContext(SiteSettingsContext);
}
