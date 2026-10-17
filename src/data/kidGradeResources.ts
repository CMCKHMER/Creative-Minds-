export type KidMaterialKind = 'Vocabulary list' | 'Dictation worksheet' | 'Review test' | 'Unscramble sheet' | 'Sentence unscramble';

export interface KidGradeMaterial {
  id: string;
  title: string;
  kind: KidMaterialKind;
  description: string;
  href: string;
  units?: number;
}

export interface KidGradeResource {
  grade: number;
  status: 'available' | 'planned';
  materials: KidGradeMaterial[];
}

function plannedGrade(grade: number): KidGradeResource {
  return { grade, status: 'planned', materials: [] };
}

// Kid 6 — Reading Future Connect 2 worksheets, served from public/rfc2/.
// Each worksheet is a single self-contained HTML file with a back-to-CMC
// floating button. Dictation + Unscramble submit completion scores to the
// `drill_attempts` Firestore collection (project: creative-minds-cambodia)
// using the student's localStorage token, matching the biweek-planner / rfc3
// pattern. The Word List is reference-only (no scoring, no Firestore write).
const kid6Resources: KidGradeMaterial[] = [
  {
    id: 'kid-6-rfc2-word-list',
    title: 'Reading Future Connect 2 · Word List',
    kind: 'Vocabulary list',
    description: 'Interactive 16-unit vocabulary reference with parts of speech, definitions, and example sentences.',
    href: './rfc2/rfc2unitwords.html',
    units: 16,
  },
  {
    id: 'kid-6-rfc2-unscramble',
    title: 'Reading Future Connect 2 · Unscramble Sheet',
    kind: 'Sentence unscramble',
    description: 'Rebuild scrambled sentences A–D and place each into the correct gap ①–④ of the passage.',
    href: './rfc2/rfc2un.html',
    units: 16,
  },
  {
    id: 'kid-6-rfc2-dictation',
    title: 'Reading Future Connect 2 · Dictation Sheet',
    kind: 'Dictation worksheet',
    description: 'Listen to the unit track and fill all 10 blanks. Spelling-tolerant, multi-word aware, auto-scored.',
    href: './rfc2/rfc2dic.html',
    units: 16,
  },
];

const kid11Resources: KidGradeMaterial[] = [
  {
    id: 'kid-11-rfc3-word-list',
    title: 'Reading Future Create 3 · Word List',
    kind: 'Vocabulary list',
    description: 'Interactive vocabulary list for all 16 units — definitions, parts of speech, and sample sentences. Select a unit and review on screen or print.',
    href: 'https://cmckhmer.github.io/Creative-Minds-/rfc3/word-list.html',
    units: 16,
  },
  {
    id: 'kid-11-rfc3-dictation',
    title: 'Reading Future Create 3 · Dictation Sheet',
    kind: 'Dictation worksheet',
    description: 'Interactive dictation with 20 blanks per unit. Auto-graded, spelling-tolerant, with answer key, share, and print/PDF options. 16 units.',
    href: 'https://cmckhmer.github.io/Creative-Minds-/rfc3/dictation.html',
    units: 16,
  },
  {
    id: 'kid-11-rfc3-review-tests',
    title: 'Reading Future Create 3 · Review Tests 1–4',
    kind: 'Review test',
    description: 'Full interactive review tests covering Units 1–16. Includes vocabulary fill-ins with word banks, multiple choice, cloze gaps, unscramble, and written questions with model answers. 4 tests, auto-graded.',
    href: 'https://cmckhmer.github.io/Creative-Minds-/rfc3/review-tests.html',
    units: 4,
  },
  {
    id: 'kid-11-rfc3-unscramble',
    title: 'Reading Future Create 3 · Unscramble Sheet',
    kind: 'Unscramble sheet',
    description: 'Interactive sentence-unscramble exercises for all 16 units. Rebuild scrambled sentences and place them back into the passage. Auto-graded with instant feedback.',
    href: 'https://cmckhmer.github.io/Creative-Minds-/rfc3/unscramble.html',
    units: 16,
  },
];

const kidGradeResources = ([
  plannedGrade(5),
  { grade: 6, status: 'available', materials: kid6Resources },
  plannedGrade(7),
  plannedGrade(8),
  plannedGrade(9),
  plannedGrade(10),
  { grade: 11, status: 'available', materials: kid11Resources },
  plannedGrade(12),
].sort((a, b) => a.grade - b.grade)) as KidGradeResource[];

export const KID_GRADE_RESOURCES: KidGradeResource[] = kidGradeResources;
