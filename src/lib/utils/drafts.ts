/**
 * Draft persistence utility for preserving user work during session expiration.
 * Stores minimal state in localStorage with a TTL.
 */

const DRAFT_PREFIX = 'unime_draft_';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface DraftData {
  data: Record<string, any>;
  savedAt: number;
  expiresAt: number;
}

/**
 * Save a draft to localStorage with a TTL.
 */
export function saveDraft(key: string, data: Record<string, any>, ttlMs = DEFAULT_TTL_MS): void {
  try {
    const draft: DraftData = {
      data,
      savedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(draft));
  } catch {
    // localStorage might be full or unavailable
  }
}

/**
 * Load a draft from localStorage. Returns null if expired or not found.
 */
export function loadDraft(key: string): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;
    const draft: DraftData = JSON.parse(raw);
    if (Date.now() > draft.expiresAt) {
      localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
      return null;
    }
    return draft.data;
  } catch {
    return null;
  }
}

/**
 * Clear a specific draft.
 */
export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch {
    // ignore
  }
}

/**
 * Clear all drafts.
 */
export function clearAllDrafts(): void {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(DRAFT_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Build a draft key for practice sessions.
 */
export function practiceSessionDraftKey(userId: string, courseId: string): string {
  return `practice_${userId}_${courseId}`;
}
