'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import {
  SitePageId,
  SiteContentHome,
  SiteContentNav,
  SiteContentFooter,
  SiteContentVersion,
  DEFAULT_HOME_CONTENT,
  DEFAULT_NAV_CONTENT,
  DEFAULT_FOOTER_CONTENT,
} from '@/lib/types';

const CONTENT_COL = 'site_content';
const VERSIONS_COL = 'site_content_versions';
const MAX_VERSIONS = 20;

type PageData = SiteContentHome | SiteContentNav | SiteContentFooter;

function getDefault(pageId: SitePageId) {
  switch (pageId) {
    case 'home': return DEFAULT_HOME_CONTENT;
    case 'nav': return DEFAULT_NAV_CONTENT;
    case 'footer': return DEFAULT_FOOTER_CONTENT;
  }
}

/**
 * Admin hook: real-time listener + saveDraft / publish / revert / rollback.
 * Version history is stored in `site_content_versions`.
 */
export function useSiteContent(pageId: SitePageId) {
  const { user, userProfile } = useAuth();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<(SiteContentVersion & { id: string })[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const bootstrapped = useRef(false);

  const docRef = doc(db, CONTENT_COL, pageId);

  // ─── Real-time listener on the page doc ─────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setData(snap.data() as PageData);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error(`useSiteContent(${pageId}) listener error:`, err);
        setLoading(false);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // ─── Auto-bootstrap if doc missing and user is admin ────
  useEffect(() => {
    if (loading || data !== null || bootstrapped.current) return;
    if (!user || !userProfile || userProfile.role !== 'admin') return;
    bootstrapped.current = true;

    const bootstrap = async () => {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) return;
        const seed = getDefault(pageId);
        await setDoc(docRef, {
          ...seed,
          draft: { updatedAt: serverTimestamp(), updatedBy: user.uid, version: 1 },
        });
      } catch (e) {
        console.error(`Failed to bootstrap ${pageId}:`, e);
      }
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data, user, userProfile, pageId]);

  // ─── Load version history ──────────────────────────────
  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    try {
      const q = query(
        collection(db, VERSIONS_COL),
        where('pageId', '==', pageId),
        orderBy('createdAt', 'desc'),
        limit(MAX_VERSIONS * 2), // both draft+published
      );
      const snap = await getDocs(q);
      setVersions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SiteContentVersion & { id: string })));
    } catch (e) {
      console.error('Failed to load versions:', e);
    } finally {
      setVersionsLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // ─── Prune old versions (keep latest N per kind) ───────
  const pruneVersions = useCallback(async (kind: 'draft' | 'published') => {
    try {
      const q = query(
        collection(db, VERSIONS_COL),
        where('pageId', '==', pageId),
        where('kind', '==', kind),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const docs = snap.docs;
      if (docs.length > MAX_VERSIONS) {
        const toDelete = docs.slice(MAX_VERSIONS);
        await Promise.all(toDelete.map((d) => deleteDoc(d.ref)));
      }
    } catch (e) {
      console.error('Prune versions error:', e);
    }
  }, [pageId]);

  // ─── Save Draft ─────────────────────────────────────────
  const saveDraft = useCallback(async (
    content: Partial<PageData>,
    label?: string,
  ) => {
    if (!user) throw new Error('Not authenticated');
    setSaving(true);
    try {
      const current = data ?? { ...getDefault(pageId), draft: { updatedAt: null, updatedBy: '', version: 0 } };
      const currentVersion = (current as any).draft?.version ?? 0;
      const newVersion = currentVersion + 1;

      const merged: Record<string, any> = {
        ...current,
        ...content,
        draft: {
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          version: newVersion,
        },
      };

      // Don't overwrite published metadata
      if ((current as any).published) {
        merged.published = (current as any).published;
      }

      await setDoc(docRef, merged);

      // Write version snapshot
      await addDoc(collection(db, VERSIONS_COL), {
        pageId,
        kind: 'draft',
        version: newVersion,
        snapshot: merged,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        label: label || '',
      } satisfies Omit<SiteContentVersion, 'createdAt'> & { createdAt: any });

      await pruneVersions('draft');
      await loadVersions();
    } finally {
      setSaving(false);
    }
  }, [user, data, pageId, docRef, pruneVersions, loadVersions]);

  // ─── Publish ────────────────────────────────────────────
  const publish = useCallback(async (label?: string) => {
    if (!user) throw new Error('Not authenticated');
    setSaving(true);
    try {
      const current = data;
      if (!current) throw new Error('No content to publish');
      const draftVersion = (current as any).draft?.version ?? 1;

      const update: Record<string, any> = {
        published: {
          publishedAt: serverTimestamp(),
          publishedBy: user.uid,
          version: draftVersion,
        },
      };

      await setDoc(docRef, update, { merge: true });

      // Write published version snapshot
      await addDoc(collection(db, VERSIONS_COL), {
        pageId,
        kind: 'published',
        version: draftVersion,
        snapshot: { ...current, published: { publishedAt: new Date().toISOString(), publishedBy: user.uid, version: draftVersion } },
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        label: label || '',
      });

      await pruneVersions('published');
      await loadVersions();
    } finally {
      setSaving(false);
    }
  }, [user, data, pageId, docRef, pruneVersions, loadVersions]);

  // ─── Revert to Published ────────────────────────────────
  const revertToPublished = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    // Find the latest published version snapshot
    const pubVersions = versions.filter((v) => v.kind === 'published');
    if (pubVersions.length === 0) throw new Error('No published version to revert to');

    setSaving(true);
    try {
      const latest = pubVersions[0];
      const snapshot = latest.snapshot;

      // Restore as a new draft
      const current = data;
      const currentDraftVersion = (current as any)?.draft?.version ?? 0;
      const newVersion = currentDraftVersion + 1;

      const restored: Record<string, any> = {
        ...snapshot,
        draft: {
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          version: newVersion,
        },
      };

      await setDoc(docRef, restored);

      // Write rollback version snapshot
      await addDoc(collection(db, VERSIONS_COL), {
        pageId,
        kind: 'draft',
        version: newVersion,
        snapshot: restored,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        label: `Reverted to published v${latest.version}`,
      });

      await pruneVersions('draft');
      await loadVersions();
    } finally {
      setSaving(false);
    }
  }, [user, data, versions, pageId, docRef, pruneVersions, loadVersions]);

  // ─── Rollback to specific version ──────────────────────
  const rollbackToVersion = useCallback(async (
    versionDoc: SiteContentVersion & { id: string },
    andPublish = false,
  ) => {
    if (!user) throw new Error('Not authenticated');
    setSaving(true);
    try {
      const snapshot = versionDoc.snapshot;
      const current = data;
      const currentDraftVersion = (current as any)?.draft?.version ?? 0;
      const newVersion = currentDraftVersion + 1;

      const restored: Record<string, any> = {
        ...snapshot,
        draft: {
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          version: newVersion,
        },
      };

      // If andPublish, also update published metadata
      if (andPublish) {
        restored.published = {
          publishedAt: serverTimestamp(),
          publishedBy: user.uid,
          version: newVersion,
        };
      }

      await setDoc(docRef, restored);

      // Write rollback draft version
      await addDoc(collection(db, VERSIONS_COL), {
        pageId,
        kind: 'draft',
        version: newVersion,
        snapshot: restored,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        label: `Rollback to ${versionDoc.kind} v${versionDoc.version}`,
      });

      // If publish too, write published version as well
      if (andPublish) {
        await addDoc(collection(db, VERSIONS_COL), {
          pageId,
          kind: 'published',
          version: newVersion,
          snapshot: restored,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          label: `Rollback & publish from ${versionDoc.kind} v${versionDoc.version}`,
        });
        await pruneVersions('published');
      }

      await pruneVersions('draft');
      await loadVersions();
    } finally {
      setSaving(false);
    }
  }, [user, data, pageId, docRef, pruneVersions, loadVersions]);

  return {
    data,
    loading,
    saving,
    versions,
    versionsLoading,
    saveDraft,
    publish,
    revertToPublished,
    rollbackToVersion,
    refreshVersions: loadVersions,
  };
}
