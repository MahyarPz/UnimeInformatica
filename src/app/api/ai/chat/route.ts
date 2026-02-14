import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Constants ────────────────────────────────────────────
const MAX_INPUT_LENGTH = 4000; // chars
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Simple in-memory rate limiter (best-effort, per-instance) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per minute per user

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(uid);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Clean up stale entries every 5 minutes (only at runtime, not build time)
if (typeof setInterval !== 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  setInterval(() => {
    const now = Date.now();
    const keys = Array.from(rateLimitMap.keys());
    for (const uid of keys) {
      const entry = rateLimitMap.get(uid);
      if (entry && now > entry.resetAt) rateLimitMap.delete(uid);
    }
  }, 5 * 60_000);
}

// ─── Europe/Rome date key ─────────────────────────────────
function getRomeDateKey(): string {
  const now = new Date();
  const rome = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // "YYYY-MM-DD"
  return rome.replace(/-/g, '');
}

// ─── POST handler ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  const requestStartMs = Date.now();
  try {
    // ── 1. Verify Firebase ID token ──
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (err: any) {
      const code = err?.errorInfo?.code || err?.code || '';
      // Log the real error server-side for debugging
      console.error('[AI Chat] verifyIdToken error:', code, err?.message);

      if (code === 'app/invalid-credential' || code === 'auth/invalid-credential') {
        return NextResponse.json(
          { error: 'Server authentication misconfigured. Contact admin.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const userRole = decodedToken.role || 'user';

    // ── Abuse protection: in-memory rate limit ──
    if (!checkRateLimit(uid)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    // ── Parse body ──
    let body: { message?: string; context?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (message.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `Message too long. Max ${MAX_INPUT_LENGTH} characters.`, code: 'INPUT_TOO_LONG' },
        { status: 400 },
      );
    }

    // ── 2. Load site_settings/global — KILL SWITCHES ──
    const settingsSnap = await adminDb.doc('site_settings/global').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : null;
    const monetization = settings?.monetization;

    // Layer 1: Global AI Kill Switch
    if (!monetization?.aiEnabled) {
      // Log blocked request for analytics
      adminDb.collection('ai_logs').add({
        uid,
        plan: 'unknown',
        planAtTime: 'free',
        promptChars: 0,
        responseChars: 0,
        status: 'blocked',
        model: GEMINI_MODEL,
        latencyMs: Date.now() - requestStartMs,
        dateKey: getRomeDateKey(),
        blockReason: 'ai_disabled',
        timestamp: FieldValue.serverTimestamp(),
      }).catch(() => {});

      return NextResponse.json(
        { error: 'AI features are currently disabled.', code: 'AI_DISABLED' },
        { status: 403 },
      );
    }

    // Also check paidFeaturesEnabled
    if (!monetization?.paidFeaturesEnabled) {
      return NextResponse.json(
        { error: 'Paid features are currently disabled.', code: 'PAID_FEATURES_DISABLED' },
        { status: 403 },
      );
    }

    // ── 3. Determine user plan + per-user overrides ──
    const planSnap = await adminDb.doc(`user_plans/${uid}`).get();
    let userTier: 'free' | 'supporter' | 'pro' = 'free';
    let planStatus: 'active' | 'revoked' | 'expired' = 'active';
    let aiBanned = false;
    let bonusTokens = 0;
    let aiQuotaOverride: number | null = null;

    if (planSnap.exists) {
      const planData = planSnap.data()!;
      
      // Check status first
      if (planData.status === 'revoked' || planData.status === 'expired') {
        planStatus = planData.status;
        userTier = 'free';
      } else {
        const expiresAt = planData.endsAt ?? planData.expiresAt;
        if (expiresAt === null || expiresAt === undefined) {
          // Lifetime plan
          userTier = planData.plan || 'free';
        } else {
          const expiryDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
          if (expiryDate > new Date()) {
            userTier = planData.plan || 'free';
          }
          // else: expired → stays free
        }
      }

      // Per-user AI overrides
      aiBanned = planData.aiBanned === true;
      bonusTokens = planData.bonusTokens || 0;
      aiQuotaOverride = planData.aiQuotaOverride != null ? planData.aiQuotaOverride : null;
    }

    // Layer 3: Per-user AI ban
    if (aiBanned) {
      // Log blocked request for analytics
      adminDb.collection('ai_logs').add({
        uid,
        plan: userTier,
        planAtTime: userTier,
        promptChars: 0,
        responseChars: 0,
        status: 'blocked',
        model: GEMINI_MODEL,
        latencyMs: Date.now() - requestStartMs,
        dateKey: getRomeDateKey(),
        blockReason: 'ai_banned',
        timestamp: FieldValue.serverTimestamp(),
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Your AI access has been suspended. Contact support.', code: 'AI_BANNED', plan: userTier, remaining: 0 },
        { status: 403 },
      );
    }

    // ── 4. Get quota for plan (with per-user overrides) ──
    const aiQuotas = monetization?.aiQuotas || { free: 0, supporter: 20, pro: 120 };
    let quota = aiQuotaOverride != null ? aiQuotaOverride : (aiQuotas[userTier] ?? 0);
    quota += bonusTokens;

    if (quota <= 0) {
      return NextResponse.json(
        {
          error: 'Your plan does not include AI access. Upgrade to Supporter or Pro.',
          code: 'NO_AI_ACCESS',
          plan: userTier,
          remaining: 0,
        },
        { status: 403 },
      );
    }

    // ── 5. Compute dateKey (Europe/Rome) & usage doc id ──
    const dateKey = getRomeDateKey();
    const usageDocId = `${uid}_${dateKey}`;
    const usageRef = adminDb.doc(`ai_usage_daily/${usageDocId}`);

    // ── 6. Firestore TRANSACTION — atomic quota enforcement ──
    let remaining: number;

    try {
      remaining = await adminDb.runTransaction(async (transaction) => {
        const usageSnap = await transaction.get(usageRef);

        if (!usageSnap.exists) {
          // First request of the day — create doc with count = 1
          transaction.set(usageRef, {
            uid,
            dateKey,
            count: 1,
            limit: quota,
            planAtTime: userTier,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return quota - 1;
        }

        const usageData = usageSnap.data()!;
        const currentCount = usageData.count || 0;
        const currentLimit = usageData.limit || quota;

        if (currentCount >= currentLimit) {
          // Quota exhausted — abort
          throw new Error('QUOTA_EXCEEDED');
        }

        // Increment count
        transaction.update(usageRef, {
          count: currentCount + 1,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return currentLimit - currentCount - 1;
      });
    } catch (txError: any) {
      if (txError.message === 'QUOTA_EXCEEDED') {
        // Log blocked request for analytics
        adminDb.collection('ai_logs').add({
          uid,
          plan: userTier,
          planAtTime: userTier,
          promptChars: message.length,
          responseChars: 0,
          status: 'blocked',
          model: GEMINI_MODEL,
          latencyMs: Date.now() - requestStartMs,
          dateKey: getRomeDateKey(),
          blockReason: 'quota_exceeded',
          timestamp: FieldValue.serverTimestamp(),
        }).catch(() => {});

        return NextResponse.json(
          {
            error: 'Daily AI quota exceeded. Resets at midnight (Europe/Rome).',
            code: 'QUOTA_EXCEEDED',
            plan: userTier,
            remaining: 0,
          },
          { status: 429 },
        );
      }
      throw txError;
    }

    // ── 7. Call Gemini API (server-side only) ──
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set');
      return NextResponse.json(
        { error: 'AI service is not configured. Contact the administrator.' },
        { status: 500 },
      );
    }

    const systemPrompt = `You are an intelligent study assistant for Unime Informatica, a university platform for Data Analysis and Computer Science students. Help users understand concepts, solve problems, prepare for exams, and learn effectively. Be concise, accurate, and educational. Use examples when helpful. If the question is about math, use proper notation. Answer in the same language the user writes in (default: English).`;

    const geminiUrl = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: body.context ? `Context: ${body.context}\n\nQuestion: ${message}` : message }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      return NextResponse.json(
        { error: 'AI service returned an error. Please try again later.' },
        { status: 502 },
      );
    }

    const geminiData = await geminiResponse.json();
    const aiText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'I could not generate a response. Please try again.';

    // ── 8. Log to ai_logs collection (anti-abuse) + audit (fire-and-forget) ──
    const latencyMs = Date.now() - requestStartMs;
    adminDb.collection('ai_logs').add({
      uid,
      plan: userTier,
      planAtTime: userTier,
      promptChars: message.length,
      responseChars: aiText.length,
      status: 'success',
      model: GEMINI_MODEL,
      latencyMs,
      dateKey,
      timestamp: FieldValue.serverTimestamp(),
    }).catch((err) => console.error('AI log error:', err));

    adminDb.collection('audit_log').add({
      action: 'ai.chat',
      category: 'monetization',
      actorUid: uid,
      actorUsername: decodedToken.email || uid,
      actorRole: userRole,
      targetType: 'ai_usage',
      targetId: usageDocId,
      details: {
        plan: userTier,
        dateKey,
        messageLength: message.length,
        remaining,
      },
      timestamp: FieldValue.serverTimestamp(),
    }).catch((err) => console.error('Audit log error:', err));

    // ── Return response ──
    return NextResponse.json({
      response: aiText,
      plan: userTier,
      remaining,
      dateKey,
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
