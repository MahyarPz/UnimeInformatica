'use client';

import { useEffect } from 'react';
import { ref, set, onDisconnect, onValue, serverTimestamp } from 'firebase/database';
import { rtdb } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

export function usePresence() {
  const { user, userProfile } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!user || !userProfile) return;

    const presenceRef = ref(rtdb, `presence/${user.uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Set presence data
        set(presenceRef, {
          state: 'online',
          username: userProfile.username,
          role: userProfile.role,
          lastActive: Date.now(),
          currentPath: pathname || '/',
        });

        // On disconnect, set offline
        onDisconnect(presenceRef).set({
          state: 'offline',
          username: userProfile.username,
          role: userProfile.role,
          lastActive: Date.now(),
          currentPath: '',
        });
      }
    });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (user) {
        set(presenceRef, {
          state: 'online',
          username: userProfile.username,
          role: userProfile.role,
          lastActive: Date.now(),
          currentPath: pathname || '/',
        });
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(heartbeat);
    };
  }, [user, userProfile, pathname]);
}
