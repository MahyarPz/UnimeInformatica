'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/lib/hooks/useSiteSettings';
import {
  useAdminPlans, usePlanHistory, useUserPlanDoc,
  adminSetUserPlan, adminRevokeUserPlan, adminSetAIOverrides,
  exportUsersToCSV,
} from '@/lib/hooks/useAdminPlans';
import {
  DonationRequest, UserProfile, UserPlanTier,
  DEFAULT_MONETIZATION_SETTINGS, UserPlan,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  CreditCard, Bot, Shield, Zap, Crown, Check, X, Clock, User,
  Loader2, Save, Eye, Search, ExternalLink,
  ArrowUpCircle, ArrowDownCircle, Download, History, ChevronRight,
  BarChart3, DollarSign, UserCheck,
} from 'lucide-react';
import { logAudit } from '@/lib/firebase/activity';
import { useToast } from '@/components/ui/toast';
import type { PlanHistoryEntry } from '@/lib/types';

// ─── Badge helpers ────────────────────────────────────────
function PlanBadge({ plan }: { plan?: string }) {
  if (!plan || plan === 'free') return <Badge variant="secondary" className="text-xs">FREE</Badge>;
  if (plan === 'supporter') return <Badge className="bg-blue-100 text-blue-700 text-xs"><Zap className="h-3 w-3 mr-1" />SUPPORTER</Badge>;
  if (plan === 'pro') return <Badge className="bg-amber-100 text-amber-700 text-xs"><Crown className="h-3 w-3 mr-1" />PRO</Badge>;
  return <Badge variant="secondary" className="text-xs">{(plan ?? '').toUpperCase()}</Badge>;
}

function StatusBadge({ status, plan }: { status?: string; plan?: string }) {
  // Users without a paid plan don't need a status badge
  if (!plan || plan === 'free') return <span className="text-xs text-muted-foreground">—</span>;
  if (!status || status === 'active') return <Badge className="bg-green-100 text-green-700 text-xs">ACTIVE</Badge>;
  if (status === 'revoked') return <Badge className="bg-red-100 text-red-700 text-xs">REVOKED</Badge>;
  if (status === 'expired') return <Badge className="bg-gray-100 text-gray-600 text-xs">EXPIRED</Badge>;
  return <Badge variant="outline" className="text-xs">{(status ?? '').toUpperCase()}</Badge>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: Check },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: X },
};

