import { QuickLinkItem, ResourceItem, FaqItem } from '../types';

export const QUICK_LINKS: QuickLinkItem[] = [
  {
    id: 'daily-assessment',
    title: 'Daily Student Assessment',
    category: 'Student Records',
    badge: 'Workspace',
    description: 'Open the separate daily assessment record workspace for reading, listening/speaking, homework, participation, and overall progress.',
    iconName: 'ClipboardCheck',
    path: '#daily-assessment'
  },
  {
    id: 'kid-grades',
    title: 'Kid Program · Grades 5–12',
    category: 'Curriculum Paths',
    badge: 'Kid 6 available',
    description: 'Open the grade pathway for Kid 5 through Kid 12. Kid 6 currently links to Reading Future Connect 2 vocabulary review; more grade collections can be added later.',
    iconName: 'GraduationCap',
    path: '#kid-grades'
  },
  {
    id: 'toefl-suite',
    title: 'Member TOEFL Mini Mock',
    category: 'Assessment & Tests',
    badge: 'Popular',
    description: 'Eight original questions across reading, listening, and language use, served after verified member access.',
    iconName: 'GraduationCap',
    path: '#toefl-mini-test'
  },
  {
    id: 'toefl-assessments',
    title: 'TOEFL Junior Skill Assessments',
    category: 'Assessment & Tests',
    badge: '15 original sets',
    description: 'Five original speaking, listening, and writing assessment packs per skill, each with separate teacher guidance and a rubric.',
    iconName: 'BookOpen',
    path: '#toefl-junior-assessments'
  },
  {
    id: 'auto-grading',
    title: 'Feedback Preview',
    category: 'Assessment & Tests',
    badge: 'Sample only',
    description: 'Explore sample feedback. This preview is not an AI grading service or validated scoring system.',
    iconName: 'Sparkles',
    path: '#interactive-demo'
  },
  {
    id: 'worksheets',
    title: 'Worksheet Preview',
    category: 'Teacher Resources',
    badge: 'Example only',
    description: 'Preview example worksheet interactions; this demo does not generate or download custom worksheets.',
    iconName: 'FileSpreadsheet',
    path: '#resources'
  },
  {
    id: 'worksheet-uploads',
    title: 'Printable Assignment Packs',
    category: 'Teacher Resources',
    description: 'Preview original student handouts and separate teacher keys. Print or save a copy from the browser.',
    iconName: 'FileSpreadsheet',
    path: '#resources'
  },
  {
    id: 'prefix-suffix',
    title: 'Prefix & Suffix Practice',
    category: 'Vocabulary Lab',
    badge: 'Assignment',
    description: 'Open the original morphology assignment with word-building tasks and a separate teacher key.',
    iconName: 'Type',
    path: '#resources'
  },
  {
    id: 'class-mgmt',
    title: 'Classroom Management',
    category: 'Analytics & Admin',
    description: 'Explore the sample roster. It is not connected to or storing real student accounts.',
    iconName: 'Users',
    path: '#interactive-demo'
  },
  {
    id: 'analytics',
    title: 'Diagnostic Analytics',
    category: 'Analytics & Admin',
    badge: 'Sample data',
    description: 'Explore example skill indicators. This preview does not store real learner results.',
    iconName: 'BarChart3',
    path: '#interactive-demo'
  },
  {
    id: 'learning-games',
    title: 'Creative Minds Play Lab',
    category: 'Student Engagement',
    badge: '6 games',
    description: 'Open a dedicated student game room with vocabulary, reading, grammar, listening, and phonics mini-games.',
    iconName: 'Gamepad2',
    path: '#games'
  },
  {
    id: 'pre-kid',
    title: 'Pre-Kid Foundation Hub',
    category: 'Curriculum Paths',
    description: 'Browse the early-reading sound detective assignment for sh/ch and short vowels.',
    iconName: 'Baby',
    path: '#resources'
  },
  {
    id: 'kid-program',
    title: 'Kid Program · Grades 5–12',
    category: 'Curriculum Paths',
    description: 'Browse all eight grade spaces. Kid 6 currently links to Reading Future Connect 2 vocabulary review; materials for other grades can be added later.',
    iconName: 'BookOpen',
    path: '#kid-grades'
  },
  {
    id: 'chinese-language',
    title: 'Speaking & Writing Practice',
    category: 'Curriculum Paths',
    description: 'Explore the original speaking and academic-writing practice assignments.',
    iconName: 'Languages',
    path: '#resources'
  }
];

