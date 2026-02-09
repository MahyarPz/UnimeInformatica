'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, where, getDocs,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { Note, Course, Topic } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
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
import { logAudit } from '@/lib/firebase/activity';
import { Plus, FileText, Trash2, Edit, Upload, Eye, EyeOff, Download, ExternalLink } from 'lucide-react';

export default function AdminNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, 'courses'), orderBy('order')), (snap) =>
      setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course)))
    );
    const unsub2 = onSnapshot(query(collection(db, 'topics'), orderBy('order')), (snap) =>
      setTopics(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Topic)))
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    let q;
    if (selectedCourse && selectedCourse !== 'all') {
      q = query(collection(db, 'notes'), where('courseId', '==', selectedCourse), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'notes'), orderBy('createdAt', 'desc'));
    }
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note)));
      setLoading(false);
    });
    return () => unsub();
  }, [selectedCourse]);

  const togglePublic = async (id: string, isPublic: boolean) => {
    await updateDoc(doc(db, 'notes', id), { isPublic: !isPublic, updatedAt: serverTimestamp() });
  };

  const deleteNote = async (note: Note) => {
    if (!confirm('Delete this note?')) return;
    try {
      if (note.fileUrl) {
        try {
          const fileRef = ref(storage, note.fileUrl);
          await deleteObject(fileRef);
        } catch {}
      }
      await deleteDoc(doc(db, 'notes', note.id));
      addToast({ title: 'Note deleted', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title || '';
  const topicTitle = (id: string) => topics.find((t) => t.id === id)?.title || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-muted-foreground">Manage uploaded notes and resources</p>
        </div>
        <NoteUploadDialog courses={courses} topics={topics} user={user} userProfile={userProfile} addToast={addToast}>
          <Button><Plus className="h-4 w-4 mr-2" /> Upload Note</Button>
        </NoteUploadDialog>
      </div>

      <div className="flex items-center gap-3">
        <Label>Course:</Label>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-64"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">{note.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {courseTitle(note.courseId)}
                      {note.topicId && ` • ${topicTitle(note.topicId)}`}
                      {' • by @'}{note.creatorUsername}
                    </p>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {note.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={note.isPublic ? 'success' : 'secondary'}>
                    {note.isPublic ? 'Public' : 'Private'}
                  </Badge>
                  <Switch
                    checked={note.isPublic}
                    onCheckedChange={() => togglePublic(note.id, note.isPublic)}
                  />
                  {note.fileUrl && (
                    <a href={note.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                    </a>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => deleteNote(note)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {notes.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No notes found.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

function NoteUploadDialog({
  children,
  courses,
  topics,
  user,
  userProfile,
  addToast,
}: {
  children: React.ReactNode;
  courses: Course[];
  topics: Topic[];
  user: any;
  userProfile: any;
  addToast: any;
}) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const filteredTopics = topics.filter((t) => t.courseId === courseId);

  const handleUpload = async () => {
    if (!title || !courseId || !file) return;
    setUploading(true);

    try {
      const fileRef = ref(storage, `notes/${courseId}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on('state_changed', (snapshot) => {
        setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      });

      await uploadTask;
      const fileUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'notes'), {
        title,
        courseId,
        topicId: topicId || null,
        description,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        isPublic: true,
        creatorId: user.uid,
        creatorUsername: userProfile.username,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      addToast({ title: 'Note uploaded!', variant: 'success' });
      setTitle('');
      setCourseId('');
      setTopicId('');
      setDescription('');
      setTags('');
      setFile(null);
      setProgress(0);
    } catch (error: any) {
      console.error('Note upload failed:', error);
      addToast({ title: 'Upload failed', description: error?.message || 'Check console for details', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 1 - Introduction" />
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
          {courseId && filteredTopics.length > 0 && (
            <div>
              <Label>Topic</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue placeholder="Select topic (optional)" /></SelectTrigger>
                <SelectContent>
                  {filteredTopics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description..." />
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="limits, derivatives, exam-prep" />
          </div>
          <div>
            <Label>File *</Label>
            <Input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          {uploading && <Progress value={progress} />}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={uploading}>Cancel</Button></DialogClose>
          <Button onClick={handleUpload} disabled={!title || !courseId || !file || uploading}>
            {uploading ? `Uploading ${Math.round(progress)}%` : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
