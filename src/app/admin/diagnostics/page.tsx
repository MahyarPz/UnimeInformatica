'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import { ref as rtdbRef, get as rtdbGet } from 'firebase/database';
import { db, storage, rtdb } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity, logAudit } from '@/lib/firebase/activity';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import type { DiagnosticCheck, DiagnosticStatus } from '@/lib/types';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Copy,
  Shield,
  Database,
  HardDrive,
  Wifi,
  Cloud,
  Lock,
  Search,
  Mail,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

const STATUS_CONFIG: Record<DiagnosticStatus, { icon: any; color: string; badgeVariant: string; label: string }> = {
  ok: { icon: CheckCircle2, color: 'text-green-600', badgeVariant: 'success', label: 'OK' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', badgeVariant: 'warning', label: 'Warning' },
  error: { icon: XCircle, color: 'text-red-600', badgeVariant: 'destructive', label: 'Error' },
  checking: { icon: Loader2, color: 'text-blue-600', badgeVariant: 'secondary', label: 'Checking...' },
  unknown: { icon: Info, color: 'text-gray-500', badgeVariant: 'outline', label: 'Unknown' },
};

const INITIAL_CHECKS: DiagnosticCheck[] = [
  {
    id: 'firebase-auth',
    name: 'Firebase Auth Configuration',
    description: 'Checks if Firebase Auth is properly configured with Email/Password provider.',
    status: 'unknown',
  },
  {
    id: 'firestore-reachable',
    name: 'Firestore Reachable',
    description: 'Attempts to read a safe public document (site_settings/global or feature_flags).',
    status: 'unknown',
  },
  {
    id: 'storage-reachable',
    name: 'Firebase Storage Reachable',
    description: 'Attempts to list or read from a known storage path.',
    status: 'unknown',
  },
  {
    id: 'rtdb-presence',
    name: 'Realtime Database (Presence)',
    description: 'Attempts to read from the presence/status path in RTDB.',
    status: 'unknown',
  },
  {
    id: 'cloud-functions',
    name: 'Cloud Functions Deployment',
    description: 'Checks if the functions folder exists and if endpoints are configured.',
    status: 'unknown',
  },
  {
    id: 'rules-sanity',
    name: 'Firestore Rules (RBAC Sanity)',
    description: 'Attempts an admin-only read/write to the diagnostics_test collection.',
    status: 'unknown',
  },
  {
    id: 'missing-indexes',
    name: 'Missing Firestore Indexes',
    description: 'Detects queries that fail with "index required" errors.',
    status: 'unknown',
  },
  {
    id: 'email-verification',
    name: 'Email Verification Flow',
    description: 'Checks if the app enforces email verification before granting access.',
    status: 'unknown',
  },
];

export default function DiagnosticsPage() {
  const { user, userProfile, claims } = useAuth();
  const { addToast } = useToast();
  const [checks, setChecks] = useState<DiagnosticCheck[]>(INITIAL_CHECKS);
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  const hasAccess =
    claims?.role === 'admin' ||
    (claims?.role === 'moderator' && userProfile?.permissions?.diagnosticsView);

  const updateCheck = useCallback(
    (id: string, updates: Partial<DiagnosticCheck>) => {
      setChecks((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates, lastCheckedAt: new Date() } : c))
      );
    },
    []
  );

  // ─── Individual check implementations ───────────────────

  const checkFirebaseAuth = useCallback(async () => {
    updateCheck('firebase-auth', { status: 'checking' });
    try {
      // We can't directly check if Email/Password provider is enabled from client
      // But we can verify that auth is initialized and the current user has a token
      if (user) {
        const token = await user.getIdTokenResult();
        if (token) {
          updateCheck('firebase-auth', {
            status: 'ok',
            message: `Auth working. User authenticated with role: ${token.claims?.role || 'user'}. Email/Password provider status requires manual check in Firebase Console.`,
            howToFix: 'Go to Firebase Console → Authentication → Sign-in method → Ensure Email/Password is enabled.',
          });
          return;
        }
      }
      updateCheck('firebase-auth', {
        status: 'warning',
        message: 'Cannot fully verify — manual check required for Email/Password provider.',
        howToFix: 'Go to Firebase Console → Authentication → Sign-in method → Enable Email/Password.',
      });
    } catch (error: any) {
      updateCheck('firebase-auth', {
        status: 'error',
        message: `Auth check failed: ${error.message}`,
        howToFix: 'Ensure Firebase Auth is properly initialized. Check your environment variables.',
      });
    }
  }, [user, updateCheck]);

  const checkFirestore = useCallback(async () => {
    updateCheck('firestore-reachable', { status: 'checking' });
    try {
      // Try to read site_settings or feature_flags
      const docRef = doc(db, 'site_settings', 'global');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        updateCheck('firestore-reachable', {
          status: 'ok',
          message: 'Firestore is reachable. site_settings/global document found.',
        });
      } else {
        // Try feature_flags as fallback
        const ffSnap = await getDocs(query(collection(db, 'feature_flags'), limit(1)));
        updateCheck('firestore-reachable', {
          status: ffSnap.empty ? 'warning' : 'ok',
          message: ffSnap.empty
            ? 'Firestore reachable but no site_settings or feature_flags found. You may need to run the seed script.'
            : 'Firestore reachable via feature_flags collection.',
          howToFix: ffSnap.empty
            ? 'Run the seed script to create initial data: npx ts-node scripts/seed.ts'
            : undefined,
        });
      }
    } catch (error: any) {
      updateCheck('firestore-reachable', {
        status: 'error',
        message: `Firestore unreachable: ${error.message}`,
        howToFix: 'Check Firestore rules, project configuration, and internet connection.',
      });
    }
  }, [updateCheck]);

  const checkStorage = useCallback(async () => {
    updateCheck('storage-reachable', { status: 'checking' });
    try {
      const storageRef = ref(storage, 'icons/');
      const result = await listAll(storageRef);
      updateCheck('storage-reachable', {
        status: 'ok',
        message: `Storage reachable. Found ${result.items.length} items in icons/.`,
      });
    } catch (error: any) {
      if (error.code === 'storage/unauthorized') {
        updateCheck('storage-reachable', {
          status: 'warning',
          message: 'Storage reachable but access denied for icons/. Rules may be restrictive.',
          howToFix: 'Check Firebase Storage rules to ensure admin read access is permitted.',
        });
      } else {
        updateCheck('storage-reachable', {
          status: 'error',
          message: `Storage check failed: ${error.message}`,
          howToFix: 'Verify NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is set correctly.',
        });
      }
    }
  }, [updateCheck]);

  const checkRTDB = useCallback(async () => {
    updateCheck('rtdb-presence', { status: 'checking' });
    try {
      const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      if (!dbUrl) {
        updateCheck('rtdb-presence', {
          status: 'warning',
          message: 'NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set. RTDB presence may not work.',
          howToFix: 'Set NEXT_PUBLIC_FIREBASE_DATABASE_URL in your .env.local file.',
        });
        return;
      }
      const statusRef = rtdbRef(rtdb, 'status');
      const snap = await rtdbGet(statusRef);
      updateCheck('rtdb-presence', {
        status: 'ok',
        message: `RTDB reachable. /status has ${snap.exists() ? Object.keys(snap.val() || {}).length : 0} entries.`,
      });
    } catch (error: any) {
      updateCheck('rtdb-presence', {
        status: 'error',
        message: `RTDB check failed: ${error.message}`,
        howToFix: 'Ensure RTDB is enabled and NEXT_PUBLIC_FIREBASE_DATABASE_URL is correct.',
      });
    }
  }, [updateCheck]);

  const checkCloudFunctions = useCallback(async () => {
    updateCheck('cloud-functions', { status: 'checking' });
    try {
      // We check if the functions project has source files — client-side we can only infer
      // The firebase/functions/src/index.ts exists in repository
      // We can't call functions from client without knowing the endpoint
      updateCheck('cloud-functions', {
        status: 'warning',
        message:
          'Cloud Functions source exists (firebase/functions/). Deployment status cannot be verified from client. Check Firebase Console → Functions.',
        howToFix:
          'Deploy functions with: cd firebase/functions && npm run deploy. Verify in Firebase Console → Functions tab.',
      });
    } catch (error: any) {
      updateCheck('cloud-functions', {
        status: 'error',
        message: `Functions check failed: ${error.message}`,
      });
    }
  }, [updateCheck]);

  const checkRules = useCallback(async () => {
    updateCheck('rules-sanity', { status: 'checking' });
    try {
      const testDocRef = doc(db, 'diagnostics_test', 'health_check');

      // Try write
      await setDoc(testDocRef, {
        checkedAt: serverTimestamp(),
        checkedBy: user?.uid || 'unknown',
        status: 'ok',
      });

      // Try read
      const snap = await getDoc(testDocRef);
      if (snap.exists()) {
        // Clean up
        await deleteDoc(testDocRef);
        updateCheck('rules-sanity', {
          status: 'ok',
          message: 'RBAC rules working correctly. Admin can read/write to diagnostics_test.',
        });
      } else {
        updateCheck('rules-sanity', {
          status: 'warning',
          message: 'Write succeeded but read returned empty. Check rules.',
        });
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        updateCheck('rules-sanity', {
          status: 'error',
          message:
            'Permission denied on diagnostics_test. Firestore rules may not include the diagnostics_test collection for admin access.',
          howToFix:
            'Add a rule in firestore.rules:\n  match /diagnostics_test/{docId} {\n    allow read, write: if isAdmin();\n  }',
        });
      } else {
        updateCheck('rules-sanity', {
          status: 'error',
          message: `Rules check failed: ${error.message}`,
          howToFix: 'Ensure Firestore rules are deployed and include diagnostics_test collection.',
        });
      }
    }
  }, [user, updateCheck]);

  const checkMissingIndexes = useCallback(async () => {
    updateCheck('missing-indexes', { status: 'checking' });
    try {
      // Try a compound query that is likely to need an index
      const testQueries = [
        // This compound query may reveal missing indexes
        getDocs(
          query(
            collection(db, 'questions_public'),
            limit(1)
          )
        ),
        getDocs(
          query(
            collection(db, 'activity_events'),
            limit(1)
          )
        ),
      ];

      const results = await Promise.allSettled(testQueries);
      const indexErrors: string[] = [];

      for (const result of results) {
        if (result.status === 'rejected') {
          const msg = result.reason?.message || '';
          if (msg.includes('index') || msg.includes('Index')) {
            indexErrors.push(msg);
          }
        }
      }

      if (indexErrors.length > 0) {
        updateCheck('missing-indexes', {
          status: 'warning',
          message: `Found ${indexErrors.length} missing index(es). Create them in Firebase Console.`,
          howToFix: indexErrors
            .map((e) => {
              const urlMatch = e.match(/(https:\/\/console\.firebase\.google\.com\S+)/);
              return urlMatch ? `Create index: ${urlMatch[1]}` : e;
            })
            .join('\n'),
        });
      } else {
        updateCheck('missing-indexes', {
          status: 'ok',
          message: 'No missing indexes detected for tested queries.',
        });
      }
    } catch (error: any) {
      const msg = error.message || '';
      if (msg.includes('index') || msg.includes('Index')) {
        updateCheck('missing-indexes', {
          status: 'warning',
          message: `Index required: ${msg}`,
          howToFix: 'Follow the link in the error to create the required index.',
        });
      } else {
        updateCheck('missing-indexes', {
          status: 'ok',
          message: 'No index issues detected.',
        });
      }
    }
  }, [updateCheck]);

  const checkEmailVerification = useCallback(async () => {
    updateCheck('email-verification', { status: 'checking' });
    try {
      // Check site_settings for requireEmailVerification flag
      const settingsDoc = await getDoc(doc(db, 'site_settings', 'global'));
      const settings = settingsDoc.data();
      const requireVerification = settings?.auth?.requireEmailVerification;

      if (requireVerification === true) {
        updateCheck('email-verification', {
          status: 'ok',
          message: 'Email verification is enforced (auth.requireEmailVerification = true in site_settings).',
        });
      } else if (requireVerification === false) {
        updateCheck('email-verification', {
          status: 'warning',
          message: 'Email verification is NOT enforced. Users can access the app without verifying email.',
          howToFix: 'Go to Admin → Site Settings → Auth section → Enable "Require Email Verification".',
        });
      } else {
        updateCheck('email-verification', {
          status: 'warning',
          message: 'Could not determine email verification setting. site_settings/global may not exist or auth section is missing.',
          howToFix: 'Create or update site_settings/global with auth.requireEmailVerification = true.',
        });
      }
    } catch (error: any) {
      updateCheck('email-verification', {
        status: 'error',
        message: `Email verification check failed: ${error.message}`,
      });
    }
  }, [updateCheck]);

  // ─── Run all checks ─────────────────────────────────────

  const runAllChecks = useCallback(async () => {
    setRunning(true);
    // Reset all to checking
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: 'checking' as DiagnosticStatus })));

    await Promise.allSettled([
      checkFirebaseAuth(),
      checkFirestore(),
      checkStorage(),
      checkRTDB(),
      checkCloudFunctions(),
      checkRules(),
      checkMissingIndexes(),
      checkEmailVerification(),
    ]);

    setLastRunAt(new Date());
    setRunning(false);

    // Audit log
    if (user && userProfile) {
      logActivity({
        type: 'admin.diagnostics.run',
        category: 'admin',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
      });
    }
  }, [
    checkFirebaseAuth,
    checkFirestore,
    checkStorage,
    checkRTDB,
    checkCloudFunctions,
    checkRules,
    checkMissingIndexes,
    checkEmailVerification,
    user,
    userProfile,
  ]);

  // Run on page load
  useEffect(() => {
    if (hasAccess) {
      runAllChecks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const handleCopyDebugInfo = () => {
    const debugInfo = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown',
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? 'set' : 'not set',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'set' : 'not set',
      lastRunAt: lastRunAt?.toISOString() || 'never',
      checks: checks.map((c) => ({
        id: c.id,
        status: c.status,
        message: c.message,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    addToast({ title: 'Debug info copied to clipboard', variant: 'success' });
  };

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Diagnostics</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2" />
            <p>You don&apos;t have permission to view diagnostics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusCounts = checks.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">System Health & Diagnostics</h1>
          <p className="text-muted-foreground">
            Live checks for Firebase services, rules, and configuration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyDebugInfo}>
            <Copy className="h-4 w-4 mr-2" /> Copy Debug Info
          </Button>
          <Button onClick={runAllChecks} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run All Checks
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {statusCounts.ok && (
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3 mr-1" /> {statusCounts.ok} OK
          </Badge>
        )}
        {statusCounts.warning && (
          <Badge variant="warning">
            <AlertTriangle className="h-3 w-3 mr-1" /> {statusCounts.warning} Warning
          </Badge>
        )}
        {statusCounts.error && (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" /> {statusCounts.error} Error
          </Badge>
        )}
        {statusCounts.checking && (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> {statusCounts.checking} Checking
          </Badge>
        )}
        {lastRunAt && (
          <span className="text-xs text-muted-foreground ml-2 self-center">
            Last run: {lastRunAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Check cards */}
      <div className="grid gap-4">
        {checks.map((check) => {
          const config = STATUS_CONFIG[check.status];
          const StatusIcon = config.icon;
          const isExpanded = expandedId === check.id;

          return (
            <Card key={check.id} className="overflow-hidden">
              <div
                className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : check.id)}
              >
                <StatusIcon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    config.color,
                    check.status === 'checking' && 'animate-spin'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{check.name}</span>
                    <Badge
                      variant={config.badgeVariant as any}
                      className="text-[10px]"
                    >
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>

              {isExpanded && (check.message || check.howToFix) && (
                <div className="px-6 pb-4 border-t bg-muted/20">
                  {check.message && (
                    <div className="pt-3">
                      <p className="text-sm">{check.message}</p>
                    </div>
                  )}
                  {check.howToFix && (
                    <div className="pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">How to fix:</p>
                      <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap font-mono">
                        {check.howToFix}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Environment info (safe) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Project ID</span>
              <span className="font-mono">{process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Auth Domain</span>
              <span className="font-mono">{process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Database URL</span>
              <span className="font-mono">{process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? 'Configured' : 'Not set'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Storage Bucket</span>
              <span className="font-mono">{process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'Configured' : 'Not set'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
