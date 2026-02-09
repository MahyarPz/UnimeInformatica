'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, where,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { Lab, LabQuestion, Course } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  Plus, FlaskConical, Trash2, Edit, Upload, Database, Eye, EyeOff, Loader2,
  FileSpreadsheet, HelpCircle, PlusCircle, X,
} from 'lucide-react';

export default function AdminLabsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'courses'), orderBy('order')), (snap) =>
      setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course)))
    );
    const unsub2 = onSnapshot(query(collection(db, 'labs'), orderBy('createdAt', 'desc')), (snap) => {
      setLabs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lab)));
      setLoading(false);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const toggleActive = async (id: string, active: boolean) => {
    await updateDoc(doc(db, 'labs', id), { active: !active, updatedAt: serverTimestamp() });
  };

  const deleteLab = async (id: string) => {
    if (!confirm('Delete this lab? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'labs', id));
      addToast({ title: 'Lab deleted', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.title || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Labs</h1>
          <p className="text-muted-foreground">Create and manage data analysis labs</p>
        </div>
        <LabFormDialog courses={courses} user={user} userProfile={userProfile} addToast={addToast}>
          <Button><Plus className="h-4 w-4 mr-2" /> Create Lab</Button>
        </LabFormDialog>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : labs.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No labs created yet.</CardContent></Card>
        ) : (
          labs.map((lab) => (
            <Card key={lab.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <FlaskConical className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">{lab.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {courseName(lab.courseId)} • {lab.questions?.length || 0} questions
                        • Difficulty: {lab.difficulty}
                      </p>
                      {lab.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{lab.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={lab.active ? 'success' : 'secondary'}>
                      {lab.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Switch checked={lab.active} onCheckedChange={() => toggleActive(lab.id, lab.active)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteLab(lab.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function LabFormDialog({
  children,
  courses,
  user,
  userProfile,
  addToast,
}: {
  children: React.ReactNode;
  courses: Course[];
  user: any;
  userProfile: any;
  addToast: any;
}) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('3');
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [questions, setQuestions] = useState<Partial<LabQuestion>[]>([
    { questionText: '', type: 'mcq', options: { A: '', B: '', C: '', D: '' }, correctAnswer: '' },
  ]);

  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', type: 'mcq', options: { A: '', B: '', C: '', D: '' }, correctAnswer: '' }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...questions];
    if (field.startsWith('option_')) {
      const key = field.replace('option_', '');
      updated[idx] = { ...updated[idx], options: { ...updated[idx].options, [key]: value } };
    } else {
      (updated[idx] as any)[field] = value;
    }
    setQuestions(updated);
  };

  const handleCreate = async () => {
    if (!title || !courseId) return;
    setUploading(true);

    try {
      let datasetUrl = '';
      let datasetName = '';

      if (datasetFile) {
        const fileRef = ref(storage, `labs/${courseId}/${Date.now()}_${datasetFile.name}`);
        const task = uploadBytesResumable(fileRef, datasetFile);
        task.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100));
        await task;
        datasetUrl = await getDownloadURL(fileRef);
        datasetName = datasetFile.name;
      }

      await addDoc(collection(db, 'labs'), {
        title,
        courseId,
        description,
        difficulty: parseInt(difficulty),
        datasetUrl,
        datasetName,
        questions: questions.map((q, i) => ({
          id: `q${i + 1}`,
          questionText: q.questionText,
          type: q.type,
          options: q.type === 'mcq' ? q.options : null,
          correctAnswer: q.correctAnswer || null,
        })),
        active: true,
        authorUid: user.uid,
        authorUsername: userProfile.username,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      addToast({ title: 'Lab created!', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to create lab', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Lab</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Analyzing Student Grades" />
            </div>
            <div>
              <Label>Course *</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dataset (CSV)</Label>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setDatasetFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          {uploading && <Progress value={uploadProgress} />}

          {/* Questions Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <HelpCircle className="h-4 w-4" /> Questions
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <PlusCircle className="h-4 w-4 mr-1" /> Add Question
              </Button>
            </div>
            {questions.map((q, idx) => (
              <Card key={idx} className="border-dashed">
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Q{idx + 1}</span>
                    {questions.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeQuestion(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    value={q.questionText}
                    onChange={(e) => updateQuestion(idx, 'questionText', e.target.value)}
                    placeholder="What is the mean of column X?"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={q.type || 'mcq'} onValueChange={(v) => updateQuestion(idx, 'type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">MCQ</SelectItem>
                        <SelectItem value="numeric">Numeric</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={q.correctAnswer || ''}
                      onChange={(e) => updateQuestion(idx, 'correctAnswer', e.target.value)}
                      placeholder="Correct answer"
                    />
                  </div>
                  {q.type === 'mcq' && (
                    <div className="grid grid-cols-2 gap-2">
                      {['A','B','C','D'].map((key) => (
                        <Input
                          key={key}
                          value={(q.options as any)?.[key] || ''}
                          onChange={(e) => updateQuestion(idx, `option_${key}`, e.target.value)}
                          placeholder={`Option ${key}`}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={uploading}>Cancel</Button></DialogClose>
          <Button onClick={handleCreate} disabled={!title || !courseId || uploading}>
            {uploading ? 'Creating...' : 'Create Lab'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
