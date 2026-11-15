#!/usr/bin/env node
// Question counts of the bi-weekly tests — ONE source of truth.
//
// WHY THIS EXISTS
//   A test's question count is shown in several places (the planner hub's
//   share window, the dashboard's test picker, the Studio test list, the
//   teacher score sheets) and it is used to recognise results that belong to
//   an EARLIER VERSION of a test. Those places used to carry no count or a
//   hand-typed one, so a test could be replaced (the Orientation Diagnostic
//   went from 9 to 23 questions) while old 9-question results kept showing
//   up under the same name, unmarked.
//
//   This script reads every page under public/biweek-planner/tests/ and
//   writes public/biweek-planner/test-counts.json:
//
//     { "v": 1, "tests": { "<slug>": { "title", "kicker", "total",
//                                       "parts": [{ "title", "total" }] } } }
//
//   The count is the number of questions the page RENDERS (the banks named
//   by TEST_CONFIG.groups), which is also the number of sealed answers.
//
// USAGE
//   node scripts/test_counts.mjs           rewrite test-counts.json
//   node scripts/test_counts.mjs --check   exit 1 when anything disagrees:
//       - test-counts.json is out of date
//       - a private twin (tests/private/<slug>.html) has another count
//       - the planner hub, the dashboard catalog or the Studio list names a
//         test page that does not exist
//       - a catalog title says "(N questions)" with the wrong N
//
//   `npm run seal` runs this after sealing; `npm run seal:check` checks it,
//   and so does the unit-test suite (src/tests/testCounts.test.ts).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.env.CMC_COUNTS_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const PLANNER_DIR = path.join(ROOT, 'public/biweek-planner');
const TESTS_DIR = path.join(PLANNER_DIR, 'tests');
const PRIVATE_DIR = path.join(TESTS_DIR, 'private');
const OUT_PATH = path.join(PLANNER_DIR, 'test-counts.json');

const strip = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function listTestPages() {
  return fs.readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.html') && !f.startsWith('_'))
    .sort();
}

/** Evaluate the page's data block (TEST_CONFIG … TEST_BANKS) in a sandbox
 *  object — the same slice the Studio and the sealing tool read. */
function readPageData(file) {
  const html = fs.readFileSync(path.join(TESTS_DIR, file), 'utf8');
  const iA = html.indexOf('window.AMAP_OFF');
  const iC = html.indexOf('window.TEST_CONFIG=');
  if (iC < 0) throw new Error(`${file}: no TEST_CONFIG`);
  const start = iA >= 0 && iA < iC ? iA : iC;
  const iB = html.indexOf('window.TEST_BANKS', iC);
  if (iB < 0) throw new Error(`${file}: no TEST_BANKS`);
  let end = html.indexOf('\n', iB);
  if (end < 0) end = html.length;
  // The "rhetorical" page keeps two extra banks on the lines that follow.
  while (html.startsWith('window.RHETORICAL_', end + 1)) {
    const next = html.indexOf('\n', end + 1);
    end = next < 0 ? html.length : next;
  }
  const win = {};
  new Function('window', html.slice(start, end))(win);
  if (!win.TEST_CONFIG || !win.TEST_BANKS) throw new Error(`${file}: data block unreadable`);
  return win;
}

/** Rows of one group. The two "rhetorical" groups keep their questions in
 *  their own arrays instead of TEST_BANKS. */
function groupRows(win, gid, file) {
  if (Array.isArray(win.TEST_BANKS[gid])) return win.TEST_BANKS[gid];
  if (gid === 'rhetorical-a-list' && Array.isArray(win.RHETORICAL_A)) return win.RHETORICAL_A;
  if (gid === 'rhetorical-b-list' && Array.isArray(win.RHETORICAL_B)) return win.RHETORICAL_B;
  throw new Error(`${file}: group "${gid}" has no question bank`);
}

function countPage(file) {
  const win = readPageData(file);
  const cfg = win.TEST_CONFIG;
  const parts = (cfg.groups || []).map((g) => ({
    title: strip(g.title) || g.id,
    total: groupRows(win, g.id, file).length,
  }));
  const total = parts.reduce((n, p) => n + p.total, 0);
  if (!total) throw new Error(`${file}: no questions found`);
  return { title: strip(cfg.title), kicker: strip(cfg.kicker), total, parts };
}

function buildManifest() {
  const tests = {};
  for (const file of listTestPages()) tests[file.replace(/\.html$/, '')] = countPage(file);
  return { v: 1, tests };
}

const serialize = (manifest) => `${JSON.stringify(manifest, null, 1)}\n`;

function privateTwinCount(file) {
  const html = fs.readFileSync(path.join(PRIVATE_DIR, file), 'utf8');
  const at = html.indexOf('window.CMC_PRIVATE_TEST=');
  if (at < 0) return null;
  let end = html.indexOf('\n', at);
  if (end < 0) end = html.length;
  const json = html.slice(at + 'window.CMC_PRIVATE_TEST='.length, end).replace(/;\s*$/, '');
  const data = JSON.parse(json);
  return Array.isArray(data.questions) ? data.questions.length : null;
}

