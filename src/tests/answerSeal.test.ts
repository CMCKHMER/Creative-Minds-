import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanSealCode, formatSealCode, gradeSheet, keyMapOf, normalizeAnswer, openAnswerKey, openSeal, parseSheet,
  sealCodeMatches,
} from '../lib/answerSeal';
import type { SealBlob, SealBundle, SealPayload, SealPublicKey } from '../lib/answerSeal';

/**
 * ANSWER SEAL. The bi-weekly test pages are public files in a public repo,
 * so their answer keys are stored ENCRYPTED (scripts/seal_tests.mjs) and the
 * private key lives only in Firestore, readable by verified teachers.
 *
 * Two kinds of tests here:
 *   1. Repository invariants — no page may ever ship a readable answer again
 *      and the private key may never be committed. These fail CI (and so the
 *      deploy) before an unsealed page reaches the live site.
 *   2. The grading maths and the crypto format the dashboard uses, checked
 *      against the real sealing tool with a throwaway key pair.
 */

const ROOT = resolve(process.cwd());
const PLANNER = resolve(ROOT, 'public/biweek-planner');
const TESTS_DIR = resolve(PLANNER, 'tests');
const SCRIPT = resolve(ROOT, 'scripts/seal_tests.mjs');

const pages = readdirSync(TESTS_DIR).filter((f) => f.endsWith('.html') && f !== '_template.html').sort();
const pub = JSON.parse(readFileSync(resolve(PLANNER, 'answer-seal.pub.json'), 'utf8')) as SealPublicKey;
const bundle = JSON.parse(readFileSync(resolve(PLANNER, 'answer-seals.json'), 'utf8')) as SealBundle;

describe('repository: no readable answer key ships with the site', () => {
  it('every bi-weekly test page is sealed (the sealing tool agrees)', () => {
    const out = execFileSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
    expect(out).toContain('check passed');
    expect(out).toContain(`${pages.length} test pages sealed`);
  });

  it('every page loads the unlock script and carries only placeholder answers', () => {
    expect(pages.length).toBeGreaterThanOrEqual(45);
    for (const file of pages) {
      const html = readFileSync(resolve(TESTS_DIR, file), 'utf8');
      expect(html, file).toContain('<script src="../answer-seal.js?v=1"></script>');
      expect(html, file).toContain('window.CMC_SEAL=');
      // Classic rows end `],<answer>]`; after sealing the answer is -1 or ["?"].
      const line = html.split('\n').find((l) => l.startsWith('window.TEST_BANKS=')) ?? '';
      expect(line, file).not.toBe('');
      const banks = JSON.parse(line.slice('window.TEST_BANKS='.length).replace(/;\s*$/, '')) as Record<string, unknown[][]>;
      const recap = html.includes('window.AMAP_OFF=');
      for (const rows of Object.values(banks)) {
        for (const row of rows) {
          const answer = row[2];
          if (recap) {
            // Recap rows: one ciphered letter that decodes to "none" + no explanation.
            const off = Number(/window\.AMAP_OFF=(\d+)/.exec(html)?.[1]);
            expect((String(answer).charCodeAt(0) - 65 - off + 52) % 26, file).toBe(25);
            expect(row[3] ?? '', file).toBe('');
          } else if (Array.isArray(answer)) {
            expect(answer, file).toEqual(['?']);
          } else {
            expect(answer, file).toBe(-1);
          }
        }
      }
    }
  });

  it('the dashboard bundle holds exactly one seal per page, made with the repo key', () => {
    expect(Object.keys(bundle.seals).sort()).toEqual(pages.map((f) => f.replace(/\.html$/, '')));
    expect(bundle.kid).toBe(pub.kid);
    for (const file of pages) {
      const html = readFileSync(resolve(TESTS_DIR, file), 'utf8');
      const line = html.split('\n').find((l) => l.startsWith('window.CMC_SEAL=')) ?? '';
      const seal = JSON.parse(line.slice('window.CMC_SEAL='.length).replace(/;\s*$/, '')) as SealBlob;
      expect(seal.kid, file).toBe(pub.kid);
      expect(bundle.seals[file.replace(/\.html$/, '')].ct, file).toBe(seal.ct);
    }
  });

  it('every test the dashboard can share has a seal to grade it with', () => {
    const panel = readFileSync(resolve(ROOT, 'src/components/BiWeeklyTestsPanel.tsx'), 'utf8');
    const slugs = [...panel.matchAll(/slug: '([^']+)\.html'/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(20);
    for (const slug of slugs) expect(Object.keys(bundle.seals), slug).toContain(slug);
    // …and the other way round: students' browsers cannot grade any more, so
    // a test missing from the dashboard list could never be scored at all.
    expect([...slugs].sort()).toEqual(Object.keys(bundle.seals).sort());
  });

  it('the private key is not in the repository', async () => {
    // A key code is "cmcseal1." + 43 base64url characters. No tracked file
    // may contain one that actually opens the repo's seals.
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter((f) => f && !f.startsWith('dist/assets/') && /\.(html|js|mjs|ts|tsx|json|md|py|txt|rules|yml|yaml|env|example)$/.test(f));
    const found: string[] = [];
    for (const file of tracked) {
      const path = resolve(ROOT, file);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8');
      for (const m of text.matchAll(/cmcseal1\.[A-Za-z0-9_-]{43}/g)) {
        if (await sealCodeMatches(pub, m[0])) found.push(file);
      }
    }
    expect(found).toEqual([]);
    expect(readFileSync(resolve(ROOT, '.gitignore'), 'utf8')).toMatch(/^\.secrets\/$/m);
  });

  it('the rules give the key to verified teachers only, and only the owner can install it', () => {
    const rules = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8');
    const block = /match \/teacher_secrets\/\{secretId\} \{([\s\S]*?)\n {4}\}/.exec(rules)?.[1] ?? '';
    expect(block).toContain('allow get: if isVerifiedTeacher();');
    expect(block).toContain('allow list: if false;');
    expect(block).toMatch(/allow create, update: if isCmcAdmin\(\)/);
    expect(block).toContain('allow delete: if false;');
    expect(block).not.toMatch(/allow read/);
  });
});

