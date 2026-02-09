'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Course, Topic } from '@/lib/types';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'courses'),
      where('active', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      setCourses(data);
      setLoading(false);
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
    });

    return () => unsubscribe();
  }, [slug]);

  return { course, loading };
}

export function useTopics(courseId: string) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    const q = query(
      collection(db, 'courses', courseId, 'topics'),
      where('active', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Topic[];
      setTopics(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [courseId]);

  return { topics, loading };
}
