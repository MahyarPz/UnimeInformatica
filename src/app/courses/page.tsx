'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useCourses } from '@/lib/hooks/useCourses';
import { t } from '@/lib/i18n';

export default function CoursesPage() {
  const { courses, loading } = useCourses();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2 mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold">{t('courses.title')}</h1>
        <p className="text-lg text-muted-foreground">{t('courses.subtitle')}</p>
      </motion.div>

      {courses.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
          <p className="text-muted-foreground">Courses will appear here once created by an admin.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <BookOpen className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          <Link href={`/courses/${course.slug}`} className="hover:text-primary transition-colors">
                            {course.title}
                          </Link>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{course.shortDescription}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/courses/${course.slug}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="learn" className="border-none">
                      <AccordionTrigger className="py-2 text-sm text-primary hover:no-underline">
                        {t('courses.whatYouLearn')}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div
                          className="prose-content text-sm text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(course.whatYouLearn || 'Content coming soon.') }}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <div className="flex items-center gap-2 mt-3">
                    <Button asChild>
                      <Link href={`/courses/${course.slug}`}>
                        Start Learning <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
