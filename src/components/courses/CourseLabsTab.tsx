'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Lab } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, ArrowRight, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function CourseLabsTab({ courseId }: { courseId: string }) {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!courseId) return;
    const q = query(
      collection(db, 'labs'),
      where('courseId', '==', courseId),
      where('active', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Lab));
      setLabs(data);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, [courseId]);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading labs...</div>;
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FlaskConical className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Log in to access labs</h3>
          <p className="text-muted-foreground mb-4">Create an account to start working on data analysis labs.</p>
          <Button asChild><Link href="/login">Log In</Link></Button>
        </CardContent>
      </Card>
    );
  }

  if (labs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No labs available yet for this course.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {labs.map((lab, i) => (
        <Card key={lab.id} className="hover:shadow-sm transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Database className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{lab.title}</h3>
                  <p className="text-sm text-muted-foreground">{lab.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{lab.questions?.length || 0} questions</Badge>
                    <span className="text-xs text-muted-foreground">{lab.datasetFileName}</span>
                  </div>
                </div>
              </div>
              <Button asChild size="sm">
                <Link href={`/labs/${lab.id}`}>
                  Start <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
