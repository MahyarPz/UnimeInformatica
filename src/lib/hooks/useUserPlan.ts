'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserPlan, UserPlanTier } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { handleFirebaseError } from '@/lib/utils/session';

/**
 * Hook to load the current user's plan from user_plans/{uid}.
 * Falls back to 'free' if missing, expired, or revoked.
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

          // If status is revoked or expired, treat as free
          if (data.status === 'revoked' || data.status === 'expired') {
            setEffectiveTier('free');
          } else {
            // Check expiry (endsAt or legacy expiresAt)
            const expiryField = data.endsAt ?? data.expiresAt;
            if (expiryField) {
              const expiryDate = expiryField.toDate ? expiryField.toDate() : new Date(expiryField);
              if (expiryDate < new Date()) {
                setEffectiveTier('free');
              } else {
                setEffectiveTier(data.plan);
              }
            } else {
              // null = lifetime
              setEffectiveTier(data.plan);
            }
          }
        } else {
          setPlan(null);
          setEffectiveTier('free');
        }
        setLoading(false);
      },
      (error) => {
        if (handleFirebaseError(error)) return;
        setPlan(null);
        setEffectiveTier('free');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  return { plan, effectiveTier, loading };
}
