# QA Report — Unime Informatica Static Code Audit

**Date:** 2025-01-XX
**Auditor:** Automated Static Analysis
**Commit baseline:** `439048a` (pre-audit)
**Fix commit:** `a72620a`
**Scope:** Full codebase — security rules, RBAC, auth, signup, public profiles, presence, activity feed, practice engine, labs, hooks, routing, types

---

## Executive Summary

This audit reviewed **30+ source files** across the entire Unime Informatica Next.js + Firebase stack. **8 critical bugs** were found and patched in commit `a72620a`. Several medium/low-severity issues are documented below with recommended follow-ups.

### Patch Summary (commit `a72620a`)

| # | File | Fix |
| | | |
| 1 | `firebase/firestore.rules` | Added missing rules for `exam_sessions`, `questions_private`, `audit_logs`; fixed `user_stats` write rule; fixed notes `authorUid` → `creatorId` |
| 2 | `firebase/database.rules.json` | Added `'offline'` to allowed presence state values |
| 3 | `src/lib/firebase/activity.ts` | Fixed collection name `audit_logs` → `audit_log` |
| 4 | `src/lib/hooks/usePresence.ts` | Removed `role` from RTDB presence (info leak); replaced `onDisconnect.set('offline')` with `onDisconnect.remove()` |
| 5 | `src/lib/hooks/useCourses.ts` | Fixed `useTopics` to read from top-level `topics` collection instead of nonexistent subcollection |
| 6 | `src/app/admin/notes/page.tsx` | Changed `authorUid` → `creatorId` to match Firestore rules and TS type |
| 7 | `src/app/admin/users/page.tsx` | Fixed `'student'` → `'user'` in role filter/dropdown; fixed `PromoteByUsername` to use `username_lower` |
| 8 | `src/lib/types/index.ts` | Removed `role` from `PresenceData` interface |

---

## Section A — Security Rules

### A1. Firestore Rules (`firebase/firestore.rules`)

| Finding | Severity | Status |
| | | |
| **No rule for `exam_sessions`** — practice session CRUD silently denied | 🔴 CRITICAL | ✅ FIXED |
| **No rule for `questions_private`** — dashboard private questions silently denied | 🔴 CRITICAL | ✅ FIXED |
| **`user_stats` write rule was `false`** — client stats update always fails (Cloud Functions not deployed) | 🔴 CRITICAL | ✅ FIXED |
| **`audit_log` vs `audit_logs`** — audit logging collection name mismatch | 🔴 CRITICAL | ✅ FIXED (both code and rules) |
| **Notes rule checked `authorUid` but dashboard saves `creatorId`** — owner can't edit own notes | 🟠 HIGH | ✅ FIXED |
| Usernames collection `allow create: if isAuthenticated()` — any auth user can reserve any username | 🟡 MEDIUM | ⚠️ NOTED |
| `activity_events` allows `create` by any authenticated user — could be spammed | 🟡 MEDIUM | ⚠️ NOTED |
| No rule for `lab_sessions` update — users can't update lab progress | 🟡 MEDIUM | ⚠️ NOTED (add update rule when labs ship) |

**Positive findings:**

- Helper functions (`isAuthenticated`, `isAdmin`, `isOwner`, etc.) are well-structured
- Moderator permission checks via `hasModPermission()` are granular
- Default deny on unmatched paths (Firestore default)
- `course_stats`, `daily_summaries` correctly deny client writes

### A2. Realtime Database Rules (`firebase/database.rules.json`)

| Finding | Severity | Status |
| | | |
| **`onDisconnect` wrote `state: 'offline'` but rule only allowed `'online'\|'idle'`** — disconnect handler always fails, users stuck as "online" | 🔴 CRITICAL | ✅ FIXED |
| **`role` was written to presence but not validated** — user role exposed to anyone (`.read: true`) | 🟠 HIGH | ✅ FIXED (removed from code) |
| Presence `.read: true` per-uid — anyone can read who's online and what page they're on | 🟡 MEDIUM | ⚠️ NOTED |
| No rate-limiting on presence writes | 🔵 LOW | ⚠️ NOTED |

**Positive findings:**

- Write restricted to `$uid === auth.uid` — users can only write own presence
- Validation rules enforce data shape (`username`, `state`, `lastActive` required)
- `typing` node properly scoped by room/uid

### A3. Storage Rules (`firebase/storage.rules`)

| Finding | Severity | Status |
| | | |
| Notes allow any authenticated user to write to any `notes/{courseId}/` path | 🟡 MEDIUM | ⚠️ NOTED |
| No file type validation on notes upload (only size limit) | 🟡 MEDIUM | ⚠️ NOTED |
| Default deny (`/{allPaths=**}`) is correct | ✅ GOOD | — |

**Positive findings:**

- Labs restricted to admin/moderator only
- Avatars restricted to own uid path with image content-type check and 5MB limit
- Reasonable size limits (50MB notes, 100MB labs, 5MB avatars)

---

