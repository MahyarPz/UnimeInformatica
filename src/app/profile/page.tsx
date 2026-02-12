'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Flame, Target, TrendingUp, Calendar, Award, BookOpen, Crown, Zap } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { useUserPlan } from '@/lib/hooks/useUserPlan';

export default function ProfilePage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { plan, effectiveTier, loading: planLoading } = useUserPlan();
  const expiresAt = plan?.endsAt ? (plan.endsAt.toDate ? plan.endsAt.toDate() : new Date(plan.endsAt)) : null;

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!user || !userProfile) { router.push('/login'); return null; }

  return (
    <div className="container py-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-6">{t('profile.title')}</h1>

        {/* Profile Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={userProfile.avatar} />
                <AvatarFallback className="text-2xl">{getInitials(userProfile.username)}</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-bold">@{userProfile.username}</h2>
                {(userProfile.firstName || userProfile.lastName) && (
                  <p className="text-muted-foreground">
                    {userProfile.firstName} {userProfile.lastName}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                  <Badge variant="secondary">{userProfile.role}</Badge>
                  {effectiveTier === 'pro' && <Badge className="bg-amber-100 text-amber-700"><Crown className="h-3 w-3 mr-1" />PRO</Badge>}
                  {effectiveTier === 'supporter' && <Badge className="bg-blue-100 text-blue-700"><Zap className="h-3 w-3 mr-1" />SUPPORTER</Badge>}
                  {effectiveTier === 'free' && <Badge variant="outline">Free</Badge>}
                  {expiresAt && <span className="text-xs text-muted-foreground self-center">expires {expiresAt.toLocaleDateString()}</span>}
                </div>
                {userProfile.bio && (
                  <p className="text-sm text-muted-foreground mt-3">{userProfile.bio}</p>
                )}
              </div>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Edit Profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <Flame className="h-8 w-8 mx-auto text-orange-500 mb-2" />
              <div className="text-2xl font-bold">{userProfile.streak || 0}</div>
              <p className="text-xs text-muted-foreground">{t('profile.streak')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Target className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">{t('profile.questionsAnswered')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">{t('profile.accuracy')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="h-8 w-8 mx-auto text-purple-500 mb-2" />
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/dashboard')}>
            <CardContent className="pt-6 flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Go to Dashboard</h3>
                <p className="text-sm text-muted-foreground">Manage notes, questions, and practice history</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/practice')}>
            <CardContent className="pt-6 flex items-center gap-3">
              <Award className="h-8 w-8 text-yellow-500" />
              <div>
                <h3 className="font-semibold">Start Practicing</h3>
                <p className="text-sm text-muted-foreground">Quick practice, weakness focus, mock exams</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
