import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

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
