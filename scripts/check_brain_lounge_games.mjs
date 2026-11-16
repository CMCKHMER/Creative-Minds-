#!/usr/bin/env node
// THE BRAIN LOUNGE — cartridge audit.
//
//   node scripts/check_brain_lounge_games.mjs
//   node scripts/check_brain_lounge_games.mjs --json
//
// Every arcade game on #brain-lounge is one entry in src/games/registry.ts.
// This script reads that file and then checks the thing the entry points at,
// so a broken cartridge is caught here instead of by a student mid-period.
//
// What it verifies, per cartridge
//   registry   unique URL-safe id, a title, a tagline, a genre, a difficulty,
//              a status, and a launch mode that matches its fields
//   target     'react'        the lazy chunk exists and default-exports a game
//              'standalone'   the launch file exists in public/
//              'external'     the launch URL is https
//   chrome     a way back to CMC: every in-repo page must either link to
//              #brain-lounge or load assets/js/cmc-game-chrome.js, and every
//              React cartridge must call onExit from a visible control
//   access     the page loads cmc-auth-gate.js and calls CMC_GATE.guard(...)
//   scores     the page posts to the shared board (drillSource 'brain-lounge')
//   page       <title>, meta description and a viewport meta are present
//   art        every referenced cover/sector image exists on disk
//   lounge     BrainLoungePage still renders the shelf straight from the
//              registry and shows the cover art
//
// Exits 0 when there is no error (warnings allowed), 1 otherwise.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const JSON_OUT = process.argv.includes('--json');
const QUIET = process.argv.includes('--quiet');

const rel = (p) => p.replace(`${ROOT}/`, '');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const file = (p) => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isFile();

/** Files under `dir` whose text matches `test` (skips tests and node_modules). */
function readDir(dir, test) {
  const hits = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|\.git/.test(entry.name)) walk(p);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
      try { if (test(readFileSync(p, 'utf8'))) hits.push(p); } catch { /* unreadable */ }
    }
  };
  walk(dir);
  return hits;
}

/* ── the card every cartridge is graded on ─────────────────────────────── */
const results = [];
function game(id, title) {
  const card = { id, title, checks: [] };
  results.push(card);
  return {
    ok(name, detail = '') { card.checks.push({ name, status: 'ok', detail }); },
    warn(name, detail = '') { card.checks.push({ name, status: 'warn', detail }); },
    fail(name, detail = '') { card.checks.push({ name, status: 'fail', detail }); },
  };
}