/** Every `{ … slug: 'x' … title: 'y' … }` or `file:'x.html'` reference in a
 *  catalog source, as { slug, title }. */
function catalogRefs(text) {
  const refs = [];
  const entry = /\{[^{}]*\}/g;
  let m;
  while ((m = entry.exec(text))) {
    const body = m[0];
    const slug = /(?:slug|file)\s*:\s*'([^']+)'/.exec(body);
    if (!slug) continue;
    const title = /(?:title|text)\s*:\s*'((?:[^'\\]|\\.)*)'/.exec(body);
    refs.push({ slug: slug[1], title: title ? title[1] : '' });
  }
  return refs;
}

function between(text, startMarker, endMarker, label) {
  const a = text.indexOf(startMarker);
  if (a < 0) throw new Error(`${label}: marker "${startMarker}" not found`);
  const b = text.indexOf(endMarker, a + startMarker.length);
  if (b < 0) throw new Error(`${label}: end marker "${endMarker}" not found`);
  return text.slice(a, b);
}

function cmdCheck() {
  const problems = [];
  const manifest = buildManifest();
  const want = serialize(manifest);
  const have = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';
  if (want !== have) problems.push('test-counts.json is out of date — run "npm run seal"');

  // Private twins must ask exactly the questions the open page asks.
  if (fs.existsSync(PRIVATE_DIR)) {
    for (const file of fs.readdirSync(PRIVATE_DIR).filter((f) => f.endsWith('.html')).sort()) {
      const slug = file.replace(/\.html$/, '');
      const open = manifest.tests[slug];
      if (!open) { problems.push(`tests/private/${file} has no open page tests/${file}`); continue; }
      const n = privateTwinCount(file);
      if (n !== open.total) problems.push(`tests/private/${file} has ${n} questions, tests/${file} has ${open.total}`);
    }
  }

  // Catalogs: every test they name must exist, and a "(N questions)" in a
  // title must be the real count.
  const catalogs = [];
  const hub = fs.readFileSync(path.join(PLANNER_DIR, 'index.html'), 'utf8');
  catalogs.push(['planner hub (WEEKS)', catalogRefs(between(hub, 'const WEEKS=', '];', 'planner hub'))]);
  const panelPath = path.join(ROOT, 'src/components/BiWeeklyTestsPanel.tsx');
  if (fs.existsSync(panelPath)) {
    const panel = fs.readFileSync(panelPath, 'utf8');
    catalogs.push(['dashboard (TEST_CATALOG)', catalogRefs(between(panel, 'const TEST_CATALOG', '];', 'dashboard'))]);
  }
  const studioPath = path.join(ROOT, 'public/studio/index.html');
  if (fs.existsSync(studioPath)) {
    const studio = fs.readFileSync(studioPath, 'utf8');
    catalogs.push(['Studio (STUDIO_TESTS)', catalogRefs(between(studio, 'var STUDIO_TESTS = [', '\n];', 'Studio'))]);
  }
  for (const [label, refs] of catalogs) {
    if (!refs.length) problems.push(`${label}: no tests found — the catalog format changed, update scripts/test_counts.mjs`);
    for (const ref of refs) {
      if (ref.slug === '#' || /^https?:/.test(ref.slug)) continue;
      if (/\.html$/.test(ref.slug) === false && label.startsWith('planner')) continue; // non-test links
      const slug = ref.slug.replace(/\.html$/, '');
      const test = manifest.tests[slug];
      if (!test) { problems.push(`${label}: "${ref.slug}" is not a test page`); continue; }
      const said = /\((\d+)\s*questions?\)/i.exec(ref.title);
      if (said && Number(said[1]) !== test.total) {
        problems.push(`${label}: "${ref.title}" — the page has ${test.total} questions`);
      }
    }
  }

  if (problems.length) {
    console.error(`test counts: ${problems.length} problem(s)`);
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  const all = Object.values(manifest.tests);
  console.log(`test counts OK: ${all.length} tests, ${all.reduce((n, t) => n + t.total, 0)} questions`);
}

function cmdWrite() {
  const manifest = buildManifest();
  const next = serialize(manifest);
  const before = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf8') : '';
  if (next !== before) fs.writeFileSync(OUT_PATH, next);
  const all = Object.values(manifest.tests);
  console.log(`test-counts.json ${next === before ? 'unchanged' : 'written'}: ${all.length} tests, ${all.reduce((n, t) => n + t.total, 0)} questions`);
}

try {
  if (process.argv[2] === '--check') cmdCheck();
  else cmdWrite();
} catch (err) {
  console.error('test counts: ' + (err && err.message ? err.message : err));
  process.exit(1);
}
