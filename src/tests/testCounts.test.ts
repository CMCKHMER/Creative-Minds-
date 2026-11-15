// The question count of a bi-weekly test must be the same everywhere:
// what the teacher is told when sharing it, what the student answers, and
// what the result is scored out of. Regression for the owner's report —
// "the Diagnostic showed N questions, the live sheet said 9 and 4 correct":
// the 9 was the test's size before it was replaced on 9 Nov 2026.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnswerKeyMap } from '../lib/answerSeal';
import { inviteRows } from '../lib/inviteScores';
import { countLine, currentTotal, isEarlierVersion, versionNote } from '../lib/testCounts';
import type { TestCounts } from '../lib/testCounts';

const ROOT = resolve(__dirname, '../..');
const PLANNER = resolve(ROOT, 'public/biweek-planner');
const counts = (JSON.parse(readFileSync(resolve(PLANNER, 'test-counts.json'), 'utf8')) as { tests: TestCounts }).tests;

describe('repository: one question count per test, everywhere', () => {
  it('test-counts.json matches the pages, their private twins and every catalog', () => {
    const out = execFileSync('node', [resolve(ROOT, 'scripts/test_counts.mjs'), '--check'], { encoding: 'utf8' });
    expect(out).toMatch(/test counts OK/);
  });

  it('lists every test page, and the parts add up to the total', () => {
    const pages = readdirSync(resolve(PLANNER, 'tests'))
      .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
      .map((f) => f.replace(/\.html$/, ''))
      .sort();
    expect(Object.keys(counts).sort()).toEqual(pages);
    for (const [slug, t] of Object.entries(counts)) {
      expect(t.total, slug).toBeGreaterThan(0);
      expect(t.parts.reduce((n, p) => n + p.total, 0), slug).toBe(t.total);
    }
  });

  it('a part title that names a number of questions names the real one', () => {
    for (const [slug, t] of Object.entries(counts)) {
      for (const p of t.parts) {
        const said = /\((\d+)\s*questions?\)/i.exec(p.title);
        if (said) expect(Number(said[1]), `${slug}: ${p.title}`).toBe(p.total);
      }
    }
  });

  it('the Week 2 tests the owner compared: Diagnostic 23, Written Expressions 25', () => {
    expect(counts.diagnostic.total).toBe(23);
    expect(counts.diagnostic.parts.map((p) => p.total)).toEqual([6, 5, 5, 7]);
    expect(counts.structure.total).toBe(25);
    expect(countLine(counts.diagnostic)).toBe('23 questions — Part A 6 · Part B 5 · Part C 5 · Part D 7');
  });

  it('the planner hub reads its results from the private collection and scores them itself', () => {
    const hub = readFileSync(resolve(PLANNER, 'index.html'), 'utf8');
    expect(hub).toContain("query('invite_attempts'");
    expect(hub).toContain('test-counts.json');
    expect(hub).toContain('<script src="./answer-seal.js');
    // the invite code is registered before a link can be copied
    expect(hub).toContain("FS+'/invite_codes?documentId='");
  });
});