## Section B — Authentication & RBAC

### B1. Firebase Init (`src/lib/firebase/config.ts`, `src/lib/firebase/admin.ts`)

| Finding | Severity | Status |
| | | |
| Client SDK init uses `getApps().length === 0` guard — prevents double-init | ✅ GOOD | — |
| Admin SDK properly guards with `!getApps().length` | ✅ GOOD | — |
| Admin SDK uses `FIREBASE_ADMIN_*` env vars (not `NEXT_PUBLIC_`) — no client leak | ✅ GOOD | — |
| Admin SDK `privateKey?.replace(/\\n/g, '\n')` handles Heroku newline escaping | ✅ GOOD | — |

### B2. AuthContext (`src/contexts/AuthContext.tsx`)

| Finding | Severity | Status |
| | | |
| **Signup race condition:** Auth account created BEFORE Firestore transaction. If transaction fails (username taken), orphaned Auth account persists. Auto-create profile mitigates but assigns generated username. | 🟠 HIGH | ⚠️ NOTED |
| **No cleanup on failed signup:** If `runTransaction` throws after `createUserWithEmailAndPassword`, no `user.delete()` is called | 🟠 HIGH | ⚠️ NOTED |
| Username reservation in transaction is atomic (good) | ✅ GOOD | — |
| Bootstrap admin auto-upgrade writes `role: 'admin'` to Firestore on every login | 🟡 MEDIUM | ⚠️ NOTED (unnecessary writes) |
| `checkUsernameAvailable` uses `getDoc` (not real-time) — TOCTOU gap with signup | 🔵 LOW | ⚠️ NOTED (transaction is the real guard) |
| `lastLoginAt` update on every auth state change could fail for new signups (profile not yet created) — error is silently caught | 🔵 LOW | ⚠️ OK |

### B3. Admin Layout (`src/app/admin/layout.tsx`)

| Finding | Severity | Status |
| | | |
| Dual check: `claims?.role` OR `userProfile?.role` — compensates for missing Cloud Functions claim sync | ✅ GOOD (workaround) | — |
| Client-side redirect on `!hasAdminAccess` — but no server-side middleware | 🟡 MEDIUM | ⚠️ NOTED |
| Returns `null` after redirect — prevents flash of admin content | ✅ GOOD | — |

### B4. Navigation (`src/components/layout/Navigation.tsx`)

| Finding | Severity | Status |
| | | |
| Admin link shown for both `claims?.role` and `userProfile?.role` checks | ✅ GOOD | — |
| Hides nav on `/admin` paths — avoids double navigation | ✅ GOOD | — |

### B5. Admin Pages — RBAC Consistency

All 16 admin sub-pages were reviewed. Key finding:

| Finding | Severity | Status |
| | | |
| Admin pages rely ONLY on layout-level auth check — no per-page permission verification | 🟡 MEDIUM | ⚠️ NOTED |
| Moderator granular permissions (e.g., `canManageCourses`) are defined in types but NOT checked in individual admin pages | 🟠 HIGH | ⚠️ NOTED |
| Admin users page correctly checks `isAdmin` before role changes | ✅ GOOD | — |
| Admin users page prevents self-role-change | ✅ GOOD | — |

**Recommendation:** Add per-page permission checks. Currently a moderator with only `canManageNotes` can access all admin pages.

---

## Section C — Signup & Username

| Finding | Severity | Status |
| | | |
| Username regex on input: `[^a-zA-Z0-9_]` stripped — good client validation | ✅ GOOD | — |
| Min 3 / Max 20 characters enforced in HTML | ✅ GOOD | — |
| **No server-side username validation** — malicious client could bypass regex | 🟡 MEDIUM | ⚠️ NOTED |
| Username stored both original case and `username_lower` — consistent | ✅ GOOD | — |
| Debounced availability check (500ms) — good UX | ✅ GOOD | — |
| **Firestore `usernames` collection allows any authenticated user to `create`** — an attacker could squat usernames | 🟡 MEDIUM | ⚠️ NOTED |

---

## Section D — Public Profiles (`/u/[username]`)

| Finding | Severity | Status |
| | | |
| `publicProfile: false` check prevents display — privacy respected | ✅ GOOD | — |
| `showDisplayName`, `showContributions` granular privacy flags | ✅ GOOD | — |
| **Query on `users` collection requires `isAuthenticated()`** — unauthenticated visitors get permission denied, profile page fails silently | 🟠 HIGH | ⚠️ NOTED |
| Contributions query correctly filters `status: 'published'` only | ✅ GOOD | — |
| Error case shows generic "Profile Not Found" — no info leak | ✅ GOOD | — |

**Recommendation:** Either make `users` collection read public (only expose safe fields via a `publicProfiles` collection) or add auth check in UI with login prompt.

---

## Section E — Presence System

