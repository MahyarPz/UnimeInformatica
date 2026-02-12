import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// ─── Helper: verify admin from ID token ───────────────────
async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing authorization token' };
  }
  const idToken = authHeader.slice(7);
  const decoded = await adminAuth.verifyIdToken(idToken);
  const uid = decoded.uid;

  // Check role from custom claims first, then fallback to Firestore
  let role: string = decoded.role || '';
  if (role !== 'admin') {
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    role = userDoc.data()?.role || 'user';
  }
  if (role !== 'admin') {
    throw { status: 403, message: 'Only admins can perform this action' };
  }
  return uid;
}

async function getUsername(uid: string): Promise<string> {
  const snap = await adminDb.doc(`users/${uid}`).get();
  return snap.exists ? (snap.data()?.username || uid) : uid;
}

// ─── POST /api/admin/plans ────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const adminUid = await verifyAdmin(request);
    const body = await request.json();
    const { action } = body;

    if (action === 'setPlan') {
      return await handleSetPlan(adminUid, body);
    } else if (action === 'revokePlan') {
      return await handleRevokePlan(adminUid, body);
    } else if (action === 'setAIOverrides') {
      return await handleSetAIOverrides(adminUid, body);
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Internal server error';
    console.error('[Admin Plans API]', message, err);
    return NextResponse.json({ error: message }, { status });
  }
}

// ─── Set Plan ─────────────────────────────────────────────
async function handleSetPlan(adminUid: string, body: any) {
  const { targetUid, plan, status, endsAt, reason, source } = body;

  if (!targetUid || typeof targetUid !== 'string') {
    return NextResponse.json({ error: 'targetUid is required' }, { status: 400 });
  }
  const validPlans = ['free', 'supporter', 'pro'];
  if (!plan || !validPlans.includes(plan)) {
    return NextResponse.json({ error: 'plan must be free, supporter, or pro' }, { status: 400 });
  }

  const validStatuses = ['active', 'revoked', 'expired'];
  const finalStatus = status && validStatuses.includes(status) ? status : 'active';
  const validSources = ['admin_grant', 'donation', 'promo', 'migration'];
  const finalSource = source && validSources.includes(source) ? source : 'admin_grant';

  let endsAtTimestamp: Timestamp | null = null;
  if (endsAt) {
    endsAtTimestamp = Timestamp.fromDate(new Date(endsAt));
  }

  const adminUsername = await getUsername(adminUid);
  const now = FieldValue.serverTimestamp();

  const oldPlanSnap = await adminDb.doc(`user_plans/${targetUid}`).get();
  const oldData = oldPlanSnap.exists ? oldPlanSnap.data()! : { plan: 'free', status: 'active' };

  const batch = adminDb.batch();

  // 1) user_plans doc
  batch.set(adminDb.doc(`user_plans/${targetUid}`), {
    uid: targetUid,
    plan,
    status: finalStatus,
    source: finalSource,
    startedAt: oldPlanSnap.exists ? (oldData.startedAt || now) : now,
    endsAt: endsAtTimestamp,
    updatedAt: now,
    updatedBy: adminUid,
    reason: reason || '',
  }, { merge: false });

  // 2) Denormalize on users
  batch.update(adminDb.doc(`users/${targetUid}`), {
    plan,
    planStatus: finalStatus,
    planUpdatedAt: now,
    planEndsAt: endsAtTimestamp,
    planSource: finalSource,
    updatedAt: now,
  });

  // 3) History
  batch.set(adminDb.collection(`user_plans/${targetUid}/history`).doc(), {
    oldPlan: oldData.plan || 'free',
    newPlan: plan,
    oldStatus: oldData.status || 'active',
    newStatus: finalStatus,
    changedBy: adminUid,
    changedByUsername: adminUsername,
    reason: reason || '',
    source: finalSource,
    endsAt: endsAtTimestamp,
    createdAt: now,
  });

  // 4) Audit log
  batch.set(adminDb.collection('audit_log').doc(), {
    action: 'monetization.plan_set',
    category: 'monetization',
    actorUid: adminUid,
    actorUsername: adminUsername,
    actorRole: 'admin',
    targetType: 'user_plan',
    targetId: targetUid,
    details: {
      oldPlan: oldData.plan || 'free',
      newPlan: plan,
      oldStatus: oldData.status || 'active',
      newStatus: finalStatus,
      source: finalSource,
      reason: reason || '',
      endsAt: endsAt || null,
    },
    timestamp: now,
  });

  await batch.commit();

  return NextResponse.json({ success: true, plan, status: finalStatus, endsAt: endsAt || null });
}

// ─── Revoke Plan ──────────────────────────────────────────
async function handleRevokePlan(adminUid: string, body: any) {
  const { targetUid, reason } = body;

  if (!targetUid || typeof targetUid !== 'string') {
    return NextResponse.json({ error: 'targetUid is required' }, { status: 400 });
  }

  const adminUsername = await getUsername(adminUid);
  const now = FieldValue.serverTimestamp();

  const oldPlanSnap = await adminDb.doc(`user_plans/${targetUid}`).get();
  const oldData = oldPlanSnap.exists ? oldPlanSnap.data()! : { plan: 'free', status: 'active' };

  const batch = adminDb.batch();

  batch.set(adminDb.doc(`user_plans/${targetUid}`), {
    uid: targetUid,
    plan: 'free',
    status: 'revoked',
    source: 'admin_grant',
    startedAt: now,
    endsAt: null,
    updatedAt: now,
    updatedBy: adminUid,
    reason: reason || 'Revoked by admin',
  }, { merge: false });

  batch.update(adminDb.doc(`users/${targetUid}`), {
    plan: 'free',
    planStatus: 'revoked',
    planUpdatedAt: now,
    planEndsAt: null,
    planSource: 'admin_grant',
    updatedAt: now,
  });

  batch.set(adminDb.collection(`user_plans/${targetUid}/history`).doc(), {
    oldPlan: oldData.plan || 'free',
    newPlan: 'free',
    oldStatus: oldData.status || 'active',
    newStatus: 'revoked',
    changedBy: adminUid,
    changedByUsername: adminUsername,
    reason: reason || 'Revoked by admin',
    source: 'admin_grant',
    endsAt: null,
    createdAt: now,
  });

  batch.set(adminDb.collection('audit_log').doc(), {
    action: 'monetization.plan_revoked',
    category: 'monetization',
    actorUid: adminUid,
    actorUsername: adminUsername,
    actorRole: 'admin',
    targetType: 'user_plan',
    targetId: targetUid,
    details: { oldPlan: oldData.plan || 'free', reason: reason || 'Revoked by admin' },
    timestamp: now,
  });

  await batch.commit();
  return NextResponse.json({ success: true });
}

// ─── Set AI Overrides ─────────────────────────────────────
async function handleSetAIOverrides(adminUid: string, body: any) {
  const { targetUid, bonusTokens, aiBanned, aiQuotaOverride } = body;

  if (!targetUid || typeof targetUid !== 'string') {
    return NextResponse.json({ error: 'targetUid is required' }, { status: 400 });
  }

  const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: adminUid };
  if (typeof bonusTokens === 'number') updates.bonusTokens = bonusTokens;
  if (typeof aiBanned === 'boolean') updates.aiBanned = aiBanned;
  if (aiQuotaOverride !== undefined) updates.aiQuotaOverride = aiQuotaOverride;

  // Use set with merge so doc is created if missing
  await adminDb.doc(`user_plans/${targetUid}`).set(updates, { merge: true });

  return NextResponse.json({ success: true });
}
