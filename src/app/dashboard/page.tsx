'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen,
  MessageSquare,
  FileText,
  BarChart3,
  FlaskConical,
  Target,
  Settings,
  Shield,
  Heart,
  Clock,
  Plus,
  Upload,
  Send,
  Eye,
  EyeOff,
  Edit,
  Loader2,
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useCourses } from '@/lib/hooks/useCourses';
import { Question, Note, ExamSession } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { t } from '@/lib/i18n';

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const { courses } = useCourses();

  // My Practice History
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  // My Private Questions
  const [myQuestions, setMyQuestions] = useState<Question[]>([]);
  // My Private Notes
  const [myNotes, setMyNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!user) return;

    // Load practice sessions
    const sessionsQ = query(
      collection(db, 'exam_sessions'),
      where('userId', '==', user.uid),
      orderBy('startedAt', 'desc')
    );
    const unsubSessions = onSnapshot(sessionsQ, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExamSession)));
    }, (err) => console.error('exam_sessions query failed:', err));

    // Load private questions
    const questionsQ = query(
      collection(db, 'questions_private'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubQuestions = onSnapshot(questionsQ, (snap) => {
      setMyQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Question)));
    }, (err) => console.error('questions_private query failed:', err));

    // Load private notes
    const notesQ = query(
      collection(db, 'notes'),
      where('creatorId', '==', user.uid),
      where('isPublic', '==', false),
      orderBy('createdAt', 'desc')
    );
    const unsubNotes = onSnapshot(notesQ, (snap) => {
      setMyNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note)));
    }, (err) => console.error('notes query failed:', err));

    return () => { unsubSessions(); unsubQuestions(); unsubNotes(); };
  }, [user]);

  if (authLoading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user || !userProfile) { router.push('/login'); return null; }

  const createPrivateQuestion = async (data: any) => {
    try {
      await addDoc(collection(db, 'questions_private'), {
        ...data,
        creatorId: user.uid,
        creatorUsername: userProfile.username,
        isPublic: false,
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Question created!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to create question', variant: 'destructive' });
    }
  };

  const submitForReview = async (question: Question) => {
    try {
      await addDoc(collection(db, 'review_queue'), {
        questionId: question.id,
        questionData: {
          questionText: question.questionText,
          type: question.type,
          options: question.options || null,
          correctIndex: question.correctIndex ?? null,
          explanation: question.explanation || '',
          hints: question.hints || [],
          difficulty: question.difficulty,
          tags: question.tags || [],
          courseId: question.courseId,
          topicId: question.topicId || null,
        },
        submitterId: user.uid,
        submitterUid: user.uid,
        submitterUsername: userProfile.username,
        courseId: question.courseId,
        topicId: question.topicId || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      // Update question status
      await updateDoc(doc(db, 'questions_private', question.id), {
        status: 'pending_review',
        updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Question submitted for review!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to submit for review', variant: 'destructive' });
    }
  };

  const createPrivateNote = async (data: { title: string; content: string; courseId: string; tags: string[] }) => {
    try {
      await addDoc(collection(db, 'notes'), {
        ...data,
        creatorId: user.uid,
        creatorUsername: userProfile.username,
        isPublic: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addToast({ title: 'Note created!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to create note', variant: 'destructive' });
    }
  };

  return (
    <div className="container py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-6">{t('dashboard.title')}</h1>

        <Tabs defaultValue="practice" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="practice"><BarChart3 className="h-4 w-4 mr-1" /> {t('dashboard.practice')}</TabsTrigger>
            <TabsTrigger value="mistakes"><Clock className="h-4 w-4 mr-1" /> {t('dashboard.mistakes')}</TabsTrigger>
            <TabsTrigger value="notes"><FileText className="h-4 w-4 mr-1" /> {t('dashboard.notes')}</TabsTrigger>
            <TabsTrigger value="questions"><MessageSquare className="h-4 w-4 mr-1" /> {t('dashboard.questions')}</TabsTrigger>
            <TabsTrigger value="labs"><FlaskConical className="h-4 w-4 mr-1" /> {t('dashboard.labs')}</TabsTrigger>
            <TabsTrigger value="goals"><Target className="h-4 w-4 mr-1" /> {t('dashboard.goals')}</TabsTrigger>
            <TabsTrigger value="account"><Settings className="h-4 w-4 mr-1" /> {t('dashboard.account')}</TabsTrigger>
          </TabsList>

          {/* Practice History */}
          <TabsContent value="practice">
            <Card>
              <CardHeader>
                <CardTitle>Practice History</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No practice sessions yet. Start practicing to see your history.</p>
                    <Button asChild className="mt-4"><a href="/practice">Go to Practice Hub</a></Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.slice(0, 20).map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{session.mode}</Badge>
                          <div>
                            <p className="text-sm font-medium">{session.totalQuestions} questions</p>
                            <p className="text-xs text-muted-foreground">{formatDate(session.startedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {session.score !== undefined && (
                            <Badge variant={session.score >= 70 ? 'success' : 'destructive'}>{session.score}%</Badge>
                          )}
                          <Badge variant={session.status === 'completed' ? 'secondary' : 'outline'}>
                            {session.status}
                          </Badge>
                          {session.status === 'in_progress' && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={`/practice/session?resume=${session.id}&course=${session.courseId}&mode=${session.mode}`}>
                                Resume
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mistakes */}
          <TabsContent value="mistakes">
            <Card>
              <CardHeader>
                <CardTitle>My Mistakes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Wrong answers from your practice sessions will appear here for review.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes */}
          <TabsContent value="notes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>My Notes</CardTitle>
                <CreateNoteDialog courses={courses} onSubmit={createPrivateNote} />
              </CardHeader>
              <CardContent>
                {myNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Create private notes to help you study.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myNotes.map((note) => (
                      <div key={note.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{note.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                        </div>
                        <div className="flex gap-1">
                          {note.tags?.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions */}
          <TabsContent value="questions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>My Questions</CardTitle>
                <CreateQuestionDialog courses={courses} onSubmit={createPrivateQuestion} />
              </CardHeader>
              <CardContent>
                {myQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Create private questions for personal practice, or submit them for public review.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myQuestions.map((q) => (
                      <div key={q.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{q.questionText}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{q.type}</Badge>
                              <Badge className={`text-xs ${
                                q.status === 'approved' ? 'bg-green-100 text-green-700' :
                                q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                q.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                                ''
                              }`} variant="outline">{q.status === 'pending_review' ? 'Under Review' : q.status}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <EditQuestionDialog question={q} courses={courses} onSubmit={async (data) => {
                              try {
                                await updateDoc(doc(db, 'questions_private', q.id), { ...data, updatedAt: serverTimestamp() });
                                addToast({ title: 'Question updated!', variant: 'success' });
                              } catch { addToast({ title: 'Failed to update', variant: 'destructive' }); }
                            }} />
                            {q.status === 'draft' && (
                              <Button size="sm" variant="outline" onClick={() => submitForReview(q)}>
                                <Send className="h-3 w-3 mr-1" /> Submit
                              </Button>
                            )}
                            {q.status === 'rejected' && (
                              <Button size="sm" variant="outline" onClick={() => {
                                updateDoc(doc(db, 'questions_private', q.id), { status: 'draft', updatedAt: serverTimestamp() });
                              }}>
                                Resubmit
                              </Button>
                            )}
                          </div>
                        </div>
                        {q.status === 'rejected' && (q as any).reviewFeedback && (
                          <div className="bg-red-50 p-2 rounded text-xs text-red-700">
                            <strong>Feedback:</strong> {(q as any).reviewFeedback}
                          </div>
                        )}
                        {q.status === 'approved' && (
                          <div className="bg-green-50 p-2 rounded text-xs text-green-700">
                            ✅ This question has been approved and added to the public pool!
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Labs */}
          <TabsContent value="labs">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Your lab sessions and progress will appear here.</p>
                <Button asChild className="mt-4"><a href="/courses">Browse Course Labs</a></Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Goals & Settings */}
          <TabsContent value="goals">
            <Card>
              <CardHeader><CardTitle>Goals & Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Daily Questions Goal</Label>
                    <Input type="number" defaultValue={userProfile.goals?.dailyQuestions || 10} min={1} />
                  </div>
                  <div className="space-y-2">
                    <Label>Weekly Practice (minutes)</Label>
                    <Input type="number" defaultValue={userProfile.goals?.weeklyPracticeMinutes || 120} min={10} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Score (%)</Label>
                    <Input type="number" defaultValue={userProfile.goals?.targetScore || 80} min={50} max={100} />
                  </div>
                </div>
                <Button>Save Goals</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account & Privacy */}
          <TabsContent value="account">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Account Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea defaultValue={userProfile.bio || ''} placeholder="Tell us about yourself..." />
                  </div>
                  <Button>Update Profile</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Privacy Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Public Profile</p>
                      <p className="text-xs text-muted-foreground">Allow others to view your profile at /u/{userProfile.username}</p>
                    </div>
                    <Switch defaultChecked={userProfile.publicProfile} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Show Display Name</p>
                      <p className="text-xs text-muted-foreground">Show your real name on your public profile</p>
                    </div>
                    <Switch defaultChecked={userProfile.showDisplayName} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Show Contributions</p>
                      <p className="text-xs text-muted-foreground">Show your published questions on your profile</p>
                    </div>
                    <Switch defaultChecked={userProfile.showContributions} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Support & Referral</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Supporter tiers and referral program coming soon!</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

// --- Dialog Components ---

function CreateNoteDialog({ courses, onSubmit }: { courses: any[]; onSubmit: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [courseId, setCourseId] = useState('');
  const [tags, setTags] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Note</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Private Note</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} /></div>
          <div><Label>Tags (comma-separated)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="review, chapter1" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSubmit({ title, content, courseId, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })}>Create</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateQuestionDialog({ courses, onSubmit }: { courses: any[]; onSubmit: (data: any) => void }) {
  const [text, setText] = useState('');
  const [type, setType] = useState<'mcq' | 'essay'>('mcq');
  const [courseId, setCourseId] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [explanation, setExplanation] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Question</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Private Question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
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
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Question Text</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} /></div>
          {type === 'mcq' && (
            <div className="space-y-2">
              <Label>Options</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={correctIdx === i} onChange={() => setCorrectIdx(i)} />
                  <Input value={opt} onChange={(e) => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} placeholder={`Option ${i + 1}`} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Select the correct answer</p>
            </div>
          )}
          <div><Label>Explanation</Label><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why this is correct..." /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSubmit({
              questionText: text,
              type,
              courseId,
              difficulty,
              options: type === 'mcq' ? options.map((text, i) => ({ text, isCorrect: i === correctIdx })) : undefined,
              correctIndex: type === 'mcq' ? correctIdx : undefined,
              explanation,
              tags: [],
            })}>Create</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditQuestionDialog({ question, courses, onSubmit }: { question: Question; courses: any[]; onSubmit: (data: any) => void }) {
  const [text, setText] = useState(question.questionText || '');
  const [type, setType] = useState<'mcq' | 'essay'>(question.type as any || 'mcq');
  const [courseId, setCourseId] = useState(question.courseId || '');
  const [difficulty, setDifficulty] = useState(String(question.difficulty || 'medium'));
  const [options, setOptions] = useState(
    question.options?.map((o: any) => typeof o === 'string' ? o : o.text) || ['', '', '', '']
  );
  const [correctIdx, setCorrectIdx] = useState(
    question.correctIndex ?? question.options?.findIndex((o: any) => o.isCorrect) ?? 0
  );
  const [explanation, setExplanation] = useState(question.explanation || '');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Edit className="h-3 w-3" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
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
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Question Text</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} /></div>
          {type === 'mcq' && (
            <div className="space-y-2">
              <Label>Options</Label>
              {options.map((opt: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="editCorrect" checked={correctIdx === i} onChange={() => setCorrectIdx(i)} />
                  <Input value={opt} onChange={(e) => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} placeholder={`Option ${i + 1}`} />
                </div>
              ))}
            </div>
          )}
          <div><Label>Explanation</Label><Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onSubmit({
              questionText: text,
              type,
              courseId,
              difficulty,
              options: type === 'mcq' ? options.map((text: string, i: number) => ({ text, isCorrect: i === correctIdx })) : undefined,
              correctIndex: type === 'mcq' ? correctIdx : undefined,
              explanation,
            })}>Save Changes</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