describe('grading a raw answer sheet', () => {
  const payload: SealPayload = {
    v: 1,
    slug: 'sample',
    banks: { g1: [2, 0, [0, 2]], g2: [[1, 10, 2]] },
    ra: [[2, 1]],
    rb: [[1, 3]],
  };
  const key = keyMapOf(payload);

  it('normalizes answers exactly like the page engine does', () => {
    expect(normalizeAnswer(2)).toBe('2');
    expect(normalizeAnswer([2, 0])).toBe('0|2');
    // The engine sorts the values as STRINGS, so 10 comes before 2.
    expect(normalizeAnswer([1, 10, 2])).toBe('1|10|2');
    expect(key).toEqual({ 'g1:0': '2', 'g1:1': '0', 'g1:2': '0|2', 'g2:0': '1|10|2', 'RA:0': '2:1', 'RB:0': '1|3' });
  });

  it('scores correct, wrong, partial multi-select and unanswered questions', () => {
    const grade = gradeSheet({ 'g1:0': '2', 'g1:1': '1', 'g1:2': '0', 'RA:0': '2:1', 'RB:0': '1|3' }, key);
    expect(grade).toEqual({ correct: 3, total: 6, answered: 5, pct: 50 });
    expect(gradeSheet({}, key)).toEqual({ correct: 0, total: 6, answered: 0, pct: 0 });
    expect(gradeSheet({ ...key }, key).pct).toBe(100);
  });

  it('a student cannot raise the score with invented or missing question ids', () => {
    const grade = gradeSheet({ 'g1:0': '2', 'bogus:0': '1', 'g1:99': '0' }, key);
    expect(grade.correct).toBe(1);
    expect(grade.total).toBe(6); // the denominator always comes from the key
  });

  it('reads the stored sheet field and rejects junk', () => {
    expect(parseSheet('{"v":1,"a":{"g1:0":"2","g1:1":3}}')).toEqual({ 'g1:0': '2', 'g1:1': '3' });
    expect(parseSheet('')).toBeNull();
    expect(parseSheet('not json')).toBeNull();
    expect(parseSheet('{"v":1}')).toBeNull();
    expect(parseSheet('{"v":1,"a":{"g1:0":{"x":1}}}')).toEqual({});
  });

  it('accepts the key code with or without its prefix', () => {
    expect(cleanSealCode('  cmcseal1.AbC-_  ')).toBe('AbC-_');
    expect(cleanSealCode('AbC-_')).toBe('AbC-_');
    expect(formatSealCode('AbC-_')).toBe('cmcseal1.AbC-_');
  });
});

