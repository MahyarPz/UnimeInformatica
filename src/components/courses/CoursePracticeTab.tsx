'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Target, Clock, RotateCcw, TrendingDown, Brain } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const practiceModesForCourse = [
  { mode: 'quick', icon: Zap, title: 'Quick Practice', desc: '5-10 minutes focused practice', color: 'text-yellow-600 bg-yellow-100' },
  { mode: 'topic_drill', icon: Target, title: 'Topic Drill', desc: 'Focus on a specific topic', color: 'text-blue-600 bg-blue-100' },
  { mode: 'mock_exam', icon: Clock, title: 'Mock Exam', desc: 'Timed full exam simulation', color: 'text-purple-600 bg-purple-100' },
  { mode: 'mistake_review', icon: RotateCcw, title: 'Review Mistakes', desc: 'Revisit wrong answers', color: 'text-red-600 bg-red-100' },
  { mode: 'weakness', icon: TrendingDown, title: 'Weakness Practice', desc: 'Target your weak areas', color: 'text-orange-600 bg-orange-100' },
  { mode: 'adaptive', icon: Brain, title: 'Adaptive Practice', desc: 'AI-adjusted difficulty', color: 'text-green-600 bg-green-100' },
];

export function CoursePracticeTab({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Log in to practice</h3>
          <p className="text-muted-foreground mb-4">Create an account or log in to start practicing.</p>
          <Button asChild><Link href="/login">Log In</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">Choose a practice mode for <strong>{courseTitle}</strong>:</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {practiceModesForCourse.map((pm) => (
          <Link key={pm.mode} href={`/practice/session?course=${courseId}&mode=${pm.mode}`}>
            <Card className="h-full hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
              <CardContent className="pt-6">
                <div className={`inline-flex p-2.5 rounded-lg ${pm.color} mb-3`}>
                  <pm.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{pm.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{pm.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
