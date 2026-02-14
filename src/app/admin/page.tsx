'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getCountFromServer, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineUsers } from '@/lib/hooks/useOnlineUsers';
import { useActivityFeed } from '@/lib/hooks/useActivityFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  BookOpen,
  MessageSquare,
  FileText,
  Activity,
  Wifi,
  Clock,
  Eye,
  Loader2,
  TrendingUp,
  ClipboardCheck,
  FlaskConical,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import { handleFirebaseError } from '@/lib/utils/session';
import { timeAgo } from '@/lib/utils';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { claims } = useAuth();
  const { onlineUsers, recentUsers, loading: presenceLoading } = useOnlineUsers();
  const [activityCategory, setActivityCategory] = useState('all');
  const { events, loading: eventsLoading } = useActivityFeed(20, activityCategory);

  // KPI counts
  const [counts, setCounts] = useState({
    users: 0,
    courses: 0,
    questions: 0,
    notes: 0,
    sessions: 0,
    reviewQueue: 0,
    labs: 0,
  });

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [usersSnap, coursesSnap, questionsSnap, notesSnap, reviewSnap, labsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'courses'), where('active', '==', true))),
          getCountFromServer(collection(db, 'questions_public')),
          getCountFromServer(query(collection(db, 'notes'), where('isPublic', '==', true))),
          getCountFromServer(query(collection(db, 'review_queue'), where('status', '==', 'pending'))),
          getCountFromServer(query(collection(db, 'labs'), where('active', '==', true))),
        ]);
        setCounts({
          users: usersSnap.data().count,
          courses: coursesSnap.data().count,
          questions: questionsSnap.data().count,
          notes: notesSnap.data().count,
          sessions: 0,
          reviewQueue: reviewSnap.data().count,
          labs: labsSnap.data().count,
        });
      } catch (e) {
        // Collections may not exist yet
        handleFirebaseError(e);
      }
    };
    loadCounts();
  }, []);

  const kpis = [
    { label: 'Total Users', value: counts.users, icon: Users, color: 'text-blue-600' },
    { label: 'Active Courses', value: counts.courses, icon: BookOpen, color: 'text-green-600' },
    { label: 'Public Questions', value: counts.questions, icon: MessageSquare, color: 'text-purple-600' },
    { label: 'Public Notes', value: counts.notes, icon: FileText, color: 'text-orange-600' },
    { label: 'Review Queue', value: counts.reviewQueue, icon: ClipboardCheck, color: 'text-red-600', href: '/admin/review-queue' },
    { label: 'Active Labs', value: counts.labs, icon: FlaskConical, color: 'text-indigo-600' },
  ];

  const eventCategoryIcons: Record<string, string> = {
    auth: '🔐',
    practice: '⚡',
    labs: '🧪',
    notes: '📝',
    questions: '❓',
    feedback: '📣',
    admin: '🛡️',
    monetization: '💰',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('admin.dashboard')}</h1>
        <p className="text-muted-foreground">Overview of your platform</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="hover:shadow-sm transition-shadow">
            {kpi.href ? (
              <Link href={kpi.href}>
                <CardContent className="pt-4 pb-3">
                  <kpi.icon className={`h-5 w-5 ${kpi.color} mb-1`} />
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </CardContent>
              </Link>
            ) : (
              <CardContent className="pt-4 pb-3">
                <kpi.icon className={`h-5 w-5 ${kpi.color} mb-1`} />
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Online Users / Presence */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wifi className="h-5 w-5 text-green-500" />
              {t('admin.onlineNow')} ({onlineUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 mb-4">
              {onlineUsers.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No users currently online.</p>
              )}
              {onlineUsers.map((u) => (
                <div key={u.uid} className="flex items-center justify-between py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="font-medium">@{u.username}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{u.currentPath || '/'}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t('admin.activeLast2Min')}: <strong>{recentUsers.length}</strong>
              </div>
              {recentUsers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {recentUsers.filter((u) => u.state !== 'online').map((u) => (
                    <div key={u.uid} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      @{u.username}
                      <span>({new Date(u.lastActive).toLocaleTimeString()})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Live Activity Feed
              </CardTitle>
              <Select value={activityCategory} onValueChange={setActivityCategory}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="practice">Practice</SelectItem>
                  <SelectItem value="labs">Labs</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="questions">Questions</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No recent activity.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <span className="text-lg">{eventCategoryIcons[event.category] || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">@{event.actorUsername}</span>
                          <span className="text-muted-foreground"> {event.type.replace(/_/g, ' ')}</span>
                        </p>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {JSON.stringify(event.metadata).substring(0, 80)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(event.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
