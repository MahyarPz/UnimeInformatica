'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { Question, ExamSession, PracticeMode, SessionAnswer, PracticeSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { logActivity } from '@/lib/firebase/activity';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Flag,
  RotateCcw,
  Lightbulb,
} from 'lucide-react';
import { cn, getDifficultyColor, getScoreBg, calculateAccuracy } from '@/lib/utils';
import { saveDraft, loadDraft, clearDraft, practiceSessionDraftKey } from '@/lib/utils/drafts';
import { handleFirebaseError } from '@/lib/utils/session';
import { motion, AnimatePresence } from 'framer-motion';

function PracticeSessionInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  const courseId = searchParams?.get('course') || '';
  const mode = (searchParams?.get('mode') || 'quick') as PracticeMode;
  const resumeSessionId = searchParams?.get('resume') || '';

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SessionAnswer>>({});
  const [sessionId, setSessionId] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings | null>(null);
  const [startTime] = useState(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [draftRestored, setDraftRestored] = useState(false);

  // Save draft to localStorage periodically (preserves work on session expiry)
  useEffect(() => {
    if (!user || !courseId || questions.length === 0 || submitted) return;
    const draftKey = practiceSessionDraftKey(user.uid, courseId);
    saveDraft(draftKey, {
      currentIndex,
      answers,
      sessionId,
      mode,
      questionIds: questions.map((q) => q.id),
    });
  }, [currentIndex, answers, user, courseId, sessionId, mode, questions, submitted]);

  // Try to restore draft on mount
  useEffect(() => {
    if (!user || !courseId || draftRestored) return;
    const draftKey = practiceSessionDraftKey(user.uid, courseId);
    const draft = loadDraft(draftKey);
    if (draft && draft.currentIndex != null && draft.answers) {
      // Only restore if we're not resuming a specific session
      if (!resumeSessionId && Object.keys(draft.answers).length > 0) {
        setDraftRestored(true);
        // Draft will be used after questions load via the resume path
      }
    }
    setDraftRestored(true);
  }, [user, courseId, resumeSessionId, draftRestored]);

  // Clear draft on successful submit
  useEffect(() => {
    if (submitted && user && courseId) {
      clearDraft(practiceSessionDraftKey(user.uid, courseId));
    }
  }, [submitted, user, courseId]);

  // Load questions
  useEffect(() => {
    if (!user || !courseId) return;

    const loadQuestions = async () => {
      try {
        // Load course practice settings
        let courseSettings: PracticeSettings | null = null;
        try {
          const settingsSnap = await getDoc(doc(db, 'practice_settings', courseId));
          if (settingsSnap.exists()) {
            courseSettings = settingsSnap.data() as PracticeSettings;
            setPracticeSettings(courseSettings);
          }
        } catch (e) {
          console.error('Failed to load practice settings:', e);
        }

        // Check for resume session
        if (resumeSessionId) {
          const sessionDoc = await getDoc(doc(db, 'exam_sessions', resumeSessionId));
          if (sessionDoc.exists()) {
            const session = sessionDoc.data() as ExamSession;
            setSessionId(resumeSessionId);
            setAnswers(session.answers || {});
            setCurrentIndex(session.currentIndex || 0);
            // Load the same questions
            const qDocs = await Promise.all(
              session.questionIds.map((qid) => getDoc(doc(db, 'questions_public', qid)))
            );
            const loadedQs = qDocs.filter((d) => d.exists()).map((d) => {
              const raw = d.data() as any;
              const question: Question = { id: d.id, ...raw } as Question;
              // Normalize old-format options
              if (question.type === 'mcq' && question.options && !Array.isArray(question.options)) {
                const optObj = question.options as any;
                const keys = ['A', 'B', 'C', 'D'].filter((k) => optObj[k] !== undefined);
                const correctKey = raw.correctAnswer || 'A';
                question.options = keys.map((k) => ({ text: optObj[k], isCorrect: k === correctKey }));
                question.correctIndex = keys.indexOf(correctKey);
              }
              return question;
            });
            setQuestions(loadedQs);
            setLoading(false);
            return;
          }
        }

        // Load questions based on mode
        // First try with status filter, fallback to all questions for the course
        let q = query(
          collection(db, 'questions_public'),
          where('courseId', '==', courseId),
          where('status', '==', 'published')
        );

        let snapshot = await getDocs(q);

        // Fallback: if no published questions, load all questions for this course
        if (snapshot.empty) {
          q = query(
            collection(db, 'questions_public'),
            where('courseId', '==', courseId)
          );
          snapshot = await getDocs(q);
        }

        let allQuestions = snapshot.docs.map((d) => {
          const raw = d.data() as any;
          const question: Question = { id: d.id, ...raw } as Question;

          // Normalize old-format options { A: "...", B: "...", ... } → MCQOption[]
          if (question.type === 'mcq' && question.options && !Array.isArray(question.options)) {
            const optObj = question.options as any;
            const keys = ['A', 'B', 'C', 'D'].filter((k) => optObj[k] !== undefined);
            const correctKey = raw.correctAnswer || 'A';
            question.options = keys.map((k) => ({
              text: optObj[k],
              isCorrect: k === correctKey,
            }));
            question.correctIndex = keys.indexOf(correctKey);
          }

          return question;
        });

        // Shuffle questions if enabled (default: true)
        const shouldShuffle = courseSettings?.shuffleQuestions !== false;
        if (shouldShuffle) {
          allQuestions = allQuestions.sort(() => Math.random() - 0.5);
        }

        // Limit based on mode, using practice settings defaultQuestionCount as base
        const defaultCount = courseSettings?.defaultQuestionCount || 10;
        const limit = mode === 'quick' ? defaultCount : mode === 'mock_exam' ? Math.min(defaultCount * 3, allQuestions.length) : Math.round(defaultCount * 1.5);
        allQuestions = allQuestions.slice(0, limit);

        // Shuffle options within each question if enabled (default: true)
        const shouldShuffleOptions = courseSettings?.shuffleOptions !== false;
        if (shouldShuffleOptions) {
          allQuestions = allQuestions.map((q) => {
            if (q.type === 'mcq' && Array.isArray(q.options)) {
              const indices = q.options.map((_, i) => i);
              for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
              }
              const shuffledOptions = indices.map((i) => q.options![i]);
              const newCorrectIndex = indices.indexOf(q.correctIndex ?? 0);
              return { ...q, options: shuffledOptions, correctIndex: newCorrectIndex };
            }
            return q;
          });
        }

        if (allQuestions.length === 0) {
          setLoading(false);
          return;
        }

        // Create session
        const sessionRef = await addDoc(collection(db, 'exam_sessions'), {
          userId: user.uid,
          courseId,
          mode,
          status: 'in_progress',
          questionIds: allQuestions.map((q) => q.id),
          currentIndex: 0,
          answers: {},
          totalQuestions: allQuestions.length,
          startedAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
          timeSpentSeconds: 0,
        });

        setSessionId(sessionRef.id);
        setQuestions(allQuestions);

        await logActivity({
          type: 'practice_started',
          category: 'practice',
          actorUid: user.uid,
          actorUsername: userProfile?.username || '',
          actorRole: userProfile?.role || 'user',
          metadata: { courseId, mode, questionCount: allQuestions.length },
        });
      } catch (error) {
        console.error('Failed to load questions:', error);
        if (handleFirebaseError(error)) return;
        addToast({ title: 'Failed to load questions', variant: 'destructive' });
      }
      setLoading(false);
    };

    loadQuestions();
  }, [user, courseId, mode, resumeSessionId]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleMCQAnswer = (selectedIndex: number) => {
    if (answers[currentQuestion.id]) return; // Already answered
    const isCorrect = selectedIndex === currentQuestion.correctIndex;
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    const answer: SessionAnswer = {
      questionId: currentQuestion.id,
      questionType: 'mcq',
      selectedIndex,
      isCorrect,
      answeredAt: Timestamp.now(),
      timeSpentSeconds: timeSpent,
    };

    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
    setShowResult(true);

    // Update session in Firestore
    if (sessionId) {
      updateDoc(doc(db, 'exam_sessions', sessionId), {
        [`answers.${currentQuestion.id}`]: answer,
        currentIndex,
        lastActiveAt: serverTimestamp(),
      }).catch(console.error);
    }
  };

  const handleEssayAnswer = (text: string) => {
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
    const answer: SessionAnswer = {
      questionId: currentQuestion.id,
      questionType: 'essay',
      essayAnswer: text,
      answeredAt: Timestamp.now(),
      timeSpentSeconds: timeSpent,
    };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowResult(false);
      setShowHint(false);
      setQuestionStartTime(Date.now());
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowResult(!!answers[questions[currentIndex - 1]?.id]);
      setShowHint(false);
    }
  };

  const submitSession = async () => {
    if (!sessionId) return;
    setSubmitted(true);

    const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
    const totalTime = Math.round((Date.now() - startTime) / 1000);

    try {
      await updateDoc(doc(db, 'exam_sessions', sessionId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        score: calculateAccuracy(correctCount, questions.length),
        correctCount,
        timeSpentSeconds: totalTime,
        answers,
      });

      // Update user stats
      const statsRef = doc(db, 'user_stats', user!.uid);
      const statsSnap = await getDoc(statsRef);
      const existingStats = statsSnap.exists() ? statsSnap.data() : {};
      const courseStats = existingStats?.courseStats?.[courseId] || { totalAttempts: 0, totalCorrect: 0 };

      await updateDoc(statsRef, {
        totalAttempts: (existingStats.totalAttempts || 0) + Object.keys(answers).length,
        totalCorrect: (existingStats.totalCorrect || 0) + correctCount,
        totalSessions: (existingStats.totalSessions || 0) + 1,
        [`courseStats.${courseId}.totalAttempts`]: courseStats.totalAttempts + Object.keys(answers).length,
        [`courseStats.${courseId}.totalCorrect`]: courseStats.totalCorrect + correctCount,
        lastPracticeAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(async () => {
        // If doc doesn't exist, create it
        const { setDoc } = await import('firebase/firestore');
        await setDoc(statsRef, {
          uid: user!.uid,
          totalAttempts: Object.keys(answers).length,
          totalCorrect: correctCount,
          totalSessions: 1,
          courseStats: {
            [courseId]: {
              courseId,
              totalAttempts: Object.keys(answers).length,
              totalCorrect: correctCount,
            },
          },
          recentPerformance: [],
          weakAreas: [],
          lastPracticeAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await logActivity({
        type: 'practice_submitted',
        category: 'practice',
        actorUid: user!.uid,
        actorUsername: userProfile?.username || '',
        actorRole: userProfile?.role || 'user',
        metadata: { courseId, mode, score: calculateAccuracy(correctCount, questions.length), questionCount: questions.length },
      });

      addToast({ title: 'Session complete!', description: `Score: ${calculateAccuracy(correctCount, questions.length)}%`, variant: 'success' });
    } catch (error) {
      console.error('Failed to submit session:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading practice session...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="container py-16 text-center">
        <h2 className="text-2xl font-bold mb-2">No questions available</h2>
        <p className="text-muted-foreground mb-4">No published questions found for this course and mode.</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  // Show summary if submitted
  if (submitted) {
    const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
    const totalAnswered = Object.keys(answers).length;
    const score = calculateAccuracy(correctCount, totalAnswered);

    return (
      <div className="container py-8 max-w-2xl">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card>
            <CardHeader className="text-center">
              <div className={`inline-flex mx-auto p-4 rounded-full ${getScoreBg(score)} mb-3`}>
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <CardTitle className="text-2xl">Session Complete!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold">{score}%</div>
                  <p className="text-sm text-muted-foreground">Score</p>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-600">{correctCount}</div>
                  <p className="text-sm text-muted-foreground">Correct</p>
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-600">{totalAnswered - correctCount}</div>
                  <p className="text-sm text-muted-foreground">Wrong</p>
                </div>
              </div>

              {/* Question Review */}
              <div className="space-y-3">
                <h3 className="font-semibold">Review</h3>
                {questions.map((q, i) => {
                  const answer = answers[q.id];
                  return (
                    <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium w-6">{i + 1}.</span>
                      {answer?.isCorrect ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <span className="text-sm truncate flex-1">{q.questionText}</span>
                      <Badge variant="outline" className="text-xs">{q.difficulty}</Badge>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => router.push('/practice')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Practice Hub
                </Button>
                <Button onClick={() => router.push(`/practice/session?course=${courseId}&mode=${mode}`)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Practice Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/practice')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Exit
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{mode.replace('_', ' ')}</Badge>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      <Progress value={progress} className="mb-6 h-2" />

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
                  {currentQuestion.difficulty}
                </Badge>
                {currentQuestion.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
              <CardTitle className="text-lg mt-3">{currentQuestion.questionText}</CardTitle>
            </CardHeader>
            <CardContent>
              {currentQuestion.type === 'mcq' && currentQuestion.options && (
                <div className="space-y-2">
                  {currentQuestion.options.map((option, idx) => {
                    const answer = answers[currentQuestion.id];
                    const isSelected = answer?.selectedIndex === idx;
                    const isCorrect = idx === currentQuestion.correctIndex;
                    const showFeedback = showResult && answer;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleMCQAnswer(idx)}
                        disabled={!!answer}
                        className={cn(
                          'w-full text-left p-4 rounded-lg border-2 transition-all',
                          !answer && 'hover:border-primary hover:bg-primary/5 cursor-pointer',
                          isSelected && !showFeedback && 'border-primary bg-primary/5',
                          showFeedback && isCorrect && 'border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30',
                          showFeedback && isSelected && !isCorrect && 'border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/30',
                          showFeedback && !isSelected && !isCorrect && 'opacity-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-sm">{option.text}</span>
                          {showFeedback && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto shrink-0" />}
                          {showFeedback && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-600 ml-auto shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'essay' && (
                <div className="space-y-3">
                  {currentQuestion.promptText && (
                    <p className="text-muted-foreground text-sm">{currentQuestion.promptText}</p>
                  )}
                  <Textarea
                    placeholder="Type your answer..."
                    value={answers[currentQuestion.id]?.essayAnswer || ''}
                    onChange={(e) => handleEssayAnswer(e.target.value)}
                    rows={6}
                  />
                  {currentQuestion.rubric && currentQuestion.rubric.length > 0 && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">Rubric / Self-Check:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {currentQuestion.rubric.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Explanation — only if showExplanations is enabled in practice settings */}
              {showResult && currentQuestion.explanation && (practiceSettings?.showExplanations !== false) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                >
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Explanation</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{currentQuestion.explanation}</p>
                </motion.div>
              )}

              {/* Hint — only if allowHints is enabled in practice settings */}
              {!showResult && (practiceSettings?.allowHints !== false) && currentQuestion.hints && currentQuestion.hints.length > 0 && (
                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setShowHint(!showHint)}>
                    <Lightbulb className="h-4 w-4 mr-1" /> {showHint ? 'Hide' : 'Show'} Hint
                  </Button>
                  {showHint && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-muted-foreground mt-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg"
                    >
                      {currentQuestion.hints[0]}
                    </motion.p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={goPrev} disabled={currentIndex === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <div className="flex gap-2">
          {currentIndex === questions.length - 1 ? (
            <Button onClick={submitSession} disabled={Object.keys(answers).length === 0}>
              <Flag className="h-4 w-4 mr-1" /> Finish & Submit
            </Button>
          ) : (
            <Button onClick={goNext}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PracticeSessionPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <PracticeSessionInner />
    </Suspense>
  );
}
