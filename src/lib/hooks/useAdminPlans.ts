'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, getDocs, where,
  limit as firestoreLimit, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { auth } from '@/lib/firebase/config';
import {
  UserProfile, UserPlan, PlanHistoryEntry, UserPlanTier, UserPlanStatus, UserPlanSource,
} from '@/lib/types';
import { apiFetch } from '@/lib/utils/api';
import { handleFirebaseError } from '@/lib/utils/session';

// ─── API helper ───────────────────────────────────────────
async function callPlanApi(body: Record<string, any>) {
  const res = await apiFetch('/api/admin/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.data?.error || 'Request failed');
  return res.data;
}

export interface SetUserPlanParams {
  targetUid: string;
  plan: UserPlanTier;
  status?: UserPlanStatus;
  endsAt?: string | null;
  reason?: string;
  source?: UserPlanSource;
}

export async function adminSetUserPlan(params: SetUserPlanParams) {
  return callPlanApi({ action: 'setPlan', ...params }) as Promise<{ success: boolean; plan: string; status: string; endsAt: string | null }>;
}

export async function adminRevokeUserPlan(targetUid: string, reason?: string) {
  return callPlanApi({ action: 'revokePlan', targetUid, reason }) as Promise<{ success: boolean }>;
}

export async function adminSetAIOverrides(targetUid: string, overrides: {
  bonusTokens?: number;
  aiBanned?: boolean;
  aiQuotaOverride?: number | null;
}) {
  return callPlanApi({ action: 'setAIOverrides', targetUid, ...overrides }) as Promise<{ success: boolean }>;
}

// ─── KPI stats ────────────────────────────────────────────
export interface PlanKPIStats {
  activePro: number;
  activeSupporter: number;
  totalPaid: number;
  totalFree: number;
  totalRevoked: number;
  totalExpired: number;
}

// ─── Hook: useAdminPlans ──────────────────────────────────
// Loads all users with plan info for the admin table
export function useAdminPlans() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to ALL users (admin page — already existing pattern in Users page)
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers(list);
      setLoading(false);
    }, (err) => { handleFirebaseError(err); setLoading(false); });
    return () => unsub();
  }, []);

  // Compute KPI from users array (denormalized plan fields)
  const kpi: PlanKPIStats = {
    activePro: users.filter((u) => u.plan === 'pro' && u.planStatus === 'active').length,
    activeSupporter: users.filter((u) => u.plan === 'supporter' && u.planStatus === 'active').length,
    totalPaid: users.filter((u) => (u.plan === 'pro' || u.plan === 'supporter') && u.planStatus === 'active').length,
    totalFree: users.filter((u) => !u.plan || u.plan === 'free').length,
    totalRevoked: users.filter((u) => u.planStatus === 'revoked').length,
    totalExpired: users.filter((u) => u.planStatus === 'expired').length,
  };

  return { users, loading, kpi };
}

// ─── Hook: usePlanHistory ─────────────────────────────────
// Loads plan history for a specific user
export function usePlanHistory(uid: string | null) {
  const [history, setHistory] = useState<PlanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) {
      setHistory([]);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, `user_plans/${uid}/history`),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlanHistoryEntry)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  return { history, loading };
}

// ─── Hook: useUserPlanDoc ─────────────────────────────────
// Loads single user_plans doc for plan details drawer
export function useUserPlanDoc(uid: string | null) {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) { setPlan(null); return; }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'user_plans', uid), (snap) => {
      setPlan(snap.exists() ? (snap.data() as UserPlan) : null);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  return { plan, loading };
}

// ─── CSV export helper ────────────────────────────────────
export function exportUsersToCSV(users: UserProfile[]) {
  const headers = ['Username', 'Email', 'Role', 'Plan', 'Status', 'Source', 'Ends At', 'Updated At'];
  const rows = users.map((u) => [
    u.username,
    u.email,
    u.role,
    u.plan || 'free',
    u.planStatus || 'active',
    u.planSource || '-',
    u.planEndsAt ? (u.planEndsAt.toDate ? u.planEndsAt.toDate().toISOString() : String(u.planEndsAt)) : 'Lifetime',
    u.planUpdatedAt ? (u.planUpdatedAt.toDate ? u.planUpdatedAt.toDate().toISOString() : String(u.planUpdatedAt)) : '-',
  ]);

  const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `user_plans_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
