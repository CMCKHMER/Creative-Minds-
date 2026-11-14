#!/usr/bin/env node
// seal_tests.mjs — keep answer keys OUT of the public bi-weekly test pages.
//
// WHY
//   The site is a static GitHub Pages deploy of a PUBLIC repository. Every
//   test page under public/biweek-planner/tests/ used to carry its answer
//   key in page source (the engine grades in the browser), and the teacher
//   gate is client-side only — so any student could read the answers with
//   "View source". Sealing fixes that without a server:
//
//     - the answers are ENCRYPTED into the page (window.CMC_SEAL) with the
//       school's PUBLIC key, which lives in this repo
//       (public/biweek-planner/answer-seal.pub.json);
//     - the matching PRIVATE key is NOT in the repo. It lives in Firestore at
//       teacher_secrets/answer-seal, which the security rules open to
//       verified teachers only;
//     - a teacher's browser fetches that key after sign-in and decrypts the
//       answers locally (public/biweek-planner/answer-seal.js), so preview,
//       instant grading and the dashboard scores work exactly as before;
//     - a student's browser never holds the answers: invite-link attempts
//       submit the raw answer sheet and the teacher's dashboard grades it.
//
//   Because sealing needs only the PUBLIC key, anyone (an editor, a script,
//   CI) can seal a new test. No secret is ever needed to author a page.
//
// USAGE
//   node scripts/seal_tests.mjs            seal every unsealed test page in
//                                          place + rebuild answer-seals.json
//   node scripts/seal_tests.mjs --open <slug> <key file>
//                                          print one test's answers as JSON
//   node scripts/seal_tests.mjs --check    exit 1 if any page still carries
//                                          plaintext answers or the bundle is
//                                          stale (run by the test suite, so
//                                          an unsealed page can never deploy)
//   node scripts/seal_tests.mjs --verify <private-key-file>
//                                          decrypt every seal and print a
//                                          digest per page (owner sanity check)
//   node scripts/seal_tests.mjs --init-key <private-key-file>
//                                          ONE-TIME: create a new key pair.
//                                          Writes the public half into the
//                                          repo and the private half to the
//                                          given path (keep it OUT of git).
//                                          Refuses to run when sealed pages
//                                          already exist (they would become
//                                          unreadable).
//
// WRITING A NEW TEST
//   Author the page exactly as before (answers inline in TEST_BANKS), then
//   run `npm run seal`. The script strips the answers, embeds the seal and
//   adds the unlock script tag. Commit the sealed page — never the plaintext.
//
// FORMAT (v1) — ECIES over P-256
//   shared  = ECDH(ephemeral private, school public)
//   key     = HKDF-SHA256(shared, salt = epk || schoolPub, info = "cmc-answer-seal-v1")
//   ct      = AES-256-GCM(key, iv, plaintext JSON, aad = slug)
//   seal    = { v:1, kid, epk, iv, ct }            (all base64url)
//   plaintext = { v:1, slug, banks:{bankId:[answer,…]}, expl?:{bankId:[text,…]},
//                 ra?:[[error,kind],…], rb?:[[n,…],…] }
//   An answer is a 0-based option index, or an array of them (multi-select).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const subtle = webcrypto.subtle;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLANNER_DIR = path.join(ROOT, 'public/biweek-planner');
const TESTS_DIR = path.join(PLANNER_DIR, 'tests');
const PUB_PATH = path.join(PLANNER_DIR, 'answer-seal.pub.json');
const BUNDLE_PATH = path.join(PLANNER_DIR, 'answer-seals.json');

const INFO = 'cmc-answer-seal-v1';
const KEY_PREFIX = 'cmcseal1.';
const SEAL_SCRIPT_TAG = '<script src="../answer-seal.js?v=1"></script>';
const INVITE_TAG_RE = /student-invite\.js\?v=\d+/g;
const INVITE_TAG = 'student-invite.js?v=3';
const ALLOWED_WINDOW_KEYS = new Set(['TEST_CONFIG', 'TEST_BANKS', 'RHETORICAL_A', 'RHETORICAL_B', 'AMAP_OFF', 'CMC_SEAL']);

