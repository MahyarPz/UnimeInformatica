'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { SiteSettings, DEFAULT_SITE_SETTINGS } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

const SETTINGS_COLLECTION = 'site_settings';
const SETTINGS_DOC_ID = 'global';

/**
 * Hook to load + update the global site_settings/global document.
 *
 * - Real-time listener keeps data in sync.
 * - `updateSettings(partial)` merges changes, stamps updatedAt/updatedBy.
 * - If the document doesn't exist and the current user is admin,
 *   it auto-bootstraps with DEFAULT_SITE_SETTINGS.
 */
export function useSiteSettings() {
  const { user, userProfile } = useAuth();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bootstrappedRef = useRef(false);

  const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);

  // Real-time listener
  useEffect(() => {
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as SiteSettings);
        } else {
          setSettings(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('useSiteSettings listener error:', err);
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-bootstrap if doc is missing and user is admin
  useEffect(() => {
    if (loading) return;
    if (settings !== null) return;
    if (bootstrappedRef.current) return;
    if (!user || !userProfile) return;
    if (userProfile.role !== 'admin') return;

    bootstrappedRef.current = true;

    const bootstrap = async () => {
      try {
        // Double-check to avoid race conditions
        const snap = await getDoc(docRef);
        if (snap.exists()) return;

        await setDoc(docRef, {
          ...DEFAULT_SITE_SETTINGS,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (e: any) {
        console.error('Failed to bootstrap site settings:', e);
      }
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, settings, user, userProfile]);

  /**
   * Merge-update site settings. Only pass the top-level keys you want to change;
   * nested objects are spread manually to avoid overwriting sibling fields.
   */
  const updateSettings = useCallback(
    async (partial: Partial<SiteSettings>) => {
      if (!user) throw new Error('Not authenticated');
      setSaving(true);
      setError(null);

      try {
        // Build a flat merge-safe payload
        const current = settings ?? (DEFAULT_SITE_SETTINGS as unknown as SiteSettings);
        const merged: Record<string, any> = {};

        if (partial.branding) merged.branding = { ...current.branding, ...partial.branding };
        if (partial.contact) merged.contact = { ...current.contact, ...partial.contact };
        if (partial.seo) merged.seo = { ...current.seo, ...partial.seo };
        if (partial.auth) merged.auth = { ...current.auth, ...partial.auth };
        if (partial.maintenance) merged.maintenance = { ...current.maintenance, ...partial.maintenance };
        if (partial.content) merged.content = { ...current.content, ...partial.content };
        if (partial.limits) merged.limits = { ...current.limits, ...partial.limits };
        if (partial.emailTemplates) merged.emailTemplates = { ...current.emailTemplates, ...partial.emailTemplates };

        merged.updatedAt = serverTimestamp();
        merged.updatedBy = user.uid;

        await setDoc(docRef, merged, { merge: true });
      } catch (e: any) {
        console.error('Failed to update site settings:', e);
        setError(e.message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, settings],
  );

  return { settings, loading, error, saving, updateSettings };
}
