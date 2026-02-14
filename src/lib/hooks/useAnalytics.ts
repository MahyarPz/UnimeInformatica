'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  collectionGroup,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { AnalyticsDaily, AnalyticsCourseDaily, AnalyticsTimeRange } from '@/lib/types';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';

// ─── Date helpers ───────────────────────────────────────────
function getDateRange(range: AnalyticsTimeRange, customStart?: Date, customEnd?: Date) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  let start: Date;
  switch (range) {
    case '7d':
      start = subDays(end, 6);
      break;
    case '30d':
      start = subDays(end, 29);
      break;
    case '90d':
      start = subDays(end, 89);
      break;
    case 'custom':
      start = customStart || subDays(end, 29);
      if (customEnd) {
        end.setTime(customEnd.getTime());
        end.setHours(23, 59, 59, 999);
      }
      break;
    default:
      start = subDays(end, 29);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function dateToKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

// ─── Empty daily doc ────────────────────────────────────────
function emptyDaily(date: string): AnalyticsDaily {
  return {
    date,
    dau: 0,
    wau: 0,
    signups: 0,
    practiceSessionsStarted: 0,
    questionsAnswered: 0,
    aiRequests: 0,
    aiBlocked: 0,
    donationRequestsSubmitted: 0,
    donationRequestsApproved: 0,
    activeSupporter: 0,
    activePro: 0,
    updatedAt: null,
  };
}

// ─── Main analytics data hook ───────────────────────────────
export function useAnalyticsDaily(
  range: AnalyticsTimeRange,
  customStart?: Date,
  customEnd?: Date,
) {
  const [data, setData] = useState<AnalyticsDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end } = useMemo(
    () => getDateRange(range, customStart, customEnd),
    [range, customStart?.getTime(), customEnd?.getTime()],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);

    const startKey = dateToKey(start);
    const endKey = dateToKey(end);

    const q = query(
      collection(db, 'analytics_daily'),
      where('date', '>=', startKey),
      where('date', '<=', endKey),
      orderBy('date', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docsMap = new Map<string, AnalyticsDaily>();
        snap.docs.forEach((d) => {
          const raw = d.data();
          docsMap.set(d.id, {
            date: d.id,
            dau: raw.dau || 0,
            wau: raw.wau || 0,
            signups: raw.signups || 0,
            practiceSessionsStarted: raw.practiceSessionsStarted || 0,
            questionsAnswered: raw.questionsAnswered || 0,
            aiRequests: raw.aiRequests || 0,
            aiBlocked: raw.aiBlocked || 0,
            donationRequestsSubmitted: raw.donationRequestsSubmitted || 0,
            donationRequestsApproved: raw.donationRequestsApproved || 0,
            activeSupporter: raw.activeSupporter || 0,
            activePro: raw.activePro || 0,
            updatedAt: raw.updatedAt,
          });
        });

        // Fill in missing days with zeros
        const allDays = eachDayOfInterval({ start, end });
        const filled = allDays.map((d) => {
          const key = dateToKey(d);
          return docsMap.get(key) || emptyDaily(key);
        });

        setData(filled);
        setLoading(false);
      },
      (err) => {
        console.error('Analytics daily query error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [start.getTime(), end.getTime()]);

  return { data, loading, error };
}

// ─── KPI computation ────────────────────────────────────────
export interface AnalyticsKPIs {
  dau: number;
  dauChange: number;
  wau: number;
  wauChange: number;
  signups: number;
  signupsChange: number;
  practiceSessions: number;
  practiceSessionsChange: number;
  questionsAnswered: number;
  questionsAnsweredChange: number;
  aiRequests: number;
  aiRequestsChange: number;
  aiBlocked: number;
  aiBlockedChange: number;
  donationsPending: number;
  donationsApproved: number;
  activeSupporter: number;
  activePro: number;
  paidUsersChange: number;
}

export function useAnalyticsKPIs(data: AnalyticsDaily[]): AnalyticsKPIs {
  return useMemo(() => {
    if (data.length === 0) {
      return {
        dau: 0, dauChange: 0,
        wau: 0, wauChange: 0,
        signups: 0, signupsChange: 0,
        practiceSessions: 0, practiceSessionsChange: 0,
        questionsAnswered: 0, questionsAnsweredChange: 0,
        aiRequests: 0, aiRequestsChange: 0,
        aiBlocked: 0, aiBlockedChange: 0,
        donationsPending: 0, donationsApproved: 0,
        activeSupporter: 0, activePro: 0, paidUsersChange: 0,
      };
    }

    const half = Math.floor(data.length / 2);
    const current = data.slice(half);
    const previous = data.slice(0, half);

    const sum = (arr: AnalyticsDaily[], key: keyof AnalyticsDaily) =>
      arr.reduce((s, d) => s + ((d[key] as number) || 0), 0);

    const last = (arr: AnalyticsDaily[], key: keyof AnalyticsDaily) =>
      arr.length > 0 ? ((arr[arr.length - 1][key] as number) || 0) : 0;

    const pctChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const curSignups = sum(current, 'signups');
    const prevSignups = sum(previous, 'signups');
    const curSessions = sum(current, 'practiceSessionsStarted');
    const prevSessions = sum(previous, 'practiceSessionsStarted');
    const curQA = sum(current, 'questionsAnswered');
    const prevQA = sum(previous, 'questionsAnswered');
    const curAI = sum(current, 'aiRequests');
    const prevAI = sum(previous, 'aiRequests');
    const curAIBlocked = sum(current, 'aiBlocked');
    const prevAIBlocked = sum(previous, 'aiBlocked');
    const curDAU = last(current, 'dau');
    const prevDAU = last(previous, 'dau');
    const curWAU = last(current, 'wau');
    const prevWAU = last(previous, 'wau');

    const latestDoc = data[data.length - 1];
    const curPaid = (latestDoc.activeSupporter || 0) + (latestDoc.activePro || 0);
    const midDoc = data[half] || data[0];
    const prevPaid = (midDoc.activeSupporter || 0) + (midDoc.activePro || 0);

    return {
      dau: curDAU,
      dauChange: pctChange(curDAU, prevDAU),
      wau: curWAU,
      wauChange: pctChange(curWAU, prevWAU),
      signups: curSignups,
      signupsChange: pctChange(curSignups, prevSignups),
      practiceSessions: curSessions,
      practiceSessionsChange: pctChange(curSessions, prevSessions),
      questionsAnswered: curQA,
      questionsAnsweredChange: pctChange(curQA, prevQA),
      aiRequests: curAI,
      aiRequestsChange: pctChange(curAI, prevAI),
      aiBlocked: curAIBlocked,
      aiBlockedChange: pctChange(curAIBlocked, prevAIBlocked),
      donationsPending: sum(current, 'donationRequestsSubmitted'),
      donationsApproved: sum(current, 'donationRequestsApproved'),
      activeSupporter: latestDoc.activeSupporter || 0,
      activePro: latestDoc.activePro || 0,
      paidUsersChange: pctChange(curPaid, prevPaid),
    };
  }, [data]);
}

// ─── Top Courses hook ───────────────────────────────────────
export interface TopCourseRow {
  courseId: string;
  courseTitle: string;
  sessions: number;
  uniqueUsers: number;
  questionsAnswered: number;
  correctAnswers: number;
  wrongRate: number;
}

export function useTopCourses(
  range: AnalyticsTimeRange,
  customStart?: Date,
  customEnd?: Date,
) {
  const [data, setData] = useState<TopCourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { start, end } = useMemo(
    () => getDateRange(range, customStart, customEnd),
    [range, customStart?.getTime(), customEnd?.getTime()],
  );

  useEffect(() => {
    setLoading(true);

    async function fetch() {
      try {
        const allDays = eachDayOfInterval({ start, end });
        const courseAgg = new Map<string, TopCourseRow>();

        // Query each day's courses subcollection
        for (const day of allDays) {
          const dayKey = dateToKey(day);
          const coursesSnap = await getDocs(
            collection(db, `analytics_courses_daily/${dayKey}/courses`),
          );
          coursesSnap.docs.forEach((d) => {
            const raw = d.data();
            const existing = courseAgg.get(d.id);
            if (existing) {
              existing.sessions += raw.sessions || 0;
              existing.uniqueUsers += raw.uniqueUsers || 0;
              existing.questionsAnswered += raw.questionsAnswered || 0;
              existing.correctAnswers += raw.correctAnswers || 0;
            } else {
              courseAgg.set(d.id, {
                courseId: d.id,
                courseTitle: raw.courseTitle || d.id,
                sessions: raw.sessions || 0,
                uniqueUsers: raw.uniqueUsers || 0,
                questionsAnswered: raw.questionsAnswered || 0,
                correctAnswers: raw.correctAnswers || 0,
                wrongRate: 0,
              });
            }
          });
        }

        // Compute wrong rate
        const rows = Array.from(courseAgg.values()).map((r) => ({
          ...r,
          wrongRate:
            r.questionsAnswered > 0
              ? Math.round(((r.questionsAnswered - r.correctAnswers) / r.questionsAnswered) * 100)
              : 0,
        }));

        rows.sort((a, b) => b.sessions - a.sessions);
        setData(rows.slice(0, 20));
      } catch (err) {
        console.error('Top courses fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [start.getTime(), end.getTime()]);

  return { data, loading };
}

// ─── Top Users hook ─────────────────────────────────────────
export interface TopUserRow {
  uid: string;
  username: string;
  email: string;
  sessions: number;
  aiRequests: number;
  lastActive: string;
  plan: string;
}

export function useTopUsers() {
  const [data, setData] = useState<TopUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    async function fetch() {
      try {
        // Get user_stats sorted by totalSessions (top 50)
        const statsSnap = await getDocs(
          query(collection(db, 'user_stats'), orderBy('totalSessions', 'desc')),
        );

        const topDocs = statsSnap.docs.slice(0, 50);

        // Batch-fetch user profiles and AI usage counts
        const rows: TopUserRow[] = await Promise.all(
          topDocs.map(async (d) => {
            const stats = d.data();
            const uid = d.id;

            // Fetch user profile and AI usage in parallel
            const [userSnap, aiUsageSnap] = await Promise.all([
              getDoc(doc(db, 'users', uid)),
              getDocs(
                query(
                  collection(db, 'ai_usage_daily'),
                  where('__name__', '>=', `${uid}_`),
                  where('__name__', '<=', `${uid}_\uf8ff`),
                ),
              ),
            ]);

            const user = userSnap.exists() ? userSnap.data() : null;
            const totalAI = aiUsageSnap.docs.reduce(
              (sum, aiDoc) => sum + ((aiDoc.data().count as number) || 0),
              0,
            );

            return {
              uid,
              username: user?.username || uid,
              email: user?.email || '',
              sessions: stats.totalSessions || 0,
              aiRequests: totalAI,
              lastActive: user?.lastLoginAt
                ? (user.lastLoginAt.toDate ? format(user.lastLoginAt.toDate(), 'yyyy-MM-dd HH:mm') : '')
                : '',
              plan: user?.plan || 'free',
            };
          }),
        );

        setData(rows);
      } catch (err) {
        console.error('Top users fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, []);

  return { data, loading };
}

// ─── Recent Audit Logs hook ─────────────────────────────────
export interface AuditLogEntry {
  id: string;
  action: string;
  category: string;
  actorUsername: string;
  targetId?: string;
  details?: Record<string, any>;
  timestamp: any;
}

export function useRecentAuditLogs(limit = 50) {
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const q = query(
      collection(db, 'audit_log'),
      orderBy('timestamp', 'desc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.slice(0, limit).map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AuditLogEntry, 'id'>),
      }));
      setData(logs);
      setLoading(false);
    }, (err) => {
      console.error('Audit logs error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [limit]);

  return { data, loading };
}

// ─── CSV Export helpers ─────────────────────────────────────
export function exportDailyCSV(data: AnalyticsDaily[], filename: string) {
  const headers = [
    'date', 'dau', 'wau', 'signups', 'practiceSessionsStarted',
    'questionsAnswered', 'aiRequests', 'aiBlocked',
    'donationRequestsSubmitted', 'donationRequestsApproved',
    'activeSupporter', 'activePro',
  ];

  const rows = data.map((d) =>
    headers.map((h) => String((d as any)[h] ?? 0)).join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(csv, filename);
}

export function exportTopCoursesCSV(data: TopCourseRow[]) {
  const headers = ['courseId', 'courseTitle', 'sessions', 'uniqueUsers', 'questionsAnswered', 'correctAnswers', 'wrongRate'];
  const rows = data.map((d) =>
    headers.map((h) => String((d as any)[h] ?? '')).join(','),
  );
  downloadCSV([headers.join(','), ...rows].join('\n'), 'top_courses.csv');
}

export function exportTopUsersCSV(data: TopUserRow[]) {
  const headers = ['username', 'email', 'sessions', 'aiRequests', 'lastActive', 'plan'];
  const rows = data.map((d) =>
    headers.map((h) => String((d as any)[h] ?? '')).join(','),
  );
  downloadCSV([headers.join(','), ...rows].join('\n'), 'top_users.csv');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
