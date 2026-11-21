export interface AiFutureCard {
  readonly id: string;
  readonly pillar: string;
  readonly phase: string;
  readonly title: string;
  readonly summary: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly tone: 'violet' | 'cyan' | 'indigo' | 'teal';
  readonly tags: readonly string[];
  readonly liveHref: string;
  readonly liveLabel: string;
  readonly todayState: string;
  readonly aiNextState: string;
  readonly icon: 'book' | 'brain' | 'chart' | 'globe';
}

export const AI_FUTURE_CARDS: readonly AiFutureCard[] = [
  {
    id: 'smart-learning',
    pillar: 'SMART LEARNING',
    phase: 'AI · PHASE 01',
    title: 'AI Smart Learning Engine',
    summary:
      'Automated TOEFL speaking and writing rubric analysis built directly over our full mock exams and structured curriculum.',
    image: './images/ai-future-smart-learning.webp',
    imageAlt:
      'Floating 3D glowing wireframe open book with rising crystal bar chart columns, soaring arrow, and orbiting graduation caps',
    tone: 'violet',
    tags: ['Speaking Coach', 'Essay Feedback', 'Score Trajectory'],
    liveHref: '#toefl-ibt-mock',
    liveLabel: 'Open live TOEFL Mock',
    todayState: 'Full 4-section timed TOEFL iBT practice with audio recording and teacher review.',
    aiNextState:
      'Instant pronunciation, coherence, and band-score estimates right after every response.',
    icon: 'book',
  },
  {
    id: 'adaptive-systems',
    pillar: 'ADAPTIVE SYSTEMS',
    phase: 'AI · PHASE 02',
    title: 'Adaptive Neural Tutor',
    summary:
      'Intelligent skill routing that spots grammar or vocabulary gaps in real time and tunes each exercise to the learner.',
    image: './images/ai-future-adaptive-tutor.webp',
    imageAlt:
      'Floating 3D luminous wireframe neural brain with pulsing constellation nodes, radiant lightbulb, and holographic rings',
    tone: 'cyan',
    tags: ['Live Hints', 'Dynamic Difficulty', 'Mastery Memory'],
    liveHref: '#games',
    liveLabel: 'Open live Play Lab',
    todayState: 'Eight interactive English skill games with immediate answer verification.',
    aiNextState:
      'Personalised follow-up drills and step-by-step explanations tailored to each student.',
    icon: 'brain',
  },
  {
    id: 'data-insights',
    pillar: 'DATA INSIGHTS',
    phase: 'AI · PHASE 03',
    title: 'Predictive Class Insights',
    summary:
      'Visual classroom telemetry that turns daily assessment logs into early intervention signals and ready-to-share reports.',
    image: './images/ai-future-data-insights.webp',
    imageAlt:
      'Floating 3D glowing wireframe analytics cube with ascending neon bar pillars, radial HUD dials, and energy waveforms',
    tone: 'indigo',
    tags: ['Skill Forecasting', 'Cohort Radar', '1-Click Reports'],
    liveHref: '#daily-assessment',
    liveLabel: 'Open Daily Records',
    todayState: 'Structured day-by-day student assessment tracking across classes and terms.',
    aiNextState:
      'Automated trend detection highlighting who needs support before exam week arrives.',
    icon: 'chart',
  },
  {
    id: 'global-access',
    pillar: 'GLOBAL ACCESS',
    phase: 'AI · PHASE 04',
    title: 'Connected Bilingual Classrooms',
    summary:
      'Always-on Khmer-English reading companions and voice narration bridging interactive workbooks across every grade.',
    image: './images/ai-future-global-access.webp',
    imageAlt:
      'Floating 3D glowing wireframe Earth globe woven from violet and cyan constellations with orbiting graduation caps and books',
    tone: 'teal',
    tags: ['Khmer-English Aid', 'Voice Companion', 'Any Device'],
    liveHref: '#library',
    liveLabel: 'Open Reading Room',
    todayState: 'Kid 1–11 interactive readers, digital workbooks, and downloadable packs.',
    aiNextState:
      'Context-aware bilingual definitions, read-along pacing, and spoken comprehension checks.',
    icon: 'globe',
  },
];
