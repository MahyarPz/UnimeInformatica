'use client';

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserStats } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Target, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { calculateAccuracy, getScoreColor, getScoreBg } from '@/lib/utils';

export function CourseProgressTab({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const unsubscribe = onSnapshot(doc(db, 'user_stats', user.uid), (snap) => {
      if (snap.exists()) {
        setStats(snap.data() as UserStats);
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Log in to track progress</h3>
          <p className="text-muted-foreground mb-4">Your stats will appear once you start practicing.</p>
          <Button asChild><Link href="/login">Log In</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const courseStats = stats?.courseStats?.[courseId];
  const accuracy = courseStats ? calculateAccuracy(courseStats.totalCorrect, courseStats.totalAttempts) : 0;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-8 w-8 mx-auto text-primary mb-2" />
            <div className="text-2xl font-bold">{courseStats?.totalAttempts || 0}</div>
            <p className="text-sm text-muted-foreground">Questions Attempted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <div className={`text-2xl font-bold ${getScoreColor(accuracy)}`}>{accuracy}%</div>
            <p className="text-sm text-muted-foreground">Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <div className="text-2xl font-bold">{courseStats?.totalCorrect || 0}</div>
            <p className="text-sm text-muted-foreground">Correct Answers</p>
          </CardContent>
        </Card>
      </div>

      {courseStats?.topicStats && Object.keys(courseStats.topicStats).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Topic Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(courseStats.topicStats).map(([topicId, ts]) => {
              const topicAcc = calculateAccuracy(ts.totalCorrect, ts.totalAttempts);
              return (
                <div key={topicId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{topicId}</span>
                    <span className={getScoreColor(topicAcc)}>{topicAcc}%</span>
                  </div>
                  <Progress value={topicAcc} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {stats?.weakAreas?.filter((w) => w.courseId === courseId).length ? (
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-orange-500" /> Weak Areas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.weakAreas.filter((w) => w.courseId === courseId).map((w, i) => (
                <Badge key={i} variant="warning">{w.tag || w.topicId} ({w.accuracy}%)</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!courseStats && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No progress yet. Start a practice session to track your performance!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