// ─── Main Page ────────────────────────────────────────────
export default function AdminMonetizationPage() {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const { settings, loading: settingsLoading, saving, updateSettings } = useSiteSettings();
  const { users, loading: usersLoading, kpi } = useAdminPlans();

  // Settings state
  const monetization = settings?.monetization || DEFAULT_MONETIZATION_SETTINGS;
  const [aiEnabled, setAiEnabled] = useState(monetization.aiEnabled);
  const [monetizationEnabled, setMonetizationEnabled] = useState(monetization.monetizationEnabled);
  const [paidFeaturesEnabled, setPaidFeaturesEnabled] = useState(monetization.paidFeaturesEnabled);
  const [quotaFree, setQuotaFree] = useState(monetization.aiQuotas?.free ?? 0);
  const [quotaSupporter, setQuotaSupporter] = useState(monetization.aiQuotas?.supporter ?? 20);
  const [quotaPro, setQuotaPro] = useState(monetization.aiQuotas?.pro ?? 120);
  const [donationInstructions, setDonationInstructions] = useState(monetization.donationInstructions || '');
  const [paymentLinksStr, setPaymentLinksStr] = useState(JSON.stringify(monetization.paymentLinks || [], null, 2));

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

  // Donation requests
  const [donationRequests, setDonationRequests] = useState<DonationRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, 'donation_requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setDonationRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as DonationRequest[]);
      setRequestsLoading(false);
    }, () => setRequestsLoading(false));
    return () => unsub();
  }, []);

  // ── Users table state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [detailUid, setDetailUid] = useState<string | null>(null);

  // Change plan dialog
  const [changePlanDialog, setChangePlanDialog] = useState<UserProfile | null>(null);
  const [changePlan, setChangePlan] = useState<UserPlanTier>('supporter');
  const [changeDuration, setChangeDuration] = useState('30');
  const [changeReason, setChangeReason] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  // Bulk action state
  const [bulkDialog, setBulkDialog] = useState<'revoke' | 'set' | null>(null);
  const [bulkPlan, setBulkPlan] = useState<UserPlanTier>('supporter');
  const [bulkDuration, setBulkDuration] = useState('30');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Donation review
  const [reviewDialog, setReviewDialog] = useState<DonationRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewExpiry, setReviewExpiry] = useState('30');
  const [reviewProcessing, setReviewProcessing] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [donationFilter, setDonationFilter] = useState<string>('all');

  // ── Filtered users ──
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const userPlan = u.plan || 'free';
      const userStatus = u.planStatus || 'active';
      if (planFilter !== 'all' && userPlan !== planFilter) return false;
      if (statusFilter !== 'all' && userStatus !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.uid?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [users, planFilter, statusFilter, searchQuery]);

  // ── Selection helpers ──
  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) => { const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedUids.size === filteredUsers.length) setSelectedUids(new Set());
    else setSelectedUids(new Set(filteredUsers.map((u) => u.uid)));
  };

  // ── Quick actions ──
  const handleQuickUpgrade = async (u: UserProfile, plan: UserPlanTier) => {
    if (!confirm(`Upgrade @${u.username} to ${plan}? (30 days)`)) return;
    try {
      const endsAt = new Date(); endsAt.setDate(endsAt.getDate() + 30);
      await adminSetUserPlan({ targetUid: u.uid, plan, endsAt: endsAt.toISOString(), reason: `Quick upgrade to ${plan}`, source: 'admin_grant' });
      addToast({ title: `@${u.username} upgraded to ${plan}`, variant: 'success' });
    } catch (e: any) { addToast({ title: e.message || 'Failed', variant: 'destructive' }); }
  };

  const handleQuickRevoke = async (u: UserProfile) => {
    const reason = prompt(`Revoke @${u.username}'s plan? Enter reason (optional):`, '');
    if (reason === null) return;
    try {
      await adminRevokeUserPlan(u.uid, reason || 'Revoked via quick action');
      addToast({ title: `@${u.username} plan revoked`, variant: 'success' });
    } catch (e: any) { addToast({ title: e.message || 'Failed', variant: 'destructive' }); }
  };

  // ── Change plan dialog submit ──
  const handleChangePlan = async () => {
    if (!changePlanDialog) return;
    setChangeLoading(true);
    try {
      let endsAt: string | null = null;
      if (changeDuration !== 'lifetime') { const d = new Date(); d.setDate(d.getDate() + parseInt(changeDuration)); endsAt = d.toISOString(); }
      await adminSetUserPlan({ targetUid: changePlanDialog.uid, plan: changePlan, status: changePlan === 'free' ? 'revoked' : 'active', endsAt, reason: changeReason || `Plan set to ${changePlan}`, source: 'admin_grant' });
      addToast({ title: `Plan updated for @${changePlanDialog.username}`, variant: 'success' });
      setChangePlanDialog(null); setChangeReason('');
    } catch (e: any) { addToast({ title: e.message || 'Failed', variant: 'destructive' }); }
    finally { setChangeLoading(false); }
  };

  // ── Bulk actions ──
  const handleBulkRevoke = async () => {
    setBulkLoading(true);
    let success = 0;
    for (const uid of Array.from(selectedUids)) { try { await adminRevokeUserPlan(uid, bulkReason || 'Bulk revoke'); success++; } catch { /* skip */ } }
    setBulkLoading(false); setBulkDialog(null); setSelectedUids(new Set());
    addToast({ title: `Revoked ${success} user(s)`, variant: 'success' });
  };

  const handleBulkSet = async () => {
    setBulkLoading(true);
    let endsAt: string | null = null;
    if (bulkDuration !== 'lifetime') { const d = new Date(); d.setDate(d.getDate() + parseInt(bulkDuration)); endsAt = d.toISOString(); }
    let success = 0;
    for (const uid of Array.from(selectedUids)) { try { await adminSetUserPlan({ targetUid: uid, plan: bulkPlan, endsAt, reason: bulkReason || 'Bulk set', source: 'admin_grant' }); success++; } catch { /* skip */ } }
    setBulkLoading(false); setBulkDialog(null); setSelectedUids(new Set());
    addToast({ title: `Set plan for ${success} user(s)`, variant: 'success' });
  };

  // ── Save settings ──
  const handleSaveSettings = async () => {
    let parsedLinks: { label: string; url: string }[] = [];
    try { parsedLinks = JSON.parse(paymentLinksStr); if (!Array.isArray(parsedLinks)) throw 0; } catch { parsedLinks = []; }
    await updateSettings({ monetization: { aiEnabled, monetizationEnabled, paidFeaturesEnabled, aiQuotas: { free: Number(quotaFree) || 0, supporter: Number(quotaSupporter) || 20, pro: Number(quotaPro) || 120 }, donationInstructions, paymentLinks: parsedLinks } });
    if (user && userProfile) {
      logAudit({ action: 'monetization.settings_updated', category: 'monetization', actorUid: user.uid, actorUsername: userProfile.username, actorRole: userProfile.role, details: { aiEnabled, monetizationEnabled, paidFeaturesEnabled } });
    }
    addToast({ title: 'Settings saved', variant: 'success' });
  };

  // ── Donation review ──
  const handleReview = async () => {
    if (!reviewDialog || !user || !userProfile) return;
    setReviewProcessing(true);
    try {
      const reqRef = doc(db, 'donation_requests', reviewDialog.id!);
      if (reviewAction === 'approve') {
        let endsAt: string | null = null;
        if (reviewExpiry !== 'lifetime') { const d = new Date(); d.setDate(d.getDate() + parseInt(reviewExpiry)); endsAt = d.toISOString(); }
        await adminSetUserPlan({ targetUid: reviewDialog.uid, plan: reviewDialog.requestedPlan, endsAt, reason: `Donation approved: ${reviewFeedback || 'Approved'}`, source: 'donation' });
        await updateDoc(reqRef, { status: 'approved', adminFeedback: reviewFeedback || 'Approved', reviewedBy: user.uid, reviewedByUsername: userProfile.username, updatedAt: serverTimestamp() });
      } else {
        await updateDoc(reqRef, { status: 'rejected', adminFeedback: reviewFeedback || 'Rejected', reviewedBy: user.uid, reviewedByUsername: userProfile.username, updatedAt: serverTimestamp() });
      }
      logAudit({ action: `monetization.donation_${reviewAction}`, category: 'monetization', actorUid: user.uid, actorUsername: userProfile.username, actorRole: userProfile.role, targetType: 'donation_request', targetId: reviewDialog.id, details: { uid: reviewDialog.uid, username: reviewDialog.username, requestedPlan: reviewDialog.requestedPlan, feedback: reviewFeedback } });
      addToast({ title: `Donation ${reviewAction}d`, variant: 'success' });
      setReviewDialog(null); setReviewFeedback('');
    } catch (e: any) { addToast({ title: e.message || 'Failed', variant: 'destructive' }); }
    finally { setReviewProcessing(false); }
  };

  const loadProofUrl = async (filePath: string) => { try { setProofUrl(await getDownloadURL(ref(storage, filePath))); } catch { setProofUrl(null); } };
  const filteredDonations = donationFilter === 'all' ? donationRequests : donationRequests.filter((r) => r.status === donationFilter);
  const pendingCount = donationRequests.filter((r) => r.status === 'pending').length;

  if (settingsLoading || usersLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Monetization</h1>
        <p className="text-muted-foreground">Manage plans, AI access, quotas, and donations.</p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card><CardContent className="pt-5 text-center">
          <Crown className="h-6 w-6 mx-auto text-amber-500 mb-1" />
          <div className="text-2xl font-bold">{kpi.activePro}</div>
          <p className="text-xs text-muted-foreground">Active Pro</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 text-center">
          <Zap className="h-6 w-6 mx-auto text-blue-500 mb-1" />
          <div className="text-2xl font-bold">{kpi.activeSupporter}</div>
          <p className="text-xs text-muted-foreground">Active Supporter</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 text-center">
          <UserCheck className="h-6 w-6 mx-auto text-green-500 mb-1" />
          <div className="text-2xl font-bold">{kpi.totalPaid}</div>
          <p className="text-xs text-muted-foreground">Total Paid</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 text-center">
          <BarChart3 className="h-6 w-6 mx-auto text-purple-500 mb-1" />
          <div className="text-2xl font-bold">{kpi.totalRevoked + kpi.totalExpired}</div>
          <p className="text-xs text-muted-foreground">Revoked / Expired</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 text-center">
          <DollarSign className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
          <div className="text-2xl font-bold">—</div>
          <p className="text-xs text-muted-foreground">Revenue (TBD)</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users &amp; Plans</TabsTrigger>
          <TabsTrigger value="requests">
            Donations
            {pendingCount > 0 && <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] text-xs">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ═══ USERS & PLANS TAB ═══ */}
        <TabsContent value="users" className="space-y-4">
          <Card><CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Username, email, or UID..." className="pl-9" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Plan</Label>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="supporter">Supporter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedUids.size > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <span className="text-sm font-medium">{selectedUids.size} selected</span>
                <Button size="sm" variant="destructive" onClick={() => { setBulkReason(''); setBulkDialog('revoke'); }}>
                  <ArrowDownCircle className="h-4 w-4 mr-1" /> Revoke All
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setBulkReason(''); setBulkDialog('set'); }}>
                  <ArrowUpCircle className="h-4 w-4 mr-1" /> Set Plan
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportUsersToCSV(filteredUsers.filter((u) => selectedUids.has(u.uid)))}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedUids(new Set())}>Clear</Button>
              </div>
            )}
          </CardContent></Card>

          <div className="text-sm text-muted-foreground px-1">{filteredUsers.length} user(s)</div>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[40px_1fr_100px_100px_100px_110px_200px] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
            <div><Checkbox checked={selectedUids.size === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={toggleSelectAll} /></div>
            <div>User</div><div>Role</div><div>Plan</div><div>Status</div><div>Ends At</div><div>Actions</div>
          </div>

          <div className="space-y-1">
            {filteredUsers.map((u) => (
              <Card key={u.uid} className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-2 px-4">
                  <div className="grid md:grid-cols-[40px_1fr_100px_100px_100px_110px_200px] gap-2 items-center">
                    <div><Checkbox checked={selectedUids.has(u.uid)} onCheckedChange={() => toggleSelect(u.uid)} /></div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs flex-shrink-0">
                        {(u.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-sm">@{u.username}</span>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <div><Badge variant="outline" className="text-xs">{u.role}</Badge></div>
                    <div><PlanBadge plan={u.plan} /></div>
                    <div><StatusBadge status={u.planStatus} plan={u.plan} /></div>
                    <div className="text-xs text-muted-foreground">
                      {(!u.plan || u.plan === 'free') ? '—' : u.planEndsAt ? (typeof u.planEndsAt?.toDate === 'function' ? u.planEndsAt.toDate().toLocaleDateString() : new Date(u.planEndsAt as any).toLocaleDateString()) : '∞'}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(!u.plan || u.plan === 'free') && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleQuickUpgrade(u, 'supporter')}><Zap className="h-3 w-3 mr-1" />Supp</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleQuickUpgrade(u, 'pro')}><Crown className="h-3 w-3 mr-1" />Pro</Button>
                        </>
                      )}
                      {u.plan === 'supporter' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleQuickUpgrade(u, 'pro')}><Crown className="h-3 w-3 mr-1" />Pro</Button>
                      )}
                      {u.plan && u.plan !== 'free' && (
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleQuickRevoke(u)}><X className="h-3 w-3 mr-1" />Revoke</Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setChangePlanDialog(u); setChangePlan((u.plan as UserPlanTier) || 'supporter'); setChangeReason(''); }}>Edit</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetailUid(u.uid)}><ChevronRight className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredUsers.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No users match the current filters.</CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* ═══ DONATIONS TAB ═══ */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={donationFilter} onValueChange={setDonationFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{filteredDonations.length} request(s)</p>
          </div>

          {requestsLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filteredDonations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No donation requests found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredDonations.map((req) => {
                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <Card key={req.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-full ${cfg.color.split(' ')[0]}`}><Icon className={`h-4 w-4 ${cfg.color.split(' ')[1]}`} /></div>
                          <div>
                            <p className="font-medium">@{req.username} <Badge variant="outline" className="ml-2">{req.requestedPlan}</Badge></p>
                            <p className="text-xs text-muted-foreground">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : 'Unknown'}</p>
                            {req.note && <p className="text-sm text-muted-foreground mt-1">{req.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.proofFilePath && (
                            <Button variant="outline" size="sm" onClick={() => { loadProofUrl(req.proofFilePath!); setReviewDialog(req); setReviewAction('approve'); setReviewFeedback(''); }}>
                              <Eye className="h-4 w-4 mr-1" /> Proof
                            </Button>
                          )}
                          {req.status === 'pending' ? (
                            <Button size="sm" onClick={() => { setReviewDialog(req); setReviewAction('approve'); setReviewFeedback(''); setProofUrl(null); if (req.proofFilePath) loadProofUrl(req.proofFilePath); }}>
                              <Check className="h-4 w-4 mr-1" /> Review
                            </Button>
                          ) : (
                            <Badge className={cfg.color}>{cfg.label}</Badge>
                          )}
                        </div>
                      </div>
                      {req.adminFeedback && req.status !== 'pending' && (
                        <p className="text-xs text-muted-foreground mt-2 border-t pt-2">Admin: {req.adminFeedback}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ SETTINGS TAB ═══ */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> Kill Switches</CardTitle>
              <CardDescription>Global toggles. Server enforces these.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">AI Enabled</p><p className="text-sm text-muted-foreground">OFF = all AI returns 403</p></div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Monetization Visible</p><p className="text-sm text-muted-foreground">OFF = Support page hidden</p></div>
                <Switch checked={monetizationEnabled} onCheckedChange={setMonetizationEnabled} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Paid Features Enabled</p><p className="text-sm text-muted-foreground">OFF = all paid gates block</p></div>
                <Switch checked={paidFeaturesEnabled} onCheckedChange={setPaidFeaturesEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Bot className="h-5 w-5" /> Daily AI Quotas</CardTitle>
              <CardDescription>Max prompts/day per plan. Resets 00:00 Europe/Rome.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="flex items-center gap-2"><User className="h-4 w-4" /> Free</Label><Input type="number" min={0} value={quotaFree} onChange={(e) => setQuotaFree(parseInt(e.target.value) || 0)} /></div>
                <div className="space-y-2"><Label className="flex items-center gap-2"><Zap className="h-4 w-4 text-blue-500" /> Supporter</Label><Input type="number" min={0} value={quotaSupporter} onChange={(e) => setQuotaSupporter(parseInt(e.target.value) || 0)} /></div>
                <div className="space-y-2"><Label className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> Pro</Label><Input type="number" min={0} value={quotaPro} onChange={(e) => setQuotaPro(parseInt(e.target.value) || 0)} /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Donation Instructions</CardTitle></CardHeader>
            <CardContent><Textarea placeholder="Markdown..." value={donationInstructions} onChange={(e) => setDonationInstructions(e.target.value)} rows={6} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Payment Links (JSON)</CardTitle></CardHeader>
            <CardContent><Textarea placeholder='[{"label":"PayPal","url":"..."}]' value={paymentLinksStr} onChange={(e) => setPaymentLinksStr(e.target.value)} rows={4} className="font-mono text-sm" /></CardContent>
          </Card>

          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
          </Button>
        </TabsContent>
      </Tabs>

      {/* ═══ CHANGE PLAN DIALOG ═══ */}
      <Dialog open={!!changePlanDialog} onOpenChange={(o) => !o && setChangePlanDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Change Plan — @{changePlanDialog?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={changePlan} onValueChange={(v) => setChangePlan(v as UserPlanTier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="supporter">Supporter</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={changeDuration} onValueChange={setChangeDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="7">7 days</SelectItem><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem><SelectItem value="lifetime">Lifetime</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Reason (optional)</Label><Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g. Early supporter reward" /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangePlanDialog(null)}>Cancel</Button>
              <Button onClick={handleChangePlan} disabled={changeLoading}>
                {changeLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />} Confirm
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ BULK REVOKE DIALOG ═══ */}
      <Dialog open={bulkDialog === 'revoke'} onOpenChange={(o) => !o && setBulkDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Revoke ({selectedUids.size} users)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Reason</Label><Input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Reason for revoking..." /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleBulkRevoke} disabled={bulkLoading}>
                {bulkLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />} Revoke All
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ BULK SET PLAN DIALOG ═══ */}
      <Dialog open={bulkDialog === 'set'} onOpenChange={(o) => !o && setBulkDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Set Plan ({selectedUids.size} users)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={bulkPlan} onValueChange={(v) => setBulkPlan(v as UserPlanTier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="supporter">Supporter</SelectItem><SelectItem value="pro">Pro</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={bulkDuration} onValueChange={setBulkDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem><SelectItem value="lifetime">Lifetime</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Reason</Label><Input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder="Reason..." /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
              <Button onClick={handleBulkSet} disabled={bulkLoading}>
                {bulkLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />} Apply to {selectedUids.size}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ DONATION REVIEW DIALOG ═══ */}
      <Dialog open={!!reviewDialog} onOpenChange={(o) => !o && setReviewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Review — @{reviewDialog?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <p><strong>Requested:</strong> {reviewDialog?.requestedPlan}</p>
              {reviewDialog?.note && <p><strong>Note:</strong> {reviewDialog.note}</p>}
              <p><strong>Submitted:</strong> {reviewDialog?.createdAt?.toDate ? reviewDialog.createdAt.toDate().toLocaleString() : 'Unknown'}</p>
            </div>
            {proofUrl && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Proof:</p>
                {proofUrl.match(/\.pdf/i) ? (
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm"><ExternalLink className="h-4 w-4 inline mr-1" />View PDF</a>
                ) : (
                  <img src={proofUrl} alt="Proof" className="max-h-48 rounded border" />
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={reviewAction} onValueChange={(v) => setReviewAction(v as 'approve' | 'reject')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="approve">Approve</SelectItem><SelectItem value="reject">Reject</SelectItem></SelectContent>
              </Select>
            </div>
            {reviewAction === 'approve' && (
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={reviewExpiry} onValueChange={setReviewExpiry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="7">7 days</SelectItem><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem><SelectItem value="lifetime">Lifetime</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Feedback (optional)</Label><Textarea value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)} rows={2} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
              <Button variant={reviewAction === 'reject' ? 'destructive' : 'default'} onClick={handleReview} disabled={reviewProcessing}>
                {reviewProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : reviewAction === 'approve' ? <Check className="h-4 w-4 mr-2" /> : <X className="h-4 w-4 mr-2" />}
                {reviewAction === 'approve' ? 'Approve & Activate' : 'Reject'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ PLAN DETAILS DRAWER ═══ */}
      <PlanDetailsDrawer uid={detailUid} onClose={() => setDetailUid(null)} addToast={addToast} />
    </div>
  );
}

// ─── Plan Details Drawer (with AI overrides + History) ────
function PlanDetailsDrawer({ uid, onClose, addToast }: { uid: string | null; onClose: () => void; addToast: (t: { title: string; variant?: 'default' | 'destructive' | 'success' }) => void }) {
  const { plan, loading: planLoading } = useUserPlanDoc(uid);
  const { history, loading: historyLoading } = usePlanHistory(uid);

  const [bonusTokens, setBonusTokens] = useState(0);
  const [aiBanned, setAiBanned] = useState(false);
  const [aiQuotaOverride, setAiQuotaOverride] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);

  useEffect(() => {
    if (plan) {
      setBonusTokens(plan.bonusTokens || 0);
      setAiBanned(plan.aiBanned || false);
      setAiQuotaOverride(plan.aiQuotaOverride != null ? String(plan.aiQuotaOverride) : '');
    }
  }, [plan]);

  const handleSaveOverrides = async () => {
    if (!uid) return;
    setOverrideLoading(true);
    try {
      await adminSetAIOverrides(uid, { bonusTokens: Number(bonusTokens) || 0, aiBanned, aiQuotaOverride: aiQuotaOverride.trim() ? Number(aiQuotaOverride) : null });
      addToast({ title: 'AI overrides saved', variant: 'success' });
    } catch (e: any) { addToast({ title: e.message || 'Failed', variant: 'destructive' }); }
    finally { setOverrideLoading(false); }
  };

  if (!uid) return null;

  const endsAt = plan?.endsAt ?? (plan as any)?.expiresAt;
  const endsDate = endsAt ? (typeof endsAt?.toDate === 'function' ? endsAt.toDate() : new Date(endsAt)) : null;
  const timeRemaining = endsDate ? Math.max(0, Math.ceil((endsDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <Dialog open={!!uid} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Plan Details</DialogTitle></DialogHeader>

        {planLoading ? (
          <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-6">
            {/* Current plan summary */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Plan</Label><div className="mt-1"><PlanBadge plan={plan?.plan} /></div></div>
              <div><Label className="text-xs text-muted-foreground">Status</Label><div className="mt-1"><StatusBadge status={plan?.status} plan={plan?.plan} /></div></div>
              <div><Label className="text-xs text-muted-foreground">Ends At</Label><p className="text-sm mt-1">{endsDate ? endsDate.toLocaleDateString() : '∞ Lifetime'}</p></div>
              <div><Label className="text-xs text-muted-foreground">Remaining</Label><p className="text-sm mt-1">{timeRemaining !== null ? `${timeRemaining} day(s)` : '∞'}</p></div>
              <div><Label className="text-xs text-muted-foreground">Source</Label><p className="text-sm mt-1">{plan?.source || '-'}</p></div>
              <div><Label className="text-xs text-muted-foreground">Updated By</Label><p className="text-sm mt-1">{plan?.updatedBy || '-'}</p></div>
            </div>
            {plan?.reason && <div><Label className="text-xs text-muted-foreground">Reason</Label><p className="text-sm">{plan.reason}</p></div>}

            <Separator />

            {/* Per-User AI Controls */}
            <div>
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><Bot className="h-4 w-4" /> Per-User AI Controls</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm">AI Banned</p><p className="text-xs text-muted-foreground">Blocks AI even if Pro</p></div>
                  <Switch checked={aiBanned} onCheckedChange={setAiBanned} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Bonus Tokens/day</Label><Input type="number" min={0} value={bonusTokens} onChange={(e) => setBonusTokens(parseInt(e.target.value) || 0)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Quota Override (blank=default)</Label><Input type="number" min={0} value={aiQuotaOverride} onChange={(e) => setAiQuotaOverride(e.target.value)} placeholder="default" /></div>
                </div>
                <Button size="sm" onClick={handleSaveOverrides} disabled={overrideLoading}>
                  {overrideLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save AI Overrides
                </Button>
              </div>
            </div>

            <Separator />

            {/* Plan History Timeline */}
            <div>
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Plan History</h3>
              {historyLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history entries yet.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="border-l-2 border-primary/30 pl-3 py-1">
                      <div className="flex items-center gap-2">
                        <PlanBadge plan={h.oldPlan} /><span className="text-muted-foreground">→</span><PlanBadge plan={h.newPlan} /><StatusBadge status={h.newStatus} plan={h.newPlan} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">by {h.changedByUsername || h.changedBy} · {h.source}{h.reason && ` — "${h.reason}"`}</p>
                      <p className="text-xs text-muted-foreground">{h.createdAt?.toDate ? h.createdAt.toDate().toLocaleString() : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
