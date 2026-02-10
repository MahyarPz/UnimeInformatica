'use client';

import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase/config';
import { PresenceData } from '@/lib/types';

interface OnlineUser extends PresenceData {
  uid: string;
}

export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentUsers, setRecentUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const presenceRef = ref(rtdb, 'presence');

    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setOnlineUsers([]);
        setRecentUsers([]);
        setLoading(false);
        return;
      }

      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      const users: OnlineUser[] = [];

      Object.entries(data).forEach(([uid, value]) => {
        const presence = value as PresenceData;
        users.push({ uid, ...presence });
      });

      const online = users.filter((u) => u.state === 'online');
      const recent = users.filter(
        (u) => now - u.lastActive <= twoMinutes
      );

      setOnlineUsers(online);
      setRecentUsers(recent);
      setLoading(false);
    }, (error) => {
      console.error('Presence read failed:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { onlineUsers, recentUsers, loading };
}