describe('the sealing tool and the dashboard agree on the format', () => {
  // A throwaway site: one unsealed page, a fresh key pair made by the tool.
  let dir = '';
  let testPub: SealPublicKey;
  let testBundle: SealBundle;
  let code = '';
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [join(dir, 'scripts/seal_tests.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  const PAGE = [
    '<!doctype html><html><head>',
    '<script src="../student-invite.js?v=2"></script>',
    '</head><body><div id="g1"></div><div id="g2"></div>',
    '<script>',
    'window.TEST_CONFIG={"title":"Sample","groups":[{"id":"g1","title":"One"},{"id":"g2","title":"Two"}]};',
    'window.TEST_BANKS={"g1":[["Pick C",["a","b","c"],2],["Pick A",["a","b"],0]],"g2":[["Pick two",["a","b","c"],[0,2]]],"unused-list":[["never shown",["a","b"],1]]};',
    '</script>',
    '<script>',
    '/* CMC-TEMPLATE-V2 */',
    '</script>',
    '</body></html>',
  ].join('\n');

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cmc-seal-'));
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'public/biweek-planner/tests'), { recursive: true });
    cpSync(SCRIPT, join(dir, 'scripts/seal_tests.mjs'));
    writeFileSync(join(dir, 'public/biweek-planner/tests/sample.html'), PAGE);
    run('--init-key', join(dir, 'private.json'));
    testPub = JSON.parse(readFileSync(join(dir, 'public/biweek-planner/answer-seal.pub.json'), 'utf8')) as SealPublicKey;
    code = (JSON.parse(readFileSync(join(dir, 'private.json'), 'utf8')) as { key: string }).key;
  });
  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('an unsealed page fails the check, sealing fixes it, and sealing twice changes nothing', () => {
    expect(() => run('--check')).toThrow();
    expect(run()).toContain('1 page(s) sealed now');
    expect(run('--check')).toContain('check passed');
    const once = readFileSync(join(dir, 'public/biweek-planner/tests/sample.html'), 'utf8');
    expect(run()).toContain('0 page(s) sealed now');
    expect(readFileSync(join(dir, 'public/biweek-planner/tests/sample.html'), 'utf8')).toBe(once);
    // Questions and options survive; the answers do not.
    expect(once).toContain('"Pick C",["a","b","c"],-1]');
    expect(once).toContain('"Pick two",["a","b","c"],["?"]]');
    expect(once).toContain('student-invite.js?v=3');
    expect(once).toContain('<script src="../answer-seal.js?v=1"></script>');
    testBundle = JSON.parse(readFileSync(join(dir, 'public/biweek-planner/answer-seals.json'), 'utf8')) as SealBundle;
  });

  it('the dashboard opens the seal with the key code and grades with it', async () => {
    expect(await sealCodeMatches(testPub, code)).toBe(true);
    const key = await openAnswerKey(testPub, testBundle, code, 'sample');
    // Only rendered banks are sealed ("unused-list" has no container).
    expect(key).toEqual({ 'g1:0': '2', 'g1:1': '0', 'g2:0': '0|2' });
    expect(gradeSheet({ 'g1:0': '2', 'g1:1': '1', 'g2:0': '0|2' }, key!)).toEqual({ correct: 2, total: 3, answered: 3, pct: 67 });
    expect(await openAnswerKey(testPub, testBundle, code, 'no-such-test')).toBeNull();
  });

  it('nothing opens without the right key', async () => {
    const seal = testBundle.seals.sample;
    // The real site's key pair is a different one — its public half cannot help.
    expect(await sealCodeMatches(pub, code)).toBe(false);
    expect(await sealCodeMatches(testPub, 'cmcseal1.' + 'A'.repeat(43))).toBe(false);
    expect(await sealCodeMatches(testPub, 'nonsense')).toBe(false);
    await expect(openSeal(testPub, 'cmcseal1.' + 'B'.repeat(43), 'sample', seal)).rejects.toBeDefined();
    // A seal is bound to its test: it cannot be replayed under another slug…
    await expect(openSeal(testPub, code, 'other-test', seal)).rejects.toBeDefined();
    // …and a modified seal is rejected rather than decrypted to garbage.
    const flipped = (seal.ct[0] === 'A' ? 'B' : 'A') + seal.ct.slice(1);
    await expect(openSeal(testPub, code, 'sample', { ...seal, ct: flipped })).rejects.toBeDefined();
  });
});