// ── small helpers ────────────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => new Uint8Array(Buffer.from(String(s), 'base64url'));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
/** JSON that is safe inside an inline <script> block. */
const scriptJson = (value) => JSON.stringify(value)
  .replace(/<\//g, '<\\/')
  .replace(/<!--/g, '<\\!--')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

function listTestPages() {
  return fs.readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.html') && f !== '_template.html')
    .sort();
}

// ── crypto ───────────────────────────────────────────────────────────
function loadPublicKey() {
  if (!fs.existsSync(PUB_PATH)) {
    throw new Error(`No public key at ${path.relative(ROOT, PUB_PATH)} — run --init-key once first.`);
  }
  return JSON.parse(fs.readFileSync(PUB_PATH, 'utf8'));
}
function rawPublic(pub) {
  return concat(new Uint8Array([4]), unb64u(pub.x), unb64u(pub.y));
}
async function kidOf(rawPub) {
  const digest = new Uint8Array(await subtle.digest('SHA-256', rawPub));
  return Buffer.from(digest.slice(0, 8)).toString('hex');
}
async function aesKey(sharedBits, epkRaw, recipientRaw, usage) {
  const hk = await subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: concat(epkRaw, recipientRaw), info: enc.encode(INFO) },
    hk, { name: 'AES-GCM', length: 256 }, false, [usage],
  );
}
async function sealJson(pub, slug, payload) {
  const recipientRaw = rawPublic(pub);
  const recipient = await subtle.importKey('raw', recipientRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const epkRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey));
  const shared = await subtle.deriveBits({ name: 'ECDH', public: recipient }, eph.privateKey, 256);
  const key = await aesKey(shared, epkRaw, recipientRaw, 'encrypt');
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(slug) }, key, enc.encode(JSON.stringify(payload)),
  );
  return { v: 1, kid: pub.kid, epk: b64u(epkRaw), iv: b64u(iv), ct: b64u(new Uint8Array(ct)) };
}
async function importPrivate(pub, code) {
  const d = String(code || '').trim().replace(/^cmcseal1\./, '');
  return subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, d, ext: true },
    { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}
async function openSeal(pub, priv, slug, seal) {
  const recipientRaw = rawPublic(pub);
  const epkRaw = unb64u(seal.epk);
  const epk = await subtle.importKey('raw', epkRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: epk }, priv, 256);
  const key = await aesKey(shared, epkRaw, recipientRaw, 'decrypt');
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: unb64u(seal.iv), additionalData: enc.encode(slug) }, key, unb64u(seal.ct),
  );
  return JSON.parse(dec.decode(pt));
}

// ── page parsing ─────────────────────────────────────────────────────
function locateBlocks(html, file) {
  let data = null;
  let engine = null;
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    if (m[1].includes('CMC-TEMPLATE-V2')) engine = m;
    else if (m[1].includes('window.TEST_CONFIG')) data = m;
  }
  if (!data || !engine) throw new Error(`${file}: could not locate the TEST_CONFIG block and the engine block`);
  return { data, engine };
}
function evalData(body, file) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  try {
    vm.runInContext(body, sandbox, { filename: file });
  } catch (err) {
    throw new Error(`${file}: data block failed to evaluate — ${err.message}`);
  }
  // Round-trip through JSON so the objects belong to THIS realm and so any
  // non-JSON value (function, undefined) is caught here, not at runtime.
  const win = JSON.parse(JSON.stringify(sandbox.window));
  for (const key of Object.keys(win)) {
    if (!ALLOWED_WINDOW_KEYS.has(key)) {
      throw new Error(`${file}: unexpected window.${key} in the data block — teach seal_tests.mjs about it before sealing`);
    }
  }
  if (!win.TEST_CONFIG || !win.TEST_BANKS) throw new Error(`${file}: TEST_CONFIG / TEST_BANKS missing`);
  return win;
}

