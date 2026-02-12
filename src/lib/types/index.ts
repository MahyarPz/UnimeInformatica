// ============================================================
// ROLE & PERMISSION TYPES
// ============================================================
export type UserRole = 'admin' | 'moderator' | 'user';

export interface ModeratorPermissions {
  canManageCourses: boolean;
  canManageTopics: boolean;
  canManageNotes: boolean;
  canManageQuestions: boolean;
  canReviewQuestions: boolean;
  canManageLabs: boolean;
  canManageAnnouncements: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewUsers: boolean;
  canViewAnalytics: boolean;
  canViewAuditLog: boolean;
  canViewActivityFeed: boolean;
  // CMS permissions
  siteContentEditHome: boolean;
  siteContentEditNav: boolean;
  siteContentEditFooter: boolean;
  siteContentViewHistory: boolean;
  // Command Palette & Tools permissions
  adminCommandPalette: boolean;
  adminToolsExport: boolean;
  adminToolsImport: boolean;
  diagnosticsView: boolean;
}

export interface PermissionTemplate {
  id?: string;
  name: string;
  description: string;
  permissions: ModeratorPermissions;
  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  canManageCourses: false,
  canManageTopics: false,
  canManageNotes: true,
  canManageQuestions: true,
  canReviewQuestions: true,
  canManageLabs: false,
  canManageAnnouncements: false,
  canManageUsers: false,
  canManageSettings: false,
  canViewUsers: false,
  canViewAnalytics: false,
  canViewAuditLog: false,
  canViewActivityFeed: true,
  // CMS
  siteContentEditHome: false,
  siteContentEditNav: false,
  siteContentEditFooter: false,
  siteContentViewHistory: true,
  // Command Palette & Tools
  adminCommandPalette: false,
  adminToolsExport: false,
  adminToolsImport: false,
  diagnosticsView: false,
};

// ============================================================
// USER TYPES
// ============================================================
export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  username_lower: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  role: UserRole;
  permissions?: ModeratorPermissions;
  banned?: boolean;
  publicProfile: boolean;
  showDisplayName: boolean;
  showContributions: boolean;
  supporterTier?: string;
  createdAt: any;
  updatedAt: any;
  lastLoginAt?: any;
  streak?: number;
  goals?: UserGoals;
}

export interface UserGoals {
  dailyQuestions: number;
  weeklyPracticeMinutes: number;
  targetScore: number;
}

export interface UsernameMapping {
  uid: string;
  createdAt: any;
}

