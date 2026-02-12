'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { DonationRequest, DonationRequestStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook for managing donation requests.
 * - Users see their own requests.
 * - Can submit new requests with optional proof upload.
 */
export function useDonationRequests() {
  const { user, userProfile } = useAuth();
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Listen to user's own donation requests
  useEffect(() => {
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'donation_requests'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as DonationRequest[];
        setRequests(docs);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [user]);

  /**
   * Submit a new donation request.
   * @param requestedPlan - The plan the user is requesting
   * @param note - Optional user note
   * @param proofFile - Optional proof file (image/pdf)
   */
  const submitRequest = useCallback(
    async (
      requestedPlan: 'supporter' | 'pro',
      note?: string,
      proofFile?: File,
    ) => {
      if (!user || !userProfile) throw new Error('Not authenticated');
      setSubmitting(true);
      setUploadProgress(null);

      try {
        let proofFilePath: string | undefined;

        // Upload proof file if provided
        if (proofFile) {
          const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const filePath = `donation_proofs/${user.uid}/${requestId}/${proofFile.name}`;
          const storageRef = ref(storage, filePath);

          await new Promise<void>((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, proofFile);
            task.on(
              'state_changed',
              (snap) => {
                setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
              },
              reject,
              async () => {
                proofFilePath = filePath;
                resolve();
              },
            );
          });
        }

        await addDoc(collection(db, 'donation_requests'), {
          uid: user.uid,
          username: userProfile.username,
          requestedPlan,
          status: 'pending' as DonationRequestStatus,
          note: note || '',
          proofFilePath: proofFilePath || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } finally {
        setSubmitting(false);
        setUploadProgress(null);
      }
    },
    [user, userProfile],
  );

  return { requests, loading, submitting, uploadProgress, submitRequest };
}
