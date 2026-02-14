'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAdminSearch } from '@/lib/hooks/useAdminSearch';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity, logAudit } from '@/lib/firebase/activity';
import { SearchResult, SearchEntityType, COMMAND_PALETTE_ACTIONS } from '@/lib/utils/search';
import {
  Search,
  BookOpen,
  Layers,
  FileText,
  MessageSquare,
  Users,
  Megaphone,
  FlaskConical,
  Zap,
  Loader2,
  ArrowRight,
  Command,
} from 'lucide-react';
import { t } from '@/lib/i18n';

const ENTITY_CONFIG: Record<SearchEntityType, { label: string; color: string; icon: any }> = {
  course: { label: 'Course', color: 'bg-blue-100 text-blue-800', icon: BookOpen },
  topic: { label: 'Topic', color: 'bg-green-100 text-green-800', icon: Layers },
  note: { label: 'Note', color: 'bg-orange-100 text-orange-800', icon: FileText },
  question: { label: 'Question', color: 'bg-purple-100 text-purple-800', icon: MessageSquare },
  user: { label: 'User', color: 'bg-indigo-100 text-indigo-800', icon: Users },
  announcement: { label: 'Announcement', color: 'bg-yellow-100 text-yellow-800', icon: Megaphone },
  lab: { label: 'Lab', color: 'bg-teal-100 text-teal-800', icon: FlaskConical },
  action: { label: 'Action', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200', icon: Zap },
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { searchTerm, setSearchTerm, results, loading } = useAdminSearch();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { user, userProfile, claims } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Permission check: admin or moderator with adminCommandPalette permission
  const hasAccess =
    claims?.role === 'admin' ||
    (claims?.role === 'moderator' && userProfile?.permissions?.adminCommandPalette);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (hasAccess) {
          setOpen((prev) => !prev);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasAccess]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedIndex(0);
      // Log activity
      if (user && userProfile) {
        logActivity({
          type: 'admin.command_palette.opened',
          category: 'admin',
          actorUid: user.uid,
          actorUsername: userProfile.username,
          actorRole: userProfile.role,
        });
      }
      // Focus input after dialog renders
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, setSearchTerm, user, userProfile]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      router.push(result.href);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [results, selectedIndex, handleSelect]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!hasAccess) return null;

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const group = r.type === 'action' ? 'Actions' : 'Results';
    if (!acc[group]) acc[group] = [];
    acc[group].push(r);
    return acc;
  }, {});

  // Flat list for keyboard navigation
  const flatResults = [...(grouped['Actions'] || []), ...(grouped['Results'] || [])];
  // Sync results for index
  const currentResults = flatResults.length > 0 ? flatResults : results;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">{t('common.search')}</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search courses, topics, users, actions..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Results */}
          <ScrollArea className="max-h-[400px]">
            <div ref={listRef} className="py-2">
              {/* Empty state */}
              {!loading && searchTerm.length >= 2 && currentResults.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results found for &quot;{searchTerm}&quot;
                </div>
              )}

              {/* Initial state */}
              {searchTerm.length < 2 && (
                <div className="px-4 py-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Quick Actions</p>
                  {COMMAND_PALETTE_ACTIONS.slice(0, 5).map((match) => (
                    <button
                      key={match.id}
                      onClick={() => handleSelect(match)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                    >
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>{match.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{match.subtitle}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}

              {/* Grouped results */}
              {searchTerm.length >= 2 &&
                Object.entries(grouped).map(([groupName, items]) => (
                  <div key={groupName}>
                    <p className="text-xs font-medium text-muted-foreground px-4 py-1">{groupName}</p>
                    {items.map((result) => {
                      const globalIdx = currentResults.indexOf(result);
                      const config = ENTITY_CONFIG[result.type];
                      const IconComp = config.icon;
                      return (
                        <button
                          key={result.id}
                          data-selected={globalIdx === selectedIndex}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            'flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left',
                            globalIdx === selectedIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50'
                          )}
                        >
                          <IconComp className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{result.title}</span>
                            {result.subtitle && (
                              <span className="text-xs text-muted-foreground truncate block">
                                {result.subtitle}
                              </span>
                            )}
                          </div>
                          <Badge className={cn('text-[10px] shrink-0', config.color)}>
                            {config.label}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1 font-mono">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1 font-mono">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1 font-mono">Esc</kbd> Close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