// ============================================================
// COURSE TYPES
// ============================================================
export interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  whatYouLearn: string; // Rich text HTML
  syllabus?: string; // Rich text
  examInfo?: string; // Rich text
  recommendedResources?: string; // Rich text
  order: number;
  active: boolean;
  imageUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Topic {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  description?: string;
  order: number;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

// ============================================================
// NOTE TYPES
// ============================================================
export interface Note {
  id: string;
  courseId: string;
  topicId?: string;
  title: string;
  content?: string; // Rich text content
  fileUrl?: string; // Firebase Storage URL
  fileName?: string;
  fileType?: string;
  tags: string[];
  isPublic: boolean;
  creatorId: string;
  creatorUsername?: string;
  createdAt: any;
  updatedAt: any;
}

// ============================================================
// QUESTION TYPES
// ============================================================
export type QuestionType = 'mcq' | 'essay';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 1 | 2 | 3 | 4 | 5;
export type QuestionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';

export interface MCQOption {
  text: string;
  isCorrect: boolean;
}

export interface SolutionStep {
  order: number;
  content: string;
}

export interface Question {
  id: string;
  courseId: string;
  topicId?: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  tags: string[];
  // MCQ fields
  questionText: string;
  options?: MCQOption[];
  correctIndex?: number;
  explanation?: string;
  solutionSteps?: SolutionStep[];
  hints?: string[];
  // Essay fields
  promptText?: string;
  rubric?: string[];
  keyPoints?: string[];
  // Metadata
  creatorId: string;
  creatorUsername?: string;
  isPublic: boolean;
  status: QuestionStatus;
  createdAt: any;
  updatedAt: any;
}

export interface ReviewRequest {
  id: string;
  questionId: string;
  question?: Question;
  questionData?: any;
  submitterId: string;
  submitterUid?: string;
  submitterUsername: string;
  courseId: string;
  topicId?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerId?: string;
  reviewerNote?: string;
  feedback?: string;
  submittedAt?: any;
  createdAt: any;
  reviewedAt?: any;
}

// ============================================================
// PRACTICE / EXAM TYPES
// ============================================================
export type PracticeMode = 'quick' | 'topic_drill' | 'mock_exam' | 'mistake_review' | 'weakness' | 'adaptive';
export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'abandoned';

export interface PracticeSettings {
  courseId: string;
  // Core counts
  quickPracticeCount?: number;
  mockExamCount?: number;
  mockExamTimeMinutes?: number;
  defaultQuestionCount?: number;
  timeLimitMinutes?: number;
  passingScore?: number;
  // Adaptive
  adaptiveWindowSize?: number;
  weaknessThreshold?: number;
  weaknessRatio?: number;
  repetitionCap?: number;
  // Features
  resumeEnabled?: boolean;
  resumeTTLHours?: number;
  allowHints?: boolean;
  showExplanations?: boolean;
  enableSpacedRepetition?: boolean;
  enableTimer?: boolean;
  shuffleOptions?: boolean;
  shuffleQuestions?: boolean;
  difficultyRange?: { min: number; max: number };
  createdAt?: any;
  updatedAt?: any;
}

export interface ExamSession {
  id: string;
  userId: string;
  courseId: string;
  topicId?: string;
  mode: PracticeMode;
  status: SessionStatus;
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, SessionAnswer>;
  score?: number;
  totalQuestions: number;
  correctCount?: number;
  startedAt: any;
  completedAt?: any;
  lastActiveAt: any;
  timeSpentSeconds: number;
  settings?: {
    timeLimit?: number;
    questionCount?: number;
  };
}

export interface SessionAnswer {
  questionId: string;
  questionType: QuestionType;
  selectedIndex?: number; // MCQ
  essayAnswer?: string; // Essay
  isCorrect?: boolean;
  answeredAt: any;
  timeSpentSeconds: number;
}

export interface Attempt {
  id: string;
  sessionId: string;
  userId: string;
  courseId: string;
  topicId?: string;
  questionId: string;
  questionType: QuestionType;
  selectedIndex?: number;
  essayAnswer?: string;
  isCorrect?: boolean;
  difficulty: DifficultyLevel;
  tags: string[];
  createdAt: any;
}

// ============================================================
// USER STATS
// ============================================================
export interface UserStats {
  uid: string;
  totalAttempts: number;
  totalCorrect: number;
  totalSessions: number;
  courseStats: Record<string, CourseStats>;
  recentPerformance: PerformanceEntry[];
  weakAreas: WeakArea[];
  lastPracticeAt?: any;
  updatedAt: any;
}

export interface CourseStats {
  courseId: string;
  totalAttempts: number;
  totalCorrect: number;
  topicStats: Record<string, TopicStats>;
  difficultyStats: Record<DifficultyLevel, { attempts: number; correct: number }>;
  tagStats: Record<string, { attempts: number; correct: number }>;
}

export interface TopicStats {
  topicId: string;
  totalAttempts: number;
  totalCorrect: number;
}

export interface PerformanceEntry {
  date: string;
  correct: number;
  total: number;
  courseId: string;
}

export interface WeakArea {
  courseId: string;
  topicId?: string;
  tag?: string;
  accuracy: number;
  attempts: number;
}

// ============================================================
// LAB TYPES
// ============================================================
export type LabQuestionType = 'mcq' | 'numeric' | 'short_text' | 'interpretation';

export interface Lab {
  id: string;
  courseId: string;
  topicId?: string;
  title: string;
  description: string;
  difficulty?: string;
  datasetUrl: string;
  datasetFileName: string;
  previewColumns: string[];
  questions: LabQuestion[];
  active: boolean;
  order: number;
  createdAt: any;
  updatedAt: any;
}

export interface LabQuestion {
  id: string;
  type: LabQuestionType;
  questionText: string;
  options?: string[] | Record<string, string>; // MCQ - array or keyed object
  correctAnswer?: string; // MCQ correct option / numeric value
  tolerance?: number; // numeric
  rubric?: string[]; // short_text / interpretation
  order: number;
}

export interface LabSession {
  id: string;
  labId: string;
  userId: string;
  courseId: string;
  status: SessionStatus;
  answers: Record<string, LabSessionAnswer>;
  score?: number;
  startedAt: any;
  completedAt?: any;
  lastActiveAt: any;
}

export interface LabSessionAnswer {
  questionId: string;
  answer: string;
  isCorrect?: boolean;
  answeredAt: any;
}

// ============================================================
// ANNOUNCEMENT TYPES
// ============================================================
export type AnnouncementLevel = 'info' | 'warning' | 'critical' | 'success' | 'error';
export type AnnouncementAudience = 'all' | 'logged_in' | 'supporters' | 'students' | 'admins';
export type AnnouncementPlacement = 'banner' | 'home_only' | 'modal' | 'toast';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  placement: AnnouncementPlacement;
  startAt?: any;
  endAt?: any;
  active: boolean;
  linkUrl?: string;
  linkText?: string;
  authorUid?: string;
  authorUsername?: string;
  createdBy?: string;
  createdAt: any;
  updatedAt: any;
}

