'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Course, Topic } from '@/lib/types';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try with orderBy first, fallback to simple query if index missing
    let q;
    try {
      q = query(
        collection(db, 'courses'),
        where('active', '==', true),
        orderBy('order', 'asc')
      );
    } catch {
      q = query(collection(db, 'courses'), where('active', '==', true));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      setCourses(data);
      setLoading(false);
    }, (error) => {
      console.error('useCourses error:', error);
      // Fallback: try simple query without orderBy (index may be missing)
      const fallbackQ = query(collection(db, 'courses'));
      onSnapshot(fallbackQ, (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Course))
          .filter((c) => c.active !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setCourses(data);
        setLoading(false);
      }, () => {
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  return { courses, loading };
}

export function useCourseBySlug(slug: string) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const q = query(
      collection(db, 'courses'),
      where('slug', '==', slug),
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setCourse({ id: doc.id, ...doc.data() } as Course);
      } else {
        setCourse(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('useCourseBySlug error:', error);
      // Fallback: get all courses and filter client-side
      const fallbackQ = query(collection(db, 'courses'));
      onSnapshot(fallbackQ, (snapshot) => {
        const match = snapshot.docs.find((d) => d.data().slug === slug && d.data().active !== false);
        setCourse(match ? { id: match.id, ...match.data() } as Course : null);
        setLoading(false);
      }, () => {
        setCourse(null);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [slug]);

  return { course, loading };
}

export function useTopics(courseId: string) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    let q;
    try {
      q = query(
        collection(db, 'topics'),
        where('courseId', '==', courseId),
        where('active', '==', true),
        orderBy('order', 'asc')
      );
    } catch {
      q = query(collection(db, 'topics'), where('courseId', '==', courseId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Topic[];
      setTopics(data);
      setLoading(false);
    }, (error) => {
      console.error('useTopics error:', error);
      // Fallback without compound query
      const fallbackQ = query(collection(db, 'topics'), where('courseId', '==', courseId));
      onSnapshot(fallbackQ, (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Topic))
          .filter((t) => t.active !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setTopics(data);
        setLoading(false);
      }, () => {
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [courseId]);

  return { topics, loading };
}
