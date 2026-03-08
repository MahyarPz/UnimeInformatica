'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  doc, collection, query, where, orderBy, limit, onSnapshot,
  getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, functions, httpsCallable } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import type {
  GamificationUserStats, UserCourseStats, LeaderboardEntry,
  CourseLeaderboardEntry, SeasonLeaderboardEntry, LeaderboardConfig,
  StudyActivityDay, Season, UserAchievement, AppNotification,
  Challenge, UserChallenge, UserPrivacySettings,
} from '@/lib/types';
import { DEFAULT_PRIVACY_SETTINGS, DEFAULT_LEADERBOARD_CONFIG } from '@/lib/types';

// ─── useUserGamificationStats ────────────────────────────
export function useUserGamificationStats(uid?: string) {
  const [stats, setStats] = useState<GamificationUserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'user_stats', uid), (snap) => {
      if (snap.exists()) {
        setStats({ uid, ...snap.data() } as GamificationUserStats);
      } else {
        setStats(null);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  return { stats, loading };
}

// ─── useLeaderboard ──────────────────────────────────────
export type LeaderboardType = 'weekly' | 'alltime' | 'season';
export type LeaderboardScope = 'global' | 'course';

export function useLeaderboard(
  type: LeaderboardType,
  scope: LeaderboardScope,
  courseId?: string,
  weeklyKey?: string,
  seasonKey?: string,
  maxEntries = 50,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let collectionPath = '';

    if (type === 'season' && seasonKey) {
      collectionPath = `season_leaderboard/${seasonKey}/entries`;
    } else if (type === 'weekly') {
      const wk = weeklyKey || getCurrentWeeklyKey();
      if (scope === 'global') {
        collectionPath = `leaderboard_weekly_global/${wk}/entries`;
      } else if (courseId) {
        collectionPath = `leaderboard_weekly_course/${wk}_${courseId}/entries`;
      }
    } else if (type === 'alltime') {
      if (scope === 'global') {
        collectionPath = 'leaderboard_alltime_global/entries';
      } else if (courseId) {
        collectionPath = `leaderboard_alltime_course/${courseId}/entries`;
      }
    }

    if (!collectionPath) { setLoading(false); return; }

    const xpField = type === 'season' ? 'seasonXp' : 'xp';
    const q = query(
      collection(db, collectionPath),
      orderBy(xpField, 'desc'),
      limit(maxEntries),
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d, i) => ({
        ...d.data(),
        uid: d.id,
        rank: i + 1,
      })) as unknown as LeaderboardEntry[];
      setEntries(data);
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [type, scope, courseId, weeklyKey, seasonKey, maxEntries]);

  return { entries, loading };
}

// ─── useUserRank ─────────────────────────────────────────
export function useUserRank(uid?: string, type: LeaderboardType = 'weekly', courseId?: string) {
  const { entries } = useLeaderboard(type, courseId ? 'course' : 'global', courseId, undefined, undefined, 200);
  const rank = uid ? entries.findIndex(e => e.uid === uid) + 1 : 0;
  const userEntry = uid ? entries.find(e => e.uid === uid) : null;
  const nextEntry = rank > 1 ? entries[rank - 2] : null;
  const xpToNext = nextEntry && userEntry ? (nextEntry.xp - userEntry.xp) : 0;

  return { rank: rank || null, xp: userEntry?.xp || 0, xpToNext, totalEntries: entries.length };
}

// ─── useLeaderboardConfig ────────────────────────────────
export function useLeaderboardConfig() {
  const [config, setConfig] = useState<LeaderboardConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'leaderboard_config', 'singleton'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as LeaderboardConfig);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const updateConfig = useCallback(async (updates: Partial<LeaderboardConfig>) => {
    const fn = httpsCallable(functions, 'adminUpdateLeaderboardConfig');
    await fn(updates);
  }, []);

  return { config: config || DEFAULT_LEADERBOARD_CONFIG, loading, updateConfig };
}

// ─── useStudyHeatmap ─────────────────────────────────────
export function useStudyHeatmap(uid?: string, days = 180) {
  const [data, setData] = useState<StudyActivityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const q = query(
      collection(db, `study_activity_daily/${uid}/days`),
      where('date', '>=', cutoffStr),
      orderBy('date', 'asc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(d => d.data() as StudyActivityDay));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [uid, days]);

  return { data, loading };
}

// ─── useAchievements ─────────────────────────────────────
export function useAchievements(uid?: string) {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, `users/${uid}/achievements`),
      (snap) => {
        setAchievements(snap.docs.map(d => d.data() as UserAchievement));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  return { achievements, loading };
}

// ─── useNotifications ────────────────────────────────────
export function useNotifications(uid?: string, maxCount = 20) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(maxCount),
    );

    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [uid, maxCount]);

  const markRead = useCallback(async (notifId: string) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
  }, [notifications]);

  return { notifications, unreadCount, loading, markRead, markAllRead };
}

// ─── useActiveSeason ─────────────────────────────────────
export function useActiveSeason() {
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'seasons'),
      where('active', '==', true),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setSeason(snap.docs[0].data() as Season);
      } else {
        setSeason(null);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const manageSeason = useCallback(async (action: string, data?: any) => {
    const fn = httpsCallable(functions, 'adminManageSeason');
    await fn({ action, ...data });
  }, []);

  return { season, loading, manageSeason };
}

// ─── useLiveFeed ─────────────────────────────────────────
export function useLiveFeed(maxItems = 10) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'activity_events'),
      where('visibility', '==', 'public'),
      orderBy('timestamp', 'desc'),
      limit(maxItems),
    );

    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return unsub;
  }, [maxItems]);

  return { events };
}