// ============================================================
// FEATURE FLAGS
// ============================================================
export interface FeatureFlag {
  id: string;
  key: string;
  name?: string;
  enabled: boolean;
  description: string;
  updatedAt: any;
  updatedBy: string;
}

// ============================================================
// AUDIT LOG
// ============================================================
export interface AuditLog {
  id: string;
  action: string;
  category: string;
  actorUid: string;
  actorUsername: string;
  actorRole: UserRole;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  timestamp: any;
}

// ============================================================
// ACTIVITY EVENTS
// ============================================================
export type ActivityEventCategory =
  | 'auth'
  | 'practice'
  | 'labs'
  | 'notes'
  | 'questions'
  | 'feedback'
  | 'admin'
  | 'monetization';

export type ActivityEventSeverity = 'low' | 'medium' | 'high';

export interface ActivityEvent {
  id: string;
  type: string;
  category: ActivityEventCategory;
  timestamp: any;
  actorUid: string;
  actorUsername: string;
  actorRole: UserRole;
  metadata?: Record<string, any>;
  severity: ActivityEventSeverity;
  visibility: 'admin' | 'public';
}

// ============================================================
// DAILY SUMMARY
// ============================================================
export interface DailySummary {
  dateId: string; // YYYY-MM-DD
  totalSignups: number;
  totalLogins: number;
  totalSessions: number;
  totalAttempts: number;
  totalLabSessions: number;
  activeUsers: number;
  createdAt: any;
}

// ============================================================
// PRESENCE (RTDB)
// ============================================================
export interface PresenceData {
  state: 'online' | 'offline';
  username: string;
  lastActive: number; // timestamp ms
  currentPath?: string;
}

// ============================================================
// ADMIN BOOTSTRAP
// ============================================================
export interface AdminBootstrap {
  done: boolean;
  adminUid?: string;
  adminEmail?: string;
  bootstrappedAt?: any;
}

// ============================================================
// MONETIZATION TYPES
// ============================================================
export type UserPlanTier = 'free' | 'supporter' | 'pro';

export interface AIQuotas {
  free: number;
  supporter: number;
  pro: number;
}

export const DEFAULT_AI_QUOTAS: AIQuotas = {
  free: 0,
  supporter: 20,
  pro: 120,
};

export interface PaymentLink {
  label: string;
  url: string;
}

/** Fields stored at site_settings/global for monetization + AI */
export interface SiteSettingsMonetization {
  aiEnabled: boolean;
  monetizationEnabled: boolean;
  paidFeaturesEnabled: boolean;
  aiQuotas: AIQuotas;
  donationInstructions?: string;
  paymentLinks?: PaymentLink[];
}

export const DEFAULT_MONETIZATION_SETTINGS: SiteSettingsMonetization = {
  aiEnabled: true,
  monetizationEnabled: true,
  paidFeaturesEnabled: true,
  aiQuotas: { ...DEFAULT_AI_QUOTAS },
  donationInstructions: '',
  paymentLinks: [],
};

/** user_plans/{uid} */
export interface UserPlan {
  uid: string;
  plan: UserPlanTier;
  expiresAt: any | null; // Timestamp | null (null = lifetime)
  activatedBy: string;
  activatedByUsername: string;
  reason?: string;
  createdAt: any;
  updatedAt: any;
}