/** Bank ids the engine actually renders: `document.getElementById(id)`
 *  must exist — every config group gets a container, and a page may also
 *  carry static containers in its markup. */
function renderedBankIds(win, html) {
  const ids = new Set((win.TEST_CONFIG.groups || []).map((g) => g.id));
  for (const tid of Object.keys(win.TEST_BANKS)) {
    if (html.includes(`id="${tid}"`)) ids.add(tid);
  }
  return ids;
}

const isRecap = (win) => Object.prototype.hasOwnProperty.call(win, 'AMAP_OFF');
const recapDecode = (letter, off) => (String(letter).charCodeAt(0) - 65 - off + 52) % 26;
/** A cipher letter that decodes to option index 25 — never a real option. */
const recapPlaceholder = (off) => String.fromCharCode(65 + ((25 + off) % 26));

const PLACEHOLDER_SINGLE = -1;
const PLACEHOLDER_MULTI = ['?'];

/** True when a bank row still carries a real answer. */
function rowIsPlain(row, win) {
  const a = row[2];
  if (isRecap(win)) return a !== recapPlaceholder(win.AMAP_OFF || 7) || (row.length > 3 && row[3] !== '');
  if (Array.isArray(a)) return !(a.length === 1 && a[0] === '?');
  return a !== PLACEHOLDER_SINGLE;
}
function pageHasPlaintext(win) {
  for (const rows of Object.values(win.TEST_BANKS)) {
    for (const row of rows) if (rowIsPlain(row, win)) return true;
  }
  for (const r of win.RHETORICAL_A || []) if (!(r[1] === 0 && r[2] === PLACEHOLDER_SINGLE)) return true;
  for (const r of win.RHETORICAL_B || []) if (!(Array.isArray(r[1]) && r[1].length === 1 && r[1][0] === '?')) return true;
  return false;
}

/** Pull the answers out of the evaluated data and replace them in place
 *  with placeholders that can never match a student's selection. */
function extractAndStrip(win, html, slug) {
  const rendered = renderedBankIds(win, html);
  const recap = isRecap(win);
  const off = win.AMAP_OFF || 7;
  const payload = { v: 1, slug, banks: {} };
  const expl = {};
  let count = 0;

  for (const [tid, rows] of Object.entries(win.TEST_BANKS)) {
    const keep = rendered.has(tid);
    const answers = [];
    const why = [];
    for (const row of rows) {
      const raw = row[2];
      if (recap) {
        if (typeof raw !== 'string' || raw.length !== 1) throw new Error(`${slug}: bank ${tid} has a non-letter recap answer`);
        const idx = recapDecode(raw, off);
        if (idx < 0 || idx >= row[1].length) throw new Error(`${slug}: bank ${tid} recap answer decodes outside the options`);
        answers.push(idx);
        why.push(typeof row[3] === 'string' ? row[3] : '');
        row[2] = recapPlaceholder(off);
        if (row.length > 3) row[3] = '';
      } else if (Array.isArray(raw)) {
        if (!raw.length || raw.some((n) => !Number.isInteger(n) || n < 0 || n >= row[1].length)) {
          throw new Error(`${slug}: bank ${tid} has a bad multi-select answer`);
        }
        answers.push(raw.slice().sort((a, b) => a - b));
        row[2] = PLACEHOLDER_MULTI.slice();
      } else {
        if (!Number.isInteger(raw) || raw < 0 || raw >= row[1].length) {
          throw new Error(`${slug}: bank ${tid} has a bad answer index (${JSON.stringify(raw)})`);
        }
        answers.push(raw);
        row[2] = PLACEHOLDER_SINGLE;
      }
    }
    if (keep) {
      payload.banks[tid] = answers;
      count += answers.length;
      if (recap && why.some(Boolean)) expl[tid] = why;
    }
  }
  if (Object.keys(expl).length) payload.expl = expl;

  if (win.RHETORICAL_A) {
    payload.ra = win.RHETORICAL_A.map((r) => [r[1], r[2]]);
    count += payload.ra.length;
    for (const r of win.RHETORICAL_A) { r[1] = 0; r[2] = PLACEHOLDER_SINGLE; }
  }
  if (win.RHETORICAL_B) {
    payload.rb = win.RHETORICAL_B.map((r) => (Array.isArray(r[1]) ? r[1].slice() : [r[1]]));
    count += payload.rb.length;
    for (const r of win.RHETORICAL_B) r[1] = PLACEHOLDER_MULTI.slice();
  }
  if (!count) throw new Error(`${slug}: no gradable questions found — refusing to seal an empty key`);
  return { payload, count };
}