export const RESOURCE_CATALOG: ResourceItem[] = [
  {
    id: 'res-1',
    title: 'TOEFL-Style Reading: Inference & Evidence Practice',
    category: 'TOEFL Prep',
    tags: ['Central idea', 'Inference', 'Evidence', 'Synthesis'],
    description: 'A two-text nonfiction reading lab with central-idea, vocabulary-in-context, evidence, and synthesis questions plus a reasoned answer key.',
    tag: 'Two-text reading',
  },
  {
    id: 'res-2',
    title: 'Prefixes & Suffixes Morphological Masterclass (un-, re-, -able, -tion)',
    category: 'Grammar & Vocab',
    tags: ['Morphology', 'Roots & Affixes', 'Vocabulary Builder', 'Printable'],
    description: 'A three-part morphology challenge covering affix meanings, word building in context, and evidence-based explanations.',
    tag: 'Affix challenge',
  },
  {
    id: 'res-3',
    title: 'Phonics Foundations: CVC Blends & Vowel Teams Activity Binder',
    category: 'Reading & Phonics',
    tags: ['Phonics', 'Early Reading', 'Sound Mapping', 'ESL Scaffolding'],
    description: 'A guided sound-detective worksheet for sh/ch listening, sound mapping, one-sound changes, and short-vowel words.',
    tag: 'Early phonics',
  },
  {
    id: 'res-4',
    title: 'TOEFL-Style Speaking Practice & Rubric',
    category: 'TOEFL Prep',
    tags: ['Speaking Practice', 'Oral Fluency', 'Rubric', 'Reflection'],
    description: 'Three original timed speaking tasks with planning space, listener reflection, and a transparent four-part scoring rubric.',
    tag: 'Speaking practice',
  },
  {
    id: 'res-5',
    title: 'Academic Writing & Paraphrasing: Avoiding Plagiarism Workshop Pack',
    category: 'Academic Writing',
    tags: ['Academic Writing', 'Paraphrasing', 'Evidence', 'Citation'],
    description: 'A source-literacy workshop on meaning, original sentence structure, evidence, and responsible citation, with a teacher rubric.',
    tag: 'Writing workshop',
  },
  {
    id: 'res-6',
    title: 'Grammar Arcade: Irregular Verbs & Past Tense Classroom Relay Game',
    category: 'Classroom Games',
    tags: ['Irregular Verbs', 'Grammar', 'Team Activity', 'Practice'],
    description: 'A cooperative three-round verb relay with a 12-verb ladder, sentence challenge, game directions, and scoring guide.',
    tag: 'Team challenge',
  }
];

export const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'Grading & AI',
    question: 'Does the member mini mock provide an official TOEFL or CEFR score?',
    answer: 'No. It is original classroom practice, not an official TOEFL test, ETS material, CEFR placement, or validated score. It checks multiple-choice answers and provides explanations. The feedback sandbox uses example data and is not an AI grading service.'
  },
  {
    id: 'faq-2',
    category: 'Platform',
    question: 'Can I upload a worksheet or generate a custom one here?',
    answer: 'Not in the current build. The Ready-to-Use section contains six original assignments you can preview and print. Worksheet upload/OCR and AI-generated worksheets are not enabled.'
  },
  {
    id: 'faq-3',
    category: 'Curriculum',
    question: 'What grade bands are represented in the assignments?',
    answer: 'The six current packs show their suggested grade bands in the resource library: early phonics, elementary vocabulary and grammar, middle-grade reading, and secondary speaking/writing practice. These are teacher-written practice materials, not a formal curriculum or official standards mapping.'
  },
  {
    id: 'faq-4',
    category: 'Pricing & Schools',
    question: 'Does this preview have paid plans or a free trial?',
    answer: 'No paid checkout, recurring billing, or paid trial is enabled here. Once Supabase is configured, email-verified accounts receive the free member entitlement used to open the mini mock. There are no published paid plans in this build.'
  },
  {
    id: 'faq-5',
    category: 'Platform',
    question: 'Are quiz answers, learner rosters, or scores saved or synced?',
    answer: 'The mini mock keeps answers and its practice result in browser memory only; they are not sent to Supabase or persisted. The roster in the interactive sandbox is sample data. Google Classroom, Canvas, and other LMS integrations are not enabled.'
  },
  {
    id: 'faq-6',
    category: 'Platform',
    question: 'What member and contact information is stored?',
    answer: 'Supabase Auth handles account credentials. A member profile stores name, email, school, role, and member ID. Teacher-interest requests and separate newsletter opt-ins record their relevant consent and are scheduled for deletion after 90 days. Account deletion removes the Auth account and matching contact records. See the Privacy & data use disclosure below; it still needs the operator details and legal review before public launch.'
  }
];

export const INTERACTIVE_TOEFL_SAMPLES = [
  {
    id: 'sample-1',
    title: 'Middle School TOEFL Reading Diagnostic',
    level: 'Reading sample',
    question: 'Read the short excerpt on "Ocean Ecosystems" and summarize the author’s primary argument in 2-3 sentences.',
    studentSubmission: 'The ocean has deep vents where animals live without sun. They make energy from chemicals instead of plants doing photosynthesis. This shows life can survive in very harsh conditions.',
    aiScore: {
      overall: 'Sample only',
      cefr: 'Not assessed',
      grammar: 0,
      coherence: 0,
      vocabulary: 0,
      feedback: 'Illustrative text only. No language model, standards-based rubric, or measured score runs in this preview.'
    }
  },
  {
    id: 'sample-2',
    title: 'Prefix & Suffix Contextual Application',
    level: 'Vocabulary sample',
    question: 'Change the base word "care" using prefixes/suffixes to complete: "She was very ______ when crossing the street, but her brother was ______ and lost his ball."',
    studentSubmission: 'She was very careful when crossing the street, but her brother was careless and lost his ball.',
    aiScore: {
      overall: 'Sample only',
      cefr: 'Not assessed',
      grammar: 0,
      coherence: 0,
      vocabulary: 0,
      feedback: 'Illustrative text only. No language model, standards-based rubric, or measured score runs in this preview.'
    }
  },
  {
    id: 'sample-3',
    title: 'TOEFL Junior Listening Response',
    level: 'Listening sample',
    question: 'Why did the biology teacher instruct students to bring field journals to Friday’s laboratory session?',
    studentSubmission: 'Because the teacher wants them to record observations of butterfly lifecycles right away rather than trying to remember the details afterwards.',
    aiScore: {
      overall: 'Sample only',
      cefr: 'Not assessed',
      grammar: 0,
      coherence: 0,
      vocabulary: 0,
      feedback: 'Illustrative text only. No language model, standards-based rubric, or measured score runs in this preview.'
    }
  }
];
