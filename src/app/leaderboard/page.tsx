'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Medal, Crown, ChevronDown, Filter, Star, TrendingUp,
  Loader2, ShieldAlert, Eye, ArrowUp, Zap, Calendar,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCourses } from '@/lib/hooks/useCourses';
import {
  useLeaderboard, useUserRank, useActiveSeason, useLeaderboardConfig,
  type LeaderboardType, type LeaderboardScope,
} from '@/lib/hooks/useGamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { t } from '@/lib/i18n';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { courses } = useCourses();
  const { season } = useActiveSeason();
  const { config } = useLeaderboardConfig();

  const [type, setType] = useState<LeaderboardType>('weekly');
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [courseId, setCourseId] = useState<string>('');

  const { entries, loading } = useLeaderboard(
    type, scope,
    scope === 'course' ? courseId : undefined,
    undefined,
    type === 'season' ? season?.seasonKey : undefined,
    100,
  );

  const { rank: myRank, xp: myXp, xpToNext } = useUserRank(
    user?.uid, type,
    scope === 'course' ? courseId : undefined,
  );

  if (config && !config.visible) {
    return (
      <div className="container py-16 text-center">
        <ShieldAlert className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Leaderboard Hidden</h2>
        <p className="text-muted-foreground">The leaderboard is currently not visible. Check back later!</p>
      </div>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
  const medalIcons = [Crown, Medal, Medal];

  return (
    <div className="container py-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{t('gamification.leaderboard')}</h1>
            {season && type === 'season' && (
              <p className="text-sm text-muted-foreground">
                {season.name} — {daysRemaining(season.endsAt)} {t('gamification.daysLeft')}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Tabs value={type} onValueChange={(v) => setType(v as LeaderboardType)} className="w-auto">
            <TabsList>
              <TabsTrigger value="weekly">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                {t('gamification.leaderboardWeekly')}
              </TabsTrigger>
              <TabsTrigger value="alltime">
                <Star className="h-3.5 w-3.5 mr-1" />
                {t('gamification.leaderboardAllTime')}
              </TabsTrigger>
              {season && (
                <TabsTrigger value="season">
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  {t('gamification.leaderboardSeason')}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          <Select value={scope} onValueChange={(v) => setScope(v as LeaderboardScope)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">{t('gamification.leaderboardGlobal')}</SelectItem>
              <SelectItem value="course">{t('gamification.leaderboardCourse')}</SelectItem>
            </SelectContent>
          </Select>

          {scope === 'course' && (
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-1">No entries yet</h3>
              <p className="text-sm text-muted-foreground">Start practicing to appear on the leaderboard!</p>
              <Button asChild className="mt-4"><a href="/practice">Start Practicing</a></Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Podium - Top 3 */}
            {top3.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {/* 2nd place */}
                {top3.length >= 2 && (
                  <PodiumCard entry={top3[1]} rank={2} color={medalColors[1]} className="mt-8" />
                )}
                {/* 1st place */}
                <PodiumCard entry={top3[0]} rank={1} color={medalColors[0]} className="mt-0" />
                {/* 3rd place */}
                {top3.length >= 3 && (
                  <PodiumCard entry={top3[2]} rank={3} color={medalColors[2]} className="mt-12" />
                )}
              </div>
            )}

            {/* Your Rank - Sticky */}
            {user && myRank && (
              <Card className="mb-4 border-primary/30 bg-primary/5">
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      #{myRank}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t('gamification.yourRank')}</p>
                      <p className="text-xs text-muted-foreground">{myXp.toLocaleString()} XP</p>
                    </div>
                  </div>
                  {xpToNext > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <ArrowUp className="h-3 w-3 mr-1" />
                      {xpToNext} {t('gamification.xpToNext')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Remaining entries */}
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {rest.map((entry, i) => (
                    <div key={entry.uid} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <span className="w-8 text-center text-sm font-medium text-muted-foreground">
                        {i + 4}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {(entry.username || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.username}</p>
                        {entry.level && (
                          <p className="text-xs text-muted-foreground">Level {entry.level}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{(entry.xp || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">XP</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </div>
  );
}

function PodiumCard({ entry, rank, color, className }: {
  entry: any; rank: number; color: string; className?: string;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
    >
      <Card className={`text-center ${className}`}>
        <CardContent className="pt-6 pb-4">
          <div className="text-3xl mb-2">{medals[rank - 1]}</div>
          <Avatar className="h-12 w-12 mx-auto mb-2">
            <AvatarFallback className="text-lg font-bold">
              {(entry.username || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="font-semibold text-sm truncate">{entry.username}</p>
          <p className="text-lg font-bold text-primary">{(entry.xp || entry.seasonXp || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">XP</p>
          {entry.level && (
            <Badge variant="secondary" className="mt-1 text-xs">Lv.{entry.level}</Badge>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function daysRemaining(endsAt: any): number {
  if (!endsAt) return 0;
  const end = endsAt.toDate ? endsAt.toDate() : new Date(endsAt);
  const diff = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