/* ── 1. read the registry ──────────────────────────────────────────────── */
function parseRegistry() {
  const src = read('src/games/registry.ts');
  const start = src.indexOf('export const BRAIN_GAMES');
  if (start < 0) throw new Error('src/games/registry.ts: BRAIN_GAMES not found');
  const end = src.indexOf('\n];', start);
  const body = src.slice(start, end < 0 ? src.length : end);
  const blocks = body.split(/\n  \{\n/).slice(1);
  return blocks.map((block) => {
    const field = (key) => {
      const m = block.match(new RegExp(`${key}:\\s*'([^']*)'`));
      return m ? m[1] : '';
    };
    const imp = block.match(/import\(\s*'([^']+)'\s*\)/);
    return {
      id: field('id'),
      title: field('title'),
      tagline: field('tagline'),
      genre: field('genre'),
      difficulty: Number((block.match(/difficulty:\s*(\d)/) || [])[1] || 0),
      emoji: field('emoji'),
      gradient: field('gradient'),
      status: field('status'),
      mode: field('mode'),
      loadPath: imp ? imp[1] : '',
      launchUrl: field('launchUrl'),
      controls: field('controls'),
      scoreLabel: field('scoreLabel'),
      art: field('art'),
      raw: block,
    };
  });
}

let games;
try {
  games = parseRegistry();
} catch (err) {
  console.error(`\n  ✖ ${err.message}\n`);
  process.exit(1);
}

/* ── 2. registry hygiene, shared by every cartridge ───────────────────── */
function checkRegistryShape(g) {
  const t = game(g.id || '(missing id)', g.title || '(missing title)');
  if (!g.id) t.fail('registry', 'id is missing');
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(g.id)) t.fail('registry', `id "${g.id}" is not a URL-safe slug`);
  else t.ok('registry', `id "${g.id}"`);

  const seen = games.filter((x) => x.id === g.id).length;
  if (seen > 1) t.fail('registry', `id "${g.id}" appears ${seen}× — ids must be unique`);

  for (const [label, value] of [['title', g.title], ['tagline', g.tagline], ['genre', g.genre], ['emoji', g.emoji], ['gradient', g.gradient]]) {
    if (!value) t.fail('registry', `${label} is missing`);
  }
  if (![1, 2, 3].includes(g.difficulty)) t.fail('registry', 'difficulty must be 1, 2 or 3');
  if (!['live', 'coming-soon'].includes(g.status)) t.fail('registry', `status "${g.status}" must be live or coming-soon`);

  if (g.status === 'live') {
    if (!['react', 'standalone', 'external'].includes(g.mode)) {
      t.fail('registry', 'a live cartridge needs mode react | standalone | external');
    } else if (g.mode === 'react' && !g.loadPath) {
      t.fail('registry', "mode 'react' needs load: () => import('./<id>/<Game>')");
    } else if (g.mode !== 'react' && !g.launchUrl) {
      t.fail('registry', `mode '${g.mode}' needs launchUrl`);
    }
  }
  if (g.status === 'live' && !g.controls) t.fail('registry', 'controls line is missing');
  if (g.status === 'live' && !g.scoreLabel) t.fail('registry', 'scoreLabel is missing');
  return t;
}