// ─── usePrivacySettings ──────────────────────────────────
export function usePrivacySettings(uid?: string) {
  const [settings, setSettings] = useState<UserPrivacySettings>({
    publicProfile: true,
    showOnLeaderboard: true,
    showInLiveFeed: true,
    allowFriendRequests: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'user_privacy', uid), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as UserPrivacySettings);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  const updateSettings = useCallback(async (updates: Partial<UserPrivacySettings>) => {
    if (!uid) return;
    await setDoc(doc(db, 'user_privacy', uid), {
      ...settings,
      ...updates,
    }, { merge: true });
  }, [uid, settings]);

  return { settings, loading, updateSettings };
}

// ─── useFriends ──────────────────────────────────────────
export function useFriends(uid?: string) {
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    // Accepted friendships where user is either from or to
    const q1 = query(
      collection(db, 'friendships'),
      where('fromUid', '==', uid),
      where('status', '==', 'accepted'),
    );
    const q2 = query(
      collection(db, 'friendships'),
      where('toUid', '==', uid),
      where('status', '==', 'accepted'),
    );
    const q3 = query(
      collection(db, 'friendships'),
      where('toUid', '==', uid),
      where('status', '==', 'pending'),
    );
    const q4 = query(
      collection(db, 'friendships'),
      where('fromUid', '==', uid),
      where('status', '==', 'pending'),
    );

    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(q1, (snap) => {
      const accepted1 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFriends(prev => {
        const other = prev.filter((f: any) => !accepted1.find((a: any) => a.id === f.id));
        return [...other, ...accepted1];
      });
    }));

    unsubs.push(onSnapshot(q2, (snap) => {
      const accepted2 = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFriends(prev => {
        const other = prev.filter((f: any) => !accepted2.find((a: any) => a.id === f.id));
        return [...other, ...accepted2];
      });
      setLoading(false);
    }));

    unsubs.push(onSnapshot(q3, (snap) => {
      setPendingReceived(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    unsubs.push(onSnapshot(q4, (snap) => {
      setPendingSent(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    return () => unsubs.forEach(u => u());
  }, [uid]);

  const sendRequest = useCallback(async (toUid: string, toUsername: string, fromUsername: string) => {
    if (!uid) return;
    await setDoc(doc(collection(db, 'friendships')), {
      fromUid: uid,
      fromUsername: fromUsername,
      toUid,
      toUsername,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [uid]);

  const acceptRequest = useCallback(async (friendshipId: string) => {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  }, []);

  const rejectRequest = useCallback(async (friendshipId: string) => {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  }, []);

  const removeFriend = useCallback(async (friendshipId: string) => {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  }, []);

  return { friends, pendingReceived, pendingSent, loading, sendRequest, acceptRequest, rejectRequest, removeFriend };
}

// ─── useChallenges ───────────────────────────────────────
export function useChallenges(uid?: string) {
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState<Challenge | null>(null);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get active daily challenge
    const now = Timestamp.now();
    const qDaily = query(
      collection(db, 'challenges'),
      where('type', '==', 'daily'),
      orderBy('startsAt', 'desc'),
      limit(1),
    );
    const qWeekly = query(
      collection(db, 'challenges'),
      where('type', '==', 'weekly'),
      orderBy('startsAt', 'desc'),
      limit(1),
    );

    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(qDaily, (snap) => {
      if (!snap.empty) setDailyChallenge({ id: snap.docs[0].id, ...snap.docs[0].data() } as Challenge);
    }));
    unsubs.push(onSnapshot(qWeekly, (snap) => {
      if (!snap.empty) setWeeklyChallenge({ id: snap.docs[0].id, ...snap.docs[0].data() } as Challenge);
    }));

    if (uid) {
      const qUser = query(
        collection(db, 'user_challenges'),
        where('uid', '==', uid),
        orderBy('startedAt', 'desc'),
        limit(10),
      );
      unsubs.push(onSnapshot(qUser, (snap) => {
        setUserChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserChallenge)));
        setLoading(false);
      }));
    } else {
      setLoading(false);
    }

    return () => unsubs.forEach(u => u());
  }, [uid]);

  return { dailyChallenge, weeklyChallenge, userChallenges, loading };
}

// ─── XP Functions (callable) ─────────────────────────────
export function useGamificationActions() {
  const awardPracticeXp = useCallback(async (params: {
    uid: string;
    courseId: string;
    topicId?: string;
    correctCount: number;
    wrongCount: number;
    sessionId?: string;
    durationSec?: number;
  }) => {
    const fn = httpsCallable(functions, 'awardXpForPracticeSession');
    const result = await fn(params);
    return result.data as any;
  }, []);

  const awardLabXp = useCallback(async (params: {
    uid: string;
    courseId: string;
    labId: string;
  }) => {
    const fn = httpsCallable(functions, 'awardXpForLabCompletion');
    const result = await fn(params);
    return result.data as any;
  }, []);

  const callUpdateStreak = useCallback(async () => {
    const fn = httpsCallable(functions, 'updateStreak');
    const result = await fn({});
    return result.data as any;
  }, []);

  const adminForceWeeklyReset = useCallback(async () => {
    const fn = httpsCallable(functions, 'adminForceWeeklyReset');
    await fn({});
  }, []);

  const adminLeaderboardBan = useCallback(async (uid: string, reason = 'Manual ban') => {
    const fn = httpsCallable(functions, 'adminLeaderboardBan');
    await fn({ uid, reason });
  }, []);

  return { awardPracticeXp, awardLabXp, callUpdateStreak, adminForceWeeklyReset, adminLeaderboardBan };
}

// ─── Helper ──────────────────────────────────────────────
function getCurrentWeeklyKey(): string {
  const d = new Date();
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - yearStart.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + yearStart.getDay()) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