/** ai_usage_daily/{uid_YYYYMMDD} */
export interface AIUsageDaily {
  uid: string;
  dateKey: string;
  count: number;
  limit: number;
  planAtTime: UserPlanTier;
  updatedAt: any;
}

/** donation_requests/{id} */
export type DonationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface DonationRequest {
  id?: string;
  uid: string;
  username: string;
  requestedPlan: 'supporter' | 'pro';
  status: DonationRequestStatus;
  note?: string;
  proofFilePath?: string;
  adminFeedback?: string;
  reviewedBy?: string;
  reviewedByUsername?: string;
  createdAt: any;
  updatedAt: any;
}

// Legacy stubs kept for backward compat
export interface SupporterTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  active: boolean;
  order: number;
}

export interface ContentPack {
  id: string;
  name: string;
  description: string;
  minPrice: number;
  suggestedPrice: number;
  currency: string;
  courseIds: string[];
  active: boolean;
}

// ============================================================
// SITE SETTINGS
// ============================================================
export interface SiteSettingsBranding {
  appName: string;
  tagline?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColorHex?: string;
}

export interface SiteSettingsContact {
  supportEmail?: string;
  instagram?: string;
  telegram?: string;
  website?: string;
}

export interface SiteSettingsSEO {
  defaultTitle?: string;
  defaultDescription?: string;
  ogImageUrl?: string;
  twitterHandle?: string;
  indexable: boolean;
}

export interface SiteSettingsAuth {
  requireEmailVerification: boolean;
  allowSignup: boolean;
}

export interface SiteSettingsMaintenance {
  enabled: boolean;
  message?: string;
  allowedRolesBypass: Array<'admin' | 'moderator'>;
}

export interface SiteSettingsContent {
  publicCourseCatalog: boolean;
  publicProfiles: boolean;
  publicQuestionBank: boolean;
}

export interface SiteSettingsLimits {
  maxUploadMB: number;
  maxNotesPerUser?: number | null;
}

export interface SiteSettingsEmailTemplates {
  senderName?: string;
  replyTo?: string;
  verifySubject?: string;
}

export interface SiteSettings {
  branding: SiteSettingsBranding;
  contact: SiteSettingsContact;
  seo: SiteSettingsSEO;
  auth: SiteSettingsAuth;
  maintenance: SiteSettingsMaintenance;
  content: SiteSettingsContent;
  limits: SiteSettingsLimits;
  emailTemplates: SiteSettingsEmailTemplates;
  monetization: SiteSettingsMonetization;
  updatedAt: any;
  updatedBy: string;
}

export const DEFAULT_SITE_SETTINGS: Omit<SiteSettings, 'updatedAt' | 'updatedBy'> = {
  branding: {
    appName: 'Unime Informatica',
    tagline: '',
    logoUrl: '',
    faviconUrl: '',
    primaryColorHex: '#3b82f6',
  },
  contact: {
    supportEmail: '',
    instagram: '',
    telegram: '',
    website: '',
  },
  seo: {
    defaultTitle: 'Unime Informatica - Master Data Analysis & Computer Science',
    defaultDescription: 'Course-first learning platform with adaptive practice, mini labs, and community-driven content.',
    ogImageUrl: '',
    twitterHandle: '',
    indexable: true,
  },
  auth: {
    requireEmailVerification: true,
    allowSignup: true,
  },
  maintenance: {
    enabled: false,
    message: 'We are currently performing scheduled maintenance. Please check back soon.',
    allowedRolesBypass: ['admin', 'moderator'],
  },
  content: {
    publicCourseCatalog: true,
    publicProfiles: true,
    publicQuestionBank: true,
  },
  limits: {
    maxUploadMB: 25,
    maxNotesPerUser: null,
  },
  emailTemplates: {
    senderName: 'Unime Informatica',
    replyTo: '',
    verifySubject: 'Verify your email address',
  },
  monetization: {
    aiEnabled: true,
    monetizationEnabled: true,
    paidFeaturesEnabled: true,
    aiQuotas: { free: 0, supporter: 20, pro: 120 },
    donationInstructions: '',
    paymentLinks: [],
  },
};

// ============================================================
// SITE CONTENT (Mini-CMS)
// ============================================================

/** All CMS-editable pages */
export type SitePageId = 'home' | 'nav' | 'footer';

