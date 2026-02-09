'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Question, Course, Topic } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  Plus, MessageSquare, Trash2, Edit, CheckSquare, XSquare, Search,
  ArrowUpDown, Filter, MoreHorizontal, Loader2,
} from 'lucide-react';

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    const q = query(collection(db, 'questions_public'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = questions.filter((q) => {
    if (filterCourse !== 'all' && q.courseId !== filterCourse) return false;
    if (filterType !== 'all' && q.type !== filterType) return false;
    if (filterDifficulty !== 'all' && String(q.difficulty) !== filterDifficulty) return false;
    if (searchQuery && !q.questionText.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((q) => q.id)));
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} questions?`)) return;
    try {
      const batch = writeBatch(db);
      selected.forEach((id) => batch.delete(doc(db, 'questions_public', id)));
      await batch.commit();
      setSelected(new Set());
      addToast({ title: `${selected.size} questions deleted`, variant: 'success' });
    } catch (error) {
      addToast({ title: 'Bulk delete failed', variant: 'destructive' });
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await deleteDoc(doc(db, 'questions_public', id));
    addToast({ title: 'Question deleted', variant: 'success' });
  };

  const courseName = (id: string) => courses.find((c) => c.id === id)?.title || '';
  const topicName = (id: string) => topics.find((t) => t.id === id)?.title || '';

  const difficultyColors: Record<string, string> = {
    '1': 'bg-green-100 text-green-700',
    '2': 'bg-blue-100 text-blue-700',
    '3': 'bg-yellow-100 text-yellow-700',
    '4': 'bg-orange-100 text-orange-700',
    '5': 'bg-red-100 text-red-700',
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-muted-foreground">{questions.length} public questions total</p>
        </div>
        <QuestionFormDialog courses={courses} topics={topics} addToast={addToast} user={user} userProfile={userProfile}>
          <Button><Plus className="h-4 w-4 mr-2" /> Add Question</Button>
        </QuestionFormDialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search questions..." className="pl-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Course</Label>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="mcq">MCQ</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Difficulty</Label>
              <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {[1,2,3,4,5].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button variant="destructive" size="sm" onClick={bulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete Selected
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={selectAll} />
          <span className="text-sm text-muted-foreground">
            Showing {filtered.length} of {questions.length}
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          filtered.map((q) => (
            <Card key={q.id} className={selected.has(q.id) ? 'ring-2 ring-primary' : ''}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{q.questionText}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-xs">{courseName(q.courseId)}</Badge>
                      {q.topicId && <Badge variant="secondary" className="text-xs">{topicName(q.topicId)}</Badge>}
                      <Badge className={`text-xs ${difficultyColors[String(q.difficulty)] || ''}`}>D{q.difficulty}</Badge>
                      <Badge variant={q.type === 'mcq' ? 'default' : 'secondary'} className="text-xs">{q.type.toUpperCase()}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function QuestionFormDialog({
  children,
  courses,
  topics,
  addToast,
  user,
  userProfile,
}: {
  children: React.ReactNode;
  courses: Course[];
  topics: Topic[];
  addToast: any;
  user: any;
  userProfile: any;
}) {
  const [type, setType] = useState<'mcq' | 'essay'>('mcq');
  const [courseId, setCourseId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState('3');
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [hint, setHint] = useState('');
  const [rubric, setRubric] = useState('');

  const filteredTopics = topics.filter((t) => t.courseId === courseId);

  const handleCreate = async () => {
    if (!questionText || !courseId) return;
    try {
      const data: any = {
        type,
        courseId,
        topicId: topicId || null,
        difficulty: parseInt(difficulty),
        questionText,
        explanation: explanation || null,
        hint: hint || null,
        authorUid: user.uid,
        authorUsername: userProfile.username,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (type === 'mcq') {
        data.options = { A: optionA, B: optionB, C: optionC, D: optionD };
        data.correctAnswer = correctAnswer;
      } else {
        data.rubric = rubric || null;
      }
      await addDoc(collection(db, 'questions_public'), data);
      addToast({ title: 'Question created!', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to create question', variant: 'destructive' });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'mcq' | 'essay')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Course *</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Topic</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {filteredTopics.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Question Text *</Label>
            <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} placeholder="What is the derivative of x²?" />
          </div>
          {type === 'mcq' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Option A</Label><Input value={optionA} onChange={(e) => setOptionA(e.target.value)} /></div>
                <div><Label>Option B</Label><Input value={optionB} onChange={(e) => setOptionB(e.target.value)} /></div>
                <div><Label>Option C</Label><Input value={optionC} onChange={(e) => setOptionC(e.target.value)} /></div>
                <div><Label>Option D</Label><Input value={optionD} onChange={(e) => setOptionD(e.target.value)} /></div>
              </div>
              <div>
                <Label>Correct Answer</Label>
                <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['A','B','C','D'].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {type === 'essay' && (
            <div>
              <Label>Rubric / Grading Criteria</Label>
              <Textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={3} placeholder="Key points the answer should cover..." />
            </div>
          )}
          <div>
            <Label>Explanation</Label>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} placeholder="Why this is the correct answer..." />
          </div>
          <div>
            <Label>Hint</Label>
            <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Think about the power rule..." />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button disabled={!questionText || !courseId} onClick={handleCreate}>Create Question</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
