'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDocs,
  where,
  serverTimestamp,
  Timestamp,
  limit as firestoreLimit,
  addDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/lib/hooks/useSiteSettings';
import {
  DonationRequest,
  UserPlan,
  UserPlanTier,
  DEFAULT_AI_QUOTAS,
  DEFAULT_MONETIZATION_SETTINGS,
} from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Bot,
  Shield,
  Zap,
  Crown,
  Check,
  X,
  Clock,
  User,
  Loader2,
  Save,
  Eye,
  Search,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { logAudit } from '@/lib/firebase/activity';

// ─── Status badge helper ──────────────────────────────
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: Check },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: X },
};

export default function AdminMonetizationPage() {
  const { user, userProfile } = useAuth();
  const { settings, loading: settingsLoading, saving, updateSettings } = useSiteSettings();

  // ── Monetization settings state ──
  const monetization = settings?.monetization || DEFAULT_MONETIZATION_SETTINGS;
  const [aiEnabled, setAiEnabled] = useState(monetization.aiEnabled);
  const [monetizationEnabled, setMonetizationEnabled] = useState(monetization.monetizationEnabled);
  const [paidFeaturesEnabled, setPaidFeaturesEnabled] = useState(monetization.paidFeaturesEnabled);
  const [quotaFree, setQuotaFree] = useState(monetization.aiQuotas?.free ?? 0);
  const [quotaSupporter, setQuotaSupporter] = useState(monetization.aiQuotas?.supporter ?? 20);
  const [quotaPro, setQuotaPro] = useState(monetization.aiQuotas?.pro ?? 120);
  const [donationInstructions, setDonationInstructions] = useState(monetization.donationInstructions || '');
  const [paymentLinksStr, setPaymentLinksStr] = useState(
    JSON.stringify(monetization.paymentLinks || [], null, 2)
  );

  // Sync state when settings load
  useEffect(() => {
    if (settings?.monetization) {
      const m = settings.monetization;
      setAiEnabled(m.aiEnabled);
      setMonetizationEnabled(m.monetizationEnabled);
      setPaidFeaturesEnabled(m.paidFeaturesEnabled);
      setQuotaFree(m.aiQuotas?.free ?? 0);
      setQuotaSupporter(m.aiQuotas?.supporter ?? 20);
      setQuotaPro(m.aiQuotas?.pro ?? 120);
      setDonationInstructions(m.donationInstructions || '');
      setPaymentLinksStr(JSON.stringify(m.paymentLinks || [], null, 2));
    }
  }, [settings?.monetization]);

  // ── Donation requests ──
  const [donationRequests, setDonationRequests] = useState<DonationRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const q = query(collection(db, 'donation_requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DonationRequest[];
      setDonationRequests(docs);
      setRequestsLoading(false);
    }, () => setRequestsLoading(false));
    return () => unsub();
  }, []);

  // ── Review dialog ──
  const [reviewDialog, setReviewDialog] = useState<DonationRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewExpiry, setReviewExpiry] = useState('30');
  const [reviewProcessing, setReviewProcessing] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  // ── Manual plan override ──
  const [overrideUsername, setOverrideUsername] = useState('');
  const [overridePlan, setOverridePlan] = useState<UserPlanTier>('supporter');
  const [overrideExpiry, setOverrideExpiry] = useState('30');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Save settings ──
  const handleSaveSettings = async () => {
    let parsedLinks: { label: string; url: string }[] = [];
    try {
      parsedLinks = JSON.parse(paymentLinksStr);
      if (!Array.isArray(parsedLinks)) throw new Error();
    } catch {
      parsedLinks = [];
    }

    await updateSettings({
      monetization: {
        aiEnabled,
        monetizationEnabled,
        paidFeaturesEnabled,
        aiQuotas: {
          free: Number(quotaFree) || 0,
          supporter: Number(quotaSupporter) || 20,
          pro: Number(quotaPro) || 120,
        },
        donationInstructions,
        paymentLinks: parsedLinks,
      },
    });

    if (user && userProfile) {
      logAudit({
        action: 'monetization.settings_updated',
        category: 'monetization',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        details: { aiEnabled, monetizationEnabled, paidFeaturesEnabled },
      });
    }
  };

  // ── Approve/Reject donation request ──
  const handleReview = async () => {
    if (!reviewDialog || !user || !userProfile) return;
    setReviewProcessing(true);

    try {
      const reqRef = doc(db, 'donation_requests', reviewDialog.id!);

      if (reviewAction === 'approve') {
        // Calculate expiry
        let expiresAt: Timestamp | null = null;
        if (reviewExpiry !== 'lifetime') {
          const days = parseInt(reviewExpiry);
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + days);
          expiresAt = Timestamp.fromDate(expiry);
        }

        // Set user plan
        await setDoc(doc(db, 'user_plans', reviewDialog.uid), {
          uid: reviewDialog.uid,
          plan: reviewDialog.requestedPlan,
          expiresAt,
          activatedBy: user.uid,
          activatedByUsername: userProfile.username,
          reason: `Donation request approved: ${reviewFeedback || 'Approved'}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update request status
        await updateDoc(reqRef, {
          status: 'approved',
          adminFeedback: reviewFeedback || 'Approved',
          reviewedBy: user.uid,
          reviewedByUsername: userProfile.username,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Reject
        await updateDoc(reqRef, {
          status: 'rejected',
          adminFeedback: reviewFeedback || 'Rejected',
          reviewedBy: user.uid,
          reviewedByUsername: userProfile.username,
          updatedAt: serverTimestamp(),
        });
      }

      // Audit log
      logAudit({
        action: `monetization.donation_${reviewAction}`,
        category: 'monetization',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        targetType: 'donation_request',
        targetId: reviewDialog.id,
        details: {
          uid: reviewDialog.uid,
          username: reviewDialog.username,
          requestedPlan: reviewDialog.requestedPlan,
          feedback: reviewFeedback,
        },
      });

      setReviewDialog(null);
      setReviewFeedback('');
    } finally {
      setReviewProcessing(false);
    }
  };

  // ── Load proof URL ──
  const loadProofUrl = async (filePath: string) => {
    try {
      const url = await getDownloadURL(ref(storage, filePath));
      setProofUrl(url);
    } catch {
      setProofUrl(null);
    }
  };

  // ── Manual plan override ──
  const handleManualOverride = async () => {
    if (!overrideUsername.trim() || !user || !userProfile) return;
    setOverrideLoading(true);
    setOverrideMessage(null);

    try {
      // Find user by username (case-insensitive)
      const usernameQ = query(
        collection(db, 'users'),
        where('username_lower', '==', overrideUsername.trim().toLowerCase()),
        firestoreLimit(1),
      );
      const usernameSnap = await getDocs(usernameQ);

      if (usernameSnap.empty) {
        setOverrideMessage({ type: 'error', text: `User "${overrideUsername}" not found.` });
        return;
      }

      const targetUser = usernameSnap.docs[0];
      const targetUid = targetUser.id;

      // Calculate expiry
      let expiresAt: Timestamp | null = null;
      if (overrideExpiry !== 'lifetime') {
        const days = parseInt(overrideExpiry);
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + days);
        expiresAt = Timestamp.fromDate(expiry);
      }

      await setDoc(doc(db, 'user_plans', targetUid), {
        uid: targetUid,
        plan: overridePlan,
        expiresAt,
        activatedBy: user.uid,
        activatedByUsername: userProfile.username,
        reason: overrideReason || 'Manual admin assignment',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Audit log
      logAudit({
        action: 'monetization.plan_override',
        category: 'monetization',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        targetType: 'user_plan',
        targetId: targetUid,
        details: {
          username: overrideUsername,
          plan: overridePlan,
          expiry: overrideExpiry,
          reason: overrideReason,
        },
      });

      setOverrideMessage({
        type: 'success',
        text: `Plan "${overridePlan}" assigned to @${overrideUsername} (${overrideExpiry === 'lifetime' ? 'lifetime' : overrideExpiry + ' days'}).`,
      });
      setOverrideUsername('');
      setOverrideReason('');
    } catch (e: any) {
      setOverrideMessage({ type: 'error', text: e.message || 'Failed to override plan.' });
    } finally {
      setOverrideLoading(false);
    }
  };

  const filteredRequests = statusFilter === 'all'
    ? donationRequests
    : donationRequests.filter((r) => r.status === statusFilter);

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          Monetization
        </h1>
        <p className="text-muted-foreground">
          Manage AI access, plans, quotas, and donation requests.
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="requests">
            Donation Requests
            {donationRequests.filter((r) => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] text-xs">
                {donationRequests.filter((r) => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="override">Manual Override</TabsTrigger>
        </TabsList>

        {/* ─── Settings Tab ─── */}
        <TabsContent value="settings" className="space-y-6">
          {/* Kill Switches */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Kill Switches
              </CardTitle>
              <CardDescription>
                Global toggles to instantly enable/disable features. Server enforces these.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">AI Enabled</p>
                  <p className="text-sm text-muted-foreground">
                    When OFF, all AI requests return 403 (server-enforced).
                  </p>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Monetization Visible</p>
                  <p className="text-sm text-muted-foreground">
                    When OFF, the Support page and donation forms are hidden.
                  </p>
                </div>
                <Switch checked={monetizationEnabled} onCheckedChange={setMonetizationEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Paid Features Enabled</p>
                  <p className="text-sm text-muted-foreground">
                    When OFF, all paid feature gates block access (server-enforced).
                  </p>
                </div>
                <Switch checked={paidFeaturesEnabled} onCheckedChange={setPaidFeaturesEnabled} />
              </div>
            </CardContent>
          </Card>

          {/* AI Quotas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Daily AI Quotas
              </CardTitle>
              <CardDescription>
                Maximum number of AI prompts per day per plan. Resets at 00:00 Europe/Rome.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> Free
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={quotaFree}
                    onChange={(e) => setQuotaFree(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-500" /> Supporter
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={quotaSupporter}
                    onChange={(e) => setQuotaSupporter(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" /> Pro
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={quotaPro}
                    onChange={(e) => setQuotaPro(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Donation Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Donation Instructions</CardTitle>
              <CardDescription>
                Markdown shown on the Support page. Explain how to donate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter donation instructions in Markdown..."
                value={donationInstructions}
                onChange={(e) => setDonationInstructions(e.target.value)}
                rows={6}
              />
            </CardContent>
          </Card>

          {/* Payment Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Links</CardTitle>
              <CardDescription>
                JSON array of {`{label, url}`} objects shown on the Support page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={`[{"label": "PayPal", "url": "https://paypal.me/..."}]`}
                value={paymentLinksStr}
                onChange={(e) => setPaymentLinksStr(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          {/* Save */}
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Settings</>
            )}
          </Button>
        </TabsContent>

        {/* ─── Donation Requests Tab ─── */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
            </p>
          </div>

          {requestsLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No donation requests found.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                return (
                  <Card key={req.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${statusCfg.color.split(' ')[0]}`}>
                            <StatusIcon className={`h-4 w-4 ${statusCfg.color.split(' ')[1]}`} />
                          </div>
                          <div>
                            <p className="font-medium">
                              @{req.username}
                              <Badge variant="outline" className="ml-2">
                                {req.requestedPlan}
                              </Badge>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {req.createdAt?.toDate
                                ? req.createdAt.toDate().toLocaleString()
                                : 'Unknown date'}
                            </p>
                            {req.note && (
                              <p className="text-sm text-muted-foreground mt-1">{req.note}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.proofFilePath && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                loadProofUrl(req.proofFilePath!);
                                setReviewDialog(req);
                                setReviewAction('approve');
                                setReviewFeedback('');
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" /> Proof
                            </Button>
                          )}
                          {req.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setReviewDialog(req);
                                  setReviewAction('approve');
                                  setReviewFeedback('');
                                  setProofUrl(null);
                                  if (req.proofFilePath) loadProofUrl(req.proofFilePath);
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" /> Review
                              </Button>
                            </>
                          )}
                          {req.status !== 'pending' && (
                            <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                          )}
                        </div>
                      </div>
                      {req.adminFeedback && req.status !== 'pending' && (
                        <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                          Admin feedback: {req.adminFeedback}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Manual Override Tab ─── */}
        <TabsContent value="override" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Manual Plan Assignment
              </CardTitle>
              <CardDescription>
                Assign a plan to any user by their username. Overrides any existing plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground self-center">@</span>
                    <Input
                      placeholder="username"
                      value={overrideUsername}
                      onChange={(e) => setOverrideUsername(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={overridePlan} onValueChange={(v) => setOverridePlan(v as UserPlanTier)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (remove plan)</SelectItem>
                      <SelectItem value="supporter">Supporter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={overrideExpiry} onValueChange={setOverrideExpiry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Input
                    placeholder="e.g., Early supporter reward"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
              </div>

              {overrideMessage && (
                <div className={`text-sm ${overrideMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                  {overrideMessage.text}
                </div>
              )}

              <Button onClick={handleManualOverride} disabled={overrideLoading || !overrideUsername.trim()}>
                {overrideLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Assigning...</>
                ) : (
                  <><Crown className="h-4 w-4 mr-2" /> Assign Plan</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Review Dialog ─── */}
      <Dialog open={!!reviewDialog} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Review Donation Request — @{reviewDialog?.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm">
              <p><strong>Requested plan:</strong> {reviewDialog?.requestedPlan}</p>
              {reviewDialog?.note && <p><strong>Note:</strong> {reviewDialog.note}</p>}
              <p><strong>Submitted:</strong>{' '}
                {reviewDialog?.createdAt?.toDate
                  ? reviewDialog.createdAt.toDate().toLocaleString()
                  : 'Unknown'}
              </p>
            </div>

            {proofUrl && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Proof:</p>
                {proofUrl.match(/\.pdf/i) ? (
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm flex items-center gap-1">
                    <ExternalLink className="h-4 w-4" /> View PDF
                  </a>
                ) : (
                  <img src={proofUrl} alt="Proof" className="max-h-48 rounded border" />
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={reviewAction} onValueChange={(v) => setReviewAction(v as 'approve' | 'reject')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reviewAction === 'approve' && (
              <div className="space-y-2">
                <Label>Plan Duration</Label>
                <Select value={reviewExpiry} onValueChange={setReviewExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Feedback (optional)</Label>
              <Textarea
                placeholder="Message to the user..."
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewDialog(null)}>
                Cancel
              </Button>
              <Button
                variant={reviewAction === 'reject' ? 'destructive' : 'default'}
                onClick={handleReview}
                disabled={reviewProcessing}
              >
                {reviewProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : reviewAction === 'approve' ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                {reviewAction === 'approve' ? 'Approve & Activate' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
