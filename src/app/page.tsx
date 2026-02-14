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

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

// ─── Block Renderers ──────────────────────────────────────

function HeroBlock({ content }: { content: any }) {
  return (
    <section className="relative overflow-hidden py-24 md:py-36 lg:py-44 bg-gradient-to-b from-primary/[0.03] via-background to-background">
      {/* Background: dot grid + glow blobs */}
      <div className="absolute inset-0 dot-grid" />
      <div className="absolute inset-0 noise-overlay" />
      <div className="glow-blob animate-glow-shift w-[600px] h-[600px] bg-blue-500/40 -top-[15%] -left-[5%]" />
      <div className="glow-blob animate-glow-shift w-[500px] h-[500px] bg-violet-500/30 -bottom-[10%] -right-[5%]" style={{ animationDelay: '3s' }} />
      <div className="glow-blob animate-glow-shift w-[400px] h-[400px] bg-indigo-400/25 top-[10%] right-[15%]" style={{ animationDelay: '5s' }} />

      <div className="container relative z-10">
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="max-w-3xl mx-auto text-center space-y-8"
        >
          {/* Badge chip */}
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm shadow-sm">
              <GraduationCap className="h-4 w-4" />
              Course-First Learning Platform
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent"
          >
            {content.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            {content.subtitle}
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {content.primaryCtaLabel && (
              <Button size="lg" asChild className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                <Link href={content.primaryCtaHref || '/courses'}>
                  {content.primaryCtaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            {content.secondaryCtaLabel && (
              <Button size="lg" variant="outline" asChild className="rounded-full px-8 h-12 text-base border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
                <Link href={content.secondaryCtaHref || '/practice'}>
                  {content.secondaryCtaLabel}
                </Link>
              </Button>
            )}
          </motion.div>

          {/* Trust bar */}
          <motion.div variants={fadeUp} className="pt-8">
            <div className="flex items-center justify-center gap-6 text-muted-foreground/50">
              <div className="h-px w-12 bg-border" />
              <p className="text-xs uppercase tracking-[0.2em] font-medium">Built for students, by students</p>
              <div className="h-px w-12 bg-border" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesBlock({ content }: { content: any }) {
  return (
    <section className="py-20 md:py-28 border-t border-border/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{content.heading}</h2>
          <div className="w-12 h-1 rounded-full bg-primary mx-auto" />
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(content.items || []).map((item: any, i: number) => {
            const Icon = resolveIcon(item.icon);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Card className="h-full group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="inline-flex p-2.5 rounded-xl w-fit bg-primary/10 text-primary mb-2 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
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
    <section className="relative py-20 md:py-28 bg-muted/40 border-t border-border/30 overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-50" />
      <div className="container relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">{content.heading || 'Available Courses'}</h2>
            <p className="text-muted-foreground mt-2">Start your journey today</p>
          </div>
          <Button variant="outline" asChild className="rounded-full self-start sm:self-auto">
            <Link href="/courses">View All <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {display.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <Link href={`/courses/${course.slug}`}>
                <Card className="h-full group cursor-pointer hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 bg-card/90 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                        <BookOpen className="h-4 w-4" />
                      </div>
                    </div>
                    <CardTitle className="text-base group-hover:text-primary transition-colors">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.shortDescription}</p>
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
    <section className="py-20 md:py-28 border-t border-border/30">
      <div className="container text-center">
        {content.heading && (
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold mb-12"
          >
            {content.heading}
          </motion.h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
          {(content.items || []).map((item: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="space-y-1"
            >
              <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">{item.value}</div>
              <div className="text-sm text-muted-foreground">{item.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQBlock({ content }: { content: any }) {
  return (
    <section className="py-20 md:py-28 bg-muted/30 border-t border-border/30">
      <div className="container max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{content.heading}</h2>
        <div className="w-12 h-1 rounded-full bg-primary mx-auto mb-12" />
        <div className="space-y-3">
          {(content.items || []).map((item: any, i: number) => (
            <Card key={i} className="hover:border-primary/20 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="text-sm text-muted-foreground prose prose-sm max-w-none"
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
    <section className="relative py-20 md:py-28 border-t border-border/30 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.04] via-violet-500/[0.03] to-primary/[0.04]" />
      <div className="glow-blob w-[400px] h-[400px] bg-primary/25 top-[10%] left-[20%]" />
      <div className="glow-blob w-[300px] h-[300px] bg-violet-500/20 bottom-[10%] right-[20%]" style={{ animationDelay: '2s' }} />
      <div className="container max-w-2xl text-center space-y-6 relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold">{content.heading}</h2>
        {content.bodyMarkdown && (
          <div
            className="text-muted-foreground prose prose-sm mx-auto max-w-none"
            dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(content.bodyMarkdown) }}
          />
        )}
        {content.buttonLabel && (
          <Button size="lg" asChild className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/20">
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
    <section className="relative py-20 md:py-28 bg-muted/40 border-t border-border/30 overflow-hidden">
      <div className="absolute inset-0 dot-grid opacity-40" />
      <div className="container relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{content.heading}</h2>
        <div className="w-12 h-1 rounded-full bg-primary mx-auto mb-16" />
        <div className="grid md:grid-cols-3 gap-12">
          {(content.steps || []).map((step: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center space-y-4"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25 ring-4 ring-primary/10">
                {i + 1}
              </div>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsBlock({ content }: { content: any }) {
  return (
    <section className="py-20 md:py-28 border-t border-border/30">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{content.heading}</h2>
        <div className="w-12 h-1 rounded-full bg-primary mx-auto mb-12" />
        <div className="grid md:grid-cols-3 gap-5">
          {(content.items || []).map((item: any, i: number) => (
            <Card key={i} className="h-full hover:border-primary/20 hover:shadow-md transition-all duration-300 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <p className="text-muted-foreground italic mb-4 text-sm leading-relaxed">&ldquo;{item.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  {item.avatarUrl && (
                    <img src={item.avatarUrl} alt={item.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-border" />
                  )}
                  <span className="text-sm font-medium">{item.name}</span>
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
  const bgClass = content.style === 'warning'
    ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/40 dark:border-yellow-800 dark:text-yellow-200'
    : content.style === 'success'
    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-200'
    : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200';

  return (
    <section className="py-4">
      <div className="container">
        <div className={`rounded-xl border p-4 text-center ${bgClass}`}>
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
