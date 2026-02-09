'use client';

import { usePresence } from '@/lib/hooks/usePresence';

export function PresenceWrapper() {
  usePresence();
  return null;
}
