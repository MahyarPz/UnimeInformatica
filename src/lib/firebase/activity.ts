import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ActivityEventCategory, ActivityEventSeverity, UserRole } from '@/lib/types';

interface LogActivityParams {
  type: string;
  category: ActivityEventCategory;
  actorUid: string;
  actorUsername: string;
  actorRole: UserRole;
  metadata?: Record<string, any>;
  severity?: ActivityEventSeverity;
}

export async function logActivity({
  type,
  category,
  actorUid,
  actorUsername,
  actorRole,
  metadata = {},
  severity = 'low',
}: LogActivityParams) {
  try {
    await addDoc(collection(db, 'activity_events'), {
      type,
      category,
      timestamp: serverTimestamp(),
      actorUid,
      actorUsername,
      actorRole,
      metadata,
      severity,
      visibility: 'admin',
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function logAudit({
  action,
  category,
  actorUid,
  actorUsername,
  actorRole,
  targetType,
  targetId,
  details,
}: {
  action: string;
  category: string;
  actorUid: string;
  actorUsername: string;
  actorRole: UserRole;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
}) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action,
      category,
      actorUid,
      actorUsername,
      actorRole,
      targetType,
      targetId,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
