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
// MONETIZATION STUBS
// ============================================================
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
  maxNotesPerUser?: number;
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
    maxNotesPerUser: undefined,
  },
  emailTemplates: {
    senderName: 'Unime Informatica',
    replyTo: '',
    verifySubject: 'Verify your email address',
  },
};
