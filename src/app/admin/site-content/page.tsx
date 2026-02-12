'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteContent } from '@/lib/hooks/useSiteContent';
import { logAudit } from '@/lib/firebase/activity';
import { formatDateTime, generateId } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import {
  SitePageId,
  SiteContentHome,
  SiteContentNav,
  SiteContentFooter,
  HomeBlock,
  HomeBlockType,
  NavLink,
  FooterColumn,
  FooterLink,
  SiteContentVersion,
  DEFAULT_HOME_CONTENT,
  DEFAULT_NAV_CONTENT,
  DEFAULT_FOOTER_CONTENT,
} from '@/lib/types';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  Loader2,
  Save,
  Upload as UploadIcon,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  History,
  Eye,
  RotateCcw,
  ChevronRight,
  FileText,
  Navigation,
  Footprints,
  Globe,
  GripVertical,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const BLOCK_TYPE_LABELS: Record<HomeBlockType, string> = {
  hero: 'Hero',
  announcement: 'Announcement',
  features: 'Features',
  featured_courses: 'Featured Courses',
  how_it_works: 'How It Works',
  faq: 'FAQ',
  cta: 'Call To Action',
  stats: 'Stats',
  testimonials: 'Testimonials',
};

const ALL_BLOCK_TYPES: HomeBlockType[] = [
  'hero', 'announcement', 'features', 'featured_courses',
  'how_it_works', 'faq', 'cta', 'stats', 'testimonials',
];

