'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Construction } from 'lucide-react';

export default function AdminMonetizationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monetization</h1>
        <p className="text-muted-foreground">Supporter tiers and revenue management</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Monetization features including supporter tiers (Free, Supporter €2.99/mo, Pro €5.99/mo),
            Stripe integration, subscription management, and revenue dashboards.
          </p>
          <Badge variant="secondary" className="mt-4">Planned Feature</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