/* ── 3. per-mode target checks ─────────────────────────────────────────── */
function checkReactTarget(g, t) {
  if (!g.loadPath) return null;
  const target = join(dirname('src/games/registry.ts'), g.loadPath);
  const candidates = [`${target}.tsx`, `${target}.ts`, `${target}/index.tsx`, `${target}/index.ts`];
  const found = candidates.find(file);
  if (!found) {
    t.fail('target', `lazy chunk ${g.loadPath} not found (looked for ${candidates.map(rel).join(', ')})`);
    return null;
  }
  const src = read(found);
  if (!/export default/.test(src)) t.fail('target', `${rel(found)} has no default export`);
  else t.ok('target', rel(found));

  // A React cartridge lives inside the lounge stage, so its way back is onExit.
  if (!/\bonExit\b/.test(src)) t.fail('chrome', 'React cartridge never accepts onExit — there is no way back to the lounge');
  else if (!/onClick=\{onExit\}/.test(src)) t.fail('chrome', 'onExit is never wired to a button — there is no way back to the lounge');
  else t.ok('chrome', 'in-game exit button wired to onExit (lounge shelf)');

  // The submission may live beside the component (stats.ts), as in Chess 3D.
  const dir = join(ROOT, dirname(found));
  const posts = readDir(dir, (text) => /drillSource:\s*["']brain-lounge["']/.test(text) || /drillSource:\s*"brain-lounge"/.test(text));
  if (posts.length) t.ok('scores', `posts runs to the shared board (${posts.map(rel).join(', ')})`);
  else t.fail('scores', "no drillSource 'brain-lounge' — the run will not reach the Lounge leaderboard");
  return found;
}

function checkStandaloneTarget(g, t) {
  if (g.mode === 'external') {
    if (!/^https:\/\//.test(g.launchUrl)) t.fail('target', `external launchUrl must be https, got "${g.launchUrl}"`);
    else t.ok('target', `external · ${g.launchUrl}`);
    t.warn('chrome', 'external cartridge — the back-to-CMC control lives on the host site');
    return null;
  }
  const path = g.launchUrl.replace(/^\.\//, 'public/');
  if (!file(path)) {
    t.fail('target', `${g.launchUrl} → ${rel(path)} is missing`);
    return null;
  }
  t.ok('target', rel(path));
  const src = read(path);
  const page = pageChecks(src, t);

  // Back to CMC — a direct link or the shared chrome bar.
  const linksLounge = /href=["'][^"']*#brain-lounge["']/.test(src);
  const loadsChrome = /assets\/js\/cmc-game-chrome\.js/.test(src);
  if (linksLounge && loadsChrome) t.ok('chrome', '#brain-lounge link + shared CMC game chrome');
  else if (linksLounge) t.ok('chrome', 'link back to #brain-lounge');
  else if (loadsChrome) t.ok('chrome', 'shared CMC game chrome supplies the back button');
  else t.fail('chrome', 'no way back to CMC — add a #brain-lounge link or assets/js/cmc-game-chrome.js');

  // Every local <img>/url()/og image the page points at must exist.
  checkPageAssets(path, src, t);

  // Art declared on the registry and referenced by the page.
  if (g.art) checkArt(g.art, t, 'cover art');
  else t.warn('art', 'no cover art declared — the shelf falls back to the emoji cartridge');
  return { path, src, page };
}

function checkPageAssets(pagePath, src, t) {
  const dir = dirname(join(ROOT, pagePath));
  const refs = new Set();
  for (const m of src.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) refs.add(m[1]);
  for (const m of src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) refs.add(m[1]);
  for (const m of src.matchAll(/<source[^>]+srcset=["']([^"' ]+)["']/gi)) refs.add(m[1]);
  // Only literal image paths — template strings inside inline JS and SVG
  // fragment filters (url(%23n)) are not page assets.
  const local = [...refs].filter((r) =>
    !/^(https?:|data:|#|mailto:|blob:)/i.test(r) &&
    !/\$\{|\[|\]|%23/.test(r) &&
    /\.(jpe?g|png|webp|avif|svg|gif)(\?|#|$)/i.test(r));
  const missing = local.filter((r) => {
    const clean = r.split('?')[0].split('#')[0];
    return clean && !existsSync(resolve(dir, clean));
  });
  if (!local.length) t.ok('assets', 'no local images to check');
  else if (missing.length) t.fail('assets', `${missing.length} broken local reference(s): ${missing.slice(0, 4).join(', ')}`);
  else t.ok('assets', `${local.length} local image reference${local.length === 1 ? '' : 's'} resolve`);
}

function pageChecks(src, t) {
  const title = (src.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  if (!title.trim()) t.fail('page', 'no <title>');
  else t.ok('page', `title "${title.trim().slice(0, 60)}"`);

  const desc = src.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i);
  if (!desc || !desc[1].trim()) t.fail('page', 'no meta description');
  else t.ok('page', `description ${desc[1].length} chars`);

  if (!/<meta\s+name=["']viewport["']/i.test(src)) t.fail('page', 'no viewport meta — the page will not fit a phone');
  else t.ok('page', 'viewport meta');

  if (/cmc-auth-gate\.js/.test(src) && /CMC_GATE\.guard\(/.test(src)) t.ok('access', "account gate ('account') installed");
  else t.fail('access', 'missing cmc-auth-gate.js + CMC_GATE.guard(...) — the page is open to visitors');

  if (/drillSource[^\n]*brain-lounge|brain-lounge[^\n]*drillSource/.test(src)) t.ok('scores', 'posts runs to the shared board');
  else t.fail('scores', "no drillSource 'brain-lounge' — the run will not reach the Lounge leaderboard");

  if (!/CMC_NG|nameOf\(|cmcFriendlyNameFromEmail|CMC_NG_NO_EMAIL_AS_NAME/.test(src)) {
    t.warn('access', 'no email-is-not-a-name guard — a Gmail sign-in could show an address');
  } else t.ok('access', 'an email is never used as a display name');
  return { title };
}

function checkArt(artPath, t, label) {
  const p = artPath.replace(/^\.\//, '');
  const candidates = [p, `public/${p}`, `public/${p.replace(/^arcade\//, 'arcade/')}`];
  const found = candidates.find(file);
  if (found) {
    const kb = Math.round(statSync(join(ROOT, found)).size / 1024);
    if (kb > 400) t.warn('art', `${label} ${found} is ${kb} KB — compress it for phone data`);
    else t.ok('art', `${label} ${found} (${kb} KB)`);
  } else {
    t.fail('art', `${label} "${artPath}" does not exist`);
  }
}

/* ── 4. the lounge page itself ─────────────────────────────────────────── */
const lounge = game('brain-lounge', 'Brain Lounge page');
{
  const p = 'src/components/BrainLoungePage.tsx';
  if (!file(p)) lounge.fail('lounge', `${p} is missing`);
  else {
    const src = read(p);
    if (/from '\.\.\/games\/registry'/.test(src) && /BRAIN_GAMES\.map/.test(src)) lounge.ok('lounge', 'shelf renders straight from the registry');
    else lounge.fail('lounge', 'the shelf no longer maps BRAIN_GAMES — a new cartridge would not appear');
    if (/game\.art/.test(src)) lounge.ok('lounge', 'cartridges show cover art');
    else lounge.fail('lounge', 'cartridges ignore game.art — cover art would never render');
    if (/onBackHome|GlassPageBar/.test(src)) lounge.ok('lounge', 'back to CMC home from the lounge');
    else lounge.fail('lounge', 'no back-to-home control in the lounge');
    if (/LoungeLeaderboard/.test(src)) lounge.ok('lounge', 'leaderboard mounted');
    else lounge.warn('lounge', 'leaderboard is not mounted');
  }
}

/* ── 5. art sets used by individual games ──────────────────────────────── */
const artSets = [
  { label: 'Galica briefing', dir: 'public/arcade/art', files: ['galica-keyart.jpg', 'galica-sector-1.jpg', 'galica-sector-2.jpg', 'galica-sector-3.jpg', 'galica-sector-4.jpg'] },
  { label: 'Shared chrome', dir: 'public/assets/js', files: ['cmc-game-chrome.js'] },
];

/* ── run ───────────────────────────────────────────────────────────────── */
const full = [];
for (const g of games) {
  const t = checkRegistryShape(g);
  let page = null;
  if (g.status === 'live') {
    if (g.mode === 'react') checkReactTarget(g, t);
    if (g.mode === 'standalone' || g.mode === 'external') {
      const out = checkStandaloneTarget(g, t);
      page = out && out.page;
    }
  } else {
    t.ok('target', 'reserved bay — nothing to launch yet');
  }
  if (g.art && g.mode === 'react') checkArt(g.art, t, 'cover art');
  full.push({ ...g, page });
}

for (const set of artSets) {
  const t = game(set.label, set.label);
  for (const f of set.files) {
    const p = `${set.dir}/${f}`;
    if (file(p)) t.ok('art', p);
    else t.fail('art', `${p} is missing`);
  }
}

/* ── report ────────────────────────────────────────────────────────────── */
const totals = { ok: 0, warn: 0, fail: 0 };
for (const card of results) for (const c of card.checks) totals[c.status]++;

if (JSON_OUT) {
  console.log(JSON.stringify({ totals, results }, null, 2));
} else {
  const icon = { ok: '✓', warn: '!', fail: '✖' };
  console.log('\n  THE BRAIN LOUNGE — cartridge audit');
  console.log(`  ${games.filter((g) => g.status === 'live').length} live · ${games.filter((g) => g.status !== 'live').length} reserved\n`);
  for (const card of results) {
    const bad = card.checks.some((c) => c.status === 'fail');
    const warn = !bad && card.checks.some((c) => c.status === 'warn');
    if (QUIET && !bad && !warn) continue;
    console.log(`  ${bad ? '✖' : warn ? '!' : '✓'} ${card.title}  ${bad ? '' : ''}`.trimEnd());
    for (const c of card.checks) {
      console.log(`      ${icon[c.status]} ${c.name.padEnd(8)} ${c.detail}`);
    }
    console.log('');
  }
  console.log(`  ${totals.ok} ok · ${totals.warn} warning${totals.warn === 1 ? '' : 's'} · ${totals.fail} problem${totals.fail === 1 ? '' : 's'}\n`);
}

process.exit(totals.fail ? 1 : 0);