// ─── Version History Panel ────────────────────────────────
function VersionHistoryPanel({
  versions,
  loading,
  saving,
  onRollback,
  onRollbackAndPublish,
  isAdmin,
}: {
  versions: (SiteContentVersion & { id: string })[];
  loading: boolean;
  saving: boolean;
  onRollback: (v: SiteContentVersion & { id: string }) => void;
  onRollbackAndPublish: (v: SiteContentVersion & { id: string }) => void;
  isAdmin: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'rollback' | 'rollback_publish' | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No version history yet. Save a draft to start tracking changes.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2 pr-2">
        {versions.map((v) => {
          const isExpanded = expandedId === v.id;
          const isConfirming = confirmId === v.id;
          const ts = v.createdAt?.toDate ? formatDateTime(v.createdAt) : '—';

          return (
            <Card key={v.id} className="overflow-hidden">
              <button
                className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : v.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={v.kind === 'published' ? 'default' : 'secondary'} className="text-xs">
                    {v.kind === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                  <span className="text-sm font-medium">v{v.version}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{ts}</span>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
                {v.label && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{v.label}</p>
                )}
              </button>

              {isExpanded && (
                <div className="border-t p-3 space-y-3 bg-muted/30">
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Author:</span> {v.createdBy}</p>
                    <p><span className="font-medium">Page:</span> {v.pageId}</p>
                    {v.label && <p><span className="font-medium">Label:</span> {v.label}</p>}
                  </div>

                  {/* Snapshot preview */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View snapshot (JSON)
                    </summary>
                    <pre className="mt-2 p-2 bg-background rounded border text-[10px] overflow-auto max-h-60">
                      {JSON.stringify(v.snapshot, null, 2)}
                    </pre>
                  </details>

                  {/* Actions */}
                  {!isConfirming ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => { setConfirmId(v.id); setConfirmAction('rollback'); }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Restore as Draft
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          onClick={() => { setConfirmId(v.id); setConfirmAction('rollback_publish'); }}
                        >
                          <UploadIcon className="h-3 w-3 mr-1" /> Restore &amp; Publish
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                      <span className="text-xs">
                        {confirmAction === 'rollback_publish'
                          ? 'Restore & publish this version?'
                          : 'Restore this version as draft?'}
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="ml-auto"
                        disabled={saving}
                        onClick={() => {
                          if (confirmAction === 'rollback_publish') onRollbackAndPublish(v);
                          else onRollback(v);
                          setConfirmId(null);
                          setConfirmAction(null);
                        }}
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setConfirmId(null); setConfirmAction(null); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ─── Home Blocks Editor ───────────────────────────────────
function HomeBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: HomeBlock[];
  onChange: (blocks: HomeBlock[]) => void;
}) {
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newBlocks = [...sorted];
    const tmpOrder = newBlocks[idx].order;
    newBlocks[idx] = { ...newBlocks[idx], order: newBlocks[swapIdx].order };
    newBlocks[swapIdx] = { ...newBlocks[swapIdx], order: tmpOrder };
    onChange(newBlocks);
  };

  const toggleBlock = (id: string, enabled: boolean) => {
    onChange(sorted.map((b) => (b.id === id ? { ...b, enabled } : b)));
  };

  const updateBlockContent = (id: string, content: any) => {
    onChange(sorted.map((b) => (b.id === id ? { ...b, content: { ...b.content, en: content } } : b)));
  };

  const removeBlock = (id: string) => {
    onChange(sorted.filter((b) => b.id !== id));
  };

  const addBlock = (type: HomeBlockType) => {
    const maxOrder = sorted.length > 0 ? Math.max(...sorted.map((b) => b.order)) : -1;
    const newBlock: HomeBlock = {
      id: `${type}-${generateId()}`,
      type,
      enabled: false,
      order: maxOrder + 1,
      content: { en: getDefaultBlockContent(type) },
    };
    onChange([...sorted, newBlock]);
  };

  return (
    <div className="space-y-3">
      {sorted.map((block, idx) => {
        const isExpanded = expandedBlock === block.id;
        return (
          <Card key={block.id} className={!block.enabled ? 'opacity-60' : ''}>
            <div className="flex items-center gap-2 p-3">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{BLOCK_TYPE_LABELS[block.type]}</Badge>
                  <span className="text-xs text-muted-foreground">#{block.order}</span>
                </div>
              </div>
              <Switch
                checked={block.enabled}
                onCheckedChange={(v) => toggleBlock(block.id, v)}
              />
              <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => moveBlock(block.id, -1)}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" disabled={idx === sorted.length - 1} onClick={() => moveBlock(block.id, 1)}>
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setExpandedBlock(isExpanded ? null : block.id)}>
                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removeBlock(block.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>

            {isExpanded && (
              <div className="border-t p-4 space-y-3">
                <BlockContentEditor
                  type={block.type}
                  content={block.content.en || {}}
                  onChange={(c) => updateBlockContent(block.id, c)}
                />
              </div>
            )}
          </Card>
        );
      })}

      {/* Add block */}
      <div className="flex flex-wrap gap-2">
        {ALL_BLOCK_TYPES.map((t) => (
          <Button key={t} variant="outline" size="sm" onClick={() => addBlock(t)}>
            <Plus className="h-3 w-3 mr-1" /> {BLOCK_TYPE_LABELS[t]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function getDefaultBlockContent(type: HomeBlockType): any {
  switch (type) {
    case 'hero': return { title: '', subtitle: '', primaryCtaLabel: '', primaryCtaHref: '', secondaryCtaLabel: '', secondaryCtaHref: '' };
    case 'announcement': return { text: '', href: '', style: 'info', dismissible: true };
    case 'features': return { heading: '', items: [{ title: '', description: '', icon: '' }] };
    case 'featured_courses': return { heading: '', courseSlugs: [] };
    case 'how_it_works': return { heading: '', steps: [{ title: '', description: '' }] };
    case 'faq': return { heading: '', items: [{ q: '', aMarkdown: '' }] };
    case 'cta': return { heading: '', bodyMarkdown: '', buttonLabel: '', buttonHref: '' };
    case 'stats': return { heading: '', items: [{ label: '', value: '' }] };
    case 'testimonials': return { heading: '', items: [{ name: '', text: '', avatarUrl: '' }] };
  }
}

// ─── Block Content Editor (per type) ─────────────────────
function BlockContentEditor({
  type,
  content,
  onChange,
}: {
  type: HomeBlockType;
  content: any;
  onChange: (c: any) => void;
}) {
  const set = (key: string, value: any) => onChange({ ...content, [key]: value });

  switch (type) {
    case 'hero':
      return (
        <div className="grid gap-3">
          <div><Label>Title</Label><Input value={content.title || ''} onChange={(e) => set('title', e.target.value)} /></div>
          <div><Label>Subtitle</Label><Input value={content.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Primary CTA Label</Label><Input value={content.primaryCtaLabel || ''} onChange={(e) => set('primaryCtaLabel', e.target.value)} /></div>
            <div><Label>Primary CTA Href</Label><Input value={content.primaryCtaHref || ''} onChange={(e) => set('primaryCtaHref', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Secondary CTA Label</Label><Input value={content.secondaryCtaLabel || ''} onChange={(e) => set('secondaryCtaLabel', e.target.value)} /></div>
            <div><Label>Secondary CTA Href</Label><Input value={content.secondaryCtaHref || ''} onChange={(e) => set('secondaryCtaHref', e.target.value)} /></div>
          </div>
        </div>
      );

    case 'announcement':
      return (
        <div className="grid gap-3">
          <div><Label>Text</Label><Input value={content.text || ''} onChange={(e) => set('text', e.target.value)} /></div>
          <div><Label>Link (optional)</Label><Input value={content.href || ''} onChange={(e) => set('href', e.target.value)} /></div>
          <div className="flex items-center gap-4">
            <div>
              <Label>Style</Label>
              <select
                className="ml-2 border rounded px-2 py-1 text-sm"
                value={content.style || 'info'}
                onChange={(e) => set('style', e.target.value)}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Dismissible</Label>
              <Switch checked={content.dismissible ?? true} onCheckedChange={(v) => set('dismissible', v)} />
            </div>
          </div>
        </div>
      );

    case 'features':
      return (
        <div className="space-y-3">
          <div><Label>Heading</Label><Input value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></div>
          <Label>Items</Label>
          {(content.items || []).map((item: any, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Input placeholder="Title" value={item.title || ''} onChange={(e) => {
                  const items = [...(content.items || [])];
                  items[i] = { ...items[i], title: e.target.value };
                  set('items', items);
                }} />
                <Input placeholder="Description" value={item.description || ''} onChange={(e) => {
                  const items = [...(content.items || [])];
                  items[i] = { ...items[i], description: e.target.value };
                  set('items', items);
                }} />
                <Input placeholder="Icon (e.g. Zap)" value={item.icon || ''} onChange={(e) => {
                  const items = [...(content.items || [])];
                  items[i] = { ...items[i], icon: e.target.value };
                  set('items', items);
                }} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                const items = (content.items || []).filter((_: any, j: number) => j !== i);
                set('items', items);
              }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('items', [...(content.items || []), { title: '', description: '', icon: '' }])}>
            <Plus className="h-3 w-3 mr-1" /> Add Item
          </Button>
        </div>
      );

    case 'featured_courses':
      return (
        <div className="space-y-3">
          <div><Label>Heading</Label><Input value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></div>
          <div>
            <Label>Course Slugs (comma-separated)</Label>
            <Input
              value={(content.courseSlugs || []).join(', ')}
              onChange={(e) => set('courseSlugs', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
            />
          </div>
        </div>
      );

    case 'how_it_works':
      return (
        <div className="space-y-3">
          <div><Label>Heading</Label><Input value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></div>
          <Label>Steps</Label>
          {(content.steps || []).map((step: any, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input placeholder="Title" value={step.title || ''} onChange={(e) => {
                  const steps = [...(content.steps || [])];
                  steps[i] = { ...steps[i], title: e.target.value };
                  set('steps', steps);
                }} />
                <Input placeholder="Description" value={step.description || ''} onChange={(e) => {
                  const steps = [...(content.steps || [])];
                  steps[i] = { ...steps[i], description: e.target.value };
                  set('steps', steps);
                }} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => set('steps', (content.steps || []).filter((_: any, j: number) => j !== i))}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('steps', [...(content.steps || []), { title: '', description: '' }])}>
            <Plus className="h-3 w-3 mr-1" /> Add Step
          </Button>
        </div>
      );

    case 'faq':
      return (
        <div className="space-y-3">
          <div><Label>Heading</Label><Input value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></div>
          <Label>Items</Label>
          {(content.items || []).map((item: any, i: number) => (
            <div key={i} className="space-y-1 p-2 border rounded">
              <Input placeholder="Question" value={item.q || ''} onChange={(e) => {
                const items = [...(content.items || [])];
                items[i] = { ...items[i], q: e.target.value };
                set('items', items);
              }} />
              <Textarea placeholder="Answer (Markdown)" value={item.aMarkdown || ''} onChange={(e) => {
                const items = [...(content.items || [])];
                items[i] = { ...items[i], aMarkdown: e.target.value };
                set('items', items);
              }} rows={2} />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => set('items', (content.items || []).filter((_: any, j: number) => j !== i))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('items', [...(content.items || []), { q: '', aMarkdown: '' }])}>
            <Plus className="h-3 w-3 mr-1" /> Add FAQ
          </Button>
        </div>
      );

    case 'cta':
      return (
        <div className="grid gap-3">
          <div><Label>Heading</Label><Input value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></div>
          <div><Label>Body (Markdown)</Label><Textarea value={content.bodyMarkdown || ''} onChange={(e) => set('bodyMarkdown', e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Button Label</Label><Input value={content.buttonLabel || ''} onChange={(e) => set('buttonLabel', e.target.value)} /></div>
            <div><Label>Button Href</Label><Input value={content.buttonHref || ''} onChange={(e) => set('buttonHref', e.target.value)} /></div>
          </div>
        </div>
      );

    case 'stats':
      return (
        <div className="space-y-3">
          <div><Label>Heading</Label><Input value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></div>
          <Label>Items</Label>
          {(content.items || []).map((item: any, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <Input placeholder="Label" className="flex-1" value={item.label || ''} onChange={(e) => {
                const items = [...(content.items || [])];
                items[i] = { ...items[i], label: e.target.value };
                set('items', items);
              }} />
              <Input placeholder="Value" className="flex-1" value={item.value || ''} onChange={(e) => {
                const items = [...(content.items || [])];
                items[i] = { ...items[i], value: e.target.value };
                set('items', items);
              }} />
              <Button variant="ghost" size="sm" onClick={() => set('items', (content.items || []).filter((_: any, j: number) => j !== i))}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('items', [...(content.items || []), { label: '', value: '' }])}>
            <Plus className="h-3 w-3 mr-1" /> Add Stat
          </Button>
        </div>
      );

    case 'testimonials':
      return (
        <div className="space-y-3">
          <div><Label>Heading</Label><Input value={content.heading || ''} onChange={(e) => set('heading', e.target.value)} /></div>
          <Label>Testimonials</Label>
          {(content.items || []).map((item: any, i: number) => (
            <div key={i} className="space-y-1 p-2 border rounded">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={item.name || ''} onChange={(e) => {
                  const items = [...(content.items || [])];
                  items[i] = { ...items[i], name: e.target.value };
                  set('items', items);
                }} />
                <Input placeholder="Avatar URL (opt)" value={item.avatarUrl || ''} onChange={(e) => {
                  const items = [...(content.items || [])];
                  items[i] = { ...items[i], avatarUrl: e.target.value };
                  set('items', items);
                }} />
              </div>
              <Textarea placeholder="Testimonial text" value={item.text || ''} onChange={(e) => {
                const items = [...(content.items || [])];
                items[i] = { ...items[i], text: e.target.value };
                set('items', items);
              }} rows={2} />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => set('items', (content.items || []).filter((_: any, j: number) => j !== i))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set('items', [...(content.items || []), { name: '', text: '', avatarUrl: '' }])}>
            <Plus className="h-3 w-3 mr-1" /> Add Testimonial
          </Button>
        </div>
      );

    default:
      return <p className="text-sm text-muted-foreground">Unknown block type</p>;
  }
}

// ─── Nav Links Editor ─────────────────────────────────────
function NavLinksEditor({
  links,
  showLogin,
  showSignup,
  onChangeLinks,
  onChangeLogin,
  onChangeSignup,
}: {
  links: NavLink[];
  showLogin: boolean;
  showSignup: boolean;
  onChangeLinks: (l: NavLink[]) => void;
  onChangeLogin: (v: boolean) => void;
  onChangeSignup: (v: boolean) => void;
}) {
  const sorted = [...links].sort((a, b) => a.order - b.order);

  const moveLink = (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newLinks = [...sorted];
    const tmp = newLinks[idx].order;
    newLinks[idx] = { ...newLinks[idx], order: newLinks[swapIdx].order };
    newLinks[swapIdx] = { ...newLinks[swapIdx], order: tmp };
    onChangeLinks(newLinks);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {sorted.map((link, i) => (
          <div key={i} className="flex items-center gap-2 p-2 border rounded">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Label"
              className="w-32"
              value={link.label.en || ''}
              onChange={(e) => {
                const newLinks = [...sorted];
                newLinks[i] = { ...newLinks[i], label: { ...newLinks[i].label, en: e.target.value } };
                onChangeLinks(newLinks);
              }}
            />
            <Input
              placeholder="/path"
              className="flex-1"
              value={link.href || ''}
              onChange={(e) => {
                const newLinks = [...sorted];
                newLinks[i] = { ...newLinks[i], href: e.target.value };
                onChangeLinks(newLinks);
              }}
            />
            <Switch
              checked={link.enabled}
              onCheckedChange={(v) => {
                const newLinks = [...sorted];
                newLinks[i] = { ...newLinks[i], enabled: v };
                onChangeLinks(newLinks);
              }}
            />
            <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => moveLink(i, -1)}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" disabled={i === sorted.length - 1} onClick={() => moveLink(i, 1)}>
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChangeLinks(sorted.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const maxOrder = sorted.length > 0 ? Math.max(...sorted.map((l) => l.order)) : -1;
          onChangeLinks([...sorted, { label: { en: '' }, href: '/', enabled: true, order: maxOrder + 1 }]);
        }}
      >
        <Plus className="h-3 w-3 mr-1" /> Add Link
      </Button>

      <Separator />
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Label>Show Login Button</Label>
          <Switch checked={showLogin} onCheckedChange={onChangeLogin} />
        </div>
        <div className="flex items-center gap-2">
          <Label>Show Signup Button</Label>
          <Switch checked={showSignup} onCheckedChange={onChangeSignup} />
        </div>
      </div>
    </div>
  );
}

// ─── Footer Editor ────────────────────────────────────────
function FooterEditor({
  columns,
  socials,
  copyright,
  onChangeColumns,
  onChangeSocials,
  onChangeCopyright,
}: {
  columns: FooterColumn[];
  socials: Record<string, string>;
  copyright: string;
  onChangeColumns: (c: FooterColumn[]) => void;
  onChangeSocials: (s: Record<string, string>) => void;
  onChangeCopyright: (c: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Columns */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Columns</Label>
        {columns.map((col, ci) => (
          <Card key={ci}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Column Title"
                  value={col.title.en || ''}
                  onChange={(e) => {
                    const newCols = [...columns];
                    newCols[ci] = { ...newCols[ci], title: { ...newCols[ci].title, en: e.target.value } };
                    onChangeColumns(newCols);
                  }}
                  className="font-medium"
                />
                <Button variant="ghost" size="sm" onClick={() => onChangeColumns(columns.filter((_, j) => j !== ci))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {col.links.map((link, li) => (
                <div key={li} className="flex items-center gap-2">
                  <Input
                    placeholder="Label"
                    className="w-32"
                    value={link.label.en || ''}
                    onChange={(e) => {
                      const newCols = deepClone(columns);
                      newCols[ci].links[li].label.en = e.target.value;
                      onChangeColumns(newCols);
                    }}
                  />
                  <Input
                    placeholder="/path"
                    className="flex-1"
                    value={link.href || ''}
                    onChange={(e) => {
                      const newCols = deepClone(columns);
                      newCols[ci].links[li].href = e.target.value;
                      onChangeColumns(newCols);
                    }}
                  />
                  <Switch
                    checked={link.enabled}
                    onCheckedChange={(v) => {
                      const newCols = deepClone(columns);
                      newCols[ci].links[li].enabled = v;
                      onChangeColumns(newCols);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newCols = deepClone(columns);
                      newCols[ci].links.splice(li, 1);
                      onChangeColumns(newCols);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newCols = deepClone(columns);
                  const maxOrd = col.links.length > 0 ? Math.max(...col.links.map((l) => l.order)) : -1;
                  newCols[ci].links.push({ label: { en: '' }, href: '/', enabled: true, order: maxOrd + 1 });
                  onChangeColumns(newCols);
                }}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Link
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChangeColumns([...columns, { title: { en: '' }, links: [] }])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Column
        </Button>
      </div>

      <Separator />

      {/* Socials */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Social Links</Label>
        <div className="grid grid-cols-2 gap-3">
          {['instagram', 'telegram', 'github', 'website'].map((key) => (
            <div key={key}>
              <Label className="capitalize">{key}</Label>
              <Input
                placeholder={`https://${key}.com/...`}
                value={(socials as any)[key] || ''}
                onChange={(e) => onChangeSocials({ ...socials, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Copyright */}
      <div>
        <Label className="text-base font-semibold">Copyright</Label>
        <Input
          placeholder="© {year} Your Company. All rights reserved."
          value={copyright}
          onChange={(e) => onChangeCopyright(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">Use &#123;year&#125; for the current year.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function AdminSiteContentPage() {
  const { user, userProfile, claims } = useAuth();
  const { addToast } = useToast();
  const isAdmin = claims?.role === 'admin' || userProfile?.role === 'admin';

  const [activePage, setActivePage] = useState<SitePageId>('home');
  const [showHistory, setShowHistory] = useState(false);
  const [changeLabel, setChangeLabel] = useState('');

  // Hooks for all three pages (only active one used for editing)
  const home = useSiteContent('home');
  const nav = useSiteContent('nav');
  const footer = useSiteContent('footer');

  const contentMap = { home, nav, footer };
  const active = contentMap[activePage];

  // ── Local form state ────────────────────────────────────
  const [homeForm, setHomeForm] = useState<SiteContentHome | null>(null);
  const [navForm, setNavForm] = useState<SiteContentNav | null>(null);
  const [footerForm, setFooterForm] = useState<SiteContentFooter | null>(null);

  const [dirty, setDirty] = useState(false);
  const [initialized, setInitialized] = useState({ home: false, nav: false, footer: false });

  // Sync Firestore → local form once per page
  useEffect(() => {
    if (home.data && !initialized.home) {
      setHomeForm(deepClone(home.data as SiteContentHome));
      setInitialized((p) => ({ ...p, home: true }));
    }
  }, [home.data, initialized.home]);

  useEffect(() => {
    if (nav.data && !initialized.nav) {
      setNavForm(deepClone(nav.data as SiteContentNav));
      setInitialized((p) => ({ ...p, nav: true }));
    }
  }, [nav.data, initialized.nav]);

  useEffect(() => {
    if (footer.data && !initialized.footer) {
      setFooterForm(deepClone(footer.data as SiteContentFooter));
      setInitialized((p) => ({ ...p, footer: true }));
    }
  }, [footer.data, initialized.footer]);

  // ── Permission checks ───────────────────────────────────
  const canEdit = (page: SitePageId) => {
    if (isAdmin) return true;
    const perms = userProfile?.permissions;
    if (!perms) return false;
    switch (page) {
      case 'home': return perms.siteContentEditHome;
      case 'nav': return perms.siteContentEditNav;
      case 'footer': return perms.siteContentEditFooter;
    }
    return false;
  };

  const canViewHistory = isAdmin || userProfile?.permissions?.siteContentViewHistory;

  // ── Save Draft ──────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!canEdit(activePage)) {
      addToast({ title: 'Permission denied', variant: 'destructive' });
      return;
    }
    try {
      let content: any;
      switch (activePage) {
        case 'home': content = homeForm; break;
        case 'nav': content = navForm; break;
        case 'footer': content = footerForm; break;
      }
      if (!content) return;

      // Strip old draft/published metadata — hook will generate new ones
      const { draft: _d, published: _p, ...rest } = content;
      await active.saveDraft(rest, changeLabel);

      if (user && userProfile) {
        await logAudit({
          action: 'site_content.save_draft',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          targetType: 'site_content',
          targetId: activePage,
          details: { pageId: activePage, label: changeLabel },
        });
      }

      addToast({ title: 'Draft saved', variant: 'success' });
      setDirty(false);
      setChangeLabel('');
    } catch (e: any) {
      addToast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  // ── Publish ─────────────────────────────────────────────
  const handlePublish = async () => {
    if (!canEdit(activePage)) {
      addToast({ title: 'Permission denied', variant: 'destructive' });
      return;
    }
    try {
      // Save draft first, then publish
      let content: any;
      switch (activePage) {
        case 'home': content = homeForm; break;
        case 'nav': content = navForm; break;
        case 'footer': content = footerForm; break;
      }
      if (!content) return;

      const { draft: _d, published: _p, ...rest } = content;
      await active.saveDraft(rest, changeLabel || 'Pre-publish save');
      await active.publish(changeLabel || 'Published');

      if (user && userProfile) {
        await logAudit({
          action: 'site_content.publish',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          targetType: 'site_content',
          targetId: activePage,
          details: { pageId: activePage, label: changeLabel },
        });
      }

      addToast({ title: 'Published!', description: 'Content is now live.', variant: 'success' });
      setDirty(false);
      setChangeLabel('');
    } catch (e: any) {
      addToast({ title: 'Publish failed', description: e.message, variant: 'destructive' });
    }
  };

  // ── Revert to Published ─────────────────────────────────
  const handleRevert = async () => {
    try {
      await active.revertToPublished();

      if (user && userProfile) {
        await logAudit({
          action: 'site_content.revert',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          targetType: 'site_content',
          targetId: activePage,
          details: { pageId: activePage },
        });
      }

      // Reset local form
      setInitialized((p) => ({ ...p, [activePage]: false }));
      setDirty(false);
      addToast({ title: 'Reverted to published version', variant: 'success' });
    } catch (e: any) {
      addToast({ title: 'Revert failed', description: e.message, variant: 'destructive' });
    }
  };

  // ── Rollback from version history ──────────────────────
  const handleRollback = async (v: SiteContentVersion & { id: string }) => {
    try {
      await active.rollbackToVersion(v, false);

      if (user && userProfile) {
        await logAudit({
          action: 'site_content.rollback_to_draft',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          targetType: 'site_content',
          targetId: activePage,
          details: { pageId: activePage, fromVersion: v.version, kind: v.kind },
        });
      }

      setInitialized((p) => ({ ...p, [activePage]: false }));
      setDirty(false);
      addToast({ title: `Restored v${v.version} as draft`, variant: 'success' });
    } catch (e: any) {
      addToast({ title: 'Rollback failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleRollbackAndPublish = async (v: SiteContentVersion & { id: string }) => {
    try {
      await active.rollbackToVersion(v, true);

      if (user && userProfile) {
        await logAudit({
          action: 'site_content.rollback_and_publish',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
          targetType: 'site_content',
          targetId: activePage,
          details: { pageId: activePage, fromVersion: v.version, kind: v.kind },
        });
      }

      setInitialized((p) => ({ ...p, [activePage]: false }));
      setDirty(false);
      addToast({ title: `Restored v${v.version} & published`, variant: 'success' });
    } catch (e: any) {
      addToast({ title: 'Rollback & publish failed', description: e.message, variant: 'destructive' });
    }
  };

  // ── Loading states ──────────────────────────────────────
  if (active.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const draftMeta = (active.data as any)?.draft;
  const pubMeta = (active.data as any)?.published;
  const hasPublished = !!pubMeta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site Content</h1>
          <p className="text-muted-foreground text-sm">Manage homepage, navigation, and footer content with draft/publish workflow.</p>
        </div>
        <div className="flex items-center gap-2">
          {canViewHistory && (
            <Button
              variant={showHistory ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
          )}
        </div>
      </div>

      {/* Page selector tabs */}
      <Tabs value={activePage} onValueChange={(v) => { setActivePage(v as SitePageId); setShowHistory(false); }}>
        <TabsList>
          <TabsTrigger value="home" className="gap-1.5">
            <FileText className="h-4 w-4" /> Homepage
          </TabsTrigger>
          <TabsTrigger value="nav" className="gap-1.5">
            <Navigation className="h-4 w-4" /> Navigation
          </TabsTrigger>
          <TabsTrigger value="footer" className="gap-1.5">
            <Footprints className="h-4 w-4" /> Footer
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main layout: editor + optional history panel */}
      <div className={`grid gap-6 ${showHistory ? 'lg:grid-cols-[1fr_380px]' : ''}`}>
        {/* Editor column */}
        <div className="space-y-4">
          {/* Draft/Publish status badges */}
          <div className="flex flex-wrap items-center gap-3">
            {draftMeta && (
              <Badge variant="secondary" className="text-xs">
                Draft v{draftMeta.version} — {draftMeta.updatedAt ? formatDateTime(draftMeta.updatedAt) : 'unsaved'}
              </Badge>
            )}
            {pubMeta && (
              <Badge variant="default" className="text-xs">
                Published v{pubMeta.version} — {pubMeta.publishedAt ? formatDateTime(pubMeta.publishedAt) : ''}
              </Badge>
            )}
            {dirty && (
              <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700">
                Unsaved changes
              </Badge>
            )}
          </div>

          {/* Content editor */}
          <Card>
            <CardContent className="pt-6">
              {activePage === 'home' && homeForm && (
                <HomeBlocksEditor
                  blocks={homeForm.blocks}
                  onChange={(blocks) => { setHomeForm({ ...homeForm, blocks }); setDirty(true); }}
                />
              )}
              {activePage === 'nav' && navForm && (
                <NavLinksEditor
                  links={navForm.links}
                  showLogin={navForm.showLogin}
                  showSignup={navForm.showSignup}
                  onChangeLinks={(links) => { setNavForm({ ...navForm, links }); setDirty(true); }}
                  onChangeLogin={(v) => { setNavForm({ ...navForm, showLogin: v }); setDirty(true); }}
                  onChangeSignup={(v) => { setNavForm({ ...navForm, showSignup: v }); setDirty(true); }}
                />
              )}
              {activePage === 'footer' && footerForm && (
                <FooterEditor
                  columns={footerForm.columns}
                  socials={footerForm.socials}
                  copyright={footerForm.copyright?.en || ''}
                  onChangeColumns={(columns) => { setFooterForm({ ...footerForm, columns }); setDirty(true); }}
                  onChangeSocials={(socials) => { setFooterForm({ ...footerForm, socials }); setDirty(true); }}
                  onChangeCopyright={(c) => { setFooterForm({ ...footerForm, copyright: { ...footerForm.copyright, en: c } }); setDirty(true); }}
                />
              )}
            </CardContent>
          </Card>

          {/* Action bar */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Change label (optional)</Label>
                  <Input
                    placeholder="e.g. Updated hero copy"
                    value={changeLabel}
                    onChange={(e) => setChangeLabel(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!dirty || active.saving}
                    onClick={handleSaveDraft}
                  >
                    {active.saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Draft
                  </Button>
                  <Button
                    size="sm"
                    disabled={active.saving}
                    onClick={handlePublish}
                  >
                    {active.saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UploadIcon className="h-4 w-4 mr-1" />}
                    Publish
                  </Button>
                  {hasPublished && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={active.saving}
                      onClick={handleRevert}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Revert to Published
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History panel */}
        {showHistory && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Version History
              </CardTitle>
              <CardDescription className="text-xs">
                Last 20 versions per kind for &quot;{activePage}&quot;
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VersionHistoryPanel
                versions={active.versions}
                loading={active.versionsLoading}
                saving={active.saving}
                onRollback={handleRollback}
                onRollbackAndPublish={handleRollbackAndPublish}
                isAdmin={!!isAdmin}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
