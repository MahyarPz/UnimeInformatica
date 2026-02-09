'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Course } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { logAudit } from '@/lib/firebase/activity';
import { Plus, Edit, Trash2, GripVertical, BookOpen } from 'lucide-react';
import { slugify } from '@/lib/utils';

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Course)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const createCourse = async (data: Partial<Course>) => {
    try {
      const slug = slugify(data.title || '');
      await addDoc(collection(db, 'courses'), {
        title: data.title,
        slug,
        shortDescription: data.shortDescription || '',
        whatYouLearn: data.whatYouLearn || '',
        syllabus: data.syllabus || '',
        examInfo: data.examInfo || '',
        recommendedResources: data.recommendedResources || '',
        order: courses.length + 1,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit({
        action: 'course_created',
        category: 'courses',
        actorUid: user!.uid,
        actorUsername: userProfile!.username,
        actorRole: userProfile!.role,
        details: { title: data.title, slug },
      });
      addToast({ title: 'Course created!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to create course', variant: 'destructive' });
    }
  };

  const updateCourse = async (id: string, data: Partial<Course>) => {
    try {
      await updateDoc(doc(db, 'courses', id), { ...data, updatedAt: serverTimestamp() });
      addToast({ title: 'Course updated!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to update course', variant: 'destructive' });
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Delete this course? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'courses', id));
      addToast({ title: 'Course deleted', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted-foreground">Manage your course catalog</p>
        </div>
        <CourseFormDialog onSubmit={createCourse}>
          <Button><Plus className="h-4 w-4 mr-2" /> Add Course</Button>
        </CourseFormDialog>
      </div>

      <div className="space-y-3">
        {courses.map((course) => (
          <Card key={course.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{course.title}</p>
                    <p className="text-xs text-muted-foreground">/{course.slug} • Order: {course.order}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={course.active ? 'success' : 'secondary'}>
                    {course.active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Switch
                    checked={course.active}
                    onCheckedChange={(checked) => updateCourse(course.id, { active: checked })}
                  />
                  <CourseFormDialog onSubmit={(data) => updateCourse(course.id, data)} initialData={course}>
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  </CourseFormDialog>
                  <Button variant="ghost" size="icon" onClick={() => deleteCourse(course.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {courses.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No courses yet. Create your first course above.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CourseFormDialog({
  children,
  onSubmit,
  initialData,
}: {
  children: React.ReactNode;
  onSubmit: (data: Partial<Course>) => void;
  initialData?: Course;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [shortDescription, setShortDescription] = useState(initialData?.shortDescription || '');
  const [whatYouLearn, setWhatYouLearn] = useState(initialData?.whatYouLearn || '');
  const [syllabus, setSyllabus] = useState(initialData?.syllabus || '');
  const [examInfo, setExamInfo] = useState(initialData?.examInfo || '');
  const [recommendedResources, setRecommendedResources] = useState(initialData?.recommendedResources || '');

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Course' : 'Create Course'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Calculus 1" />
            {title && <p className="text-xs text-muted-foreground mt-1">Slug: {slugify(title)}</p>}
          </div>
          <div>
            <Label>Short Description</Label>
            <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Introduction to limits, derivatives..." />
          </div>
          <div>
            <Label>What You&apos;ll Learn (HTML/rich text)</Label>
            <Textarea value={whatYouLearn} onChange={(e) => setWhatYouLearn(e.target.value)} rows={4} placeholder="<ul><li>Limits and continuity</li>...</ul>" />
          </div>
          <div>
            <Label>Syllabus (HTML)</Label>
            <Textarea value={syllabus} onChange={(e) => setSyllabus(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Exam Information (HTML)</Label>
            <Textarea value={examInfo} onChange={(e) => setExamInfo(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Recommended Resources (HTML)</Label>
            <Textarea value={recommendedResources} onChange={(e) => setRecommendedResources(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSubmit({ title, shortDescription, whatYouLearn, syllabus, examInfo, recommendedResources })}>
              {initialData ? 'Update' : 'Create'}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
