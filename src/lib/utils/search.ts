// ============================================================
// Search utilities for admin command palette
// ============================================================

/**
 * Normalize a string for search: lowercase, trim, remove accents
 */
export function normalizeSearchTerm(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Firestore prefix search boundaries.
 * Returns [start, end] strings to use with >= / <= queries.
 */
export function prefixSearchBounds(term: string): [string, string] {
  const lower = normalizeSearchTerm(term);
  return [lower, lower + '\uf8ff'];
}

/**
 * Entity types that can appear in search results.
 */
export type SearchEntityType =
  | 'course'
  | 'topic'
  | 'note'
  | 'question'
  | 'user'
  | 'announcement'
  | 'lab'
  | 'action';

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  href: string;
  icon?: string;
}

/**
 * Quick-action results for the command palette.
 */
export const COMMAND_PALETTE_ACTIONS: SearchResult[] = [
  { id: 'action-create-course', type: 'action', title: 'Create Course', subtitle: 'Add a new course', href: '/admin/courses?action=create' },
  { id: 'action-add-topic', type: 'action', title: 'Add Topic', subtitle: 'Add a new topic', href: '/admin/topics?action=create' },
  { id: 'action-add-question', type: 'action', title: 'Add Question', subtitle: 'Add to question bank', href: '/admin/questions?action=create' },
  { id: 'action-go-diagnostics', type: 'action', title: 'Go to Diagnostics', subtitle: 'System health checks', href: '/admin/diagnostics' },
  { id: 'action-go-site-content', type: 'action', title: 'Go to Site Content', subtitle: 'Edit CMS content', href: '/admin/site-content' },
  { id: 'action-go-tools', type: 'action', title: 'Go to Import/Export Tools', subtitle: 'Backup & data tools', href: '/admin/tools' },
  { id: 'action-go-users', type: 'action', title: 'Go to Users & Roles', subtitle: 'Manage users', href: '/admin/users' },
  { id: 'action-go-settings', type: 'action', title: 'Go to Site Settings', subtitle: 'Configure platform', href: '/admin/settings' },
  { id: 'action-go-feature-flags', type: 'action', title: 'Go to Feature Flags', subtitle: 'Toggle features', href: '/admin/feature-flags' },
  { id: 'action-go-announcements', type: 'action', title: 'Go to Announcements', subtitle: 'Manage banners', href: '/admin/announcements' },
];
