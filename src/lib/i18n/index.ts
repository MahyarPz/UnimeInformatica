// i18n-ready architecture: all user-facing strings are centralized here.
// To add a second language, duplicate the 'en' object and translate.
// Then use a context/cookie to switch locale.

export type Locale = 'en';
export const defaultLocale: Locale = 'en';
export const locales: Locale[] = ['en'];

const translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.courses': 'Courses',
    'nav.practice': 'Practice Hub',
    'nav.dashboard': 'Dashboard',
    'nav.profile': 'Profile',
    'nav.admin': 'Admin Panel',
    'nav.login': 'Log In',
    'nav.signup': 'Sign Up',
    'nav.logout': 'Log Out',

    // Home
    'home.hero.title': 'Master Data Analysis & Computer Science',
    'home.hero.subtitle': 'Practice-driven courses with adaptive learning, mini labs, and instant feedback.',
    'home.hero.cta': 'Explore Courses',
    'home.features.practice': 'Smart Practice',
    'home.features.practice.desc': 'Adaptive difficulty, weakness targeting, and detailed analytics.',
    'home.features.labs': 'Data Labs',
    'home.features.labs.desc': 'Hands-on mini labs with real datasets and guided analysis.',
    'home.features.community': 'Community',
    'home.features.community.desc': 'Submit questions, earn attribution, and build your profile.',

    // Auth
    'auth.login.title': 'Welcome Back',
    'auth.login.subtitle': 'Log in to continue your learning journey',
    'auth.signup.title': 'Create Account',
    'auth.signup.subtitle': 'Join Unime Informatica and start learning',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.username': 'Username',
    'auth.firstName': 'First Name',
    'auth.lastName': 'Last Name',
    'auth.phone': 'Phone Number',
    'auth.login.button': 'Log In',
    'auth.signup.button': 'Create Account',
    'auth.login.link': 'Already have an account? Log in',
    'auth.signup.link': "Don't have an account? Sign up",
    'auth.username.taken': 'This username is already taken',
    'auth.username.available': 'Username is available!',
    'auth.username.checking': 'Checking availability...',

    // Courses
    'courses.title': 'Courses',
    'courses.subtitle': 'Choose a course to start learning',
    'courses.whatYouLearn': "What You'll Learn",
    'courses.tabs.overview': 'Overview',
    'courses.tabs.notes': 'Notes',
    'courses.tabs.practice': 'Practice',
    'courses.tabs.labs': 'Labs',
    'courses.tabs.progress': 'Progress',
    'courses.syllabus': 'Syllabus',
    'courses.examInfo': 'Exam Information',
    'courses.resources': 'Recommended Resources',

    // Practice
    'practice.title': 'Practice Hub',
    'practice.quick': 'Quick Practice',
    'practice.quick.desc': '5-10 minute focused session',
    'practice.topic': 'Topic Drill',
    'practice.topic.desc': 'Deep dive into a specific topic',
    'practice.mock': 'Mock Exam',
    'practice.mock.desc': 'Full-length timed exam simulation',
    'practice.mistakes': 'Review Mistakes',
    'practice.mistakes.desc': 'Practice your previously wrong answers',
    'practice.weakness': 'Weakness Practice',
    'practice.weakness.desc': 'Focus on your weakest areas',
    'practice.adaptive': 'Adaptive Practice',
    'practice.adaptive.desc': 'AI-adjusted difficulty based on performance',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.practice': 'My Practice',
    'dashboard.mistakes': 'My Mistakes',
    'dashboard.notes': 'My Notes',
    'dashboard.questions': 'My Questions',
    'dashboard.labs': 'My Labs',
    'dashboard.goals': 'Goals & Settings',
    'dashboard.account': 'Account & Privacy',
    'dashboard.support': 'Support & Referral',

    // Profile
    'profile.title': 'My Profile',
    'profile.streak': 'Day Streak',
    'profile.questionsAnswered': 'Questions Answered',
    'profile.accuracy': 'Accuracy',
    'profile.recentActivity': 'Recent Activity',

    // Admin
    'admin.title': 'Admin Panel',
    'admin.dashboard': 'Dashboard',
    'admin.courses': 'Courses',
    'admin.topics': 'Topics',
    'admin.notes': 'Notes',
    'admin.questions': 'Question Bank',
    'admin.reviewQueue': 'Review Queue',
    'admin.labs': 'Labs',
    'admin.practiceSettings': 'Practice Settings',
    'admin.users': 'Users & Roles',
    'admin.settings': 'Site Settings',
    'admin.monetization': 'Monetization',
    'admin.analytics': 'Analytics',
    'admin.auditLog': 'Audit Log',
    'admin.featureFlags': 'Feature Flags',
    'admin.announcements': 'Announcements',
    'admin.onlineNow': 'Online Now',
    'admin.activeLast2Min': 'Active (2 min)',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.loading': 'Loading...',
    'common.noResults': 'No results found',
    'common.submit': 'Submit',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.finish': 'Finish',
    'common.resume': 'Resume',
    'common.start': 'Start',
    'common.by': 'by',
    'common.contributor': 'a contributor',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, locale: Locale = defaultLocale): string {
  return translations[locale]?.[key] || key;
}

export function useTranslation(locale: Locale = defaultLocale) {
  return {
    t: (key: TranslationKey) => t(key, locale),
    locale,
  };
}
