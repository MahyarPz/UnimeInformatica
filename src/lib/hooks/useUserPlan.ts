'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserPlan, UserPlanTier } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to load the current user's plan from user_plans/{uid}.
 * Falls back to 'free' if missing or expired.
 */
export function useUserPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [effectiveTier, setEffectiveTier] = useState<UserPlanTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlan(null);
      setEffectiveTier('free');
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'user_plans', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserPlan;
          setPlan(data);

          // Check expiry
          if (data.expiresAt) {
            const expiryDate = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
            if (expiryDate < new Date()) {
              setEffectiveTier('free');
            } else {
              setEffectiveTier(data.plan);
            }
          } else {
            // null expiresAt = lifetime
            setEffectiveTier(data.plan);
          }
        } else {
          setPlan(null);
          setEffectiveTier('free');
        }
        setLoading(false);
      },
      () => {
        setPlan(null);
        setEffectiveTier('free');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  return { plan, effectiveTier, loading };
}
