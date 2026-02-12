import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// ─── Helper: verify caller is admin ────────────────────────
async function verifyAdmin(context: functions.https.CallableContext): Promise<string> {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
  const role = context.auth.token.role;
  if (role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action');
  }
  return context.auth.uid;
}

// ─── Helper: get username from uid ─────────────────────────
async function getUsername(uid: string): Promise<string> {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? (snap.data()?.username || uid) : uid;
}

// ─── adminSetUserPlan (A2) ─────────────────────────────────
// Callable: adminSetUserPlan({ targetUid, plan, status?, endsAt?, reason?, source? })
export const adminSetUserPlan = functions.https.onCall(async (data, context) => {
  const adminUid = await verifyAdmin(context);
  const { targetUid, plan, status, endsAt, reason, source } = data;

  // Validate inputs
  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid is required');
  }
  const validPlans = ['free', 'supporter', 'pro'];
  if (!plan || !validPlans.includes(plan)) {
    throw new functions.https.HttpsError('invalid-argument', 'plan must be free, supporter, or pro');
  }
  const validStatuses = ['active', 'revoked', 'expired'];
  const finalStatus = status && validStatuses.includes(status) ? status : 'active';
  const validSources = ['admin_grant', 'donation', 'promo', 'migration'];
  const finalSource = source && validSources.includes(source) ? source : 'admin_grant';

  // Compute endsAt
  let endsAtTimestamp: admin.firestore.Timestamp | null = null;
  if (endsAt) {
    endsAtTimestamp = admin.firestore.Timestamp.fromDate(new Date(endsAt));
  }

  const adminUsername = await getUsername(adminUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Read old plan for history
  const oldPlanSnap = await db.doc(`user_plans/${targetUid}`).get();
  const oldData = oldPlanSnap.exists ? oldPlanSnap.data()! : { plan: 'free', status: 'active' };

  const batch = db.batch();

  // 1) Write user_plans/{targetUid}
  const planRef = db.doc(`user_plans/${targetUid}`);
  batch.set(planRef, {
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

  // 2) Denormalize on users/{targetUid}
  const userRef = db.doc(`users/${targetUid}`);
  batch.update(userRef, {
    plan,
    planStatus: finalStatus,
    planUpdatedAt: now,
    planEndsAt: endsAtTimestamp,
    planSource: finalSource,
    updatedAt: now,
  });

  // 3) Write plan history
  const historyRef = db.collection(`user_plans/${targetUid}/history`).doc();
  batch.set(historyRef, {
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
  const auditRef = db.collection('audit_log').doc();
  batch.set(auditRef, {
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

  return { success: true, plan, status: finalStatus, endsAt: endsAt || null };
});

// ─── adminRevokeUserPlan (A2) ──────────────────────────────
export const adminRevokeUserPlan = functions.https.onCall(async (data, context) => {
  const adminUid = await verifyAdmin(context);
  const { targetUid, reason } = data;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid is required');
  }

  const adminUsername = await getUsername(adminUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const oldPlanSnap = await db.doc(`user_plans/${targetUid}`).get();
  const oldData = oldPlanSnap.exists ? oldPlanSnap.data()! : { plan: 'free', status: 'active' };

  const batch = db.batch();

  batch.set(db.doc(`user_plans/${targetUid}`), {
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

  batch.update(db.doc(`users/${targetUid}`), {
    plan: 'free',
    planStatus: 'revoked',
    planUpdatedAt: now,
    planEndsAt: null,
    planSource: 'admin_grant',
    updatedAt: now,
  });

  batch.set(db.collection(`user_plans/${targetUid}/history`).doc(), {
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

  batch.set(db.collection('audit_log').doc(), {
    action: 'monetization.plan_revoked',
    category: 'monetization',
    actorUid: adminUid,
    actorUsername: adminUsername,
    actorRole: 'admin',
    targetType: 'user_plan',
    targetId: targetUid,
    details: {
      oldPlan: oldData.plan || 'free',
      reason: reason || 'Revoked by admin',
    },
    timestamp: now,
  });

  await batch.commit();
  return { success: true };
});

// ─── adminSetUserAIOverrides (B8) ──────────────────────────
export const adminSetUserAIOverrides = functions.https.onCall(async (data, context) => {
  const adminUid = await verifyAdmin(context);
  const { targetUid, bonusTokens, aiBanned, aiQuotaOverride } = data;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUid is required');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const updates: Record<string, any> = { updatedAt: now, updatedBy: adminUid };
  if (typeof bonusTokens === 'number') updates.bonusTokens = bonusTokens;
  if (typeof aiBanned === 'boolean') updates.aiBanned = aiBanned;
  if (aiQuotaOverride !== undefined) updates.aiQuotaOverride = aiQuotaOverride;

  await db.doc(`user_plans/${targetUid}`).set(updates, { merge: true });

  const adminUsername = await getUsername(adminUid);
  await db.collection('audit_log').add({
    action: 'monetization.ai_overrides_set',
    category: 'monetization',
    actorUid: adminUid,
    actorUsername: adminUsername,
    actorRole: 'admin',
    targetType: 'user_plan',
    targetId: targetUid,
    details: { bonusTokens, aiBanned, aiQuotaOverride },
    timestamp: now,
  });

  return { success: true };
});

// ─── Scheduled: Daily Plan Expiration (B7) ─────────────────
// Runs every day at 00:05 Europe/Rome
export const dailyPlanExpiration = functions.pubsub
  .schedule('5 0 * * *')
  .timeZone('Europe/Rome')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db.collection('user_plans')
      .where('status', '==', 'active')
      .where('endsAt', '!=', null)
      .where('endsAt', '<', now)
      .get();

    if (snapshot.empty) {
      console.log('No expired plans found.');
      return;
    }

    console.log(`Found ${snapshot.size} expired plan(s). Processing...`);

    const serverNow = admin.firestore.FieldValue.serverTimestamp();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const uid = doc.id;

      const batch = db.batch();

      // Expire the plan
      batch.update(db.doc(`user_plans/${uid}`), {
        plan: 'free',
        status: 'expired',
        updatedAt: serverNow,
        updatedBy: 'system',
      });

      // Sync denormalized user fields
      batch.update(db.doc(`users/${uid}`), {
        plan: 'free',
        planStatus: 'expired',
        planUpdatedAt: serverNow,
        updatedAt: serverNow,
      });

      // Plan history
      batch.set(db.collection(`user_plans/${uid}/history`).doc(), {
        oldPlan: data.plan || 'free',
        newPlan: 'free',
        oldStatus: 'active',
        newStatus: 'expired',
        changedBy: 'system',
        changedByUsername: 'system',
        reason: 'Auto-expired: endsAt reached',
        source: data.source || 'admin_grant',
        endsAt: data.endsAt,
        createdAt: serverNow,
      });

      // Audit log
      batch.set(db.collection('audit_log').doc(), {
        action: 'monetization.plan_expired',
        category: 'monetization',
        actorUid: 'system',
        actorUsername: 'system',
        actorRole: 'system',
        targetType: 'user_plan',
        targetId: uid,
        details: {
          oldPlan: data.plan,
          reason: 'Auto-expired',
        },
        timestamp: serverNow,
      });

      await batch.commit();
      console.log(`Expired plan for uid=${uid} (was ${data.plan})`);
    }
  });

// ─── Bootstrap Admin ────────────────────────────────────────
// One-time function to set the first admin. Called via HTTP.
// Set BOOTSTRAP_ADMIN_EMAIL in Firebase config.
export const bootstrapAdmin = functions.https.onRequest(async (req, res) => {
  const bootstrapEmail = functions.config().app?.bootstrap_email || 'Notmahyar3@gmail.com';
  const bootstrapSecret = functions.config().app?.bootstrap_secret || '';

  // Require a secret token for security
  const { secret } = req.query;
  if (bootstrapSecret && secret !== bootstrapSecret) {
    res.status(403).json({ error: 'Invalid secret' });
    return;
  }

  try {
    // Find user by email
    const userRecord = await auth.getUserByEmail(bootstrapEmail);

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });

    // Update Firestore profile
    await db.collection('users').doc(userRecord.uid).update({
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log audit entry
    await db.collection('audit_log').add({
      action: 'bootstrap_admin',
      category: 'admin',
      actorUid: 'system',
      actorUsername: 'system',
      actorRole: 'system',
      targetId: userRecord.uid,
      details: { email: bootstrapEmail },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, uid: userRecord.uid, email: bootstrapEmail });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── On Role Change ─────────────────────────────────────────
// When a user's role is updated in Firestore, sync to custom claims
export const onRoleChange = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const uid = context.params.userId;

    if (before.role !== after.role) {
      // Update custom claims
      await auth.setCustomUserClaims(uid, {
        role: after.role,
        ...(after.role === 'moderator' ? { permissions: after.permissions || {} } : {}),
      });

      console.log(`Role updated for ${uid}: ${before.role} -> ${after.role}`);
    }

    // Sync moderator permissions to claims
    if (after.role === 'moderator' && JSON.stringify(before.permissions) !== JSON.stringify(after.permissions)) {
      await auth.setCustomUserClaims(uid, {
        role: after.role,
        permissions: after.permissions || {},
      });
      console.log(`Permissions updated for ${uid}`);
    }
  });

// ─── On Question Approved ───────────────────────────────────
// When a question is added to public pool, update stats
export const onQuestionCreated = functions.firestore
  .document('questions_public/{questionId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data.courseId) return;

    // Update course question count
    const courseRef = db.collection('course_stats').doc(data.courseId);
    await courseRef.set(
      {
        totalQuestions: admin.firestore.FieldValue.increment(1),
        [`questionsByDifficulty.${data.difficulty}`]: admin.firestore.FieldValue.increment(1),
        [`questionsByType.${data.type}`]: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

// ─── On Practice Session Completed ──────────────────────────
// Update user stats when a practice session is marked complete
export const onSessionCompleted = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== 'completed' && after.status === 'completed') {
      const uid = after.userId;
      const userStatsRef = db.collection('user_stats').doc(uid);

      const totalQuestions = after.totalQuestions || 0;
      const correctAnswers = after.correctAnswers || 0;

      await userStatsRef.set(
        {
          totalSessions: admin.firestore.FieldValue.increment(1),
          totalQuestions: admin.firestore.FieldValue.increment(totalQuestions),
          totalCorrect: admin.firestore.FieldValue.increment(correctAnswers),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Update daily summary
      const today = new Date().toISOString().split('T')[0];
      const dailyRef = db.collection('daily_summaries').doc(`${uid}_${today}`);
      await dailyRef.set(
        {
          userId: uid,
          date: today,
          sessionsCompleted: admin.firestore.FieldValue.increment(1),
          questionsAnswered: admin.firestore.FieldValue.increment(totalQuestions),
          correctAnswers: admin.firestore.FieldValue.increment(correctAnswers),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

// ─── Cleanup Old Presence Data ──────────────────────────────
// Runs every hour to clean up stale presence entries
export const cleanupPresence = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async (context) => {
    const rtdb = admin.database();
    const presenceRef = rtdb.ref('presence');
    const snapshot = await presenceRef.once('value');

    if (!snapshot.exists()) return;

    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    const updates: Record<string, null> = {};
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.lastActive && now - data.lastActive > staleThreshold) {
        updates[child.key!] = null;
      }
    });

    if (Object.keys(updates).length > 0) {
      await presenceRef.update(updates);
      console.log(`Cleaned up ${Object.keys(updates).length} stale presence entries`);
    }
  });

// ─── On User Created ────────────────────────────────────────
// Set default custom claims for new users
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  await auth.setCustomUserClaims(user.uid, { role: 'user' });

  // Log activity
  await db.collection('activity_events').add({
    type: 'user_registered',
    category: 'auth',
    actorUid: user.uid,
    actorUsername: user.displayName || user.email || 'unknown',
    metadata: {},
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
});
