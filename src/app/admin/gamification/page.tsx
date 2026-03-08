'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Trophy, BarChart3, Zap, RefreshCw, Lock } from 'lucide-react';
import { useLeaderboardConfig, useActiveSeason, useGamificationActions } from '@/lib/hooks/useGamification';
import { t } from '@/lib/i18n';

export default function AdminGamificationPage() {
  const { config, updateConfig } = useLeaderboardConfig();
  const { season, manageSeason } = useActiveSeason();
  const { adminForceWeeklyReset, adminLeaderboardBan } = useGamificationActions();

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Trophy className="h-6 w-6 text-primary" /> {t('admin.gamification')}
      </h1>
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="season">Season</TabsTrigger>
          <TabsTrigger value="ban">Ban User</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle>DAU</CardTitle></CardHeader>
              <CardContent><BarChart3 className="h-8 w-8 text-primary mb-2" /><p className="text-2xl font-bold">--</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>WAU</CardTitle></CardHeader>
              <CardContent><BarChart3 className="h-8 w-8 text-primary mb-2" /><p className="text-2xl font-bold">--</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>XP Issued</CardTitle></CardHeader>
              <CardContent><Zap className="h-8 w-8 text-yellow-500 mb-2" /><p className="text-2xl font-bold">--</p></CardContent>
            </Card>
          </div>
          <Separator className="my-6" />
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Leaderboard Visibility</CardTitle></CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => updateConfig({ visible: !config.visible })}>
                  {config.visible ? 'Hide Leaderboard' : 'Show Leaderboard'}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Force Weekly Reset</CardTitle></CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={adminForceWeeklyReset}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Force Reset
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle>Scoring Weights</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Correct MCQ XP</label>
                  <Input type="number" value={config.scoringWeights.correctMcq} onChange={e => updateConfig({ scoringWeights: { ...config.scoringWeights, correctMcq: Number(e.target.value) } })} />
                </div>
                <div>
                  <label>Lab Completion XP</label>
                  <Input type="number" value={config.scoringWeights.labCompletion} onChange={e => updateConfig({ scoringWeights: { ...config.scoringWeights, labCompletion: Number(e.target.value) } })} />
                </div>
                <div>
                  <label>Session Bonus XP</label>
                  <Input type="number" value={config.scoringWeights.sessionBonus} onChange={e => updateConfig({ scoringWeights: { ...config.scoringWeights, sessionBonus: Number(e.target.value) } })} />
                </div>
                <div>
                  <label>80% Accuracy Bonus</label>
                  <Input type="number" value={config.scoringWeights.accuracy80Bonus} onChange={e => updateConfig({ scoringWeights: { ...config.scoringWeights, accuracy80Bonus: Number(e.target.value) } })} />
                </div>
              </div>
              <Button className="mt-4" onClick={() => updateConfig({ scoringWeights: config.scoringWeights })}>Save Weights</Button>
            </CardContent>
          </Card>
          <Separator className="my-6" />
          <Card>
            <CardHeader><CardTitle>Anti-Cheat</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Daily XP Cap</label>
                  <Input type="number" value={config.antiCheat.maxXpPerDay} onChange={e => updateConfig({ antiCheat: { ...config.antiCheat, maxXpPerDay: Number(e.target.value) } })} />
                </div>
                <div>
                  <label>Max Sessions/Hour</label>
                  <Input type="number" value={config.antiCheat.maxSessionsPerHour} onChange={e => updateConfig({ antiCheat: { ...config.antiCheat, maxSessionsPerHour: Number(e.target.value) } })} />
                </div>
              </div>
              <Button className="mt-4" onClick={() => updateConfig({ antiCheat: config.antiCheat })}>Save Anti-Cheat</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="season">
          <Card>
            <CardHeader><CardTitle>Season Management</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{season?.name || 'No active season'}</Badge>
                <Button variant="outline" onClick={() => manageSeason('activate')}>Activate</Button>
                <Button variant="destructive" onClick={() => manageSeason('deactivate')}>Deactivate</Button>
              </div>
              <div className="mt-4">
                <label>Season Name</label>
                <Input value={season?.name || ''} onChange={e => manageSeason('update', { name: e.target.value })} />
              </div>
              <Button className="mt-4" onClick={() => manageSeason('create')}>Create New Season</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ban">
          <Card>
            <CardHeader><CardTitle>Ban User from Leaderboard</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input placeholder="User UID" id="banUid" />
                <Button variant="destructive" onClick={() => {
                  const uid = (document.getElementById('banUid') as HTMLInputElement)?.value;
                  if (uid) adminLeaderboardBan(uid);
                }}>
                  <Lock className="h-4 w-4 mr-1" /> Ban
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
