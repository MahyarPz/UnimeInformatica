'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ActivityEvent } from '@/lib/types';

export function useActivityFeed(maxEvents: number = 20, categoryFilter?: string) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(
      collection(db, 'activity_events'),
      where('visibility', '==', 'admin'),
      orderBy('timestamp', 'desc'),
      limit(maxEvents)
    );

    if (categoryFilter && categoryFilter !== 'all') {
      q = query(
        collection(db, 'activity_events'),
        where('visibility', '==', 'admin'),
        where('category', '==', categoryFilter),
        orderBy('timestamp', 'desc'),
        limit(maxEvents)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ActivityEvent[];
      setEvents(data);
      setLoading(false);
    }, (err) => {
      console.error('activity_events query failed:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [maxEvents, categoryFilter]);

  return { events, loading };
}
