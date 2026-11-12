export type KidMaterialKind = 'Vocabulary list' | 'Dictation worksheet' | 'Review test' | 'Unscramble sheet' | 'Sentence unscramble' | 'Online homework';

export interface KidGradeMaterial {
  id: string;
  title: string;
  kind: KidMaterialKind;
  description: string;
  href: string;
  units?: number;
  /** Firestore share doc (biweekly_tests collection) that gates this online
   *  homework — publicly readable, teacher-only write. One doc per homework
   *  so the teacher can assign them one at a time. */
  shareDoc?: string;
  /** Students must not even see the row until the teacher shares this
   *  homework (the card hides it; the page hides its tab and content). */
  hideUntilShared?: boolean;
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
  {
    id: 'kid-6-rfc2-unit-test',
    title: 'Reading Future Connect 2 · Unit Test',
    kind: 'Review test',
    description: 'Full unit tests: vocabulary fill-ins, sentence matching/unscramble, and reading comprehension. Auto-graded against the publisher answer key. Includes light/dark theme toggle.',
    href: './rfc2/rfc2unittest.html',
    units: 16,
  },
];

// Kid 7 — Reading Future Change 1 worksheets, served from public/rfc1/.
// Same pattern as Kid 6: each worksheet is a single self-contained HTML
// file with a back-to-CMC floating button. Dictation locks "Show Key"
// behind the same teacher role-gate script used by rfc2/rfc2dic.html
// (students can take the worksheet and see scores; keys stay teacher-only).
// Worksheets are reference/practice only (no Firestore writes).
const kid7Resources: KidGradeMaterial[] = [
  {
    id: 'kid-7-rfc1-word-list',
    title: 'Reading Future Change 1 · Word List',
    kind: 'Vocabulary list',
    description: 'Interactive vocabulary reference for all 16 units — part of speech, definitions, and sample sentences. Review on screen or print.',
    href: './rfc1/word-list.html',
    units: 16,
  },
  {
    id: 'kid-7-rfc1-unscramble',
    title: 'Reading Future Change 1 · Unscramble Sheet',
    kind: 'Unscramble sheet',
    description: 'Rebuild scrambled sentences A–D and place each finished sentence into the correct gap ①–④ of the passage. Auto-graded with instant feedback.',
    href: './rfc1/unscramble.html',
    units: 16,
  },
  {
    id: 'kid-7-rfc1-dictation',
    title: 'Reading Future Change 1 · Dictation Sheet',
    kind: 'Dictation worksheet',
    description: 'Play the unit track and fill all 15 blanks. Spelling-tolerant, multi-word aware, auto-scored, with share and print/PDF options. 16 units.',
    href: './rfc1/dictation.html',
    units: 16,
  },
  {
    id: 'kid-7-rfc1-unit-test',
    title: 'Reading Future Change 1 · Unit Test',
    kind: 'Review test',
    description: 'Full unit tests across 16 units: Section A word bank, Section B match/unscramble, Section C reading. Auto-graded with instant scores; print-ready.',
    href: './rfc1/unit-test.html',
    units: 16,
  },
];

