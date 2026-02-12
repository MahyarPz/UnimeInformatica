'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  normalizeSearchTerm,
  prefixSearchBounds,
  COMMAND_PALETTE_ACTIONS,
  SearchResult,
} from '@/lib/utils/search';

const RESULTS_PER_TYPE = 5;

/**
 * Multi-entity Firestore search aggregator for the admin command palette.
 *
 * Search strategy: prefix-based queries on normalized lowercase fields
 * (title_lower, name_lower, username_lower, email_lower)
 * using where("field", ">=", qLower) and where("field", "<=", qLower + "\uf8ff").
 *
 * NOTE: This requires Firestore composite indexes for each collection
 * if combining with orderBy on a different field. Prefix queries on a
 * single field work with the auto-generated single-field indexes.
 */
export function useAdminSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(0);

  const search = useCallback(async (term: string) => {
    const normalized = normalizeSearchTerm(term);
    if (!normalized || normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId = ++abortRef.current;
    setLoading(true);

    try {
      const [start, end] = prefixSearchBounds(term);
      const allResults: SearchResult[] = [];

      // Filter actions first (instant, no Firestore call)
      const actionMatches = COMMAND_PALETTE_ACTIONS.filter(
        (a) =>
          a.title.toLowerCase().includes(normalized) ||
          (a.subtitle && a.subtitle.toLowerCase().includes(normalized))
      );
      allResults.push(...actionMatches);

      // Search each entity collection in parallel
      const searches = [
        // Courses: search on title (slug is also lowercase)
        searchCollection('courses', 'slug', start, end, (doc) => ({
          id: doc.id,
          type: 'course' as const,
          title: doc.data().title || doc.data().slug,
          subtitle: doc.data().active ? 'Active' : 'Inactive',
          href: `/admin/courses?edit=${doc.id}`,
        })),

        // Topics
        searchCollection('topics', 'slug', start, end, (doc) => ({
          id: doc.id,
          type: 'topic' as const,
          title: doc.data().title || doc.data().slug,
          subtitle: `Course: ${doc.data().courseId || '—'}`,
          href: `/admin/topics?edit=${doc.id}`,
        })),

        // Notes: search on title
        searchCollectionField('notes', 'title', start, end, (doc) => ({
          id: doc.id,
          type: 'note' as const,
          title: doc.data().title,
          subtitle: doc.data().isPublic ? 'Public' : 'Private',
          href: `/admin/notes?edit=${doc.id}`,
        })),

        // Questions: search on questionText (prefix on lowercase)
        searchCollectionField('questions_public', 'questionText', start, end, (doc) => ({
          id: doc.id,
          type: 'question' as const,
          title: truncateText(doc.data().questionText || '', 60),
          subtitle: `${doc.data().type || 'mcq'} • ${doc.data().difficulty || '—'}`,
          href: `/admin/questions?edit=${doc.id}`,
        })),

        // Users: search on username_lower
        searchCollection('users', 'username_lower', start, end, (doc) => ({
          id: doc.id,
          type: 'user' as const,
          title: `@${doc.data().username}`,
          subtitle: `${doc.data().email} • ${doc.data().role}`,
          href: `/admin/users?user=${doc.id}`,
        })),

        // Users: also search by email
        searchCollection('users', 'email', start, end, (doc) => ({
          id: doc.id,
          type: 'user' as const,
          title: `@${doc.data().username}`,
          subtitle: `${doc.data().email} • ${doc.data().role}`,
          href: `/admin/users?user=${doc.id}`,
        })),

        // Announcements: search on title
        searchCollectionField('announcements', 'title', start, end, (doc) => ({
          id: doc.id,
          type: 'announcement' as const,
          title: doc.data().title,
          subtitle: doc.data().active ? 'Active' : 'Inactive',
          href: `/admin/announcements?edit=${doc.id}`,
        })),

        // Labs: search on title
        searchCollectionField('labs', 'title', start, end, (doc) => ({
          id: doc.id,
          type: 'lab' as const,
          title: doc.data().title,
          subtitle: doc.data().active ? 'Active' : 'Inactive',
          href: `/admin/labs?edit=${doc.id}`,
        })),
      ];

      const searchResults = await Promise.allSettled(searches);
      for (const result of searchResults) {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        }
      }

      // Deduplicate by id
      const seen = new Set<string>();
      const deduped = allResults.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      if (requestId === abortRef.current) {
        setResults(deduped);
        setLoading(false);
      }
    } catch (error) {
      console.error('Admin search error:', error);
      if (requestId === abortRef.current) {
        setResults([]);
        setLoading(false);
      }
    }
  }, []);

  // Debounced effect
  useEffect(() => {
    const timer = setTimeout(() => {
      search(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, search]);

  return { searchTerm, setSearchTerm, results, loading };
}

// Helper: search a collection using a field with prefix match
async function searchCollection(
  collectionName: string,
  field: string,
  start: string,
  end: string,
  mapper: (doc: any) => SearchResult
): Promise<SearchResult[]> {
  try {
    const q = query(
      collection(db, collectionName),
      where(field, '>=', start),
      where(field, '<=', end),
      limit(RESULTS_PER_TYPE)
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapper);
  } catch (error) {
    // May fail if index is missing — just return empty
    console.warn(`Search on ${collectionName}.${field} failed:`, error);
    return [];
  }
}

// Helper: search by a text field (not necessarily _lower, so we do lowercase comparison client-side)
async function searchCollectionField(
  collectionName: string,
  field: string,
  start: string,
  end: string,
  mapper: (doc: any) => SearchResult
): Promise<SearchResult[]> {
  // Try the lowercase variant first
  try {
    const lowerField = field + '_lower';
    const q = query(
      collection(db, collectionName),
      where(lowerField, '>=', start),
      where(lowerField, '<=', end),
      limit(RESULTS_PER_TYPE)
    );
    const snap = await getDocs(q);
    if (snap.docs.length > 0) {
      return snap.docs.map(mapper);
    }
  } catch {
    // _lower field may not exist, fall through
  }

  // Fallback: query the original field
  try {
    const q = query(
      collection(db, collectionName),
      where(field, '>=', start),
      where(field, '<=', end),
      limit(RESULTS_PER_TYPE)
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapper);
  } catch (error) {
    console.warn(`Search on ${collectionName}.${field} failed:`, error);
    return [];
  }
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '…';
}
