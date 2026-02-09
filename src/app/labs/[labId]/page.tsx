'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, addDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Lab, LabSession, LabSessionAnswer } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';
import { logActivity } from '@/lib/firebase/activity';
import {
  ArrowLeft,
  ArrowRight,
  Database,
  CheckCircle2,
  Loader2,
  Table2,
  Flag,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, getScoreBg, calculateAccuracy } from '@/lib/utils';

export default function LabRunPage() {
  const params = useParams();
  const labId = params?.labId as string;
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LabSessionAnswer>>({});
  const [sessionId, setSessionId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dataPreview, setDataPreview] = useState<string[][]>([]);

  useEffect(() => {
    if (!labId || !user) return;

    const loadLab = async () => {
      try {
        const labDoc = await getDoc(doc(db, 'labs', labId));
        if (!labDoc.exists()) { setLoading(false); return; }
        const labData = { id: labDoc.id, ...labDoc.data() } as Lab;
        setLab(labData);

        // Check for existing session (resume)
        const sessionQ = query(
          collection(db, 'lab_sessions'),
          where('labId', '==', labId),
          where('userId', '==', user.uid),
          where('status', '==', 'in_progress')
        );
        const sessionSnap = await getDocs(sessionQ);
        if (!sessionSnap.empty) {
          const existingSession = { id: sessionSnap.docs[0].id, ...sessionSnap.docs[0].data() } as LabSession;
          setSessionId(existingSession.id);
          setAnswers(existingSession.answers || {});
        } else {
          // Create new session
          const sessionRef = await addDoc(collection(db, 'lab_sessions'), {
            labId,
            userId: user.uid,
            courseId: labData.courseId,
            status: 'in_progress',
            answers: {},
            startedAt: serverTimestamp(),
            lastActiveAt: serverTimestamp(),
          });
          setSessionId(sessionRef.id);
        }

        // Fetch CSV preview (simulated - in production, would fetch from Storage)
        setDataPreview([
          labData.previewColumns || ['Column A', 'Column B', 'Column C'],
          ['Sample data 1', 'Sample data 2', 'Sample data 3'],
          ['Sample data 4', 'Sample data 5', 'Sample data 6'],
          ['Sample data 7', 'Sample data 8', 'Sample data 9'],
        ]);
      } catch (error) {
        console.error('Failed to load lab:', error);
      }
      setLoading(false);
    };

    loadLab();
  }, [labId, user]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!lab || !user) return <div className="container py-16 text-center"><h2 className="text-2xl font-bold">Lab not found</h2><Button onClick={() => router.back()} className="mt-4">Go Back</Button></div>;

  const currentQuestion = lab.questions?.[currentIndex];
  const progress = lab.questions?.length ? ((currentIndex + 1) / lab.questions.length) * 100 : 0;

  const handleAnswer = (value: string) => {
    if (!currentQuestion) return;
    const answer: LabSessionAnswer = {
      questionId: currentQuestion.id,
      answer: value,
      answeredAt: Timestamp.now(),
    };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
    if (sessionId) {
      updateDoc(doc(db, 'lab_sessions', sessionId), {
        [`answers.${currentQuestion.id}`]: answer,
        lastActiveAt: serverTimestamp(),
      }).catch(console.error);
    }
  };

  const submitLab = async () => {
    setSubmitted(true);
    // Score MCQ and numeric answers
    let correct = 0;
    lab.questions?.forEach((q) => {
      const a = answers[q.id];
      if (!a) return;
      if (q.type === 'mcq' && a.answer === q.correctAnswer) correct++;
      if (q.type === 'numeric' && q.correctAnswer) {
        const tolerance = q.tolerance || 0;
        const diff = Math.abs(parseFloat(a.answer) - parseFloat(q.correctAnswer));
        if (diff <= tolerance) correct++;
      }
    });

    if (sessionId) {
      await updateDoc(doc(db, 'lab_sessions', sessionId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        score: calculateAccuracy(correct, lab.questions?.length || 1),
        answers,
      });
    }

    await logActivity({
      type: 'lab_submitted',
      category: 'labs',
      actorUid: user.uid,
      actorUsername: userProfile?.username || '',
      actorRole: userProfile?.role || 'user',
      metadata: { labId, courseId: lab.courseId, score: calculateAccuracy(correct, lab.questions?.length || 1) },
    });

    addToast({ title: 'Lab submitted!', variant: 'success' });
  };

  if (submitted) {
    return (
      <div className="container py-8 max-w-2xl text-center">
        <Card>
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Lab Complete!</h2>
            <p className="text-muted-foreground mb-6">Your answers have been submitted.</p>
            <Button onClick={() => router.push('/courses')}>Back to Courses</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <h1 className="text-2xl font-bold mb-2">{lab.title}</h1>
      <p className="text-muted-foreground mb-4">{lab.description}</p>
      <Progress value={progress} className="mb-6 h-2" />

      {/* Dataset Preview */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Table2 className="h-5 w-5" /> Dataset Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>{dataPreview[0]?.map((h, i) => <th key={i} className="border p-2 bg-muted font-medium text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {dataPreview.slice(1).map((row, ri) => (
                  <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border p-2">{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {lab.datasetUrl && (
            <Button variant="link" size="sm" className="mt-2" asChild>
              <a href={lab.datasetUrl} download>Download full dataset</a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Question */}
      {currentQuestion && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline">Q{currentIndex + 1} of {lab.questions?.length}</Badge>
              <Badge variant="secondary">{currentQuestion.type}</Badge>
            </div>
            <CardTitle className="text-lg mt-2">{currentQuestion.questionText}</CardTitle>
          </CardHeader>
          <CardContent>
            {currentQuestion.type === 'mcq' && currentQuestion.options && (
              <div className="space-y-2">
                {(Array.isArray(currentQuestion.options) ? currentQuestion.options : Object.values(currentQuestion.options)).map((opt: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(opt)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border-2 transition-all hover:border-primary',
                      answers[currentQuestion.id]?.answer === opt && 'border-primary bg-primary/5'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {(currentQuestion.type === 'numeric') && (
              <Input
                type="number"
                step="any"
                value={answers[currentQuestion.id]?.answer || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Enter numeric answer..."
              />
            )}
            {(currentQuestion.type === 'short_text' || currentQuestion.type === 'interpretation') && (
              <Textarea
                value={answers[currentQuestion.id]?.answer || ''}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Type your answer..."
                rows={4}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {currentIndex === (lab.questions?.length || 1) - 1 ? (
          <Button onClick={submitLab}><Flag className="h-4 w-4 mr-1" /> Submit Lab</Button>
        ) : (
          <Button onClick={() => setCurrentIndex(currentIndex + 1)}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
