// Type declarations for functions/lib/homeworkExport.cjs — the Kid 11 daily
// homework archive shared by the exportHomeworkSheets Cloud Function and the
// vitest parity suite (src/tests/homeworkExport.test.ts).

export interface HomeworkRowInput {
  drillSource?: unknown;
  studentName?: unknown;
  studentUid?: unknown;
  drillTitle?: unknown;
  submittedAt?: unknown; // Date | Timestamp | ISO string | epoch ms
  scorePct?: unknown;
  correctCount?: unknown;
  totalCount?: unknown;
  firstCorrectCount?: unknown;
  firstAnsweredCount?: unknown;
  checkCount?: unknown;
  [key: string]: unknown;
}

export interface HomeworkRow {
  studentName: string;
  signedIn: boolean;
  homework: number | null;
  title: string;
  correct: number;
  total: number;
  pct: number;
  at: number;
  firstCorrect: number | null;
  firstAnswered: number | null;
  checks: number | null;
  studentUid: string;
}

export interface ExportScoreRow {
  key: string;
  name: string;
  submissions: number;
  best: { correct: number; total: number; pct: number };
  firstTry: { correct: number; total: number; pct: number };
  firstTryMeasured: boolean;
  firstAnswered: number | null;
  checks: number | null;
  firstAt: number;
  lastAt: number;
}

export interface HomeworkExportDoc {
  docId: string;
  fields: {
    slug: string;
    homework: number;
    title: string;
    generatedAt: Date;
    students: number;
    submissions: number;
    rowCount: number;
    omitted: number;
    csv: string;
  };
}

export const DAY_MS: number;
export const KID11_HOMEWORK_SLUGS: readonly string[];
export const HOMEWORK_TITLES: Record<string, readonly string[]>;

export function looksLikeEmail(value: string | null | undefined): boolean;
export function friendlyNameFromEmail(email: string): string;
export function displayStudentName(name: unknown): string;
export function homeworkNumberFromTitle(title: unknown): number | null;
export function csvSafeText(value: unknown): string;
export function csvCell(value: unknown): string;
export function parseHomeworkRow(data: HomeworkRowInput | null | undefined): HomeworkRow | null;
export function scoreForAttempts(list: HomeworkRow[]): ExportScoreRow | null;
export function scoresByStudent(attempts: HomeworkRow[]): ExportScoreRow[];
export function scoresToCsv(title: string, rows: ExportScoreRow[]): string;
export function exportDocId(slug: string, homework: number): string;
export function buildHomeworkExports(input: {
  slug: string;
  rows: HomeworkRow[];
  now: number;
  maxCsvChars?: number;
}): HomeworkExportDoc[];