// Kid 11 — Reading Future Create 3 worksheets, served from public/rfc3/,
// plus the online-homework worksheets (public/rfc3/doctor-fish.html,
// public/rfc3/unit13hw.html, public/rfc3/unit15hw.html and
// public/rfc3/unit2hw.html). The homework pages follow the same self-contained
// pattern (back-to-CMC button, share menu) and add a "Submit to Teacher"
// completion button that posts the student's name + score to the
// drill_attempts Firestore collection via the validated guest branch (or the
// signed-in localStorage session token) — same pipeline as the rfc2/rfc3
// dictation sheets, so completions reach the teacher dashboard with no rules
// change. Units 2, 13, 14 and 15 are 3-homework files where EACH homework
// carries its own shareDoc: the teacher assigns one homework at a time, and
// hideUntilShared keeps every unshared homework completely invisible to
// students.
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
  // Unit 14 — the teacher's 3-homework file (Doctor Fish). Same per-homework
  // share-gate pattern as Units 13/15: one share doc per homework, students
  // see only what the teacher has opened, one homework at a time.
  {
    id: 'kid-11-homework-u14-hw1',
    title: 'Unit 14 · Homework 1 — Spa Intake File',
    kind: 'Online homework',
    description: 'Doctor Fish vocabulary & comprehension: word meanings, intake-note gap fills, reading comprehension, true/false and conjunctive adverbs — 30 auto-graded points. Only visible once the teacher shares Homework 1.',
    href: './rfc3/doctor-fish.html#hw-a',
    shareDoc: 'hw-kid11-u14-hw1',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u14-hw2',
    title: 'Unit 14 · Homework 2 — Treatment Analyst',
    kind: 'Online homework',
    description: 'Doctor Fish process & critical thinking: order the visitor journey, link causes to effects, sort benefits vs limitations, verify brochure claims, main idea and a treatment summary — 26 auto-graded points. Only visible once the teacher shares Homework 2.',
    href: './rfc3/doctor-fish.html#hw-b',
    shareDoc: 'hw-kid11-u14-hw2',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u14-hw3',
    title: 'Unit 14 · Homework 3 — Health Writer',
    kind: 'Online homework',
    description: 'Doctor Fish writing & speaking: fact vs opinion sort, headline desk, magazine feature, reader-question prep, adverb sentences and a balanced verdict — 16 auto-graded points. Only visible once the teacher shares Homework 3.',
    href: './rfc3/doctor-fish.html#hw-c',
    shareDoc: 'hw-kid11-u14-hw3',
    hideUntilShared: true,
  },
  // Unit 13 — the teacher's 3-homework file (New Homes for Animals). Each
  // homework is gated by its OWN share doc: when the teacher assigns one,
  // only that one appears for students (row + page tab) until it too is
  // shared — hideUntilShared keeps the others completely invisible.
  {
    id: 'kid-11-homework-u13-hw1',
    title: 'Unit 13 · Homework 1 — Field Notebook',
    kind: 'Online homework',
    description: 'New Homes for Animals vocabulary & comprehension: word meanings, gap fills, reading comprehension, true/false and phrasal verbs — 30 auto-graded points. Only visible once the teacher shares Homework 1.',
    href: './rfc3/unit13hw.html#hw-a',
    shareDoc: 'hw-kid11-u13-hw1',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u13-hw2',
    title: 'Unit 13 · Homework 2 — Relocation Mission',
    kind: 'Online homework',
    description: 'New Homes for Animals process & critical thinking: order the mission steps, link causes to effects, sort research vs action, decision desk — 25 auto-graded points. Only visible once the teacher shares Homework 2.',
    href: './rfc3/unit13hw.html#hw-b',
    shareDoc: 'hw-kid11-u13-hw2',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u13-hw3',
    title: 'Unit 13 · Homework 3 — Campaign Studio',
    kind: 'Online homework',
    description: 'New Homes for Animals writing & speaking: fact vs opinion, slogan workshop, campaign text, interview prep and phrasal sentences — 16 auto-graded points. Only visible once the teacher shares Homework 3.',
    href: './rfc3/unit13hw.html#hw-c',
    shareDoc: 'hw-kid11-u13-hw3',
    hideUntilShared: true,
  },
  // Unit 15 — the teacher's 3-homework file (DNA Bank). Same per-homework
  // share-gate pattern as Unit 13: one share doc per homework, students see
  // only what the teacher has opened, one homework at a time.
  {
    id: 'kid-11-homework-u15-hw1',
    title: 'Unit 15 · Homework 1 — Lab Induction',
    kind: 'Online homework',
    description: 'DNA Bank vocabulary & comprehension: word meanings, lab-note gap fills, reading comprehension, true/false and acronyms — 30 auto-graded points. Only visible once the teacher shares Homework 1.',
    href: './rfc3/unit15hw.html#hw-a',
    shareDoc: 'hw-kid11-u15-hw1',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u15-hw2',
    title: 'Unit 15 · Homework 2 — Chain-Reaction Analyst',
    kind: 'Online homework',
    description: 'DNA Bank cause & effect analysis: order the extinction cascade, link causes to effects, sort causes vs effects, predictions, claim checks and an analysis report — 28 auto-graded points. Only visible once the teacher shares Homework 2.',
    href: './rfc3/unit15hw.html#hw-b',
    shareDoc: 'hw-kid11-u15-hw2',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u15-hw3',
    title: 'Unit 15 · Homework 3 — Conservation Campaigner',
    kind: 'Online homework',
    description: 'DNA Bank writing & speaking: fact vs opinion sort, campaign slogan, campaign text, public Q&A, acronyms in your own words and a closing message — 16 auto-graded points. Only visible once the teacher shares Homework 3.',
    href: './rfc3/unit15hw.html#hw-c',
    shareDoc: 'hw-kid11-u15-hw3',
    hideUntilShared: true,
  },
  // Unit 2 — the teacher's 3-homework file (Leonardo da Vinci). Same
  // per-homework share-gate pattern as Units 13/14/15: one share doc per
  // homework, students see only what the teacher has opened, one homework
  // at a time.
  {
    id: 'kid-11-homework-u2-hw1',
    title: 'Unit 2 · Homework 1 — Museum Docent',
    kind: 'Online homework',
    description: 'Leonardo da Vinci vocabulary & comprehension: word meanings, tour-note gap fills, reading comprehension, true/false and the suffix -eer — 30 auto-graded points. Only visible once the teacher shares Homework 1.',
    href: './rfc3/unit2hw.html#hw-a',
    shareDoc: 'hw-kid11-u2-hw1',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u2-hw2',
    title: 'Unit 2 · Homework 2 — Timeline Curator',
    kind: 'Online homework',
    description: 'Leonardo da Vinci chronology & critical thinking: order the timeline, link causes to effects, sort main ideas vs supporting details, label checks, detail hunt and an exhibition panel — 27 auto-graded points. Only visible once the teacher shares Homework 2.',
    href: './rfc3/unit2hw.html#hw-b',
    shareDoc: 'hw-kid11-u2-hw2',
    hideUntilShared: true,
  },
  {
    id: 'kid-11-homework-u2-hw3',
    title: 'Unit 2 · Homework 3 — Exhibition Critic',
    kind: 'Online homework',
    description: 'Leonardo da Vinci writing & speaking: fact vs opinion sort, exhibition title, magazine review, interview prep, suffix sentences and a balanced verdict — 16 auto-graded points. Only visible once the teacher shares Homework 3.',
    href: './rfc3/unit2hw.html#hw-c',
    shareDoc: 'hw-kid11-u2-hw3',
    hideUntilShared: true,
  },
];

const kidGradeResources = ([
  plannedGrade(5),
  { grade: 6, status: 'available', materials: kid6Resources },
  { grade: 7, status: 'available', materials: kid7Resources },
  plannedGrade(8),
  plannedGrade(9),
  plannedGrade(10),
  { grade: 11, status: 'available', materials: kid11Resources },
  plannedGrade(12),
].sort((a, b) => a.grade - b.grade)) as KidGradeResource[];

export const KID_GRADE_RESOURCES: KidGradeResource[] = kidGradeResources;