| Finding | Severity | Status |
| | | |
| **Role leaked to RTDB** — any user could see admin/mod roles | 🟠 HIGH | ✅ FIXED |
| **onDisconnect wrote invalid state** — users stuck as "online" forever | 🔴 CRITICAL | ✅ FIXED |
| Heartbeat every 30s keeps presence fresh | ✅ GOOD | — |
| `useOnlineUsers` correctly reads from RTDB with real-time listener | ✅ GOOD | — |
| 2-minute recent-users window is reasonable | ✅ GOOD | — |
| `currentPath` exposed to all (shows what page each user is on) | 🔵 LOW | ⚠️ NOTED |

---

## Section F — Activity Feed & Audit

| Finding | Severity | Status |
| | | |
| **`audit_logs` vs `audit_log` collection mismatch** — all audit writes silently failed | 🔴 CRITICAL | ✅ FIXED |
| `logActivity` silently swallows errors with `console.error` — good for non-blocking, but audit failures are invisible | 🟡 MEDIUM | ⚠️ NOTED |
| Activity events include `actorUid`, `actorUsername`, `actorRole`, `metadata` — comprehensive | ✅ GOOD | — |
| `useActivityFeed` correctly filters by `visibility: 'admin'` | ✅ GOOD | — |
| Audit log page has category/action/search filters — good admin UX | ✅ GOOD | — |

---

## Section G — Practice Engine

| Finding | Severity | Status |
| | | |
| **No Firestore rule for `exam_sessions`** — entire practice system broken | 🔴 CRITICAL | ✅ FIXED |
| **`user_stats` writes always denied** — stats never persist | 🔴 CRITICAL | ✅ FIXED |
| Old-format option normalization (`{A,B,C,D}` → `MCQOption[]`) works correctly | ✅ GOOD | — |
| Fallback query for questions without `status` field — handles legacy data | ✅ GOOD | — |
| `Math.random() - 0.5` shuffle is not cryptographically uniform | 🔵 LOW | ⚠️ OK for this use case |
| `submitSession` updates `exam_sessions` then `user_stats` — not atomic | 🟡 MEDIUM | ⚠️ NOTED |
| Session resume via `?resume=` param loads saved answers/index | ✅ GOOD | — |
| Wrapped in `Suspense` for `useSearchParams()` — Next.js compatible | ✅ GOOD | — |
| Score is `Math.round((correct / total) * 100)` — standard rounding | ✅ GOOD | — |
| Answers stored per-question with `timeSpentSeconds` — detailed analytics | ✅ GOOD | — |

---

## Section H — Labs & CSV

| Finding | Severity | Status |
| | | |
| No CSV parsing/sanitization on upload — CSV injection possible if data is later rendered in formulas | 🟡 MEDIUM | ⚠️ NOTED |
| Dataset upload restricted to admin/moderator in Storage rules | ✅ GOOD | — |
| Lab questions use `{ A: '', B: '', C: '', D: '' }` format (different from practice MCQ) — intentional for labs | 🔵 LOW | ⚠️ NOTED |
| `papaparse` is in dependencies but no client-side CSV parsing was found | 🔵 INFO | — |

---

## Section I — SSR, Hooks & Routing

| Finding | Severity | Status |
| | | |
| `export const dynamic = 'force-dynamic'` in root layout — correct for Firebase runtime env vars | ✅ GOOD | — |
| All pages use `'use client'` — no accidental SSR of Firebase client SDK | ✅ GOOD | — |
| `useTopics` queried subcollection instead of top-level collection | 🔴 CRITICAL | ✅ FIXED |
| `useCourses` has fallback error handler for missing indexes | ✅ GOOD | — |
| `useCourseBySlug` has fallback for missing composite index | ✅ GOOD | — |
| No hook called conditionally (React rules respected) | ✅ GOOD | — |
| `PresenceWrapper` renders `null` — minimal footprint | ✅ GOOD | — |

---

## Section J — XSS & Injection

| Finding | Severity | Status |
| | | |
| **5 uses of `dangerouslySetInnerHTML`** in courses pages (`whatYouLearn`, `syllabus`, `examInfo`, `recommendedResources`) | 🟠 HIGH | ⚠️ NOTED |
| HTML content is admin-authored (only admins can create/edit courses) — mitigated by trust boundary | 🟡 MEDIUM | — |
| No DOMPurify or sanitization library in dependencies | 🟡 MEDIUM | ⚠️ NOTED |

**Recommendation:** Install `dompurify` and sanitize all HTML before rendering. Even admin-authored content should be sanitized to prevent stored XSS.

---

## Section K — Cloud Functions (NOT DEPLOYED)

| Finding | Severity | Status |
| | | |
| **`onRoleChange` not deployed** — custom claims never sync when roles change in Firestore | 🟠 HIGH | ⚠️ NOTED |
| **`onUserCreated` sets `role: 'student'`** but `UserRole` type defines `'user'` — mismatch | 🟡 MEDIUM | ⚠️ NOTED |
| `bootstrapAdmin` function exists but wasn't needed — client-side bootstrap workaround in use | 🔵 INFO | — |
| `cleanupPresence` scheduled function would help with stale entries — not deployed | 🟡 MEDIUM | ⚠️ NOTED |

