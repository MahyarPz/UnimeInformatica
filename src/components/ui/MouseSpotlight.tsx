'use client';

import React, { useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * MouseSpotlight — A radial glow that follows the cursor inside the container.
 * Wrap around any section and the spotlight sits behind content (z-0).
 */
export function MouseSpotlight({
  children,
  className,
  spotlightClassName,
  size = 600,
}: {
  children: React.ReactNode;
  className?: string;
  spotlightClassName?: string;
  size?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  const [isInside, setIsInside] = useState(false);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    []
  );

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseEnter={() => setIsInside(true)}
      onMouseLeave={() => setIsInside(false)}
      className={cn('relative', className)}
    >
      {/* Spotlight layer */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-0 transition-opacity duration-500',
          isInside ? 'opacity-100' : 'opacity-0',
          spotlightClassName
        )}
        style={{
          background: `radial-gradient(${size}px circle at ${pos.x}px ${pos.y}px, hsl(var(--primary) / 0.12), transparent 65%)`,
        }}
      />
      {/* Content above */}
      {children}
    </div>
  );
}