/** i18n-ready localized wrapper */
export type Localized<T> = {
  en: T;
  [locale: string]: T;
};

/** Supported homepage block types */
export type HomeBlockType =
  | 'hero'
  | 'announcement'
  | 'features'
  | 'featured_courses'
  | 'how_it_works'
  | 'faq'
  | 'cta'
  | 'stats'
  | 'testimonials';

// ─── Block content shapes ─────────────────────────────────
export interface HeroBlockContent {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
}

export interface AnnouncementBlockContent {
  text: string;
  href?: string;
  style: 'info' | 'warning' | 'success';
  dismissible: boolean;
}

export interface FeaturesBlockContent {
  heading: string;
  items: Array<{ title: string; description: string; icon?: string }>;
}

export interface FeaturedCoursesBlockContent {
  heading: string;
  courseSlugs: string[];
}

export interface HowItWorksBlockContent {
  heading: string;
  steps: Array<{ title: string; description: string }>;
}

export interface FAQBlockContent {
  heading: string;
  items: Array<{ q: string; aMarkdown: string }>;
}

export interface CTABlockContent {
  heading: string;
  bodyMarkdown: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface StatsBlockContent {
  heading: string;
  items: Array<{ label: string; value: string }>;
}

export interface TestimonialsBlockContent {
  heading: string;
  items: Array<{ name: string; text: string; avatarUrl?: string }>;
}

export type BlockContentMap = {
  hero: HeroBlockContent;
  announcement: AnnouncementBlockContent;
  features: FeaturesBlockContent;
  featured_courses: FeaturedCoursesBlockContent;
  how_it_works: HowItWorksBlockContent;
  faq: FAQBlockContent;
  cta: CTABlockContent;
  stats: StatsBlockContent;
  testimonials: TestimonialsBlockContent;
};

// ─── Draft / Published metadata ───────────────────────────
export interface DraftMeta {
  updatedAt: any;
  updatedBy: string;
  version: number;
}

export interface PublishedMeta {
  publishedAt: any;
  publishedBy: string;
  version: number;
}

// ─── Homepage content document ────────────────────────────
export interface HomeBlock {
  id: string;
  type: HomeBlockType;
  enabled: boolean;
  order: number;
  content: Localized<any>;
}

export interface SiteContentHome {
  localeDefault: string;
  localesEnabled: string[];
  blocks: HomeBlock[];
  draft: DraftMeta;
  published?: PublishedMeta;
}

// ─── Nav content document ─────────────────────────────────
export interface NavLink {
  label: Localized<string>;
  href: string;
  enabled: boolean;
  order: number;
}

export interface SiteContentNav {
  links: NavLink[];
  showLogin: boolean;
  showSignup: boolean;
  draft: DraftMeta;
  published?: PublishedMeta;
}

// ─── Footer content document ──────────────────────────────
export interface FooterLink {
  label: Localized<string>;
  href: string;
  enabled: boolean;
  order: number;
}

export interface FooterColumn {
  title: Localized<string>;
  links: FooterLink[];
}

export interface SiteContentFooter {
  columns: FooterColumn[];
  socials: { instagram?: string; telegram?: string; github?: string; website?: string };
  copyright: Localized<string>;
  draft: DraftMeta;
  published?: PublishedMeta;
}

// ─── Version history ──────────────────────────────────────
export interface SiteContentVersion {
  pageId: SitePageId;
  kind: 'draft' | 'published';
  version: number;
  snapshot: any;
  createdAt: any;
  createdBy: string;
  label?: string;
}

// ─── Extended moderator permissions for CMS ───────────────
export interface CMSPermissions {
  siteContentEditHome: boolean;
  siteContentEditNav: boolean;
  siteContentEditFooter: boolean;
  siteContentViewHistory: boolean;
}

// ─── Default seed data ────────────────────────────────────
export const DEFAULT_HOME_CONTENT: Omit<SiteContentHome, 'draft' | 'published'> = {
  localeDefault: 'en',
  localesEnabled: ['en'],
  blocks: [
    {
      id: 'hero-1',
      type: 'hero',
      enabled: true,
      order: 0,
      content: {
        en: {
          title: 'Master Data Analysis & Computer Science',
          subtitle: 'Practice-driven courses with adaptive learning, mini labs, and instant feedback.',
          primaryCtaLabel: 'Explore Courses',
          primaryCtaHref: '/courses',
          secondaryCtaLabel: 'Practice Hub',
          secondaryCtaHref: '/practice',
        },
      },
    },
    {
      id: 'features-1',
      type: 'features',
      enabled: true,
      order: 1,
      content: {
        en: {
          heading: 'Why Unime Informatica?',
          items: [
            { title: 'Smart Practice', description: 'Adaptive difficulty, weakness targeting, and detailed analytics.', icon: 'Zap' },
            { title: 'Data Labs', description: 'Hands-on mini labs with real datasets and guided analysis.', icon: 'FlaskConical' },
            { title: 'Community', description: 'Submit questions, earn attribution, and build your profile.', icon: 'Users' },
          ],
        },
      },
    },
    {
      id: 'featured_courses-1',
      type: 'featured_courses',
      enabled: true,
      order: 2,
      content: { en: { heading: 'Available Courses', courseSlugs: [] } },
    },
    {
      id: 'stats-1',
      type: 'stats',
      enabled: true,
      order: 3,
      content: {
        en: {
          heading: '',
          items: [
            { label: 'Courses', value: '4+' },
            { label: 'Practice Modes', value: '6' },
            { label: 'Data Labs', value: 'Interactive' },
            { label: 'Analytics', value: 'Detailed' },
          ],
        },
      },
    },
    {
      id: 'faq-1',
      type: 'faq',
      enabled: false,
      order: 4,
      content: {
        en: {
          heading: 'Frequently Asked Questions',
          items: [
            { q: 'Is the platform free?', aMarkdown: 'Yes, the core features are completely free.' },
          ],
        },
      },
    },
    {
      id: 'cta-1',
      type: 'cta',
      enabled: false,
      order: 5,
      content: {
        en: {
          heading: 'Ready to Start Learning?',
          bodyMarkdown: 'Join thousands of students mastering data analysis and computer science.',
          buttonLabel: 'Get Started',
          buttonHref: '/signup',
        },
      },
    },
  ],
};

export const DEFAULT_NAV_CONTENT: Omit<SiteContentNav, 'draft' | 'published'> = {
  links: [
    { label: { en: 'Courses' }, href: '/courses', enabled: true, order: 0 },
    { label: { en: 'Practice Hub' }, href: '/practice', enabled: true, order: 1 },
  ],
  showLogin: true,
  showSignup: true,
};

export const DEFAULT_FOOTER_CONTENT: Omit<SiteContentFooter, 'draft' | 'published'> = {
  columns: [
    {
      title: { en: 'Platform' },
      links: [
        { label: { en: 'Courses' }, href: '/courses', enabled: true, order: 0 },
        { label: { en: 'Practice Hub' }, href: '/practice', enabled: true, order: 1 },
      ],
    },
    {
      title: { en: 'Account' },
      links: [
        { label: { en: 'Dashboard' }, href: '/dashboard', enabled: true, order: 0 },
        { label: { en: 'Profile' }, href: '/profile', enabled: true, order: 1 },
      ],
    },
  ],
  socials: {},
  copyright: { en: '© {year} Unime Informatica. All rights reserved.' },
};

// ============================================================
// ADMIN BACKUP TYPES
// ============================================================
export interface AdminBackup {
  id: string;
  createdAt: any;
  createdBy: string;
  createdByUsername: string;
  label: string;
  includes: string[];
  counts: Record<string, number>;
  snapshotData?: string; // JSON string (optionally compressed)
}

// ============================================================
// EXPORT METADATA
// ============================================================
export interface ExportMetadata {
  exportedAt: string;
  exportedBy: string;
  exportedByUsername: string;
  projectId: string;
  appVersion?: string;
  filters?: Record<string, any>;
}

export interface ExportPayload {
  metadata: ExportMetadata;
  data: Record<string, any[]>;
}

// ============================================================
// IMPORT TYPES
// ============================================================
export type ImportMode = 'create_only' | 'upsert';

export interface ImportPreview {
  entityType: string;
  total: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
}

// ============================================================
// DIAGNOSTICS TYPES
// ============================================================
export type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'checking' | 'unknown';

export interface DiagnosticCheck {
  id: string;
  name: string;
  description: string;
  status: DiagnosticStatus;
  message?: string;
  howToFix?: string;
  lastCheckedAt?: Date;
}
