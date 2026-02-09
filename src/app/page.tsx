'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen,
  BarChart3,
  Users,
  Zap,
  FlaskConical,
  Target,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCourses } from '@/lib/hooks/useCourses';
import { t } from '@/lib/i18n';

const features = [
  {
    icon: Zap,
    title: t('home.features.practice'),
    description: t('home.features.practice.desc'),
    color: 'text-yellow-600 bg-yellow-100',
  },
  {
    icon: FlaskConical,
    title: t('home.features.labs'),
    description: t('home.features.labs.desc'),
    color: 'text-purple-600 bg-purple-100',
  },
  {
    icon: Users,
    title: t('home.features.community'),
    description: t('home.features.community.desc'),
    color: 'text-green-600 bg-green-100',
  },
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export default function HomePage() {
  const { courses } = useCourses();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-20 md:py-32">
        <div className="container relative z-10">
          <motion.div {...fadeIn} className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
              <GraduationCap className="h-4 w-4" />
              Course-First Learning Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {t('home.hero.title')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('home.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild>
                <Link href="/courses">
                  {t('home.hero.cta')} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/practice">
                  {t('nav.practice')}
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-3">Why Unime Informatica?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Everything you need to excel in your courses.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className={`inline-flex p-3 rounded-lg w-fit ${feature.color}`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Course Preview */}
      {courses.length > 0 && (
        <section className="py-16 md:py-24 bg-muted/50">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold">Available Courses</h2>
                <p className="text-muted-foreground mt-1">Start your journey today</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/courses">View All <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {courses.slice(0, 4).map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link href={`/courses/${course.slug}`}>
                    <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                      <CardHeader>
                        <div className="flex items-center gap-2 text-primary mb-2">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{course.shortDescription}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="py-16 md:py-24">
        <div className="container text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Courses', value: courses.length || '4+', icon: BookOpen },
              { label: 'Practice Modes', value: '6', icon: Target },
              { label: 'Data Labs', value: 'Interactive', icon: FlaskConical },
              { label: 'Analytics', value: 'Detailed', icon: BarChart3 },
            ].map((stat) => (
              <div key={stat.label} className="space-y-2">
                <stat.icon className="h-8 w-8 mx-auto text-primary" />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
