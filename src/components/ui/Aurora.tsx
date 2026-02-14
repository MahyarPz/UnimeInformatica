'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Aurora — Animated northern-lights background.
 * Pure CSS, GPU-accelerated (transforms + opacity only).
 */
export function Aurora({ className }: { className?: string }) {
  return (
    <div className={cn('aurora pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {/* Five colour bands, each with a different hue, size and animation delay */}
      <div className="aurora__band aurora__band--1" />
      <div className="aurora__band aurora__band--2" />
      <div className="aurora__band aurora__band--3" />
      <div className="aurora__band aurora__band--4" />
      <div className="aurora__band aurora__band--5" />
    </div>
  );
}