**Recommendation:** Deploy Cloud Functions to Firebase, or implement an API route to sync custom claims when roles change.

---

## Section L — Type Safety & Code Quality

| Finding | Severity | Status |
| | | |
| `UserRole = 'admin' \| 'moderator' \| 'user'` but some code references `'student'` | 🟡 MEDIUM | ✅ FIXED (admin users page) |
| `PresenceData` had `role` field that was removed from code | 🟡 MEDIUM | ✅ FIXED |
| `DifficultyLevel = 'easy' \| 'medium' \| 'hard' \| 1 \| 2 \| 3 \| 4 \| 5` — union type, handled correctly throughout | ✅ GOOD | — |
| Many admin page components use `any` for user/userProfile/addToast props | 🔵 LOW | ⚠️ NOTED |
| `i18n` uses static `t()` function (not a hook) — consistent | ✅ GOOD | — |

---

## Top 10 Risks to Watch in Production

| # | Risk | Impact | Likelihood | Mitigation |
| | | | | |
| **1** | **Cloud Functions not deployed** — role changes via Firestore don't sync to custom claims. Firestore security rules that check `request.auth.token.role` are stale. | HIGH | CERTAIN | Deploy Cloud Functions or create a Next.js API route (`/api/sync-claims`) that uses Admin SDK to update claims on role change |
| **2** | **Signup orphaned Auth accounts** — if Firestore transaction fails after Auth creation, orphaned Firebase Auth accounts accumulate | MEDIUM | LIKELY | Add `try/catch` around signup that calls `cred.user.delete()` on transaction failure |
| **3** | **XSS via `dangerouslySetInnerHTML`** — course HTML fields rendered without sanitization. If an admin account is compromised, stored XSS affects all users | HIGH | LOW (requires admin compromise) | Install `dompurify`, sanitize all HTML fields before rendering |
| **4** | **Moderator permission checks not enforced per-page** — any moderator (even with no permissions) can access all 16 admin pages | MEDIUM | LIKELY | Add `useModPermission()` hook and check permissions in each admin page |
| **5** | **Public profiles fail for unauthenticated visitors** — Firestore `users` read requires auth, so `/u/[username]` pages break for logged-out users | MEDIUM | CERTAIN | Create a `public_profiles` collection with limited fields or update `users` read rule |
| **6** | **Username squatting** — `usernames` collection allows any authenticated user to create entries. A malicious user could reserve popular usernames | LOW | POSSIBLE | Add Firestore rule: `allow create: if isAuthenticated() && !exists(/databases/$(database)/documents/usernames/$(username))` (already partially mitigated by transaction) |
| **7** | **No rate limiting on Firestore writes** — `activity_events`, `exam_sessions`, `attempts` can be spammed by authenticated users | MEDIUM | POSSIBLE | Deploy App Check or use Cloud Functions with rate limiting |
| **8** | **Presence data leaks browsing path** — `currentPath` is publicly readable in RTDB, showing which page each user is on | LOW | CERTAIN | Consider removing `currentPath` from presence or restricting reads to admin |
| **9** | **Non-atomic practice session submission** — `submitSession` updates `exam_sessions` then `user_stats` separately. If the second write fails, stats are inconsistent | MEDIUM | UNLIKELY | Use Firestore batch write or accept eventual consistency |
| **10** | **`postinstall: next build`** in package.json — every `npm install` triggers a full build. Slow CI/CD and unexpected build failures on dependency install | LOW | CERTAIN | Move build to an explicit build step in CI, or use `heroku-postbuild` instead |

---

## Files Reviewed (32 total)

### Security Rules

- `firebase/firestore.rules` ✅
- `firebase/database.rules.json` ✅
- `firebase/storage.rules` ✅

### Firebase Client

- `src/lib/firebase/config.ts` ✅
- `src/lib/firebase/admin.ts` ✅
- `src/lib/firebase/activity.ts` ✅

### Auth & Context

- `src/contexts/AuthContext.tsx` ✅

### Admin Pages (16)

- `src/app/admin/layout.tsx` ✅
- `src/app/admin/page.tsx` ✅
- `src/app/admin/courses/page.tsx` ✅
- `src/app/admin/topics/page.tsx` ✅
- `src/app/admin/notes/page.tsx` ✅
- `src/app/admin/questions/page.tsx` ✅
- `src/app/admin/review-queue/page.tsx` ✅
- `src/app/admin/labs/page.tsx` ✅
- `src/app/admin/practice-settings/page.tsx` ✅
- `src/app/admin/users/page.tsx` ✅
- `src/app/admin/announcements/page.tsx` ✅
- `src/app/admin/feature-flags/page.tsx` ✅
- `src/app/admin/audit-log/page.tsx` ✅
- `src/app/admin/settings/page.tsx` ✅
- `src/app/admin/analytics/page.tsx` ✅
- `src/app/admin/monetization/page.tsx` ✅

