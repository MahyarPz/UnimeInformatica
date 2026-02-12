'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  SiteContentHome,
  SiteContentNav,
  SiteContentFooter,
  DEFAULT_HOME_CONTENT,
  DEFAULT_NAV_CONTENT,
  DEFAULT_FOOTER_CONTENT,
  DraftMeta,
} from '@/lib/types';

interface SiteContentContextValue {
  home: SiteContentHome | null;
  nav: SiteContentNav | null;
  footer: SiteContentFooter | null;
  loading: boolean;
}

const SiteContentContext = createContext<SiteContentContextValue>({
  home: null,
  nav: null,
  footer: null,
  loading: true,
});

const EMPTY_DRAFT: DraftMeta = { updatedAt: null, updatedBy: '', version: 0 };

/**
 * Read-only provider for public-facing pages.
 *
 * Returns published content if available, drafts as fallback, and hardcoded
 * defaults if the Firestore document does not exist at all.
 */
export function SiteContentProvider({ children }: { children: React.ReactNode }) {
  const [home, setHome] = useState<SiteContentHome | null>(null);
  const [nav, setNav] = useState<SiteContentNav | null>(null);
  const [footer, setFooter] = useState<SiteContentFooter | null>(null);
  const [loadCount, setLoadCount] = useState(0);

  // Listen to all three page docs concurrently
  useEffect(() => {
    const unsubs = (['home', 'nav', 'footer'] as const).map((pageId) =>
      onSnapshot(
        doc(db, 'site_content', pageId),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            switch (pageId) {
              case 'home': setHome(d as SiteContentHome); break;
              case 'nav': setNav(d as SiteContentNav); break;
              case 'footer': setFooter(d as SiteContentFooter); break;
            }
          } else {
            // Use hardcoded defaults
            switch (pageId) {
              case 'home': setHome({ ...DEFAULT_HOME_CONTENT, draft: EMPTY_DRAFT }); break;
              case 'nav': setNav({ ...DEFAULT_NAV_CONTENT, draft: EMPTY_DRAFT }); break;
              case 'footer': setFooter({ ...DEFAULT_FOOTER_CONTENT, draft: EMPTY_DRAFT }); break;
            }
          }
          setLoadCount((c) => c + 1);
        },
        () => setLoadCount((c) => c + 1),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const loading = loadCount < 3;

  return (
    <SiteContentContext.Provider value={{ home, nav, footer, loading }}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContentContext() {
  return useContext(SiteContentContext);
}
