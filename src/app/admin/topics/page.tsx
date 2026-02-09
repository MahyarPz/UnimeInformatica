'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Course, Topic } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Plus, Edit, Trash2, Layers, BookOpen } from 'lucide-react';
import { slugify } from '@/lib/utils';

export default function AdminTopicsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let q;
    if (selectedCourse && selectedCourse !== 'all') {
      q = query(collection(db, 'topics'), where('courseId', '==', selectedCourse), orderBy('order', 'asc'));
    } else {
      q = query(collection(db, 'topics'), orderBy('order', 'asc'));
    }
    const unsub = onSnapshot(q, (snap) => {
      setTopics(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic)));
      setLoading(false);
    });
    return () => unsub();
  }, [selectedCourse]);

  const createTopic = async (data: { title: string; courseId: string }) => {
    try {
      const courseTopics = topics.filter((t) => t.courseId === data.courseId);
      await addDoc(collection(db, 'topics'), {
        title: data.title,
        slug: slugify(data.title),
        courseId: data.courseId,
        order: courseTopics.length + 1,
        createdAt: serverTimestamp(),
      });
      addToast({ title: 'Topic created!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to create topic', variant: 'destructive' });
    }
  };

  const updateTopic = async (id: string, data: Partial<Topic>) => {
    try {
      await updateDoc(doc(db, 'topics', id), data);
      addToast({ title: 'Topic updated!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const deleteTopic = async (id: string) => {
    if (!confirm('Delete this topic? Questions linked to it will lose their topic reference.')) return;
    try {
      await deleteDoc(doc(db, 'topics', id));
      addToast({ title: 'Topic deleted', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title || id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Topics</h1>
          <p className="text-muted-foreground">Manage topics per course</p>
        </div>
        <TopicFormDialog courses={courses} onSubmit={createTopic}>
          <Button><Plus className="h-4 w-4 mr-2" /> Add Topic</Button>
        </TopicFormDialog>
      </div>

      <div className="flex items-center gap-3">
        <Label>Filter by Course:</Label>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {topics.map((topic) => (
          <Card key={topic.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layers className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">{topic.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {courseTitle(topic.courseId)} • Order: {topic.order}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TopicFormDialog
                    courses={courses}
                    onSubmit={(data) => updateTopic(topic.id, data)}
                    initialData={topic}
                  >
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </TopicFormDialog>
                  <Button variant="ghost" size="icon" onClick={() => deleteTopic(topic.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {topics.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No topics found.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function TopicFormDialog({
  children,
  onSubmit,
  initialData,
  courses,
}: {
  children: React.ReactNode;
  onSubmit: (data: any) => void;
  initialData?: Topic;
  courses: Course[];
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [courseId, setCourseId] = useState(initialData?.courseId || '');

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Topic' : 'Create Topic'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Topic Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Limits and Continuity" />
          </div>
          <div>
            <Label>Course *</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button disabled={!title || !courseId} onClick={() => onSubmit({ title, courseId })}>
              {initialData ? 'Update' : 'Create'}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