function serializeData(win) {
  const lines = [''];
  if (isRecap(win)) lines.push(`window.AMAP_OFF=${Number(win.AMAP_OFF)};`);
  lines.push(`window.TEST_CONFIG=${scriptJson(win.TEST_CONFIG)};`);
  lines.push(`window.TEST_BANKS=${scriptJson(win.TEST_BANKS)};`);
  if (win.RHETORICAL_A) lines.push(`window.RHETORICAL_A=${scriptJson(win.RHETORICAL_A)};`);
  if (win.RHETORICAL_B) lines.push(`window.RHETORICAL_B=${scriptJson(win.RHETORICAL_B)};`);
  lines.push('// Answers are sealed (scripts/seal_tests.mjs) — only a verified teacher session can open them.');
  lines.push(`window.CMC_SEAL=${scriptJson(win.CMC_SEAL)};`);
  lines.push('');
  return lines.join('\n');
}

// The recap engine shuffles questions and options on every load, so the
// unlock script needs to know which bank row each card came from and how
// its options were reordered. Three exact, idempotent source edits.
const RECAP_PATCHES = [
  ['function addQ(target, prompt, choices, answerIdx, expl) {',
    'function addQ(target, prompt, choices, answerIdx, expl, sid) {'],
  ['  card.dataset.answer = String(newAns);\n',
    "  card.dataset.answer = String(newAns);\n  card.dataset.order = order.join(',');\n  if (sid) card.dataset.sid = sid;\n"],
  ["    addQ(target, r[0], r[1], decAns(r[2]), r[3] || '');",
    "    addQ(target, r[0], r[1], decAns(r[2]), r[3] || '', tid + ':' + ri);"],
  ['//   - answer key obfuscated in source (letter cipher, offset @@AMAP_OFF@@)',
    '//   - answer key SEALED: not present in page source (see answer-seal.js)'],
];
function patchRecapEngine(engineBody, file) {
  let out = engineBody;
  for (const [from, to] of RECAP_PATCHES) {
    if (out.includes(to)) continue;
    if (!out.includes(from)) throw new Error(`${file}: recap engine does not match the expected source — patch it by hand`);
    out = out.replace(from, to);
  }
  return out;
}

function withTags(html) {
  let out = html.replace(INVITE_TAG_RE, INVITE_TAG);
  if (!out.includes(SEAL_SCRIPT_TAG)) {
    const { engine } = locateBlocks(out, 'page');
    const end = engine.index + engine[0].length;
    out = `${out.slice(0, end)}\n${SEAL_SCRIPT_TAG}${out.slice(end)}`;
  }
  return out;
}

// ── commands ─────────────────────────────────────────────────────────
function readPage(file) {
  const html = fs.readFileSync(path.join(TESTS_DIR, file), 'utf8');
  const blocks = locateBlocks(html, file);
  const win = evalData(blocks.data[1], file);
  return { html, blocks, win, slug: file.replace(/\.html$/, '') };
}

