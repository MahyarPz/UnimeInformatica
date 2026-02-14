'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { SiteSettings, DEFAULT_SITE_SETTINGS } from '@/lib/types';
import { handleFirebaseError } from '@/lib/utils/session';

// ─── Hex → HSL conversion ───
function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Compute a readable foreground for a given hex color */
function foregroundForHex(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '210 40% 98%';
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '222.2 84% 4.9%' : '210 40% 98%';
}

interface SiteSettingsContextValue {
  settings: SiteSettings | null;
  loading: boolean;
  appName: string;
  logoUrl: string;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: null,
  loading: true,
  appName: DEFAULT_SITE_SETTINGS.branding.appName,
  logoUrl: '',
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
      (error) => {
        handleFirebaseError(error);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // Apply primary color as CSS variable
  useEffect(() => {
    const hex = settings?.branding?.primaryColorHex;
    if (!hex) return;
    const hsl = hexToHSL(hex);
    if (!hsl) return;
    const root = document.documentElement;
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--primary-foreground', foregroundForHex(hex));
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--sidebar-primary', hsl);
  }, [settings?.branding?.primaryColorHex]);

  // Apply dynamic favicon
  useEffect(() => {
    const faviconUrl = settings?.branding?.faviconUrl;
    if (!faviconUrl) return;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [settings?.branding?.faviconUrl]);

  const appName =
    settings?.branding?.appName?.trim() || DEFAULT_SITE_SETTINGS.branding.appName;
  const logoUrl = settings?.branding?.logoUrl || '';

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, appName, logoUrl }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettingsContext() {
  return useContext(SiteSettingsContext);
}
