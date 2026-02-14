'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/lib/hooks/useSiteSettings';
import { logAudit } from '@/lib/firebase/activity';
import { SiteSettings, DEFAULT_SITE_SETTINGS } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

import {
  Loader2,
  Save,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Palette,
  Mail,
  Search,
  Shield,
  AlertTriangle,
  Server,
  FileText,
  Info,
} from 'lucide-react';

// ─────────────────── Helpers ───────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Best-effort diff between old and new settings to log changed keys */
function diffKeys(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  prefix = '',
): string[] {
  const changed: string[] = [];
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const a = oldObj[key];
    const b = newObj[key];
    if (a === b) continue;
    if (
      a !== null &&
      b !== null &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      changed.push(...diffKeys(a, b, path));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      changed.push(path);
    }
  }
  return changed;
}

function isValidUrl(value: string): boolean {
  if (!value) return true; // optional is fine
  return value.startsWith('http://') || value.startsWith('https://');
}

// ─────────────────── Component ───────────────────

export default function AdminSettingsPage() {
  const { user, userProfile } = useAuth();
  const { settings, loading, saving, updateSettings } = useSiteSettings();
  const { addToast } = useToast();

  // Local form state (deep clone of settings so edits are isolated)
  const [form, setForm] = useState<Omit<SiteSettings, 'updatedAt' | 'updatedBy'>>(
    deepClone(DEFAULT_SITE_SETTINGS),
  );
  const [dirty, setDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  // Extract the "clean" settings (without Firestore metadata) for reset/comparison
  const cleanSettings = React.useMemo(() => {
    if (!settings) return null;
    const { updatedAt, updatedBy, ...rest } = settings;
    return deepClone(rest);
  }, [settings]);

  // Sync Firestore → local form ONCE on first load
  useEffect(() => {
    if (initialized || !cleanSettings) return;
    setForm(deepClone(cleanSettings));
    setInitialized(true);
  }, [cleanSettings, initialized]);

  // ─── Field updaters ───
  const updateField = (
    section: keyof Omit<SiteSettings, 'updatedAt' | 'updatedBy'>,
    key: string,
    value: any,
  ) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [key]: value,
      },
    }));
    setDirty(true);
  };

  // ─── Validation ───
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.branding.appName.trim()) {
      errs['branding.appName'] = 'App name is required';
    }
    if (form.limits.maxUploadMB < 1 || form.limits.maxUploadMB > 200) {
      errs['limits.maxUploadMB'] = 'Must be between 1 and 200 MB';
    }
    // URL validations
    const urlFields: [string, string | undefined][] = [
      ['contact.instagram', form.contact.instagram],
      ['contact.telegram', form.contact.telegram],
      ['contact.website', form.contact.website],
    ];
    for (const [path, val] of urlFields) {
      if (val && !isValidUrl(val)) {
        errs[path] = 'Must start with http:// or https://';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Save ───
  const handleSave = async () => {
    if (!validate()) {
      addToast({ title: 'Validation error', description: 'Please fix the highlighted fields.', variant: 'destructive' });
      return;
    }
    try {
      const oldData = cleanSettings ?? deepClone(DEFAULT_SITE_SETTINGS);
      const changedKeys = diffKeys(oldData as Record<string, any>, form as Record<string, any>);

      await updateSettings(form as Partial<SiteSettings>);

      // Audit log
      if (user && userProfile) {
        await logAudit({
          action: 'site_settings.update',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          targetType: 'site_settings',
          targetId: 'global',
          details: { changedKeys, summary: 'Updated Site Settings' },
        });
      }

      addToast({ title: 'Settings saved', description: 'Site settings have been updated.', variant: 'success' });
      setDirty(false);
    } catch (e: any) {
      addToast({ title: 'Save failed', description: e.message || 'Unknown error', variant: 'destructive' });
    }
  };

  // ─── Reset ───
  const handleReset = () => {
    if (cleanSettings) {
      setForm(deepClone(cleanSettings));
    } else {
      setForm(deepClone(DEFAULT_SITE_SETTINGS));
    }
    setErrors({});
    setDirty(false);
    addToast({ title: 'Changes reverted', variant: 'success' });
  };

  // ─── Storage uploads ───
  const handleImageUpload = useCallback(
    async (storagePath: string, section: keyof Omit<SiteSettings, 'updatedAt' | 'updatedBy'>, field: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          addToast({ title: 'File too large', description: 'Max 5 MB for images.', variant: 'destructive' });
          return;
        }
        setUploading(field);
        try {
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          updateField(section, field, url);
          addToast({ title: 'Upload complete', variant: 'success' });
        } catch (e: any) {
          addToast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
        } finally {
          setUploading(null);
        }
      };
      input.click();
    },
    [addToast, updateField],
  );

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          <p className="text-muted-foreground">Global platform configuration</p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          <p className="text-muted-foreground">Global platform configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Last updated badge */}
      {settings?.updatedAt && settings.updatedAt.toDate && (
        <div className="text-xs text-muted-foreground">
          Last updated {formatDateTime(settings.updatedAt)} by{' '}
          <span className="font-medium">{settings.updatedBy ?? 'unknown'}</span>
        </div>
      )}

      {/* Dirty indicator */}
      {dirty && (
        <Badge variant="secondary" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" /> Unsaved changes
        </Badge>
      )}

      {/* Tabs */}
      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="branding"><Palette className="h-3.5 w-3.5 mr-1" />Branding</TabsTrigger>
          <TabsTrigger value="contact"><Mail className="h-3.5 w-3.5 mr-1" />Contact</TabsTrigger>
          <TabsTrigger value="seo"><Search className="h-3.5 w-3.5 mr-1" />SEO</TabsTrigger>
          <TabsTrigger value="auth"><Shield className="h-3.5 w-3.5 mr-1" />Auth &amp; Access</TabsTrigger>
          <TabsTrigger value="maintenance"><Server className="h-3.5 w-3.5 mr-1" />Maintenance</TabsTrigger>
          <TabsTrigger value="limits"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Limits</TabsTrigger>
          <TabsTrigger value="email"><FileText className="h-3.5 w-3.5 mr-1" />Email</TabsTrigger>
        </TabsList>

        {/* ────── BRANDING TAB ────── */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>App name, tagline, logo, favicon, and primary colour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* App Name */}
              <div className="space-y-1">
                <Label htmlFor="appName">App Name *</Label>
                <Input
                  id="appName"
                  value={form.branding.appName}
                  onChange={(e) => updateField('branding', 'appName', e.target.value)}
                  placeholder="Unime Informatica"
                />
                {errors['branding.appName'] && (
                  <p className="text-xs text-destructive">{errors['branding.appName']}</p>
                )}
              </div>

              {/* Tagline */}
              <div className="space-y-1">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={form.branding.tagline ?? ''}
                  onChange={(e) => updateField('branding', 'tagline', e.target.value)}
                  placeholder="Master Data Analysis & Computer Science"
                />
              </div>

              {/* Logo */}
              <div className="space-y-1">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  {form.branding.logoUrl ? (
                    <img src={form.branding.logoUrl} alt="Logo" className="h-12 w-12 rounded object-contain border" />
                  ) : (
                    <div className="h-12 w-12 rounded border flex items-center justify-center bg-muted">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading === 'logoUrl'}
                    onClick={() => handleImageUpload('site/branding/logo.png', 'branding', 'logoUrl')}
                  >
                    {uploading === 'logoUrl' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Upload Logo
                  </Button>
                </div>
              </div>

              {/* Favicon */}
              <div className="space-y-1">
                <Label>Favicon</Label>
                <div className="flex items-center gap-3">
                  {form.branding.faviconUrl ? (
                    <img src={form.branding.faviconUrl} alt="Favicon" className="h-8 w-8 rounded object-contain border" />
                  ) : (
                    <div className="h-8 w-8 rounded border flex items-center justify-center bg-muted">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading === 'faviconUrl'}
                    onClick={() => handleImageUpload('site/branding/favicon.png', 'branding', 'faviconUrl')}
                  >
                    {uploading === 'faviconUrl' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Upload Favicon
                  </Button>
                </div>
              </div>

              {/* Primary Colour */}
              <div className="space-y-1">
                <Label htmlFor="primaryColor">Primary Colour (Hex)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.branding.primaryColorHex || '#3b82f6'}
                    onChange={(e) => updateField('branding', 'primaryColorHex', e.target.value)}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <Input
                    id="primaryColor"
                    value={form.branding.primaryColorHex ?? ''}
                    onChange={(e) => updateField('branding', 'primaryColorHex', e.target.value)}
                    placeholder="#3b82f6"
                    className="max-w-[140px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── CONTACT TAB ────── */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Public contact details shown on the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={form.contact.supportEmail ?? ''}
                  onChange={(e) => updateField('contact', 'supportEmail', e.target.value)}
                  placeholder="support@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="instagram">Instagram URL</Label>
                <Input
                  id="instagram"
                  value={form.contact.instagram ?? ''}
                  onChange={(e) => updateField('contact', 'instagram', e.target.value)}
                  placeholder="https://instagram.com/your-handle"
                />
                {errors['contact.instagram'] && (
                  <p className="text-xs text-destructive">{errors['contact.instagram']}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="telegram">Telegram URL</Label>
                <Input
                  id="telegram"
                  value={form.contact.telegram ?? ''}
                  onChange={(e) => updateField('contact', 'telegram', e.target.value)}
                  placeholder="https://t.me/your-channel"
                />
                {errors['contact.telegram'] && (
                  <p className="text-xs text-destructive">{errors['contact.telegram']}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  value={form.contact.website ?? ''}
                  onChange={(e) => updateField('contact', 'website', e.target.value)}
                  placeholder="https://yoursite.com"
                />
                {errors['contact.website'] && (
                  <p className="text-xs text-destructive">{errors['contact.website']}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── SEO TAB ────── */}
        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle>SEO &amp; Metadata</CardTitle>
              <CardDescription>Search engine defaults and social sharing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="seoTitle">Default Title</Label>
                <Input
                  id="seoTitle"
                  value={form.seo.defaultTitle ?? ''}
                  onChange={(e) => updateField('seo', 'defaultTitle', e.target.value)}
                  placeholder="Unime Informatica"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="seoDescription">Default Description</Label>
                <Textarea
                  id="seoDescription"
                  value={form.seo.defaultDescription ?? ''}
                  onChange={(e) => updateField('seo', 'defaultDescription', e.target.value)}
                  placeholder="Course-first learning platform..."
                  rows={3}
                />
              </div>

              {/* OG Image */}
              <div className="space-y-1">
                <Label>OG Image</Label>
                <div className="flex items-center gap-3">
                  {form.seo.ogImageUrl ? (
                    <img src={form.seo.ogImageUrl} alt="OG" className="h-16 w-28 rounded object-cover border" />
                  ) : (
                    <div className="h-16 w-28 rounded border flex items-center justify-center bg-muted">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading === 'ogImageUrl'}
                    onClick={() => handleImageUpload('site/seo/og.png', 'seo', 'ogImageUrl')}
                  >
                    {uploading === 'ogImageUrl' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Upload OG Image
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="twitter">Twitter Handle</Label>
                <Input
                  id="twitter"
                  value={form.seo.twitterHandle ?? ''}
                  onChange={(e) => updateField('seo', 'twitterHandle', e.target.value)}
                  placeholder="@handle"
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="indexable"
                  checked={form.seo.indexable}
                  onCheckedChange={(val) => updateField('seo', 'indexable', val)}
                />
                <Label htmlFor="indexable">Allow search engine indexing</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── AUTH & ACCESS TAB ────── */}
        <TabsContent value="auth">
          <Card>
            <CardHeader>
              <CardTitle>Auth &amp; Access Control</CardTitle>
              <CardDescription>Authentication behaviour and content visibility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Email Verification</Label>
                  <p className="text-xs text-muted-foreground">Redirect unverified users to /verify-email</p>
                </div>
                <Switch
                  checked={form.auth.requireEmailVerification}
                  onCheckedChange={(val) => updateField('auth', 'requireEmailVerification', val)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Signup</Label>
                  <p className="text-xs text-muted-foreground">When disabled, new registrations are blocked</p>
                </div>
                <Switch
                  checked={form.auth.allowSignup}
                  onCheckedChange={(val) => updateField('auth', 'allowSignup', val)}
                />
              </div>

              <hr />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Public Course Catalog</Label>
                  <p className="text-xs text-muted-foreground">Let unauthenticated users browse courses</p>
                </div>
                <Switch
                  checked={form.content.publicCourseCatalog}
                  onCheckedChange={(val) => updateField('content', 'publicCourseCatalog', val)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Public Profiles</Label>
                  <p className="text-xs text-muted-foreground">Allow /u/[username] public profile pages</p>
                </div>
                <Switch
                  checked={form.content.publicProfiles}
                  onCheckedChange={(val) => updateField('content', 'publicProfiles', val)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Public Question Bank</Label>
                  <p className="text-xs text-muted-foreground">Visibility of the main question bank</p>
                </div>
                <Switch
                  checked={form.content.publicQuestionBank}
                  onCheckedChange={(val) => updateField('content', 'publicQuestionBank', val)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── MAINTENANCE TAB ────── */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Mode</CardTitle>
              <CardDescription>
                When enabled, non-bypass users see a maintenance message instead of the site.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Maintenance Mode</Label>
                  <p className="text-xs text-muted-foreground">Non-bypass users will be shown a maintenance page</p>
                </div>
                <Switch
                  checked={form.maintenance.enabled}
                  onCheckedChange={(val) => updateField('maintenance', 'enabled', val)}
                />
              </div>

              {form.maintenance.enabled && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Maintenance mode is ON — regular users are blocked
                </Badge>
              )}

              <div className="space-y-1">
                <Label htmlFor="maintenanceMsg">Maintenance Message</Label>
                <Textarea
                  id="maintenanceMsg"
                  value={form.maintenance.message ?? ''}
                  onChange={(e) => updateField('maintenance', 'message', e.target.value)}
                  placeholder="We are performing scheduled maintenance..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Bypass Roles</Label>
                <p className="text-xs text-muted-foreground">These roles can still access the site during maintenance</p>
                <div className="flex items-center gap-4">
                  {(['admin', 'moderator'] as const).map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.maintenance.allowedRolesBypass.includes(role)}
                        onCheckedChange={(checked) => {
                          const current = form.maintenance.allowedRolesBypass;
                          const next = checked
                            ? [...current, role]
                            : current.filter((r) => r !== role);
                          updateField('maintenance', 'allowedRolesBypass', next);
                        }}
                      />
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── LIMITS TAB ────── */}
        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>Limits</CardTitle>
              <CardDescription>Upload and usage restrictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="maxUpload">Max Upload Size (MB)</Label>
                <Input
                  id="maxUpload"
                  type="number"
                  min={1}
                  max={200}
                  value={form.limits.maxUploadMB}
                  onChange={(e) => updateField('limits', 'maxUploadMB', Number(e.target.value))}
                />
                {errors['limits.maxUploadMB'] && (
                  <p className="text-xs text-destructive">{errors['limits.maxUploadMB']}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Also enforced by Firebase Storage rules. Update storage.rules if you change this value.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="maxNotes">Max Notes Per User (optional)</Label>
                <Input
                  id="maxNotes"
                  type="number"
                  min={0}
                  value={form.limits.maxNotesPerUser ?? ''}
                  onChange={(e) =>
                    updateField('limits', 'maxNotesPerUser', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="Unlimited"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── EMAIL TAB ────── */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>Display-only settings. Firebase Auth email templates are managed in the Firebase Console.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Firebase Auth email templates (verification, password reset) are configured in the{' '}
                  <strong>Firebase Console &rarr; Authentication &rarr; Templates</strong>. The fields below are
                  for reference only and do not control Firebase behaviour.
                </span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="senderName">Sender Name</Label>
                <Input
                  id="senderName"
                  value={form.emailTemplates.senderName ?? ''}
                  onChange={(e) => updateField('emailTemplates', 'senderName', e.target.value)}
                  placeholder="Unime Informatica"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="replyTo">Reply-To</Label>
                <Input
                  id="replyTo"
                  type="email"
                  value={form.emailTemplates.replyTo ?? ''}
                  onChange={(e) => updateField('emailTemplates', 'replyTo', e.target.value)}
                  placeholder="noreply@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="verifySubject">Verification Email Subject</Label>
                <Input
                  id="verifySubject"
                  value={form.emailTemplates.verifySubject ?? ''}
                  onChange={(e) => updateField('emailTemplates', 'verifySubject', e.target.value)}
                  placeholder="Verify your email address"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