### Public Pages

- `src/app/(auth)/login/page.tsx` ✅
- `src/app/(auth)/signup/page.tsx` ✅
- `src/app/courses/page.tsx` ✅
- `src/app/courses/[slug]/page.tsx` ✅
- `src/app/dashboard/page.tsx` ✅
- `src/app/profile/page.tsx` ✅
- `src/app/practice/session/page.tsx` ✅
- `src/app/u/[username]/page.tsx` ✅

### Hooks & Utilities

- `src/lib/hooks/useCourses.ts` ✅
- `src/lib/hooks/usePresence.ts` ✅
- `src/lib/hooks/useOnlineUsers.ts` ✅
- `src/lib/hooks/useActivityFeed.ts` ✅
- `src/lib/utils/index.ts` ✅
- `src/lib/types/index.ts` ✅

### Layout & Components

- `src/app/layout.tsx` ✅
- `src/components/layout/Navigation.tsx` ✅
- `src/components/layout/PresenceWrapper.tsx` ✅

### Infrastructure

- `firebase/functions/src/index.ts` ✅
- `next.config.js` ✅
- `package.json` ✅

---

## Glossary

- 🔴 **CRITICAL** — Feature is broken or data is exposed
- 🟠 **HIGH** — Significant security gap or reliability issue
- 🟡 **MEDIUM** — Correctness issue or missing defense-in-depth
- 🔵 **LOW / INFO** — Minor issue or improvement opportunity
- ✅ **FIXED** — Patched in commit `a72620a`
- ⚠️ **NOTED** — Documented for manual follow-up

---

## Section H — Production-Grade Monetization (Post-Audit Upgrade)

**Date:** 2025-01-XX
**Scope:** Monetization system overhaul — server-side plan management, admin UI rebuild, per-user AI controls, anti-abuse logging

### H1. Data Model Enhancements

| Change | Status |
| | |
| `UserPlan` extended with `status`, `source`, `startedAt`, `endsAt`, `updatedBy`, AI overrides (`bonusTokens`, `aiBanned`, `aiQuotaOverride`) | ✅ DONE |
| `UserProfile` denormalized with `plan`, `planStatus`, `planUpdatedAt`, `planEndsAt`, `planSource` | ✅ DONE |
| New type `PlanHistoryEntry` for `user_plans/{uid}/history/{id}` subcollection | ✅ DONE |
| New type `AILogEntry` for `ai_logs/{id}` collection | ✅ DONE |
| Backward compat: `expiresAt` still read alongside new `endsAt` | ✅ DONE |

### H2. Cloud Functions (Server-Side Plan Management)

| Function | Type | Description | Status |
| | | | |
| `adminSetUserPlan` | Callable | Admin grants/changes plan; writes user_plans + users (denorm) + history + audit | ✅ DONE |
| `adminRevokeUserPlan` | Callable | Admin revokes plan → free; writes denorm + history + audit | ✅ DONE |
| `adminSetUserAIOverrides` | Callable | Sets bonusTokens, aiBanned, aiQuotaOverride on user_plans doc | ✅ DONE |
| `dailyPlanExpiration` | Scheduled (00:05 Europe/Rome) | Finds active plans with endsAt < now, expires them, syncs `users`, writes history + audit | ✅ DONE |

### H3. Firestore Security Rules

| Change | Status |
| | |
| `user_plans/{uid}` — `allow write: if false` (forces server-side only via Cloud Functions) | ✅ DONE |
| `user_plans/{uid}/history/{historyId}` — read: owner or admin, write: false | ✅ DONE |
| `ai_logs/{logId}` — read: admin only, write: false | ✅ DONE |
| 5 new composite indexes for user_plans, donation_requests, history | ✅ DONE |

### H4. Admin Monetization Page (Rebuilt)

| Feature | Description | Status |
| | | |
| KPI Cards | Active Pro, Active Supporter, Total Paid, Revoked/Expired, Revenue (TBD) | ✅ DONE |
| Users & Plans Tab | Full user table with search, plan/status filters, checkboxes | ✅ DONE |
| Plan/Status Badges | Color-coded FREE/SUPPORTER/PRO + ACTIVE/REVOKED/EXPIRED | ✅ DONE |
| Quick Actions | Per-row buttons: Upgrade to Supp/Pro, Revoke, Edit, Details | ✅ DONE |
| Change Plan Dialog | Select plan, duration (7d/30d/90d/1y/lifetime), reason | ✅ DONE |
| Bulk Actions | Multi-select → Revoke All / Set Plan / CSV Export | ✅ DONE |
| Plan Details Drawer | Shows current plan, status, source, endsAt, remaining days, reason | ✅ DONE |
| Per-User AI Controls | AI Banned switch, Bonus Tokens, Quota Override — saved via Cloud Function | ✅ DONE |
| Plan History Timeline | Chronological old→new badges with source, reason, actor | ✅ DONE |
| Donations Tab | Filter by status, review dialog with approve/reject, proof viewer, Cloud Function approval | ✅ DONE |
| Settings Tab | Kill switches, AI quotas, donation instructions, payment links JSON | ✅ DONE |
| All mutations via Cloud Functions | No more client-side `setDoc` on `user_plans` | ✅ DONE |

