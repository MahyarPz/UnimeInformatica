/**
 * Seed Script for Unime Informatica
 *
 * Run with: npx ts-node --project tsconfig.seed.json scripts/seed.ts
 * Or: npm run seed
 *
 * This script populates Firestore with:
 * - 4 initial courses
 * - Topics per course
 * - Sample questions
 * - Default feature flags
 * - Default practice settings
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';

// Initialize Firebase Admin
// Expects GOOGLE_APPLICATION_CREDENTIALS env var or a service account JSON
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '..', 'service-account.json');

try {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({ credential: cert(serviceAccount as ServiceAccount) });
} catch {
  console.log('No service account found. Using default credentials.');
  initializeApp();
}

const db = getFirestore();

interface SeedCourse {
  title: string;
  slug: string;
  shortDescription: string;
  whatYouLearn: string;
  order: number;
  topics: string[];
  sampleQuestions: {
    type: 'mcq' | 'essay';
    questionText: string;
    difficulty: number;
    topicIndex: number;
    options?: Record<string, string>;
    correctAnswer?: string;
    explanation?: string;
    hint?: string;
    rubric?: string;
  }[];
}

const courses: SeedCourse[] = [
  {
    title: 'Calculus 1',
    slug: 'calculus-1',
    shortDescription: 'Limits, derivatives, integrals, and the fundamental theorem of calculus.',
    whatYouLearn: '<ul><li>Limits and continuity</li><li>Derivatives and differentiation rules</li><li>Applications of derivatives</li><li>Introduction to integration</li><li>Fundamental Theorem of Calculus</li></ul>',
    order: 1,
    topics: ['Limits and Continuity', 'Derivatives', 'Applications of Derivatives', 'Integration', 'Fundamental Theorem of Calculus'],
    sampleQuestions: [
      {
        type: 'mcq',
        questionText: 'What is the derivative of f(x) = x³?',
        difficulty: 1,
        topicIndex: 1,
        options: { A: '3x²', B: 'x²', C: '3x', D: 'x³' },
        correctAnswer: 'A',
        explanation: 'Using the power rule: d/dx(xⁿ) = nxⁿ⁻¹, so d/dx(x³) = 3x².',
        hint: 'Apply the power rule.',
      },
      {
        type: 'mcq',
        questionText: 'What is lim(x→0) sin(x)/x?',
        difficulty: 2,
        topicIndex: 0,
        options: { A: '0', B: '1', C: 'undefined', D: '∞' },
        correctAnswer: 'B',
        explanation: 'This is a fundamental limit. lim(x→0) sin(x)/x = 1.',
        hint: 'This is one of the standard limits you should memorize.',
      },
      {
        type: 'mcq',
        questionText: 'The integral of 2x dx equals:',
        difficulty: 1,
        topicIndex: 3,
        options: { A: 'x² + C', B: '2x² + C', C: 'x + C', D: '2 + C' },
        correctAnswer: 'A',
        explanation: '∫2x dx = 2·(x²/2) + C = x² + C',
      },
      {
        type: 'essay',
        questionText: 'Explain the relationship between derivatives and integrals as described by the Fundamental Theorem of Calculus.',
        difficulty: 3,
        topicIndex: 4,
        rubric: 'Should mention: FTC Part 1 (differentiation of definite integral), FTC Part 2 (evaluation of definite integrals using antiderivatives), the inverse relationship between differentiation and integration.',
      },
    ],
  },
  {
    title: 'Calculus 2',
    slug: 'calculus-2',
    shortDescription: 'Advanced integration techniques, sequences, series, and multivariable introduction.',
    whatYouLearn: '<ul><li>Integration techniques (by parts, substitution, partial fractions)</li><li>Improper integrals</li><li>Sequences and series</li><li>Convergence tests</li><li>Taylor and Maclaurin series</li></ul>',
    order: 2,
    topics: ['Integration Techniques', 'Improper Integrals', 'Sequences', 'Series and Convergence', 'Taylor Series'],
    sampleQuestions: [
      {
        type: 'mcq',
        questionText: 'Which integration technique is best for ∫x·eˣ dx?',
        difficulty: 2,
        topicIndex: 0,
        options: { A: 'Substitution', B: 'Integration by parts', C: 'Partial fractions', D: 'Trigonometric substitution' },
        correctAnswer: 'B',
        explanation: 'When the integrand is a product of polynomial and exponential, integration by parts is the appropriate technique.',
        hint: 'Think LIATE: Logarithmic, Inverse trig, Algebraic, Trigonometric, Exponential.',
      },
      {
        type: 'mcq',
        questionText: 'Does the series Σ(1/n²) from n=1 to ∞ converge?',
        difficulty: 2,
        topicIndex: 3,
        options: { A: 'Yes, it converges to π²/6', B: 'No, it diverges', C: 'It oscillates', D: 'Cannot be determined' },
        correctAnswer: 'A',
        explanation: 'This is the Basel problem. The p-series with p=2 > 1 converges, and specifically to π²/6.',
      },
      {
        type: 'mcq',
        questionText: 'The Maclaurin series for eˣ is:',
        difficulty: 3,
        topicIndex: 4,
        options: { A: 'Σ xⁿ/n! for n=0 to ∞', B: 'Σ xⁿ/n for n=1 to ∞', C: 'Σ nxⁿ for n=0 to ∞', D: 'Σ xⁿ for n=0 to ∞' },
        correctAnswer: 'A',
        explanation: 'eˣ = 1 + x + x²/2! + x³/3! + ... = Σ xⁿ/n!',
      },
    ],
  },
  {
    title: 'Discrete Mathematics',
    slug: 'discrete-mathematics',
    shortDescription: 'Logic, sets, combinatorics, graph theory, and proof techniques.',
    whatYouLearn: '<ul><li>Propositional and predicate logic</li><li>Set theory and relations</li><li>Proof techniques (direct, contradiction, induction)</li><li>Combinatorics and counting</li><li>Graph theory basics</li><li>Boolean algebra</li></ul>',
    order: 3,
    topics: ['Logic and Propositions', 'Set Theory', 'Proof Techniques', 'Combinatorics', 'Graph Theory', 'Boolean Algebra'],
    sampleQuestions: [
      {
        type: 'mcq',
        questionText: 'What is the contrapositive of "If it rains, then the ground is wet"?',
        difficulty: 1,
        topicIndex: 0,
        options: {
          A: 'If the ground is not wet, then it does not rain',
          B: 'If the ground is wet, then it rains',
          C: 'If it does not rain, the ground is not wet',
          D: 'The ground is wet if and only if it rains',
        },
        correctAnswer: 'A',
        explanation: 'The contrapositive of "P → Q" is "¬Q → ¬P". Both are logically equivalent.',
      },
      {
        type: 'mcq',
        questionText: 'How many ways can you choose 3 items from 10? (C(10,3))',
        difficulty: 2,
        topicIndex: 3,
        options: { A: '120', B: '720', C: '210', D: '30' },
        correctAnswer: 'A',
        explanation: 'C(10,3) = 10! / (3! · 7!) = (10·9·8)/(3·2·1) = 120.',
      },
      {
        type: 'essay',
        questionText: 'Prove by mathematical induction that 1 + 2 + 3 + ... + n = n(n+1)/2 for all positive integers n.',
        difficulty: 3,
        topicIndex: 2,
        rubric: 'Must include: Base case (n=1), inductive hypothesis, inductive step showing P(k) implies P(k+1), clear conclusion.',
      },
    ],
  },
  {
    title: 'Mathematics for Data Analysis',
    slug: 'mathematics-for-data-analysis',
    shortDescription: 'Linear algebra, probability, and statistics for data science applications.',
    whatYouLearn: '<ul><li>Vectors and matrices</li><li>Linear transformations</li><li>Probability theory</li><li>Descriptive statistics</li><li>Hypothesis testing</li><li>Regression basics</li></ul>',
    order: 4,
    topics: ['Vectors and Matrices', 'Linear Transformations', 'Probability Theory', 'Descriptive Statistics', 'Hypothesis Testing', 'Regression'],
    sampleQuestions: [
      {
        type: 'mcq',
        questionText: 'What is the determinant of the 2x2 matrix [[2, 3], [1, 4]]?',
        difficulty: 1,
        topicIndex: 0,
        options: { A: '5', B: '8', C: '11', D: '-1' },
        correctAnswer: 'A',
        explanation: 'det = (2)(4) - (3)(1) = 8 - 3 = 5.',
        hint: 'For a 2x2 matrix [[a,b],[c,d]], det = ad - bc.',
      },
      {
        type: 'mcq',
        questionText: 'If P(A) = 0.3 and P(B) = 0.4, and A and B are independent, what is P(A ∩ B)?',
        difficulty: 2,
        topicIndex: 2,
        options: { A: '0.12', B: '0.7', C: '0.1', D: '0.58' },
        correctAnswer: 'A',
        explanation: 'For independent events, P(A ∩ B) = P(A) × P(B) = 0.3 × 0.4 = 0.12.',
      },
      {
        type: 'mcq',
        questionText: 'The mean of the dataset {2, 4, 6, 8, 10} is:',
        difficulty: 1,
        topicIndex: 3,
        options: { A: '6', B: '5', C: '7', D: '8' },
        correctAnswer: 'A',
        explanation: 'Mean = (2+4+6+8+10)/5 = 30/5 = 6.',
      },
      {
        type: 'essay',
        questionText: 'Explain the difference between Type I and Type II errors in hypothesis testing, providing a real-world example for each.',
        difficulty: 3,
        topicIndex: 4,
        rubric: 'Should define both error types, explain significance level (α) and power (1-β), provide concrete examples, and discuss the tradeoff between them.',
      },
    ],
  },
];

const defaultFeatureFlags = [
  { key: 'practice_engine', name: 'Practice Engine', description: 'Enable the practice/quiz system', enabled: true },
  { key: 'labs', name: 'Labs System', description: 'Enable data analysis labs', enabled: true },
  { key: 'review_queue', name: 'Review Queue', description: 'Allow students to submit questions for review', enabled: true },
  { key: 'user_notes', name: 'User Notes', description: 'Allow students to create personal notes', enabled: true },
  { key: 'user_questions', name: 'User Questions', description: 'Allow students to create personal questions', enabled: true },
  { key: 'public_profiles', name: 'Public Profiles', description: 'Show public user profiles', enabled: true },
  { key: 'announcements', name: 'Announcements', description: 'Show announcement banners', enabled: true },
  { key: 'dark_mode', name: 'Dark Mode', description: 'Enable dark mode toggle (UI only)', enabled: false },
  { key: 'monetization', name: 'Monetization', description: 'Enable supporter tiers and payment', enabled: false },
  { key: 'leaderboard', name: 'Leaderboard', description: 'Show practice leaderboard', enabled: false },
];

async function seed() {
  console.log('🌱 Starting seed...\n');

  for (const course of courses) {
    console.log(`📚 Creating course: ${course.title}`);

    // Create course
    const courseRef = await db.collection('courses').add({
      title: course.title,
      slug: course.slug,
      shortDescription: course.shortDescription,
      whatYouLearn: course.whatYouLearn,
      syllabus: '',
      examInfo: '',
      recommendedResources: '',
      order: course.order,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create topics
    const topicIds: string[] = [];
    for (let i = 0; i < course.topics.length; i++) {
      const topicRef = await db.collection('topics').add({
        title: course.topics[i],
        slug: course.topics[i].toLowerCase().replace(/\s+/g, '-'),
        courseId: courseRef.id,
        order: i + 1,
        createdAt: FieldValue.serverTimestamp(),
      });
      topicIds.push(topicRef.id);
      console.log(`  📌 Topic: ${course.topics[i]}`);
    }

    // Create sample questions
    for (const q of course.sampleQuestions) {
      const questionData: any = {
        type: q.type,
        courseId: courseRef.id,
        topicId: topicIds[q.topicIndex] || null,
        difficulty: q.difficulty,
        questionText: q.questionText,
        explanation: q.explanation || null,
        hint: q.hint || null,
        authorUid: 'seed',
        authorUsername: 'system',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (q.type === 'mcq') {
        questionData.options = q.options;
        questionData.correctAnswer = q.correctAnswer;
      } else {
        questionData.rubric = q.rubric || null;
      }

      await db.collection('questions_public').add(questionData);
      console.log(`  ❓ Question: ${q.questionText.substring(0, 50)}...`);
    }

    // Create default practice settings
    await db.collection('practice_settings').doc(courseRef.id).set({
      courseId: courseRef.id,
      defaultQuestionCount: 10,
      timeLimitMinutes: 30,
      allowHints: true,
      showExplanations: true,
      enableSpacedRepetition: true,
      difficultyRange: { min: 1, max: 5 },
      shuffleOptions: true,
      shuffleQuestions: true,
      enableTimer: true,
      passingScore: 60,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('');
  }

  // Create feature flags
  console.log('🚩 Creating feature flags...');
  for (const flag of defaultFeatureFlags) {
    await db.collection('feature_flags').doc(flag.key).set({
      ...flag,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`  ${flag.enabled ? '✅' : '⬜'} ${flag.name}`);
  }

  console.log('\n✨ Seed completed successfully!');
  console.log(`   📚 ${courses.length} courses`);
  console.log(`   📌 ${courses.reduce((a, c) => a + c.topics.length, 0)} topics`);
  console.log(`   ❓ ${courses.reduce((a, c) => a + c.sampleQuestions.length, 0)} questions`);
  console.log(`   🚩 ${defaultFeatureFlags.length} feature flags`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
