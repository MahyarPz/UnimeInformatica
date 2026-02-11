# Unime Informatica

A **course-first learning platform** designed for Data Analysis and Computer Science students. Built with Next.js 14, Firebase, and Tailwind CSS.

![License](https://img.shields.io/badge/license-Private-red)
![Next.js](https://img.shields.io/badge/Next.js-14.2.15-black)
![Firebase](https://img.shields.io/badge/Firebase-10.14.1-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Firebase Setup](#firebase-setup)
  - [Environment Variables](#environment-variables)
  - [Seed Data](#seed-data)
  - [Running Locally](#running-locally)
- [Architecture](#architecture)
  - [Data Model](#data-model)
  - [Role System](#role-system)
  - [Security Rules](#security-rules)
- [Admin Panel](#admin-panel)
- [Cloud Functions](#cloud-functions)
- [Deployment](#deployment)
  - [Heroku](#heroku)
  - [Firebase Services](#firebase-services)
- [PWA Support](#pwa-support)
- [i18n](#internationalization)
- [Contributing](#contributing)

---

## Features

### 🎓 Course Catalog

- **4 initial courses**: Calculus 1, Calculus 2, Discrete Mathematics, Mathematics for Data Analysis
- Rich course pages with Overview, Notes, Practice, Labs, and Progress tabs
- Topic-based organization with ordering
- "What you'll learn" accordion on the catalog page

### ⚡ Practice Engine

- **6 practice modes**: Study, Quick Quiz, Timed Exam, Mistakes Only, Spaced Repetition, Custom
- MCQ questions with instant feedback (green/red highlighting)
- Essay questions with rubric display
- Hints, explanations, and detailed review
- Session persistence and resume support
- Per-course configurable settings (question count, time limits, difficulty range)

### 🧪 Data Analysis Labs

- CSV dataset uploads with preview tables
- Multi-question labs (MCQ, numeric, text answer types)
- Scoring and review system
- Resume in-progress labs

### 📝 Notes System

- Admin/mod file uploads (PDF, DOCX, PPTX, etc.)
- Students can create personal notes (private)
- Tag-based organization and search
- Public/private toggle per note

### ❓ Question System

- Admin question bank with bulk actions
- Students can create personal questions
- **Submit for Review** workflow: student questions → review queue → public pool
- Author attribution preserved on approval
- Rejection with feedback

### 👤 User System

- Email/password authentication
- **Email verification** required — verification email sent on signup with resend + refresh page
- **Unique username** with atomic reservation (Firestore transactions)
- Real-time username availability check with suggestions
- Public profiles (`/u/username`) with privacy controls
- Motivational profile page with streak tracking

### 📊 User Dashboard

- Practice history with scores
- Mistake review
- Notes management (CRUD)
- Questions management (CRUD + submit for review)
- Lab history
- Study goals
- Account & privacy settings

### 🔐 Role-Based Access

- **Admin**: Full access to everything
- **Moderator**: Granular permissions (10 toggleable capabilities)
- **Student**: Standard access
- Permission templates for quick moderator setup

### 🛡️ Admin Panel

Full CMS accessible at `/admin`:

- Dashboard with KPIs and live activity feed
- Online users real-time presence
- Courses CRUD with rich text fields
- Topics CRUD per course
- Notes management with file uploads
- Question Bank with filters and bulk actions
- Review Queue (approve/reject with feedback)
- Labs management with question builder
- Practice Settings per course
- Users & Roles with permission matrix
- Announcements CRUD
- Feature Flags toggle system
- Audit Log viewer
- Site Settings (branding, SEO, auth, maintenance, limits, email)
- Analytics, Monetization (stubs)

### 📡 Real-Time Features

- User presence via Firebase RTDB (online/idle/offline)
- 30-second heartbeat ping
- Live activity feed with category filtering
- Real-time announcement banners

### 🏗️ PWA Ready

- Service worker via next-pwa
- Web app manifest with icons
- Installable on mobile and desktop

---

## Tech Stack

| Layer | Technology |
| ----- | --------- |
| Framework | **Next.js 14.2.15** (App Router, TypeScript) |
| Styling | **Tailwind CSS 3.4.14** with CSS variables |
| Components | Custom shadcn/ui-style (Radix UI + CVA) |
| Auth | **Firebase Auth** (email/password) |
| Database | **Cloud Firestore** (documents) |
| Realtime | **Firebase Realtime Database** (presence) |
| Storage | **Firebase Storage** (files, datasets) |
| Functions | **Firebase Cloud Functions** (Node 18) |
| Animation | **Framer Motion** |
| State | React Context + Firebase real-time listeners |
| Forms | React Hook Form + Zod validation |
| Math | KaTeX rendering |
| Data | PapaParse (CSV), React Dropzone |
| Deploy | **Heroku** (web dyno) |

---

## Project Structure

```text
├── firebase/
│   ├── firestore.rules          # Firestore security rules
│   ├── firestore.indexes.json   # Composite indexes
│   ├── database.rules.json      # RTDB rules (presence)
│   ├── storage.rules            # Storage security rules
│   └── functions/               # Cloud Functions
│       ├── src/index.ts         # All function handlers
│       ├── package.json
│       └── tsconfig.json
├── public/
│   ├── manifest.json            # PWA manifest
│   └── icons/                   # App icons (placeholder)
├── scripts/
│   └── seed.ts                  # Database seed script
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout (AuthProvider, Nav, Footer)
│   │   ├── page.tsx             # Home page
│   │   ├── globals.css          # Tailwind + custom styles
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── verify-email/page.tsx
│   │   ├── courses/
│   │   │   ├── page.tsx         # Course catalog
│   │   │   └── [slug]/page.tsx  # Course detail (5 tabs)
│   │   ├── practice/
│   │   │   ├── page.tsx         # Practice hub
│   │   │   └── session/page.tsx # Practice session engine
│   │   ├── labs/
│   │   │   └── [labId]/page.tsx # Lab run page
│   │   ├── dashboard/page.tsx   # User dashboard
│   │   ├── profile/page.tsx     # Motivational profile
│   │   ├── u/[username]/page.tsx # Public profile
│   │   └── admin/
│   │       ├── layout.tsx       # Admin shell + sidebar
│   │       ├── page.tsx         # Admin dashboard
│   │       ├── courses/page.tsx
│   │       ├── topics/page.tsx
│   │       ├── notes/page.tsx
│   │       ├── questions/page.tsx
│   │       ├── review-queue/page.tsx
│   │       ├── labs/page.tsx
│   │       ├── practice-settings/page.tsx
│   │       ├── users/page.tsx
│   │       ├── announcements/page.tsx
│   │       ├── feature-flags/page.tsx
│   │       ├── audit-log/page.tsx
│   │       ├── settings/page.tsx
│   │       ├── analytics/page.tsx
│   │       └── monetization/page.tsx
│   ├── components/
│   │   ├── ui/                  # 18 shadcn/ui-style components
│   │   ├── layout/              # Navigation, AnnouncementBanner, PresenceWrapper
│   │   └── courses/             # CourseNotesTab, CoursePracticeTab, etc.
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auth context with login/signup/logout
│   └── lib/
│       ├── firebase/
│       │   ├── config.ts        # Client SDK init
│       │   ├── admin.ts         # Admin SDK init
│       │   └── activity.ts      # logActivity/logAudit helpers
│       ├── hooks/               # usePresence, useCourses, useActivityFeed, etc.
│       ├── i18n/index.ts        # Translation strings
│       ├── types/index.ts       # TypeScript types (full data model)
│       └── utils/index.ts       # Utility functions
├── firebase.json                # Firebase project config
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.js
├── Procfile                     # Heroku process file
└── .env.local.example           # Environment variable template
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Firebase CLI**: `npm install -g firebase-tools`
- A **Firebase project** with these services enabled:
  - Authentication (Email/Password provider)
  - Cloud Firestore
  - Realtime Database
  - Cloud Storage
  - Cloud Functions (Blaze plan required)

### Installation

```bash
git clone https://github.com/your-org/unime-informatica.git
cd unime-informatica
npm install
```

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** auth provider
3. Create a **Firestore database** (start in test mode, then deploy rules)
4. Create a **Realtime Database**
5. Enable **Cloud Storage**
6. Download service account key for admin operations

#### Email Verification Setup

Email verification is **required** for new users. After signup, a verification email is sent automatically, and unverified users are blocked from accessing protected routes (courses, practice, labs, admin).

**Firebase Console checklist:**

1. **Authentication → Sign-in method** → Ensure **Email/Password** is enabled
2. **Authentication → Settings → Authorized domains** → Add your production domain (e.g. `unime-53970450a266.herokuapp.com`) so verification links work correctly
3. **Authentication → Templates → Email address verification** → (Optional) Customize the sender name, subject, and email body
4. **Environment variable**: Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://unime-53970450a266.herokuapp.com`) — this is used as the `continueUrl` in verification emails

> **Note**: Firebase's default email sender is `noreply@your-project.firebaseapp.com`. Users should check their spam/junk folder if they don't see the email.

```bash
firebase login
firebase init  # Select Firestore, RTDB, Storage, Functions, Hosting
firebase deploy --only firestore:rules,database,storage
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.local.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# Admin SDK (server-side)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Seed Data

Populate your database with 4 courses, topics, sample questions, and feature flags:

```bash
# Method 1: Using ts-node
npx ts-node --project tsconfig.seed.json scripts/seed.ts

# Method 2: Using npm script
npm run seed
```

> **Note**: Requires `GOOGLE_APPLICATION_CREDENTIALS` env var or a `service-account.json` file in the project root.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

### Data Model

| Collection | Purpose |
| ---------- | ------- |
| `users` | User profiles (keyed by Firebase Auth UID) |
| `usernames` | Username reservation (atomic uniqueness) |
| `courses` | Course catalog |
| `topics` | Topics per course |
| `notes` | Uploaded notes/resources |
| `questions_public` | Public question pool |
| `users/{uid}/questions` | User's private questions |
| `review_queue` | Questions submitted for review |
| `sessions` | Practice sessions |
| `attempts` | Per-question attempt records |
| `labs` | Lab definitions with datasets |
| `lab_sessions` | User lab attempts |
| `user_stats` | Aggregated user statistics |
| `course_stats` | Aggregated course statistics |
| `daily_summaries` | Daily practice summaries |
| `activity_events` | Real-time activity log |
| `audit_log` | Administrative action log |
| `announcements` | Site-wide announcements |
| `feature_flags` | Feature toggle switches |
| `practice_settings` | Per-course practice configuration |
| `site_settings` | Global platform settings (single doc: `global`) |

### Role System

| Role | Capabilities |
| ---- | ------------ |
| **Admin** | Full access to all features. Can manage users, change roles, access all admin modules. |
| **Moderator** | Configurable via 10 granular permissions. Uses permission templates for quick setup. |
| **Student** | Standard access: practice, labs, personal notes/questions, submit for review. |

**Moderator Permissions:**

- `canManageCourses` - Create/edit/delete courses
- `canManageTopics` - Create/edit/delete topics
- `canManageNotes` - Upload/edit/delete notes
- `canManageQuestions` - Manage public question bank
- `canReviewQuestions` - Approve/reject submitted questions
- `canManageLabs` - Create/edit/delete labs
- `canManageAnnouncements` - Manage announcements
- `canViewAnalytics` - Access analytics dashboard
- `canManageUsers` - Manage user accounts
- `canManageSettings` - Edit site settings

### Site Settings

Global platform configuration is stored in Firestore at `site_settings/global`.

**Location:** Admin Panel → Site Settings (`/admin/settings`)

**What it controls:**

| Section | Settings |
| ------- | -------- |
| **Branding** | App name, tagline, logo, favicon, primary colour |
| **Contact** | Support email, Instagram, Telegram, website URLs |
| **SEO** | Default page title/description, OG image, Twitter handle, search indexing toggle |
| **Auth & Access** | Require email verification, allow signup, public course catalog / profiles / question bank |
| **Maintenance** | Enable/disable maintenance mode, custom message, bypass roles (admin/moderator) |
| **Limits** | Max upload MB, max notes per user |
| **Email Templates** | Display-only sender name, reply-to, subject (actual templates managed in Firebase Console) |

**Runtime behaviour:**

- `auth.requireEmailVerification` — When true, unverified users are redirected to `/verify-email` for all protected routes.
- `maintenance.enabled` — When true, non-bypass users see a maintenance page. Admin and moderator roles pass through.

**Storage paths** for uploaded branding/SEO images:

- `site/branding/logo.png`
- `site/branding/favicon.png`
- `site/seo/og.png`

> **Note:** Firebase Auth email templates (verification, password reset) are configured in the Firebase Console under Authentication → Templates. The email fields in Site Settings are for documentation/reference only.

### Security Rules

Firestore, RTDB, and Storage rules are in the `firebase/` directory:

- **Firestore**: Role-based access with helper functions for permission checks
- **RTDB**: Users can only write to their own presence node
- **Storage**: Size limits per file type, role checks for admin uploads

---

## Admin Panel

Access at `/admin` (requires `admin` or `moderator` role).

### Bootstrap First Admin

After deployment, call the bootstrap function to set the first admin:

```bash
# Via Cloud Function
curl "https://your-region-your-project.cloudfunctions.net/bootstrapAdmin?secret=your-secret"
```

This sets the user with email `Notmahyar3@gmail.com` as admin.

### Quick Promote

Admins can promote any user by username via the Users & Roles page:

1. Go to `/admin/users`
2. Enter username in "Quick Promote" card
3. Select role (Moderator or Admin)
4. Click Promote

---

## Cloud Functions

| Function | Trigger | Purpose |
| -------- | ------- | ------- |
| `bootstrapAdmin` | HTTP | One-time admin setup |
| `onRoleChange` | Firestore update on `users/{uid}` | Sync role to Auth custom claims |
| `onQuestionCreated` | Firestore create on `questions_public` | Update course stats |
| `onSessionCompleted` | Firestore update on `sessions` | Update user stats + daily summary |
| `cleanupPresence` | Pub/Sub (every 60 min) | Remove stale RTDB presence |
| `onUserCreated` | Auth user create | Set default claims + log activity |

### Deploy Functions

```bash
cd firebase/functions
npm install
cd ../..
firebase deploy --only functions
```

---

## Deployment

### Heroku

The app is configured for Heroku deployment:

```bash
# Login to Heroku
heroku login

# Create app
heroku create unime-informatica

# Set environment variables
heroku config:set NEXT_PUBLIC_FIREBASE_API_KEY=xxx
heroku config:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
# ... (set all env vars from .env.local)

# Deploy
git push heroku main
```

The `Procfile` runs `npm start`, which uses `next start -p $PORT`.
The `postinstall` script runs `next build` automatically.

### Firebase Services

Deploy rules and functions separately:

```bash
# Deploy all Firebase services
firebase deploy

# Or individually
firebase deploy --only firestore:rules
firebase deploy --only database
firebase deploy --only storage
firebase deploy --only functions
```

---

## PWA Support

The app is PWA-ready with:

- **Web App Manifest** at `/manifest.json`
- **Service Worker** via `next-pwa` (auto-generated in production)
- **Installable** on mobile (Android, iOS) and desktop (Chrome, Edge)

> Replace placeholder icons in `public/icons/` with actual PNG files before production deployment.

---

## Internationalization

All user-facing strings are centralized in `src/lib/i18n/index.ts`:

```typescript
import { t, useTranslation } from '@/lib/i18n';

// In components:
const label = t('courses.title'); // "Courses"
```

Currently English only. To add a new locale:

1. Add translations to `src/lib/i18n/index.ts`
2. Implement locale detection/switching in the i18n module

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

This is a private project for Unime Informatica. All rights reserved.

---

Built with ❤️ for the students of the University of Messina