### H5. Users & Roles Page

| Change | Status |
| | |
| Plan badges (PRO/SUPPORTER) shown next to each user | ✅ DONE |

### H6. AI Endpoint (`/api/ai/chat`)

| Enhancement | Status |
| | |
| 5-layer gating: global kill → paid features → plan status → per-user aiBanned → quota | ✅ DONE |
| Per-user overrides: `bonusTokens` adds to quota, `aiQuotaOverride` replaces base quota | ✅ DONE |
| `ai_logs` collection: uid, plan, promptChars, responseChars, model, latencyMs, status | ✅ DONE |
| Backward compat: reads both `endsAt` and `expiresAt` | ✅ DONE |

### H7. User-Facing Profile Page

| Change | Status |
| | |
| Plan badge (PRO/SUPPORTER/Free) shown on profile | ✅ DONE |
| Expiry date displayed if applicable | ✅ DONE |

### H8. Testing Checklist

#### Admin Tests

- [ ] Grant Supporter to a user → check denorm on `users` doc + history entry
- [ ] Upgrade Supporter → Pro → verify badges update
- [ ] Revoke plan → verify status=revoked, user shows Free
- [ ] Set AI Banned → verify `/api/ai/chat` returns 403
- [ ] Set Bonus Tokens → verify quota increases
- [ ] Bulk revoke 2+ users → all become Free
- [ ] CSV export → file downloads with correct data
- [ ] Approve donation → plan activates via Cloud Function
- [ ] Reject donation → request status updates

#### Scheduled Function Tests

- [ ] Deploy `dailyPlanExpiration` → create a plan with endsAt in the past → run manually → verify expired

#### Security Tests

- [ ] Non-admin calling `adminSetUserPlan` → should fail with permission-denied
- [ ] Client-side `setDoc` on `user_plans` → should fail (rules block)
- [ ] `ai_logs` not readable by non-admin → verify

#### User-Facing Tests

- [ ] Profile page shows correct plan badge and expiry
- [ ] AI chat respects per-user overrides

---

## Section H — Analytics Dashboard

### H1. Verifying Analytics Data Collection

1. **Signup test**: Create a new user account → check `analytics_daily/{today}` doc in Firestore → `signups` should increment by 1.
2. **Practice session test**: Start a practice session → `practiceSessionsStarted` increments.
3. **Question answered test**: Answer a question (MCQ or essay) → `questionsAnswered` increments.
4. **AI request test**: Send a message via AI chat → `aiRequests` increments. If blocked (quota/banned/disabled), `aiBlocked` also increments.
5. **Donation test**: Submit a donation request → `donationRequestsSubmitted` increments. Admin approves → `donationRequestsApproved` increments.
6. **Plan change test**: Set a user to Supporter → `activeSupporter` increments. Revoke → decrements.

### H2. Admin Access Verification

- [ ] Non-admin user navigating to `/admin/analytics` → redirected (layout guard)
- [ ] Moderator without `canViewAnalytics` permission → cannot read `analytics_daily` (Firestore rules deny)
- [ ] Moderator WITH `canViewAnalytics` → can view analytics page and read data
- [ ] Direct Firestore read of `analytics_daily` from unauthenticated client → denied
- [ ] Client-side write to `analytics_daily` → denied (only Cloud Functions/Admin SDK can write)

### H3. Data Integrity

- [ ] `analytics_daily` docs are write-protected: client `setDoc`/`updateDoc` fails
- [ ] `analytics_courses_daily` docs are write-protected
- [ ] Scheduled function `dailyAnalyticsReconciliation` recomputes `activeSupporter`/`activePro` from `user_plans` daily
- [ ] DAU/WAU are best-effort from RTDB presence (not 100% accurate but cost-free)

### H4. Cost Notes

Analytics uses an **aggregated daily document** pattern:

- **One Firestore doc per day** (`analytics_daily/{YYYY-MM-DD}`) instead of scanning all users/sessions
- Counters are incremented atomically via Cloud Functions triggers at event time
- Dashboard reads only the daily docs for the selected range (7/30/90 days = 7/30/90 reads)
- Per-course data uses `analytics_courses_daily/{date}/courses/{courseId}` subcollections
- The daily scheduled function (`dailyAnalyticsReconciliation`) does ONE scan of `user_plans` (typically small collection) to reconcile paid user counts
- No heavy collection scans on page load

### H5. Export Tests

- [ ] "Daily Metrics CSV" downloads a valid CSV with date rows
- [ ] "Top Courses CSV" downloads course engagement data
- [ ] "Top Users CSV" downloads user activity data (admin-only)
- [ ] CSV exports only contain data from the currently selected time range

---

## Section I — Session Expired / Access Revoked System

