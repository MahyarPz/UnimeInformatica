'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity, logAudit } from '@/lib/firebase/activity';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';
import { t } from '@/lib/i18n';
import {
  Download,
  Upload,
  Database,
  FileJson,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Shield,
  Info,
  Copy,
  Eye,
} from 'lucide-react';
import type { AdminBackup, ExportPayload, ExportMetadata, ImportMode, ImportPreview } from '@/lib/types';

// Collections available for export/import/backup
const EXPORTABLE_COLLECTIONS = [
  { key: 'courses', label: 'Courses', firestoreCollection: 'courses' },
  { key: 'topics', label: 'Topics', firestoreCollection: 'topics' },
  { key: 'questions_public', label: 'Question Bank', firestoreCollection: 'questions_public' },
  { key: 'labs', label: 'Labs', firestoreCollection: 'labs' },
  { key: 'announcements', label: 'Announcements', firestoreCollection: 'announcements' },
  { key: 'site_content', label: 'Site Content', firestoreCollection: 'site_content' },
  { key: 'feature_flags', label: 'Feature Flags', firestoreCollection: 'feature_flags' },
  { key: 'practice_settings', label: 'Practice Settings', firestoreCollection: 'practice_settings' },
];

const MAX_BACKUPS = 20;

export default function AdminToolsPage() {
  const { user, userProfile, claims } = useAuth();
  const { addToast } = useToast();

  const isAdmin = claims?.role === 'admin';
  const canExport =
    isAdmin || (claims?.role === 'moderator' && userProfile?.permissions?.adminToolsExport);
  const canImport =
    isAdmin || (claims?.role === 'moderator' && userProfile?.permissions?.adminToolsImport);
  const canRestore = isAdmin; // Restore is admin-only

  if (!canExport && !canImport && !canRestore) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Tools</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2" />
            <p>You don&apos;t have permission to access admin tools.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import / Export / Backup Tools</h1>
        <p className="text-muted-foreground">Manage your platform data: export, import, or create backups.</p>
      </div>

      <Tabs defaultValue="export" className="space-y-4">
        <TabsList>
          {canExport && <TabsTrigger value="export"><Download className="h-4 w-4 mr-2" /> Export</TabsTrigger>}
          {canImport && <TabsTrigger value="import"><Upload className="h-4 w-4 mr-2" /> Import</TabsTrigger>}
          {canRestore && <TabsTrigger value="backup"><Database className="h-4 w-4 mr-2" /> Backup / Restore</TabsTrigger>}
        </TabsList>

        {canExport && (
          <TabsContent value="export">
            <ExportTab />
          </TabsContent>
        )}
        {canImport && (
          <TabsContent value="import">
            <ImportTab />
          </TabsContent>
        )}
        {canRestore && (
          <TabsContent value="backup">
            <BackupTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ================================================================
// EXPORT TAB
// ================================================================
function ExportTab() {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [selectedCollections, setSelectedCollections] = useState<string[]>(['courses', 'topics']);
  const [filterCourseId, setFilterCourseId] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [exporting, setExporting] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);

  // Fetch courses for filter
  useEffect(() => {
    getDocs(collection(db, 'courses')).then((snap) => {
      setCourses(snap.docs.map((d) => ({ id: d.id, title: d.data().title || d.id })));
    });
  }, []);

  const toggleCollection = (key: string) => {
    setSelectedCollections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (selectedCollections.length === 0) {
      addToast({ title: 'No collections selected', variant: 'destructive' });
      return;
    }

    setExporting(true);
    try {
      const data: Record<string, any[]> = {};

      for (const col of selectedCollections) {
        const config = EXPORTABLE_COLLECTIONS.find((c) => c.key === col);
        if (!config) continue;

        let q = collection(db, config.firestoreCollection);
        let constraints: any[] = [];

        // Apply course filter for relevant collections
        if (filterCourseId && filterCourseId !== '__all__' && ['topics', 'questions_public', 'labs'].includes(col)) {
          constraints.push(where('courseId', '==', filterCourseId));
        }

        // Apply status filter
        if (filterStatus !== 'all' && ['courses', 'topics', 'labs', 'announcements'].includes(col)) {
          constraints.push(where('active', '==', filterStatus === 'active'));
        }

        const snap = await getDocs(constraints.length > 0 ? query(q, ...constraints) : q);
        data[col] = snap.docs.map((d) => ({
          _id: d.id,
          ...serializeFirestoreData(d.data()),
        }));
      }

      const payload: ExportPayload = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: user?.uid || '',
          exportedByUsername: userProfile?.username || '',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          filters: {
            courseId: filterCourseId !== '__all__' ? filterCourseId : undefined,
            status: filterStatus !== 'all' ? filterStatus : undefined,
          },
        },
        data,
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unime-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Audit log
      if (user && userProfile) {
        logAudit({
          action: 'admin.export.run',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          details: {
            collections: selectedCollections,
            counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
            filters: { courseId: filterCourseId !== '__all__' ? filterCourseId : undefined, status: filterStatus },
          },
        });
      }

      addToast({ title: 'Export complete', description: `Exported ${Object.values(data).flat().length} items.`, variant: 'success' });
    } catch (error: any) {
      console.error('Export error:', error);
      addToast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" /> Export Data
        </CardTitle>
        <CardDescription>Export admin-managed content as JSON. Select collections and filters below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Collection selection */}
        <div>
          <Label className="text-sm font-medium">Collections</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {EXPORTABLE_COLLECTIONS.map((col) => (
              <label
                key={col.key}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedCollections.includes(col.key)
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/30'
                )}
              >
                <Checkbox
                  checked={selectedCollections.includes(col.key)}
                  onCheckedChange={() => toggleCollection(col.key)}
                />
                <span className="text-sm">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Filters */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Filter by Course</Label>
            <Select value={filterCourseId} onValueChange={setFilterCourseId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="All courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Applies to topics, questions, labs</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Filter by Status</Label>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleExport} disabled={exporting || selectedCollections.length === 0}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Export JSON
        </Button>
      </CardContent>
    </Card>
  );
}

// ================================================================
// IMPORT TAB
// ================================================================
function ImportTab() {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<ExportPayload | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('create_only');
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as ExportPayload;

      // Validate shape
      if (!payload.metadata || !payload.data) {
        throw new Error('Invalid export file: missing metadata or data');
      }

      setImportData(payload);

      // Generate previews
      const newPreviews: ImportPreview[] = [];
      for (const [entityType, items] of Object.entries(payload.data)) {
        if (!Array.isArray(items)) continue;
        const config = EXPORTABLE_COLLECTIONS.find((c) => c.key === entityType);
        if (!config) continue;

        // Check existing docs for upsert mode
        let existingIds = new Set<string>();
        if (importMode === 'upsert') {
          try {
            const snap = await getDocs(collection(db, config.firestoreCollection));
            existingIds = new Set(snap.docs.map((d) => d.id));
          } catch {}
        }

        const toCreate = items.filter((i) => !existingIds.has(i._id)).length;
        const toUpdate = items.filter((i) => existingIds.has(i._id)).length;

        newPreviews.push({
          entityType,
          total: items.length,
          toCreate: importMode === 'create_only' ? items.length : toCreate,
          toUpdate: importMode === 'create_only' ? 0 : toUpdate,
          toSkip: 0,
        });
      }
      setPreviews(newPreviews);
    } catch (error: any) {
      console.error('Import parse error:', error);
      addToast({ title: 'Invalid file', description: error.message, variant: 'destructive' });
      setImportData(null);
      setPreviews([]);
    }
  };

  const handleImport = async () => {
    if (!importData || !user || !userProfile) return;

    setImporting(true);
    setShowConfirm(false);
    const totalCounts: Record<string, number> = {};

    try {
      for (const [entityType, items] of Object.entries(importData.data)) {
        if (!Array.isArray(items)) continue;
        const config = EXPORTABLE_COLLECTIONS.find((c) => c.key === entityType);
        if (!config) continue;

        let created = 0;
        let updated = 0;

        // Check existing for create_only mode
        let existingIds = new Set<string>();
        if (importMode === 'create_only') {
          try {
            const snap = await getDocs(collection(db, config.firestoreCollection));
            existingIds = new Set(snap.docs.map((d) => d.id));
          } catch {}
        }

        // Process in batches of 500 (Firestore limit)
        const batchSize = 500;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = items.slice(i, i + batchSize);

          for (const item of chunk) {
            const docId = item._id || item.id || item.slug;
            if (!docId) continue;

            // Normalize: ensure slug/title lowercase fields
            const data = { ...item };
            delete data._id;

            // Ensure slug uniqueness + lowercasing
            if (data.slug) {
              data.slug = data.slug.toLowerCase();
            }
            if (data.title && !data.title_lower) {
              data.title_lower = data.title.toLowerCase();
            }
            if (data.username && !data.username_lower) {
              data.username_lower = data.username.toLowerCase();
            }

            // Add timestamps
            data.updatedAt = serverTimestamp();

            const docRef = doc(db, config.firestoreCollection, docId);

            if (importMode === 'create_only') {
              if (!existingIds.has(docId)) {
                data.createdAt = serverTimestamp();
                batch.set(docRef, data);
                created++;
              }
            } else {
              // Upsert
              batch.set(docRef, data, { merge: true });
              if (existingIds.has(docId)) {
                updated++;
              } else {
                created++;
              }
            }
          }

          await batch.commit();
        }

        totalCounts[entityType] = created + updated;
      }

      // Audit log
      logAudit({
        action: 'admin.import.run',
        category: 'admin',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        details: {
          fileName,
          mode: importMode,
          counts: totalCounts,
          source: importData.metadata,
        },
      });

      addToast({
        title: 'Import complete',
        description: `Imported ${Object.values(totalCounts).reduce((a, b) => a + b, 0)} items.`,
        variant: 'success',
      });

      // Reset
      setImportData(null);
      setPreviews([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error('Import error:', error);
      addToast({ title: 'Import failed', description: error.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Import Data
          </CardTitle>
          <CardDescription>
            Import admin-managed content from a JSON export file. All writes are batched for safety.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File picker */}
          <div>
            <Label className="text-sm font-medium">Select JSON File</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="mt-1"
            />
          </div>

          {/* Import mode */}
          <div>
            <Label className="text-sm font-medium">Import Mode</Label>
            <Select value={importMode} onValueChange={(v: ImportMode) => setImportMode(v)}>
              <SelectTrigger className="mt-1 w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_only">Create only (skip if exists)</SelectItem>
                <SelectItem value="upsert">Upsert (match by ID, merge if exists)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {previews.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Preview</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Entity</th>
                      <th className="text-right px-4 py-2 font-medium">Total</th>
                      <th className="text-right px-4 py-2 font-medium">Create</th>
                      <th className="text-right px-4 py-2 font-medium">Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previews.map((p) => (
                      <tr key={p.entityType} className="border-t">
                        <td className="px-4 py-2">{p.entityType}</td>
                        <td className="px-4 py-2 text-right">{p.total}</td>
                        <td className="px-4 py-2 text-right text-green-600">{p.toCreate}</td>
                        <td className="px-4 py-2 text-right text-yellow-600">{p.toUpdate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importData?.metadata && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Source: exported by {importData.metadata.exportedByUsername} on{' '}
                  {importData.metadata.exportedAt} (project: {importData.metadata.projectId})
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!importData || importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Import Data
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Import
            </DialogTitle>
            <DialogDescription>
              This will write data to your Firestore database. Mode: <strong>{importMode}</strong>.
              {importMode === 'upsert' && (
                <span className="text-yellow-600 block mt-1">
                  Upsert mode may overwrite existing data.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1">
            {previews.map((p) => (
              <div key={p.entityType} className="flex justify-between">
                <span>{p.entityType}</span>
                <span>{p.total} items</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ================================================================
// BACKUP / RESTORE TAB
// ================================================================
function BackupTab() {
  const { user, userProfile } = useAuth();
  const { addToast } = useToast();
  const [backups, setBackups] = useState<AdminBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupLabel, setBackupLabel] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    EXPORTABLE_COLLECTIONS.map((c) => c.key)
  );

  // Restore state
  const [restoreTarget, setRestoreTarget] = useState<AdminBackup | null>(null);
  const [restorePreview, setRestorePreview] = useState<Record<string, number> | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'admin_backups'),
        orderBy('createdAt', 'desc'),
        limit(MAX_BACKUPS)
      );
      const snap = await getDocs(q);
      setBackups(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminBackup)));
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const toggleCollection = (key: string) => {
    setSelectedCollections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleCreateBackup = async () => {
    if (!user || !userProfile) return;
    setCreating(true);

    try {
      const snapshotData: Record<string, any[]> = {};
      const counts: Record<string, number> = {};

      for (const colKey of selectedCollections) {
        const config = EXPORTABLE_COLLECTIONS.find((c) => c.key === colKey);
        if (!config) continue;
        const snap = await getDocs(collection(db, config.firestoreCollection));
        snapshotData[colKey] = snap.docs.map((d) => ({
          _id: d.id,
          ...serializeFirestoreData(d.data()),
        }));
        counts[colKey] = snap.docs.length;
      }

      // Add backup document
      const backupDoc = {
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByUsername: userProfile.username,
        label: backupLabel || `Backup ${new Date().toISOString().split('T')[0]}`,
        includes: selectedCollections,
        counts,
        snapshotData: JSON.stringify(snapshotData),
      };

      await addDoc(collection(db, 'admin_backups'), backupDoc);

      // Prune old backups (keep last N)
      const allBackups = await getDocs(
        query(collection(db, 'admin_backups'), orderBy('createdAt', 'desc'))
      );
      if (allBackups.docs.length > MAX_BACKUPS) {
        const toDelete = allBackups.docs.slice(MAX_BACKUPS);
        for (const d of toDelete) {
          await deleteDoc(doc(db, 'admin_backups', d.id));
        }
      }

      // Audit
      logAudit({
        action: 'admin.backup.created',
        category: 'admin',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        details: { counts, label: backupLabel, includes: selectedCollections },
      });

      addToast({ title: 'Backup created', variant: 'success' });
      setBackupLabel('');
      fetchBackups();
    } catch (error: any) {
      console.error('Backup error:', error);
      addToast({ title: 'Backup failed', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRestorePreview = async (backup: AdminBackup) => {
    setRestoreTarget(backup);

    // Parse snapshot data to show preview
    try {
      const data = JSON.parse(backup.snapshotData || '{}');
      const preview: Record<string, number> = {};
      for (const [key, items] of Object.entries(data)) {
        preview[key] = (items as any[]).length;
      }
      setRestorePreview(preview);
    } catch {
      setRestorePreview(backup.counts || {});
    }

    setRestoreConfirmText('');
    setShowRestoreDialog(true);

    // Audit
    if (user && userProfile) {
      logAudit({
        action: 'admin.backup.restore_attempt',
        category: 'admin',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        details: { backupId: backup.id, label: backup.label },
      });
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget || !user || !userProfile || restoreConfirmText !== 'RESTORE') return;

    setRestoring(true);
    try {
      const data = JSON.parse(restoreTarget.snapshotData || '{}');
      const counts: Record<string, number> = {};

      for (const [entityType, items] of Object.entries(data)) {
        if (!Array.isArray(items)) continue;
        const config = EXPORTABLE_COLLECTIONS.find((c) => c.key === entityType);
        if (!config) continue;

        const batchSize = 500;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = items.slice(i, i + batchSize);

          for (const item of chunk) {
            const docId = item._id || item.id;
            if (!docId) continue;

            const restoreData = { ...item };
            delete restoreData._id;
            restoreData.updatedAt = serverTimestamp();

            // Restore as Draft where applicable (site_content)
            if (entityType === 'site_content' && restoreData.published) {
              delete restoreData.published;
            }

            batch.set(doc(db, config.firestoreCollection, docId), restoreData, { merge: true });
          }

          await batch.commit();
        }

        counts[entityType] = items.length;
      }

      // Audit
      logAudit({
        action: 'admin.backup.restored',
        category: 'admin',
        actorUid: user.uid,
        actorUsername: userProfile.username,
        actorRole: userProfile.role,
        details: {
          backupId: restoreTarget.id,
          label: restoreTarget.label,
          counts,
        },
      });

      addToast({ title: 'Restore complete', variant: 'success' });
      setShowRestoreDialog(false);
      setRestoreTarget(null);
    } catch (error: any) {
      console.error('Restore error:', error);
      addToast({ title: 'Restore failed', description: error.message, variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Create Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" /> Create Snapshot
            </CardTitle>
            <CardDescription>
              Save a snapshot of admin-managed content. Last {MAX_BACKUPS} backups are kept.
              Backups never include private user data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Backup Label (optional)</Label>
              <Input
                placeholder="e.g., Before major update"
                value={backupLabel}
                onChange={(e) => setBackupLabel(e.target.value)}
                className="mt-1 max-w-md"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Include Collections</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {EXPORTABLE_COLLECTIONS.map((col) => (
                  <label
                    key={col.key}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
                      selectedCollections.includes(col.key)
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/30'
                    )}
                  >
                    <Checkbox
                      checked={selectedCollections.includes(col.key)}
                      onCheckedChange={() => toggleCollection(col.key)}
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleCreateBackup} disabled={creating || selectedCollections.length === 0}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
              Create Snapshot
            </Button>
          </CardContent>
        </Card>

        {/* Existing Backups */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Backups</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No backups found. Create your first snapshot above.</p>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {backups.map((backup) => (
                    <div
                      key={backup.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-sm">{backup.label || 'Untitled'}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          by {backup.createdByUsername || 'unknown'} •{' '}
                          {backup.createdAt ? timeAgo(backup.createdAt) : '—'}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {backup.includes?.map((col) => (
                            <Badge key={col} variant="secondary" className="text-[10px]">
                              {col}: {backup.counts?.[col] || 0}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestorePreview(backup)}
                        className="shrink-0"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Restore Backup — DANGEROUS OPERATION
            </DialogTitle>
            <DialogDescription>
              Restoring will overwrite current data with the backup snapshot.
              Site content will be restored as draft (unpublished).
            </DialogDescription>
          </DialogHeader>

          {restorePreview && (
            <div className="text-sm border rounded-lg p-3 bg-muted/50">
              <p className="font-medium mb-2">Dry-run preview — items to restore:</p>
              {Object.entries(restorePreview).map(([k, v]) => (
                <div key={k} className="flex justify-between py-0.5">
                  <span>{k}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">
              Type <span className="font-mono text-red-600">RESTORE</span> to confirm
            </Label>
            <Input
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              placeholder="RESTORE"
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={restoreConfirmText !== 'RESTORE' || restoring}
            >
              {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Restore Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ================================================================
// Helpers
// ================================================================

/**
 * Serialize Firestore data for JSON export.
 * Converts Timestamps to ISO strings.
 */
function serializeFirestoreData(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp || (value && typeof value.toDate === 'function')) {
      result[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = serializeFirestoreData(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? serializeFirestoreData(item)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
