'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * TypewriterText — Cycles through phrases with a typing + deleting effect.
 */
export function TypewriterText({
  phrases,
  className,
  typingSpeed = 70,
  deletingSpeed = 40,
  pauseMs = 2200,
}: {
  phrases: string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseMs?: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const currentPhrase = phrases[currentIndex] || '';

  const tick = useCallback(() => {
    if (!isDeleting) {
      // Typing
      if (displayed.length < currentPhrase.length) {
        setDisplayed(currentPhrase.slice(0, displayed.length + 1));
      } else {
        // Pause at end then start deleting
        setTimeout(() => setIsDeleting(true), pauseMs);
        return;
      }
    } else {
      // Deleting
      if (displayed.length > 0) {
        setDisplayed(currentPhrase.slice(0, displayed.length - 1));
      } else {
        setIsDeleting(false);
        setCurrentIndex((prev) => (prev + 1) % phrases.length);
      }
    }
  }, [displayed, isDeleting, currentPhrase, phrases.length, pauseMs]);

  useEffect(() => {
    const speed = isDeleting ? deletingSpeed : typingSpeed;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting, typingSpeed, deletingSpeed]);

  return (
    <span className={cn('inline', className)}>
      {displayed}
      <span className="animate-blink ml-[1px] inline-block w-[3px] h-[0.9em] bg-primary align-middle rounded-full" />
    </span>
  );
}
