// Question counts of the bi-weekly tests — read from the one file that is
// generated from the test pages themselves
// (public/biweek-planner/test-counts.json, written by scripts/test_counts.mjs).
//
// Two jobs:
//   1. tell the teacher how many questions a test has BEFORE it is shared;
//   2. recognise a result that belongs to an EARLIER VERSION of a test. A
//      test can be replaced under the same name (the Orientation Diagnostic
//      went from 9 to 23 questions on 9 Nov 2026); results recorded before
//      that keep their old total, and without a label a "4 of 9" row reads
//      like a wrong score for the test as it is today.

export interface TestCount {
  title: string;
  kicker: string;
  total: number;
  parts: { title: string; total: number }[];
}
export type TestCounts = Record<string, TestCount>;

/** "diagnostic.html" → "diagnostic" */
export const testSlug = (file: string): string => file.replace(/\.html$/, '');

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "23 questions — Part A 6 · Part B 5 · Part C 5 · Part D 7" */
export function countLine(t: TestCount | undefined): string {
  if (!t) return '';
  const parts = t.parts.map((p) => `${p.title.split(' · ')[0].replace(/\s*\(.*$/, '')} ${p.total}`);
  return plural(t.total, 'question') + (parts.length > 1 ? ` — ${parts.join(' · ')}` : '');
}

/** How many questions the test has today, or undefined for an unknown test. */
export function currentTotal(counts: TestCounts | null | undefined, slugOrFile: string): number | undefined {
  return counts?.[testSlug(slugOrFile)]?.total;
}

/** True when a result was scored out of a different number of questions
 *  than the test has today. Unknown tests and missing totals are never
 *  flagged. */
export function isEarlierVersion(total: number | null | undefined, now: number | undefined): boolean {
  return typeof now === 'number' && now > 0 && typeof total === 'number' && total > 0 && total !== now;
}

/** The label for such a result, '' otherwise. */
export function versionNote(total: number | null | undefined, now: number | undefined): string {
  return isEarlierVersion(total, now)
    ? `Earlier version of this test (${plural(total as number, 'question')}; it now has ${now})`
    : '';
}

let countsPromise: Promise<TestCounts | null> | null = null;

/** Loaded once per page view; resolves to null when the file cannot be
 *  read (callers then simply show no count and flag nothing). */
export function loadTestCounts(): Promise<TestCounts | null> {
  if (!countsPromise) {
    const base = window.location.pathname.replace(/index\.html$/, '') + 'biweek-planner/';
    countsPromise = fetch(base + 'test-counts.json', { cache: 'no-cache' })
      .then((res) => (res.ok ? (res.json() as Promise<{ tests?: TestCounts }>) : null))
      .then((data) => data?.tests ?? null)
      .catch(() => { countsPromise = null; return null; });
  }
  return countsPromise;
}
