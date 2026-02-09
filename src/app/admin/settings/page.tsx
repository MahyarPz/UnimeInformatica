'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Construction } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-muted-foreground">Global platform configuration</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Site settings including branding, contact info, SEO metadata, maintenance mode,
            and email templates will be configurable here.
          </p>
          <Badge variant="secondary" className="mt-4">Planned Feature</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
