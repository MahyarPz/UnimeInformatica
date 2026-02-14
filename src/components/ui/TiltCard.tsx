'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * TiltCard — 3D perspective card that follows the mouse.
 * Wraps children in a tilting container with optional glare.
 */
export function TiltCard({
  children,
  className,
  glare = true,
  maxTilt = 14,
}: {
  children: React.ReactNode;
  className?: string;
  glare?: boolean;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 260, damping: 25, mass: 0.8 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]), springConfig);

  // Glare position
  const glareX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), springConfig);
  const glareY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), springConfig);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      x.set(px);
      y.set(py);
    },
    [x, y]
  );

  const handleLeave = useCallback(() => {
    setIsHovering(false);
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: '1200px',
      }}
      className={cn('relative', className)}
    >
      {children}

      {/* Glare overlay */}
      {glare && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-10"
          style={{
            background: useTransform(
              [glareX, glareY],
              ([gx, gy]) =>
                `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.18) 0%, transparent 60%)`
            ),
            opacity: isHovering ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />
      )}
    </motion.div>
  );
}
