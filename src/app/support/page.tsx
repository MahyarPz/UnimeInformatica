'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettingsContext } from '@/contexts/SiteSettingsContext';
import { useUserPlan } from '@/lib/hooks/useUserPlan';
import { useDonationRequests } from '@/lib/hooks/useDonationRequests';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  Sparkles,
  Crown,
  Zap,
  Bot,
  BookOpen,
  Lightbulb,
  Target,
  Award,
  Star,
  Upload,
  Loader2,
  Check,
  Clock,
  X,
  ExternalLink,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { renderSafeMarkdown } from '@/lib/utils/renderSafeMarkdown';

const PLAN_FEATURES = {
  supporter: {
    name: 'Supporter',
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    features: [
      { icon: Bot, label: '20 AI prompts/day (Exam Coach)' },
      { icon: Lightbulb, label: 'AI Explain Modes' },
      { icon: Target, label: 'Smart Hints' },
      { icon: Award, label: 'Streak Rewards' },
      { icon: Star, label: 'Contributor Badge' },
      { icon: Heart, label: 'Support the platform' },
    ],
  },
  pro: {
    name: 'Pro',
    icon: Crown,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    features: [
      { icon: Bot, label: '120 AI prompts/day (Exam Coach)' },
      { icon: Lightbulb, label: 'AI Explain Modes (priority)' },
      { icon: Target, label: 'Smart Hints (unlimited)' },
      { icon: Award, label: 'Streak Rewards (enhanced)' },
      { icon: Star, label: 'Contributor Rewards' },
      { icon: BookOpen, label: 'Priority support' },
    ],
  },
};

const STATUS_MAP = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  approved: { label: 'Approved', icon: Check, color: 'text-green-600', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', icon: X, color: 'text-red-600', bg: 'bg-red-100' },
};

export default function SupportPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSiteSettingsContext();
  const { effectiveTier, plan, loading: planLoading } = useUserPlan();
  const { requests, loading: requestsLoading, submitting, uploadProgress, submitRequest } = useDonationRequests();

  const [selectedPlan, setSelectedPlan] = useState<'supporter' | 'pro'>('supporter');
  const [note, setNote] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monetization = settings?.monetization;
  const monetizationEnabled = monetization?.monetizationEnabled !== false;
  const isLoading = authLoading || settingsLoading || planLoading;

  const donationInstructions = monetization?.donationInstructions || '';
  const paymentLinks = monetization?.paymentLinks || [];

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await submitRequest(selectedPlan, note, proofFile || undefined);
      setSubmitted(true);
      setNote('');
      setProofFile(null);
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to submit request');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setSubmitError('Only images (JPEG, PNG, WebP) and PDF files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('File must be less than 5MB.');
      return;
    }
    setSubmitError(null);
    setProofFile(file);
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Hidden when monetization disabled
  if (!monetizationEnabled) {
    return (
      <div className="container max-w-4xl py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Not Available</h2>
            <p className="text-muted-foreground">
              Support plans are currently not available. Check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold flex items-center gap-2 justify-center">
            <Heart className="h-8 w-8 text-red-500" />
            Support Unime Informatica
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Support the platform and unlock powerful AI-powered study features.
            Every contribution helps us keep the platform running and improving.
          </p>
          {effectiveTier !== 'free' && (
            <Badge variant="outline" className="mt-3">
              Current plan: {effectiveTier.charAt(0).toUpperCase() + effectiveTier.slice(1)}
              {plan?.expiresAt && (
                <span className="ml-1">
                  (expires {new Date(plan.expiresAt.toDate ? plan.expiresAt.toDate() : plan.expiresAt).toLocaleDateString()})
                </span>
              )}
            </Badge>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {(['supporter', 'pro'] as const).map((tier) => {
            const plan = PLAN_FEATURES[tier];
            const PlanIcon = plan.icon;
            const isCurrentPlan = effectiveTier === tier;

            return (
              <Card
                key={tier}
                className={`relative overflow-hidden ${plan.borderColor} ${
                  isCurrentPlan ? 'ring-2 ring-primary' : ''
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute top-3 right-3">
                    <Badge>Current Plan</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className={`h-12 w-12 rounded-lg ${plan.bgColor} flex items-center justify-center mb-2`}>
                    <PlanIcon className={`h-6 w-6 ${plan.color}`} />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>
                    {tier === 'supporter'
                      ? 'Perfect for students who want AI-powered study help.'
                      : 'For power users who rely on AI daily.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <li key={i} className="flex items-center gap-3 text-sm">
                          <FeatureIcon className="h-4 w-4 text-primary shrink-0" />
                          {feature.label}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Donation Instructions */}
        {donationInstructions && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Support</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(donationInstructions) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Payment Links */}
        {paymentLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {paymentLinks.map((link, i) => (
                  <Button key={i} variant="outline" asChild>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {link.label}
                    </a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Donation Request */}
        {user && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Submit Donation Request
                </CardTitle>
                <CardDescription>
                  After completing your donation, submit a request below. An admin will review and
                  activate your plan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {submitted ? (
                  <div className="text-center py-6">
                    <Check className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">Request submitted!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      An admin will review your request soon.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => setSubmitted(false)}>
                      Submit Another
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Requested Plan</Label>
                      <Select
                        value={selectedPlan}
                        onValueChange={(v) => setSelectedPlan(v as 'supporter' | 'pro')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="supporter">Supporter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Note (optional)</Label>
                      <Textarea
                        placeholder="Any details about your donation (e.g., payment method, amount, date)..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Proof of Donation (optional)</Label>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {proofFile ? proofFile.name : 'Upload Screenshot / Receipt'}
                        </Button>
                        {proofFile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setProofFile(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground">
                        Images (JPEG, PNG, WebP) or PDF. Max 5MB.
                      </p>
                    </div>

                    {uploadProgress !== null && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground">Uploading: {uploadProgress}%</p>
                      </div>
                    )}

                    {submitError && (
                      <p className="text-sm text-red-500">{submitError}</p>
                    )}

                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Heart className="h-4 w-4 mr-2" />
                          Submit Request
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* My Requests History */}
        {user && requests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">My Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requests.map((req) => {
                  const status = STATUS_MAP[req.status] || STATUS_MAP.pending;
                  const StatusIcon = status.icon;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-full ${status.bg}`}>
                          <StatusIcon className={`h-4 w-4 ${status.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {req.requestedPlan.charAt(0).toUpperCase() + req.requestedPlan.slice(1)} Plan
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {req.createdAt?.toDate
                              ? req.createdAt.toDate().toLocaleDateString()
                              : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={status.color}>
                          {status.label}
                        </Badge>
                        {req.adminFeedback && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                            {req.adminFeedback}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign in CTA */}
        {!user && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">Sign in to submit a donation request.</p>
              <Button asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
