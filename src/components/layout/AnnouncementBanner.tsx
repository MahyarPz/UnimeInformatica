'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Announcement } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { X, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'announcements'),
      where('active', '==', true),
      orderBy('startAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Announcement))
        .filter((a) => {
          const start = a.startAt?.toDate?.() || new Date(0);
          const end = a.endAt?.toDate?.() || new Date('2099-01-01');
          const nowDate = new Date();
          if (nowDate < start || nowDate > end) return false;
          if (a.audience === 'logged_in' && !user) return false;
          if (a.placement === 'home_only' && pathname !== '/') return false;
          return true;
        });
      setAnnouncements(data);
    }, () => {
      // Silently fail if collection doesn't exist yet
    });

    return () => unsubscribe();
  }, [user, pathname]);

  const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  const levelStyles: Record<string, string> = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const levelIcons: Record<string, any> = {
    info: Info,
    warning: AlertTriangle,
    critical: AlertCircle,
    success: Info,
    error: AlertCircle,
  };

  return (
    <div className="space-y-0">
      {visibleAnnouncements.map((a) => {
        const Icon = levelIcons[a.level] || Info;
        return (
          <div key={a.id} className={cn('border-b px-4 py-3', levelStyles[a.level])}>
            <div className="container flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium truncate">{a.title}</span>
                {a.content && <span className="text-sm hidden sm:inline">— {a.content}</span>}
              </div>
              <button onClick={() => setDismissed((prev) => new Set(Array.from(prev).concat(a.id)))} className="shrink-0 hover:opacity-70">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