### I1. Overview

A comprehensive session management system was added to handle:

- Firebase Auth session expiry (token refresh failures, sign-out)
- Access revocation (role changes, plan downgrades)
- Firestore permission-denied errors
- API 401/403 responses

**Key files:**

- `src/lib/utils/session.ts` — Central session invalidation logic, event dispatch, Firebase error classification
- `src/lib/utils/api.ts` — Standardized fetch wrapper with auto 401/403 handling
- `src/lib/utils/drafts.ts` — Draft persistence for practice sessions
- `src/components/layout/SessionExpiredDialog.tsx` — Global modal for session/access errors
- `src/lib/hooks/useSessionGuard.ts` — `onIdTokenChanged` listener + route access guard
- `src/middleware.ts` — Next.js Edge middleware (security headers, best-effort protection)

### I2. QA Scenarios

#### Scenario 1: Expired Session

- [ ] Force logout (clear Firebase Auth) while on a protected page (e.g., `/dashboard`)
- [ ] **Expected:** SessionExpiredDialog appears with "Session Expired" message
- [ ] **Expected:** Clicking "Log In" redirects to `/login?reason=session_expired&next=%2Fdashboard`
- [ ] **Expected:** Login page shows yellow banner: "Your session has expired. Please log in again."
- [ ] **Expected:** After successful login, user is redirected back to `/dashboard`

#### Scenario 2: Admin Access Revoked

- [ ] Open `/admin` as an admin user
- [ ] Revoke admin role in Firestore `users/{uid}.role` → `'user'` and update custom claims
- [ ] **Expected:** Within seconds (on next `onIdTokenChanged` fire), SessionExpiredDialog appears with "Access Changed"
- [ ] **Expected:** Cached admin data is cleared on sign-out
- [ ] **Expected:** User is redirected to `/login?reason=access_changed`

#### Scenario 3: Plan Revoked Mid-AI Usage

- [ ] User on `/ai` with supporter/pro plan; admin revokes plan via admin panel
- [ ] User sends next AI message
- [ ] **Expected:** API returns 403; `apiFetch` intercepts and shows "Access Changed" dialog
- [ ] **Expected:** User is redirected to login

#### Scenario 4: Firestore Permission Denied

- [ ] Simulate reading an admin-only collection (`audit_log`) as a regular user
- [ ] **Expected:** Firestore returns `permission-denied`
- [ ] **Expected:** `handleFirebaseError` dispatches `access_changed` event → SessionExpiredDialog appears

#### Scenario 5: Draft Restore (Practice Session)

- [ ] Start a practice session, answer 2-3 questions
- [ ] Session expires (token becomes invalid)
- [ ] **Expected:** Draft is saved to localStorage (`unime_draft_practice_{uid}_{courseId}`)
- [ ] Login again, start a new session for the same course
- [ ] **Expected:** Draft data is available (current index, answers)

#### Scenario 6: API Retry on Network Error

- [ ] Simulate transient network failure on `/api/ai/chat`
- [ ] **Expected:** `apiFetch` retries up to 2 times with exponential backoff
- [ ] **Expected:** If all retries fail, error is shown (not session expired)

#### Scenario 7: No Infinite Redirect Loops

- [ ] Navigate directly to `/login?reason=session_expired` while unauthenticated
- [ ] **Expected:** Login page renders normally with banner, no redirect loop
- [ ] Navigate to `/signup` while unauthenticated
- [ ] **Expected:** Signup page renders normally, no session expired dialog

#### Scenario 8: Client Event Audit Logging

- [ ] Trigger a session expired event
- [ ] **Expected:** A document is created in `client_events` collection with `uid`, `type`, `route`, `createdAt`
- [ ] **Expected:** Only admins can read `client_events` (Firestore rules enforced)

### I3. Architecture Notes

- **Event-driven:** Uses custom DOM events (`session:invalid`) for decoupled communication
- **Debounced:** Session invalid events are debounced (2s) to prevent cascading triggers
- **No infinite loops:** Public routes (`/login`, `/signup`, `/verify-email`) are excluded from session checks
- **Server-enforced:** API routes verify tokens with `adminAuth.verifyIdToken()` — client guards are UX-only
- **Firestore rules:** All admin collections require `isAdmin()` or `isAdminOrMod()`
- **Draft TTL:** Practice drafts expire after 30 minutes in localStorage

---

## Section J — Gamification System

### J1. XP Award Pipeline

| Finding | Severity | Status |
| --- | --- | --- |
| XP is computed server-side via `awardXpForPracticeSession` Cloud Function | Info | ✅ Implemented |
| Anti-cheat: daily XP cap (2000 default), session rate-limit (60s default) | Info | ✅ Implemented |
| Session double-award prevention via `xpAwarded` flag on exam_session doc | Info | ✅ Implemented |
| Streak multiplier applied at thresholds (3/7/14/30 days → 5/10/15/20%) | Info | ✅ Implemented |

### J2. Leaderboard System

