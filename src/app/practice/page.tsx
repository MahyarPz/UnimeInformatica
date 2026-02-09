'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, Target, Clock, RotateCcw, TrendingDown, Brain, BookOpen, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCourses } from '@/lib/hooks/useCourses';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';

const practiceModes = [
  { mode: 'quick', icon: Zap, title: t('practice.quick'), desc: t('practice.quick.desc'), color: 'text-yellow-600 bg-yellow-100' },
  { mode: 'weakness', icon: TrendingDown, title: t('practice.weakness'), desc: t('practice.weakness.desc'), color: 'text-orange-600 bg-orange-100' },
  { mode: 'adaptive', icon: Brain, title: t('practice.adaptive'), desc: t('practice.adaptive.desc'), color: 'text-green-600 bg-green-100' },
  { mode: 'mistake_review', icon: RotateCcw, title: t('practice.mistakes'), desc: t('practice.mistakes.desc'), color: 'text-red-600 bg-red-100' },
  { mode: 'mock_exam', icon: Clock, title: t('practice.mock'), desc: t('practice.mock.desc'), color: 'text-purple-600 bg-purple-100' },
  { mode: 'topic_drill', icon: Target, title: t('practice.topic'), desc: t('practice.topic.desc'), color: 'text-blue-600 bg-blue-100' },
];

export default function PracticeHubPage() {
  const { courses } = useCourses();
  const { user } = useAuth();

  return (
    <div className="container py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mb-8">
        <h1 className="text-3xl md:text-4xl font-bold">{t('practice.title')}</h1>
        <p className="text-lg text-muted-foreground">Quick shortcuts to all practice modes across your courses.</p>
      </motion.div>

      {!user ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Log in to start practicing</h3>
            <p className="text-muted-foreground mb-4">Create an account or log in to access all practice modes.</p>
            <div className="flex justify-center gap-3">
              <Button asChild><Link href="/login">Log In</Link></Button>
              <Button variant="outline" asChild><Link href="/signup">Sign Up</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Practice Modes */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {practiceModes.map((pm, i) => (
              <motion.div
                key={pm.mode}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group">
                  <CardContent className="pt-6">
                    <div className={`inline-flex p-3 rounded-lg ${pm.color} mb-3`}>
                      <pm.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-lg">{pm.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">{pm.desc}</p>
                    {/* Course quick-start buttons */}
                    <div className="space-y-1.5">
                      {courses.map((course) => (
                        <Link
                          key={course.id}
                          href={`/practice/session?course=${course.id}&mode=${pm.mode}`}
                          className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                            {course.title}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Course-based Quick Access */}
          <div>
            <h2 className="text-2xl font-bold mb-4">By Course</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {courses.map((course) => (
                <Card key={course.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {course.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {practiceModes.map((pm) => (
                        <Button key={pm.mode} variant="outline" size="sm" asChild>
                          <Link href={`/practice/session?course=${course.id}&mode=${pm.mode}`}>
                            <pm.icon className="h-3.5 w-3.5 mr-1" /> {pm.title}
                          </Link>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
