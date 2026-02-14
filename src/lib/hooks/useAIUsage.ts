'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { AIUsageDaily } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { handleFirebaseError } from '@/lib/utils/session';

/**
 * Get the Europe/Rome date key (YYYYMMDD) for today.
 */
export function getRomeDateKey(): string {
  const now = new Date();
  const rome = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // "2026-02-12"
  return rome.replace(/-/g, '');
}

/**
 * Hook to listen to today's AI usage for the current user.
 */
export function useAIUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<AIUsageDaily | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUsage(null);
      setLoading(false);
      return;
    }

    const dateKey = getRomeDateKey();
    const docId = `${user.uid}_${dateKey}`;

    const unsub = onSnapshot(
      doc(db, 'ai_usage_daily', docId),
      (snap) => {
        if (snap.exists()) {
          setUsage(snap.data() as AIUsageDaily);
        } else {
          setUsage(null);
        }
        setLoading(false);
      },
      (error) => {
        if (handleFirebaseError(error)) return;
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user]);

  const remaining = usage ? Math.max(0, usage.limit - usage.count) : null;
  const count = usage?.count ?? 0;
  const limit = usage?.limit ?? 0;

  return { usage, remaining, count, limit, loading };
}
