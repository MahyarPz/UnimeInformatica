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
  MessageSquare,
  Shield,
  Star,
  Award,
  Globe,
  Lightbulb,
  Rocket,
  Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCourses } from '@/lib/hooks/useCourses';
import { useSiteContentContext } from '@/contexts/SiteContentContext';
import { renderSafeMarkdown } from '@/lib/utils/renderSafeMarkdown';
import { HomeBlock, Course } from '@/lib/types';

// ─── Icon resolver ────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen, BarChart3, Users, Zap, FlaskConical, Target, ArrowRight, GraduationCap,
  MessageSquare, Shield, Star, Award, Globe, Lightbulb, Rocket, Heart,
};

function resolveIcon(name?: string): React.ElementType {
  if (!name) return Zap;
  return ICON_MAP[name] || Zap;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

// ─── Block Renderers ──────────────────────────────────────

function HeroBlock({ content }: { content: any }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-20 md:py-32">
      <div className="container relative z-10">
        <motion.div {...fadeIn} className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
            <GraduationCap className="h-4 w-4" />
            Course-First Learning Platform
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            {content.title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {content.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {content.primaryCtaLabel && (
              <Button size="lg" asChild>
                <Link href={content.primaryCtaHref || '/courses'}>
                  {content.primaryCtaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            {content.secondaryCtaLabel && (
              <Button size="lg" variant="outline" asChild>
                <Link href={content.secondaryCtaHref || '/practice'}>
                  {content.secondaryCtaLabel}
                </Link>
              </Button>
            )}
          </div>
        </motion.div>
      </div>
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>
    </section>
  );
}

function FeaturesBlock({ content }: { content: any }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">{content.heading}</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {(content.items || []).map((item: any, i: number) => {
            const Icon = resolveIcon(item.icon);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="inline-flex p-3 rounded-lg w-fit bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeaturedCoursesBlock({ content, courses }: { content: any; courses: Course[] }) {
  const slugs: string[] = content.courseSlugs || [];
  const display = slugs.length > 0
    ? courses.filter((c) => slugs.includes(c.slug))
    : courses.slice(0, 4);

  if (display.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">{content.heading || 'Available Courses'}</h2>
            <p className="text-muted-foreground mt-1">Start your journey today</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/courses">View All <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {display.map((course, i) => (
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
  );
}

function StatsBlock({ content }: { content: any }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container text-center">
        {content.heading && <h2 className="text-3xl font-bold mb-8">{content.heading}</h2>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {(content.items || []).map((item: any, i: number) => (
            <div key={i} className="space-y-2">
              <div className="text-3xl font-bold">{item.value}</div>
              <div className="text-sm text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQBlock({ content }: { content: any }) {
  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-8">{content.heading}</h2>
        <div className="space-y-4">
          {(content.items || []).map((item: any, i: number) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{item.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(item.aMarkdown || '') }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABlock({ content }: { content: any }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container max-w-2xl text-center space-y-6">
        <h2 className="text-3xl font-bold">{content.heading}</h2>
        {content.bodyMarkdown && (
          <div
            className="text-muted-foreground prose prose-sm mx-auto max-w-none"
            dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(content.bodyMarkdown) }}
          />
        )}
        {content.buttonLabel && (
          <Button size="lg" asChild>
            <Link href={content.buttonHref || '/signup'}>
              {content.buttonLabel} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}

function HowItWorksBlock({ content }: { content: any }) {
  return (
    <section className="py-16 md:py-24 bg-muted/50">
      <div className="container">
        <h2 className="text-3xl font-bold text-center mb-12">{content.heading}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {(content.steps || []).map((step: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center space-y-3"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg">
                {i + 1}
              </div>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsBlock({ content }: { content: any }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <h2 className="text-3xl font-bold text-center mb-12">{content.heading}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {(content.items || []).map((item: any, i: number) => (
            <Card key={i} className="h-full">
              <CardContent className="pt-6">
                <p className="text-muted-foreground italic mb-4">&ldquo;{item.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  {item.avatarUrl && (
                    <img src={item.avatarUrl} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                  )}
                  <span className="font-medium">{item.name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnnouncementBlock({ content }: { content: any }) {
  const bgClass = content.style === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
    : content.style === 'success' ? 'bg-green-50 border-green-200 text-green-800'
    : 'bg-blue-50 border-blue-200 text-blue-800';

  return (
    <section className="py-4">
      <div className="container">
        <div className={`rounded-lg border p-4 text-center ${bgClass}`}>
          <p className="text-sm font-medium">
            {content.href ? (
              <Link href={content.href} className="underline hover:no-underline">{content.text}</Link>
            ) : (
              content.text
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function RenderBlock({ block, courses }: { block: HomeBlock; courses: Course[] }) {
  const content = block.content?.en;
  if (!content) return null;

  switch (block.type) {
    case 'hero': return <HeroBlock content={content} />;
    case 'features': return <FeaturesBlock content={content} />;
    case 'featured_courses': return <FeaturedCoursesBlock content={content} courses={courses} />;
    case 'stats': return <StatsBlock content={content} />;
    case 'faq': return <FAQBlock content={content} />;
    case 'cta': return <CTABlock content={content} />;
    case 'how_it_works': return <HowItWorksBlock content={content} />;
    case 'testimonials': return <TestimonialsBlock content={content} />;
    case 'announcement': return <AnnouncementBlock content={content} />;
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════
export default function HomePage() {
  const { courses } = useCourses();
  const { home } = useSiteContentContext();

  const blocks = home?.blocks ?? [];
  const enabledBlocks = blocks.filter((b) => b.enabled).sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col">
      {enabledBlocks.map((block) => (
        <RenderBlock key={block.id} block={block} courses={courses} />
      ))}
    </div>
  );
}
