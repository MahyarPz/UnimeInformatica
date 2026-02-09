'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import {
  BookOpen,
  FileText,
  Zap,
  FlaskConical,
  BarChart3,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCourseBySlug, useTopics } from '@/lib/hooks/useCourses';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { CourseNotesTab } from '@/components/courses/CourseNotesTab';
import { CoursePracticeTab } from '@/components/courses/CoursePracticeTab';
import { CourseLabsTab } from '@/components/courses/CourseLabsTab';
import { CourseProgressTab } from '@/components/courses/CourseProgressTab';
import Link from 'next/link';

export default function CourseDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { course, loading } = useCourseBySlug(slug);
  const { topics } = useTopics(course?.id || '');
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container py-16 text-center">
        <h2 className="text-2xl font-bold mb-2">Course not found</h2>
        <p className="text-muted-foreground mb-4">This course may not exist or is currently inactive.</p>
        <Button asChild>
          <Link href="/courses"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6 md:py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Course Header */}
        <div className="mb-6">
          <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> All Courses
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">{course.title}</h1>
          <p className="text-lg text-muted-foreground mt-2">{course.shortDescription}</p>
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {topics.map((topic) => (
                <Badge key={topic.id} variant="secondary">{topic.title}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 bg-transparent p-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4 mr-1.5" /> {t('courses.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4 mr-1.5" /> {t('courses.tabs.notes')}
            </TabsTrigger>
            <TabsTrigger value="practice" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Zap className="h-4 w-4 mr-1.5" /> {t('courses.tabs.practice')}
            </TabsTrigger>
            <TabsTrigger value="labs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FlaskConical className="h-4 w-4 mr-1.5" /> {t('courses.tabs.labs')}
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4 mr-1.5" /> {t('courses.tabs.progress')}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {course.syllabus && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('courses.syllabus')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(course.syllabus) }} />
                    </CardContent>
                  </Card>
                )}
                {course.examInfo && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('courses.examInfo')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(course.examInfo) }} />
                    </CardContent>
                  </Card>
                )}
                {!course.syllabus && !course.examInfo && (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Course overview content will be added by the instructor.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
              <div className="space-y-6">
                {course.whatYouLearn && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('courses.whatYouLearn')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(course.whatYouLearn) }} />
                    </CardContent>
                  </Card>
                )}
                {course.recommendedResources && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('courses.resources')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(course.recommendedResources) }} />
                    </CardContent>
                  </Card>
                )}
                {topics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Topics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {topics.map((topic, i) => (
                          <li key={topic.id} className="flex items-center gap-2 text-sm">
                            <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium">
                              {i + 1}
                            </span>
                            {topic.title}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes">
            <CourseNotesTab courseId={course.id} />
          </TabsContent>

          {/* Practice Tab */}
          <TabsContent value="practice">
            <CoursePracticeTab courseId={course.id} courseTitle={course.title} />
          </TabsContent>

          {/* Labs Tab */}
          <TabsContent value="labs">
            <CourseLabsTab courseId={course.id} />
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress">
            <CourseProgressTab courseId={course.id} />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
