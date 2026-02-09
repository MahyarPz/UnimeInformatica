'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Construction } from 'lucide-react';

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Platform usage analytics and insights</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Analytics dashboard with daily active users, practice session trends,
            course engagement metrics, question difficulty heatmaps, and exportable reports.
          </p>
          <Badge variant="secondary" className="mt-4">Planned Feature</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
