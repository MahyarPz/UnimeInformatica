'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen, MessageSquare, FileText, BarChart3, FlaskConical, Target, Settings,
  Clock, Plus, Send, Edit, Loader2, Flame, Zap, Trophy, Star, Bell,
  Play, ArrowRight, TrendingUp, Award,
  BrainCircuit, Rocket, ChevronRight, Activity,
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useCourses } from '@/lib/hooks/useCourses';
import {
  useUserGamificationStats, useAchievements, useNotifications,
  useLiveFeed, useActiveSeason, useChallenges, usePrivacySettings,
  useGamificationActions,
} from '@/lib/hooks/useGamification';
import { StudyHeatmap } from '@/components/dashboard/StudyHeatmap';
import { Question, Note, ExamSession, ACHIEVEMENT_DEFINITIONS } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { handleFirebaseError } from '@/lib/utils/session';
import { t } from '@/lib/i18n';

// ─── Level XP calculator ─────────────────────────────────
function xpForLevel(level: number, base = 100, growth = 25): number {
  return Math.floor(base + growth * level * level);
}

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const { courses } = useCourses();

  // Gamification hooks
  const { stats } = useUserGamificationStats(user?.uid);
  const { achievements } = useAchievements(user?.uid);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(user?.uid);
  const { events: liveFeed } = useLiveFeed(10);
  const { season } = useActiveSeason();
  const { dailyChallenge, weeklyChallenge } = useChallenges(user?.uid);
  const { settings: privacySettings, updateSettings: updatePrivacy } = usePrivacySettings(user?.uid);
  const { callUpdateStreak } = useGamificationActions();

  // Existing data
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [myQuestions, setMyQuestions] = useState<Question[]>([]);
  const [myNotes, setMyNotes] = useState<Note[]>([]);

  // Update streak on dashboard load
  useEffect(() => {
    if (user) { callUpdateStreak().catch(() => {}); }
  }, [user, callUpdateStreak]);

  useEffect(() => {
    if (!user) return;
    const sessionsQ = query(collection(db, 'exam_sessions'), where('userId', '==', user.uid), orderBy('startedAt', 'desc'));
    const unsubSessions = onSnapshot(sessionsQ, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamSession)));
    }, (err) => { console.error('exam_sessions:', err); handleFirebaseError(err); });

    const questionsQ = query(collection(db, 'questions_private'), where('creatorId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubQuestions = onSnapshot(questionsQ, (snap) => {
      setMyQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
    }, (err) => handleFirebaseError(err));

    const notesQ = query(collection(db, 'notes'), where('creatorId', '==', user.uid), where('isPublic', '==', false), orderBy('createdAt', 'desc'));
    const unsubNotes = onSnapshot(notesQ, (snap) => {
      setMyNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note)));
    }, (err) => handleFirebaseError(err));

    return () => { unsubSessions(); unsubQuestions(); unsubNotes(); };
  }, [user]);

  // Derived data
  const lastSession = sessions.find(s => s.status === 'in_progress') || sessions[0];
  const weakTopics = useMemo(() => {
    const topicAcc: Record<string, { correct: number; total: number; courseId: string }> = {};
    for (const s of sessions) {
      if (s.status !== 'completed' || !s.answers) continue;
      const key = s.courseId;
      if (!topicAcc[key]) topicAcc[key] = { correct: 0, total: 0, courseId: s.courseId };
      for (const a of Object.values(s.answers)) {
        topicAcc[key].total++;
        if ((a as any).isCorrect) topicAcc[key].correct++;
      }
    }
    return Object.values(topicAcc)
      .filter(t => t.total >= 3)
      .map(t => ({ ...t, accuracy: (t.correct / t.total) * 100 }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);
  }, [sessions]);

  const earnedIds = new Set(achievements.map(a => a.id));
  const achievementDefs = ACHIEVEMENT_DEFINITIONS;
  const levelXpRequired = stats ? xpForLevel(stats.level) : 100;
  const levelProgress = stats ? Math.min(100, (stats.levelXp / levelXpRequired) * 100) : 0;

  if (authLoading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user || !userProfile) { router.push('/login'); return null; }

  const createPrivateQuestion = async (data: any) => {
    try {
      await addDoc(collection(db, 'questions_private'), {
        ...data, creatorId: user.uid, creatorUsername: userProfile.username,
        isPublic: false, status: 'draft', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Question created!', variant: 'success' });
    } catch { addToast({ title: 'Failed to create question', variant: 'destructive' }); }
  };

  const submitForReview = async (question: Question) => {
    try {
      await addDoc(collection(db, 'review_queue'), {
        questionId: question.id,
        questionData: {
          questionText: question.questionText, type: question.type,
          options: question.options || null, correctIndex: question.correctIndex ?? null,
          explanation: question.explanation || '', hints: question.hints || [],
          difficulty: question.difficulty, tags: question.tags || [],
          courseId: question.courseId, topicId: question.topicId || null,
        },
        submitterId: user.uid, submitterUid: user.uid, submitterUsername: userProfile.username,
        courseId: question.courseId, topicId: question.topicId || null,
        status: 'pending', createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'questions_private', question.id), { status: 'pending_review', updatedAt: serverTimestamp() });
      addToast({ title: 'Question submitted for review!', variant: 'success' });
    } catch { addToast({ title: 'Failed to submit for review', variant: 'destructive' }); }
  };

  const createPrivateNote = async (data: { title: string; content: string; courseId: string; tags: string[] }) => {
    try {
      await addDoc(collection(db, 'notes'), {
        ...data, creatorId: user.uid, creatorUsername: userProfile.username,
        isPublic: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Note created!', variant: 'success' });
    } catch { addToast({ title: 'Failed to create note', variant: 'destructive' }); }
  };

  return (
    <div className="container py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* ═══ TODAY HEADER BLOCK ═══ */}
        <div className="grid gap-4 mb-6 md:grid-cols-4">
          {/* Level + XP Card */}
          <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">{stats?.level || 1}</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{t('gamification.level')} {stats?.level || 1}</h2>
                    <p className="text-sm text-muted-foreground">{stats?.xpAllTime?.toLocaleString() || 0} XP total</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{stats?.streakDays || 0}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <Flame className="h-3 w-3 text-orange-500" /> {t('gamification.streak')}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{stats?.levelXp || 0} / {levelXpRequired} XP</span>
                  <span>Lv.{(stats?.level || 1) + 1}</span>
                </div>
                <Progress value={levelProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Weekly XP */}
          <Card>
            <CardContent className="pt-6 text-center">
              <Zap className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{stats?.xpWeekly || 0}</p>
              <p className="text-xs text-muted-foreground">Weekly XP</p>
              {season && <Badge variant="outline" className="mt-2 text-xs">{season.name}</Badge>}
            </CardContent>
          </Card>

          {/* Continue CTA */}
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => {
            if (lastSession?.status === 'in_progress') {
              router.push(`/practice/session?resume=${lastSession.id}&course=${lastSession.courseId}&mode=${lastSession.mode}`);
            } else { router.push('/practice'); }
          }}>
            <CardContent className="pt-6 text-center">
              <Play className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-sm font-medium">
                {lastSession?.status === 'in_progress' ? t('gamification.continueWhereLeft') : t('gamification.resumePractice')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {lastSession?.status === 'in_progress'
                  ? `${lastSession.currentIndex + 1}/${lastSession.totalQuestions} questions`
                  : `${sessions.length} total sessions`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ═══ QUICK ACTIONS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => router.push('/practice')}>
            <Play className="h-5 w-5" /><span className="text-xs">{t('gamification.resumePractice')}</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => router.push('/practice')}>
            <Target className="h-5 w-5" /><span className="text-xs">{t('gamification.dailyChallenge')}</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => router.push('/courses')}>
            <BookOpen className="h-5 w-5" /><span className="text-xs">{t('gamification.browseCourses')}</span>
          </Button>
          <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => router.push('/leaderboard')}>
            <Trophy className="h-5 w-5" /><span className="text-xs">{t('gamification.leaderboard')}</span>
          </Button>
        </div>

        {/* ═══ MAIN TABS ═══ */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
            <TabsTrigger value="practice"><Clock className="h-4 w-4 mr-1" /> {t('dashboard.practice')}</TabsTrigger>
            <TabsTrigger value="achievements"><Award className="h-4 w-4 mr-1" /> {t('gamification.achievements')}</TabsTrigger>
            <TabsTrigger value="notes"><FileText className="h-4 w-4 mr-1" /> {t('dashboard.notes')}</TabsTrigger>
            <TabsTrigger value="questions"><MessageSquare className="h-4 w-4 mr-1" /> {t('dashboard.questions')}</TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-1" /> {t('gamification.notifications')}
              {unreadCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="account"><Settings className="h-4 w-4 mr-1" /> {t('dashboard.account')}</TabsTrigger>
          </TabsList>

          {/* ═══ OVERVIEW TAB ═══ */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Study Heatmap */}
              <div className="md:col-span-2"><StudyHeatmap uid={user.uid} days={180} /></div>

              {/* Mastery / Course Progress */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> {t('gamification.mastery')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {courses.slice(0, 5).map(course => {
                    const cSessions = sessions.filter(s => s.courseId === course.id && s.status === 'completed');
                    const totalQ = cSessions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
                    const correctQ = cSessions.reduce((sum, s) => sum + (s.correctCount || 0), 0);
                    const acc = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
                    return (
                      <div key={course.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate font-medium">{course.title}</span>
                          <span className="text-muted-foreground">{acc}%</span>
                        </div>
                        <Progress value={acc} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground">{cSessions.length} sessions · {totalQ} questions</p>
                      </div>
                    );
                  })}
                  {courses.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No courses available yet.</p>}
                </CardContent>
              </Card>

              {/* Weak Areas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" /> {t('gamification.weakAreas')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {weakTopics.length > 0 ? weakTopics.map((wt, i) => {
                    const course = courses.find(c => c.id === wt.courseId);
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/10">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{course?.title || wt.courseId}</p>
                          <p className="text-xs text-muted-foreground">{wt.total} questions attempted</p>
                        </div>
                        <Badge variant="destructive" className="text-xs">{Math.round(wt.accuracy)}%</Badge>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Complete more sessions to identify weak areas.</p>
                  )}
                  {weakTopics.length > 0 && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/practice')}>
                      Practice Weak Areas <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Challenges */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" /> {t('gamification.challenges')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dailyChallenge && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-[10px]">Daily</Badge>
                        <span className="text-sm font-medium">{dailyChallenge.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{dailyChallenge.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">+{dailyChallenge.xpReward} XP</Badge>
                        <Button size="sm" variant="outline" onClick={() => router.push('/practice')}>
                          Start <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {weeklyChallenge && (
                    <div className="p-3 rounded-lg bg-secondary/50 border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px]">Weekly</Badge>
                        <span className="text-sm font-medium">{weeklyChallenge.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{weeklyChallenge.description}</p>
                      <Badge variant="outline" className="text-xs mt-2">+{weeklyChallenge.xpReward} XP</Badge>
                    </div>
                  )}
                  {!dailyChallenge && !weeklyChallenge && (
                    <p className="text-sm text-muted-foreground text-center py-4">No active challenges right now.</p>
                  )}
                </CardContent>
              </Card>

              {/* Live Activity Feed */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" /> {t('gamification.liveActivity')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {liveFeed.length > 0 ? (
                    <div className="space-y-2">
                      {liveFeed.slice(0, 8).map(event => (
                        <div key={event.id} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                          <span className="font-medium">@{event.actorUsername}</span>
                          <span className="text-muted-foreground truncate">
                            {event.type === 'xp_earned' ? `earned +${event.metadata?.xp || 0} XP`
                              : event.type === 'lab_completed' ? 'completed a lab' : event.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>}
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Rocket className="h-4 w-4" /> {t('gamification.recommendations')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {lastSession && (
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                           onClick={() => router.push(`/practice?course=${lastSession.courseId}&mode=${lastSession.mode}`)}>
                        <Play className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Continue {lastSession.mode}</p>
                          <p className="text-xs text-muted-foreground">Pick up where you left off</p>
                        </div>
                      </div>
                    )}
                    {weakTopics[0] && (
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                           onClick={() => router.push('/practice')}>
                        <BrainCircuit className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Strengthen weak area</p>
                          <p className="text-xs text-muted-foreground">{Math.round(weakTopics[0].accuracy)}% accuracy</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                         onClick={() => router.push('/courses')}>
                      <BookOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Explore courses</p>
                        <p className="text-xs text-muted-foreground">{courses.length} available</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ PRACTICE HISTORY TAB ═══ */}
          <TabsContent value="practice">
            <Card>
              <CardHeader><CardTitle>Practice History</CardTitle></CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No practice sessions yet. Start practicing to see your history.</p>
                    <Button asChild className="mt-4"><a href="/practice">Go to Practice Hub</a></Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.slice(0, 30).map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{session.mode}</Badge>
                          <div>
                            <p className="text-sm font-medium">{session.totalQuestions} questions</p>
                            <p className="text-xs text-muted-foreground">{formatDate(session.startedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {session.score !== undefined && (
                            <Badge variant={session.score >= 70 ? 'success' : 'destructive'}>{session.score}%</Badge>
                          )}
                          {(session as any).xpAmount && (
                            <Badge variant="secondary" className="text-xs">+{(session as any).xpAmount} XP</Badge>
                          )}
                          <Badge variant={session.status === 'completed' ? 'secondary' : 'outline'}>{session.status}</Badge>
                          {session.status === 'in_progress' && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={`/practice/session?resume=${session.id}&course=${session.courseId}&mode=${session.mode}`}>Resume</a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ACHIEVEMENTS TAB ═══ */}
          <TabsContent value="achievements">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {achievementDefs.map(def => {
                const earned = earnedIds.has(def.id);
                return (
                  <Card key={def.id} className={`transition-all ${earned ? 'border-primary/30 bg-primary/5' : 'opacity-60'}`}>
                    <CardContent className="pt-4 pb-3 flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${earned ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        <Star className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{def.title}</p>
                        <p className="text-xs text-muted-foreground">{def.description}</p>
                        {earned && <Badge variant="secondary" className="text-[10px] mt-1">Earned</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ═══ NOTES TAB ═══ */}
          <TabsContent value="notes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>My Notes</CardTitle>
                <CreateNoteDialog courses={courses} onSubmit={createPrivateNote} />
              </CardHeader>
              <CardContent>
                {myNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Create private notes to help you study.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myNotes.map((note) => (
                      <div key={note.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{note.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                        </div>
                        <div className="flex gap-1">
                          {note.tags?.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ QUESTIONS TAB ═══ */}
          <TabsContent value="questions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>My Questions</CardTitle>
                <CreateQuestionDialog courses={courses} onSubmit={createPrivateQuestion} />
              </CardHeader>
              <CardContent>
                {myQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Create private questions for personal practice, or submit them for public review.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myQuestions.map((q) => (
                      <div key={q.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{q.questionText}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{q.type}</Badge>
                              <Badge className={`text-xs ${
                                q.status === 'approved' ? 'bg-green-100 text-green-700' :
                                q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                q.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' : ''
                              }`} variant="outline">{q.status === 'pending_review' ? 'Under Review' : q.status}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <EditQuestionDialog question={q} courses={courses} onSubmit={async (data) => {
                              try {
                                await updateDoc(doc(db, 'questions_private', q.id), { ...data, updatedAt: serverTimestamp() });
                                addToast({ title: 'Question updated!', variant: 'success' });
                              } catch { addToast({ title: 'Failed to update', variant: 'destructive' }); }
                            }} />
                            {q.status === 'draft' && (
                              <Button size="sm" variant="outline" onClick={() => submitForReview(q)}>
                                <Send className="h-3 w-3 mr-1" /> Submit
                              </Button>
                            )}
                            {q.status === 'rejected' && (
                              <Button size="sm" variant="outline" onClick={() => {
                                updateDoc(doc(db, 'questions_private', q.id), { status: 'draft', updatedAt: serverTimestamp() });
                              }}>Resubmit</Button>
                            )}
                          </div>
                        </div>
                        {q.status === 'rejected' && (q as any).reviewFeedback && (
                          <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-xs text-red-700 dark:text-red-300">
                            <strong>Feedback:</strong> {(q as any).reviewFeedback}
                          </div>
                        )}
                        {q.status === 'approved' && (
                          <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded text-xs text-green-700 dark:text-green-300">
                            This question has been approved and added to the public pool!
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ NOTIFICATIONS TAB ═══ */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('gamification.notifications')}</CardTitle>
                {unreadCount > 0 && <Button size="sm" variant="outline" onClick={markAllRead}>Mark all read</Button>}
              </CardHeader>
              <CardContent>
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No notifications yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map(notif => (
                      <div key={notif.id}
                        className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                          notif.read ? 'bg-muted/30' : 'bg-primary/5 border border-primary/10'}`}
                        onClick={() => markRead(notif.id)}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-transparent' : 'bg-primary'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{notif.title}</p>
                          <p className="text-xs text-muted-foreground">{notif.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ACCOUNT & PRIVACY TAB ═══ */}
          <TabsContent value="account">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Goals & Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Daily Questions Goal</Label>
                      <Input type="number" defaultValue={userProfile.goals?.dailyQuestions || 10} min={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>Weekly Practice (minutes)</Label>
                      <Input type="number" defaultValue={userProfile.goals?.weeklyPracticeMinutes || 120} min={10} />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Score (%)</Label>
                      <Input type="number" defaultValue={userProfile.goals?.targetScore || 80} min={50} max={100} />
                    </div>
                  </div>
                  <Button>Save Goals</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Privacy Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Public Profile</p>
                      <p className="text-xs text-muted-foreground">Allow others to view your profile</p>
                    </div>
                    <Switch checked={privacySettings.publicProfile}
                      onCheckedChange={(v) => updatePrivacy({ publicProfile: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t('gamification.showOnLeaderboard')}</p>
                      <p className="text-xs text-muted-foreground">Appear on public leaderboards</p>
                    </div>
                    <Switch checked={privacySettings.showOnLeaderboard}
                      onCheckedChange={(v) => updatePrivacy({ showOnLeaderboard: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t('gamification.showInLiveFeed')}</p>
                      <p className="text-xs text-muted-foreground">Show your activity in the live feed</p>
                    </div>
                    <Switch checked={privacySettings.showInLiveFeed}
                      onCheckedChange={(v) => updatePrivacy({ showInLiveFeed: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t('gamification.allowFriendRequests')}</p>
                      <p className="text-xs text-muted-foreground">Allow other users to send friend requests</p>
                    </div>
                    <Switch checked={privacySettings.allowFriendRequests}
                      onCheckedChange={(v) => updatePrivacy({ allowFriendRequests: v })} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Account Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea defaultValue={userProfile.bio || ''} placeholder="Tell us about yourself..." />
                  </div>
                  <Button>Update Profile</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

// --- Dialog Components ---

function CreateNoteDialog({ courses, onSubmit }: { courses: any[]; onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [courseId, setCourseId] = useState('');
  const [tags, setTags] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Note</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Private Note</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} /></div>
          <div><Label>Tags (comma-separated)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="review, chapter1" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSubmit({ title, content, courseId, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })}>Create</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateQuestionDialog({ courses, onSubmit }: { courses: any[]; onSubmit: (data: any) => void }) {
  const [text, setText] = useState('');
  const [type, setType] = useState<'mcq' | 'essay'>('mcq');
  const [courseId, setCourseId] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [explanation, setExplanation] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Question</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Private Question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple Choice</SelectItem>
                <SelectItem value="essay">Essay</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Question Text</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} /></div>
          {type === 'mcq' && (
            <div className="space-y-2">
              <Label>Options</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={correctIdx === i} onChange={() => setCorrectIdx(i)} />
                  <Input value={opt} onChange={(e) => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} placeholder={`Option ${i + 1}`} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Select the correct answer</p>
            </div>
          )}
          <div><Label>Explanation</Label><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why this is correct..." /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSubmit({
              questionText: text,
              type,
              courseId,
              difficulty,
              options: type === 'mcq' ? options.map((text, i) => ({ text, isCorrect: i === correctIdx })) : undefined,
              correctIndex: type === 'mcq' ? correctIdx : undefined,
              explanation,
              tags: [],
            })}>Create</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditQuestionDialog({ question, courses, onSubmit }: { question: Question; courses: any[]; onSubmit: (data: any) => void }) {
  const [text, setText] = useState(question.questionText || '');
  const [type, setType] = useState<'mcq' | 'essay'>(question.type as any || 'mcq');
  const [courseId, setCourseId] = useState(question.courseId || '');
  const [difficulty, setDifficulty] = useState(String(question.difficulty || 'medium'));
  const [options, setOptions] = useState(
    question.options?.map((o: any) => typeof o === 'string' ? o : o.text) || ['', '', '', '']
  );
  const [correctIdx, setCorrectIdx] = useState(
    question.correctIndex ?? question.options?.findIndex((o: any) => o.isCorrect) ?? 0
  );
  const [explanation, setExplanation] = useState(question.explanation || '');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Edit className="h-3 w-3" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">Multiple Choice</SelectItem>
                <SelectItem value="essay">Essay</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Question Text</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} /></div>
          {type === 'mcq' && (
            <div className="space-y-2">
              <Label>Options</Label>
              {options.map((opt: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="editCorrect" checked={correctIdx === i} onChange={() => setCorrectIdx(i)} />
                  <Input value={opt} onChange={(e) => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} placeholder={`Option ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
          <div><Label>Explanation</Label><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSubmit({
              questionText: text,
              type,
              courseId,
              difficulty,
              options: type === 'mcq' ? options.map((text: string, i: number) => ({ text, isCorrect: i === correctIdx })) : undefined,
              correctIndex: type === 'mcq' ? correctIdx : undefined,
              explanation,
            })}>Save Changes</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