| Finding | Severity | Status |
| --- | --- | --- |
| Four leaderboard types: weekly global, all-time global, weekly per-course, all-time per-course | Info | ✅ Implemented |
| Season leaderboard entries when active season exists | Info | ✅ Implemented |
| Weekly reset via scheduled Cloud Function (Monday 00:00 Europe/Rome) | Info | ✅ Implemented |
| Admin can force weekly reset and ban users from leaderboard | Info | ✅ Implemented |
| Leaderboard read-only for users; writes only via Cloud Functions (`allow write: if false`) | Info | ✅ Implemented |
| Privacy: users can opt out of leaderboard via `user_privacy` settings | Info | ✅ Implemented |

### J3. Level System

| Finding | Severity | Status |
| --- | --- | --- |
| Level 1–50, XP curve: `base + growth * level^2` (default 100 + 25*level^2) | Info | ✅ Implemented |
| Level computed server-side in Cloud Functions, stored in `gamification_stats` | Info | ✅ Implemented |
| Level displayed on dashboard header, profile page, and leaderboard entries | Info | ✅ Implemented |

### J4. Achievements

| Finding | Severity | Status |
| --- | --- | --- |
| 15 achievement definitions stored in code (`ACHIEVEMENT_DEFINITIONS`) | Info | ✅ Implemented |
| Achievements checked server-side after XP award via `checkAchievements()` | Info | ✅ Implemented |
| Earned achievements stored in `gamification_stats/{uid}/achievements` subcollection | Info | ✅ Implemented |
| Notification sent on achievement unlock | Info | ✅ Implemented |

### J5. Study Heatmap

| Finding | Severity | Status |
| --- | --- | --- |
| GitHub-style heatmap with 180 days of XP data | Info | ✅ Implemented |
| Data stored in `study_activity_daily/{uid}/days/{date}` | Info | ✅ Implemented |
| Written server-side by Cloud Functions, read-only for clients | Info | ✅ Implemented |

### J6. Security Rules for Gamification

| Finding | Severity | Status |
| --- | --- | --- |
| All leaderboard/stats collections: read by authenticated, write denied for clients | Info | ✅ Implemented |
| Notifications: owner read/update/delete only, create denied for clients | Info | ✅ Implemented |
| Privacy settings: owner reads/writes own document only | Info | ✅ Implemented |
| Friendships: both parties can read/update/delete | Info | ✅ Implemented |

### J7. Test Scenarios

#### Scenario 1: XP Award After Practice

- [ ] Complete a practice session (10 questions, 7 correct)
- [ ] **Expected:** `awardXpForPracticeSession` Cloud Function is called
- [ ] **Expected:** XP appears in `gamification_stats/{uid}` document
- [ ] **Expected:** Leaderboard entries updated in weekly/alltime global and per-course
- [ ] **Expected:** Study heatmap entry created for today's date

#### Scenario 2: Anti-Cheat Rate Limit

- [ ] Complete two practice sessions within 60 seconds
- [ ] **Expected:** Second call returns error or is rate-limited
- [ ] **Expected:** No duplicate XP awarded

#### Scenario 3: Daily XP Cap

- [ ] Award XP repeatedly until daily total exceeds 2000
- [ ] **Expected:** XP stops being awarded once daily cap is reached

#### Scenario 4: Weekly Leaderboard Reset

- [ ] Has weekly XP > 0
- [ ] Trigger `adminForceWeeklyReset` Cloud Function
- [ ] **Expected:** All `leaderboard_weekly_global` documents cleared
- [ ] **Expected:** User's `xpWeekly` in gamification_stats reset to 0

#### Scenario 5: Streak Maintenance

- [ ] User has streak of 5 days, does not practice for 24+ hours
- [ ] `dailyStreakMaintenance` scheduled function runs
- [ ] **Expected:** Streak resets to 0 for inactive users

#### Scenario 6: Leaderboard Ban

- [ ] Admin calls `adminLeaderboardBan` with a user UID
- [ ] **Expected:** User's entries removed from all leaderboard collections
- [ ] **Expected:** Ban record created in `leaderboard_bans`

#### Scenario 7: Privacy Opt-Out

- [ ] User disables "Show on Leaderboard" in dashboard privacy settings
- [ ] **Expected:** `user_privacy/{uid}` updated with `showOnLeaderboard: false`
- [ ] **Expected:** User does not appear in leaderboard queries

#### Scenario 8: Season Leaderboard

- [ ] Admin creates and activates a season via `adminManageSeason`
- [ ] User completes a practice session during active season
- [ ] **Expected:** Season leaderboard entry created in `season_leaderboard`
- [ ] **Expected:** Season tab visible on leaderboard page

#### Scenario 9: Achievement Unlock

- [ ] User completes first practice session ever
- [ ] **Expected:** `checkAchievements()` triggers and awards "first_session" achievement
- [ ] **Expected:** Notification sent to user
- [ ] **Expected:** Achievement appears on profile and dashboard achievements tab