describe('the planner does not hand out the same test twice', () => {
  /** The questions a page actually shows, reduced to their words (the same
   *  question can be bracketed or blanked slightly differently on two pages). */
  const words = (prompt: string): string => prompt
    .replace(/\[[A-D]:\s*/g, '').replace(/\]/g, '')
    .replace(/Which .*$/, '')
    .toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const questionsOf = (file: string): string[] => {
    const html = readFileSync(resolve(PLANNER, 'tests', file), 'utf8');
    const cfg = /window\.TEST_CONFIG=(\{.*?\});\n/s.exec(html);
    const banks = /window\.TEST_BANKS=(\{.*?\});\n/s.exec(html);
    if (!cfg || !banks) return [];
    const groups = (JSON.parse(cfg[1]) as { groups?: { id: string }[] }).groups ?? [];
    const data = JSON.parse(banks[1]) as Record<string, unknown[]>;
    return groups.flatMap((g) => (data[g.id] ?? []).map((row) => (Array.isArray(row) && typeof row[0] === 'string' ? words(row[0]) : ''))).filter(Boolean).sort();
  };
  const hub = readFileSync(resolve(PLANNER, 'index.html'), 'utf8');
  const weeks = hub.slice(hub.indexOf('const WEEKS='), hub.indexOf('\n];', hub.indexOf('const WEEKS=')));
  const listed = [...weeks.matchAll(/file:'([^']+\.html)'/g)].map((m) => m[1]);

  // Owner's report (15 Nov 2026): the Week 2 card listed "L9b Grammar:
  // Parallel Structure" and "Level 9b Parallel Structure" — two pages with
  // the same 20 questions.
  it('no two tests on the planner have exactly the same questions', () => {
    expect(listed.length).toBeGreaterThan(30);
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const file of new Set(listed)) {
      const q = questionsOf(file);
      if (q.length === 0) continue;
      const sig = q.join('|');
      const other = seen.get(sig);
      if (other) twice.push(`${other} = ${file}`);
      else seen.set(sig, file);
    }
    expect(twice).toEqual([]);
  });

  it('no week card lists the same test page twice', () => {
    const cards = weeks.split(/\{n:(?=\d+,cat:)/).slice(1);
    expect(cards.length).toBeGreaterThanOrEqual(7);
    for (const card of cards) {
      const files = [...card.matchAll(/file:'([^']+\.html)'/g)].map((m) => m[1]);
      expect(files.filter((f, i) => files.indexOf(f) !== i), `week ${parseInt(card, 10)}`).toEqual([]);
    }
  });

  it('the retired duplicate is off the planner and the Studio list, and its replacement is still there', () => {
    expect(listed).not.toContain('grammar.html');
    expect(listed).toContain('9b-w2-grammar.html');
    expect(questionsOf('grammar.html')).toEqual(questionsOf('9b-w2-grammar.html')); // why it was retired
    const studio = readFileSync(resolve(ROOT, 'public/studio/index.html'), 'utf8');
    expect(studio).not.toContain("{ slug: 'grammar',");
    // the dashboard keeps it for its earlier results, but offers no new link
    const panel = readFileSync(resolve(ROOT, 'src/components/BiWeeklyTestsPanel.tsx'), 'utf8');
    expect(panel).toMatch(/slug: 'grammar\.html', group: RETIRED_GROUP, retiredFor: /);
  });
});

describe('telling an earlier version of a test from the current one', () => {
  it('flags a different total, and nothing else', () => {
    expect(isEarlierVersion(9, 23)).toBe(true);
    expect(isEarlierVersion(23, 23)).toBe(false);
    expect(isEarlierVersion(9, undefined)).toBe(false); // unknown test
    expect(isEarlierVersion(null, 23)).toBe(false);
    expect(isEarlierVersion(0, 23)).toBe(false);
    expect(versionNote(9, 23)).toBe('Earlier version of this test (9 questions; it now has 23)');
    expect(versionNote(1, 23)).toBe('Earlier version of this test (1 question; it now has 23)');
    expect(versionNote(23, 23)).toBe('');
  });

  it('finds a test by slug or by file name', () => {
    expect(currentTotal(counts, 'diagnostic.html')).toBe(23);
    expect(currentTotal(counts, 'diagnostic')).toBe(23);
    expect(currentTotal(counts, 'no-such-test.html')).toBeUndefined();
    expect(currentTotal(null, 'diagnostic')).toBeUndefined();
  });
});

describe('invite-link results on the score sheet', () => {
  const key: AnswerKeyMap = { 'a:0': '1', 'a:1': '0', 'a:2': '2', 'b:0': '0|2' };
  const sheet = (a: Record<string, string>) => JSON.stringify({ v: 1, a });
  const doc = (over: Record<string, unknown>) => ({
    studentName: 'Sok Dara', drillSlug: 'diagnostic.html', drillTitle: 'Orientation Diagnostic',
    submittedAt: '2026-11-14T03:00:00.000Z', scorePct: 0, correctCount: 0, totalCount: 4, ...over,
  });

  it('grades a sealed attempt against the key: total = the key, not what the device sent', () => {
    const { attempts, unscored } = inviteRows(
      [doc({ sealed: true, totalCount: 9, sheet: sheet({ 'a:0': '1', 'a:1': '0', 'a:2': '1', 'b:0': '0|2' }) })],
      () => key,
    );
    expect(unscored).toBe(0);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ correctCount: 3, totalCount: 4, scorePct: 75, viaInvite: true, drillTitle: 'Orientation Diagnostic' });
  });

  it('never shows a made-up score: a sealed attempt without the key is counted, not listed', () => {
    const { attempts, unscored } = inviteRows([doc({ sealed: true, sheet: sheet({ 'a:0': '1' }) })], () => null);
    expect(attempts).toHaveLength(0);
    expect(unscored).toBe(1);
  });

  it('keeps the stored score of an attempt from before the tests were sealed', () => {
    const { attempts } = inviteRows([doc({ scorePct: 44, correctCount: 4, totalCount: 9 })], () => null);
    expect(attempts[0]).toMatchObject({ scorePct: 44, correctCount: 4, totalCount: 9 });
  });
});