function buildBundle(pub, seals) {
  const sorted = {};
  for (const slug of Object.keys(seals).sort()) {
    const { epk, iv, ct } = seals[slug];
    sorted[slug] = { epk, iv, ct };
  }
  return `${JSON.stringify({ v: 1, kid: pub.kid, seals: sorted }, null, 1)}\n`;
}

async function cmdSeal() {
  const pub = loadPublicKey();
  const seals = {};
  let sealedNow = 0;
  for (const file of listTestPages()) {
    const page = readPage(file);
    let { html } = page;
    const { win, slug } = page;
    if (win.CMC_SEAL && !pageHasPlaintext(win)) {
      if (win.CMC_SEAL.kid !== pub.kid) throw new Error(`${file}: sealed with a different key (${win.CMC_SEAL.kid}) than the repo's public key (${pub.kid})`);
      seals[slug] = win.CMC_SEAL;
    } else {
      const { payload, count } = extractAndStrip(win, html, slug);
      win.CMC_SEAL = await sealJson(pub, slug, payload);
      seals[slug] = win.CMC_SEAL;
      const { data } = page.blocks;
      html = `${html.slice(0, data.index)}<script>${serializeData(win)}</script>${html.slice(data.index + data[0].length)}`;
      sealedNow += 1;
      console.log(`  sealed ${file} (${count} answers)`);
    }
    if (isRecap(win)) {
      const { engine } = locateBlocks(html, file);
      const patched = patchRecapEngine(engine[1], file);
      if (patched !== engine[1]) {
        html = `${html.slice(0, engine.index)}<script>${patched}</script>${html.slice(engine.index + engine[0].length)}`;
      }
    }
    html = withTags(html);
    if (html !== page.html) fs.writeFileSync(path.join(TESTS_DIR, file), html);
  }
  const bundle = buildBundle(pub, seals);
  const before = fs.existsSync(BUNDLE_PATH) ? fs.readFileSync(BUNDLE_PATH, 'utf8') : '';
  if (bundle !== before) fs.writeFileSync(BUNDLE_PATH, bundle);
  console.log(`${sealedNow} page(s) sealed now, ${Object.keys(seals).length} sealed in total; bundle ${bundle === before ? 'unchanged' : 'rewritten'}.`);
}

