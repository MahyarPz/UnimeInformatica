'use client';

import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, updateDoc, doc, serverTimestamp,
  where, addDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ReviewRequest, Course, Topic } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { logAudit } from '@/lib/firebase/activity';
import { timeAgo } from '@/lib/utils';
import {
  CheckCircle, XCircle, Clock, MessageSquare, Eye, Loader2,
  ThumbsUp, ThumbsDown, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';

export default function AdminReviewQueuePage() {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [courses, setCourses] = useState<Record<string, string>>({});
  const [topics, setTopics] = useState<Record<string, string>>({});
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'courses'), (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((d) => (map[d.id] = d.data().title));
      setCourses(map);
    }, (err) => { console.error('courses query failed:', err); });
    const unsub2 = onSnapshot(collection(db, 'topics'), (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((d) => (map[d.id] = d.data().title));
      setTopics(map);
    }, (err) => { console.error('topics query failed:', err); });
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(
      collection(db, 'review_queue'),
      where('status', '==', tab),
      orderBy('createdAt', tab === 'pending' ? 'asc' : 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewRequest)));
      setLoading(false);
    }, (err) => {
      console.error('review_queue query failed:', err);
      if (err.code === 'permission-denied') {
        setError('Permission denied. Try logging out and back in to refresh your admin token.');
      } else {
        setError(`Query failed: ${err.message}`);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [tab]);

  const approveRequest = async (request: ReviewRequest) => {
    try {
      // Copy question to public pool, preserving original author
      const questionData: any = {
        ...request.questionData,
        authorUid: request.submitterUid,
        authorUsername: request.submitterUsername,
        approvedBy: user!.uid,
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'questions_public'), questionData);

      // Mark review as approved
      await updateDoc(doc(db, 'review_queue', request.id), {
        status: 'approved',
        reviewedBy: user!.uid,
        reviewedAt: serverTimestamp(),
      });

      // Update user's private question status
      if (request.questionId) {
        try {
          await updateDoc(doc(db, 'questions_private', request.questionId), {
            status: 'approved',
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.error('Could not update private question status:', e);
        }
      }

      await logAudit({
        action: 'question_approved',
        category: 'questions',
        actorUid: user!.uid,
        actorUsername: userProfile!.username,
        actorRole: userProfile!.role,
        targetId: request.submitterUid,
        details: { requestId: request.id },
      });

      addToast({ title: 'Question approved and added to public pool!', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to approve', variant: 'destructive' });
    }
  };

  const rejectRequest = async (request: ReviewRequest, feedback: string) => {
    try {
      await updateDoc(doc(db, 'review_queue', request.id), {
        status: 'rejected',
        reviewedBy: user!.uid,
        reviewedAt: serverTimestamp(),
        feedback,
      });

      // Update user's private question status so they see the rejection
      if (request.questionId) {
        try {
          await updateDoc(doc(db, 'questions_private', request.questionId), {
            status: 'rejected',
            reviewFeedback: feedback,
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.error('Could not update private question status:', e);
        }
      }

      await logAudit({
        action: 'question_rejected',
        category: 'questions',
        actorUid: user!.uid,
        actorUsername: userProfile!.username,
        actorRole: userProfile!.role,
        targetId: request.submitterUid,
        details: { requestId: request.id, feedback },
      });

      addToast({ title: 'Question rejected', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to reject', variant: 'destructive' });
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground">Review user-submitted questions for the public pool</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending" className="flex gap-1.5">
            <Clock className="h-4 w-4" /> Pending
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex gap-1.5">
            <CheckCircle className="h-4 w-4" /> Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex gap-1.5">
            <XCircle className="h-4 w-4" /> Rejected
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {tab} review requests.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <ReviewCard
              key={req.id}
              request={req}
              courses={courses}
              topics={topics}
              onApprove={() => approveRequest(req)}
              onReject={(feedback) => rejectRequest(req, feedback)}
              isPending={tab === 'pending'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  request,
  courses,
  topics,
  onApprove,
  onReject,
  isPending,
}: {
  request: ReviewRequest;
  courses: Record<string, string>;
  topics: Record<string, string>;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showReject, setShowReject] = useState(false);
  const q = request.questionData;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{q?.type?.toUpperCase() || 'MCQ'}</Badge>
              <Badge variant="secondary">{courses[q?.courseId] || 'Unknown'}</Badge>
              {q?.topicId && <Badge variant="secondary">{topics[q.topicId]}</Badge>}
              <Badge className={`text-xs ${q?.difficulty ? `bg-blue-100 text-blue-700` : ''}`}>
                D{q?.difficulty || '?'}
              </Badge>
            </div>
            <p className="text-sm font-medium">{q?.questionText || 'No text'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              by @{request.submitterUsername} • {request.createdAt ? timeAgo(request.createdAt) : 'just now'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t space-y-2 text-sm">
            {q?.type === 'mcq' && q?.options && Array.isArray(q.options) && (
              <div className="space-y-1">
                {q.options.map((opt: any, idx: number) => (
                  <div key={idx} className={`px-2 py-1 rounded text-sm ${(opt.isCorrect || idx === q.correctIndex) ? 'bg-green-50 dark:bg-green-950/30 font-medium text-green-700 dark:text-green-300' : 'bg-muted'}`}>
                    <strong>{String.fromCharCode(65 + idx)}.</strong> {typeof opt === 'string' ? opt : opt.text}
                  </div>
                ))}
              </div>
            )}
            {q?.explanation && (
              <div className="bg-blue-50 p-2 rounded text-sm">
                <strong>Explanation:</strong> {q.explanation}
              </div>
            )}
            {q?.hint && (
              <div className="text-muted-foreground text-xs">
                <strong>Hint:</strong> {q.hint}
              </div>
            )}
            {request.feedback && (
              <div className="bg-red-50 p-2 rounded text-sm">
                <strong>Feedback:</strong> {request.feedback}
              </div>
            )}
          </div>
        )}

        {isPending && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            <Button size="sm" onClick={onApprove} className="bg-green-600 hover:bg-green-700">
              <ThumbsUp className="h-4 w-4 mr-1" /> Approve
            </Button>
            {!showReject ? (
              <Button size="sm" variant="destructive" onClick={() => setShowReject(true)}>
                <ThumbsDown className="h-4 w-4 mr-1" /> Reject
              </Button>
            ) : (
              <div className="flex-1 flex gap-2">
                <Textarea
                  value={rejectFeedback}
                  onChange={(e) => setRejectFeedback(e.target.value)}
                  placeholder="Reason for rejection..."
                  rows={1}
                  className="flex-1"
                />
                <Button size="sm" variant="destructive" onClick={() => { onReject(rejectFeedback); setShowReject(false); }}>
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowReject(false)}>Cancel</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