function cmdCheck() {
  const problems = [];
  let pub = null;
  try { pub = loadPublicKey(); } catch (err) { problems.push(err.message); }
  if (pub && Object.prototype.hasOwnProperty.call(pub, 'd')) problems.push('answer-seal.pub.json contains a PRIVATE key field ("d") — remove it and rotate the key.');
  const seals = {};
  for (const file of listTestPages()) {
    try {
      const { html, win, slug } = readPage(file);
      if (pageHasPlaintext(win)) { problems.push(`${file}: carries plaintext answers — run "npm run seal"`); continue; }
      if (!win.CMC_SEAL) { problems.push(`${file}: has no seal — run "npm run seal"`); continue; }
      if (pub && win.CMC_SEAL.kid !== pub.kid) problems.push(`${file}: sealed with key ${win.CMC_SEAL.kid}, repo public key is ${pub.kid}`);
      if (!html.includes(SEAL_SCRIPT_TAG)) problems.push(`${file}: missing the answer-seal.js script tag — run "npm run seal"`);
      if (!html.includes(INVITE_TAG)) problems.push(`${file}: must load ${INVITE_TAG} (older invite scripts cannot submit a sealed test)`);
      if (isRecap(win) && !html.includes('card.dataset.order')) problems.push(`${file}: recap engine is missing the seal hooks — run "npm run seal"`);
      seals[slug] = win.CMC_SEAL;
    } catch (err) {
      problems.push(err.message);
    }
  }
  if (pub) {
    const want = buildBundle(pub, seals);
    const have = fs.existsSync(BUNDLE_PATH) ? fs.readFileSync(BUNDLE_PATH, 'utf8') : '';
    if (want !== have) problems.push('answer-seals.json is out of date — run "npm run seal"');
  }
  if (problems.length) {
    console.error(`Answer-seal check FAILED (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`Answer-seal check passed: ${Object.keys(seals).length} test pages sealed, none carries a plaintext answer.`);
}

async function cmdVerify(privatePath) {
  if (!privatePath) throw new Error('Usage: --verify <private-key-file>');
  const pub = loadPublicKey();
  const priv = await importPrivate(pub, readPrivate(privatePath));
  const check = await openSeal(pub, priv, 'check', pub.check);
  if (check.ok !== true) throw new Error('The private key does not match the repo public key.');
  let total = 0;
  for (const file of listTestPages()) {
    const { win, slug } = readPage(file);
    const payload = await openSeal(pub, priv, slug, win.CMC_SEAL);
    const n = Object.values(payload.banks).reduce((a, b) => a + b.length, 0) + (payload.ra || []).length + (payload.rb || []).length;
    total += n;
    console.log(`  ${file.padEnd(32)} ${String(n).padStart(3)} answers`);
  }
  console.log(`All ${listTestPages().length} seals open with this key (${total} answers).`);
}

/** Print one test's opened answers as JSON (used by make_private_test.mjs). */
async function cmdOpen(slug, privatePath) {
  if (!slug || !privatePath) throw new Error('Usage: --open <slug> <private-key-file>');
  const pub = loadPublicKey();
  const priv = await importPrivate(pub, readPrivate(privatePath));
  const { win } = readPage(`${slug}.html`);
  if (!win.CMC_SEAL) throw new Error(`${slug}: page is not sealed`);
  process.stdout.write(JSON.stringify(await openSeal(pub, priv, slug, win.CMC_SEAL)));
}

function readPrivate(privatePath) {
  const text = fs.readFileSync(privatePath, 'utf8').trim();
  try { return JSON.parse(text).key; } catch { return text; }
}

async function cmdInitKey(privatePath) {
  if (!privatePath) throw new Error('Usage: --init-key <private-key-file>   (a path OUTSIDE version control)');
  const already = listTestPages().some((file) => /window\.CMC_SEAL=/.test(fs.readFileSync(path.join(TESTS_DIR, file), 'utf8')));
  if (already) throw new Error('Sealed pages already exist. A new key pair would make them unreadable — refusing.');
  if (fs.existsSync(privatePath)) throw new Error(`${privatePath} already exists — refusing to overwrite a private key.`);
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  const pub = { v: 1, alg: 'ECDH-P256 + HKDF-SHA256 + AES-256-GCM', x: jwk.x, y: jwk.y };
  pub.kid = await kidOf(rawPublic(pub));
  pub.check = await sealJson(pub, 'check', { ok: true });
  delete pub.check.v; delete pub.check.kid;
  const ordered = { v: pub.v, alg: pub.alg, kid: pub.kid, x: pub.x, y: pub.y, check: pub.check };
  fs.writeFileSync(PUB_PATH, `${JSON.stringify(ordered, null, 1)}\n`);
  fs.mkdirSync(path.dirname(path.resolve(privatePath)), { recursive: true });
  fs.writeFileSync(privatePath, `${JSON.stringify({ kid: pub.kid, key: KEY_PREFIX + jwk.d }, null, 1)}\n`, { mode: 0o600 });
  console.log(`Key pair created (kid ${pub.kid}).`);
  console.log(`  public  → ${path.relative(ROOT, PUB_PATH)} (commit this)`);
  console.log(`  private → ${privatePath} (NEVER commit this; install it in Firestore teacher_secrets/answer-seal)`);
}

const [cmd, arg, arg2] = process.argv.slice(2);
try {
  if (cmd === '--check') cmdCheck();
  else if (cmd === '--verify') await cmdVerify(arg);
  else if (cmd === '--init-key') await cmdInitKey(arg);
  else if (cmd === '--open') await cmdOpen(arg, arg2);
  else if (!cmd) await cmdSeal();
  else throw new Error(`Unknown option ${cmd}`);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
