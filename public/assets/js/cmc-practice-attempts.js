/* ============================================================
   CMC PRACTICE ATTEMPTS — "Score Trajectory" for AI Phase 01.
   ------------------------------------------------------------
   Every scored response (writing or speaking) is saved to

     practice_attempts/{uid}/attempts/{attemptId}

   and read back as a small trend: the student sees the last few
   bands and whether they are moving.

   WHY A SUBCOLLECTION KEYED BY UID
     · a student can only ever write under their own uid (rules check
       it), so a score cannot be forged for a classmate;
     · reading "my last 8 attempts" needs no composite index — the
       parent path is already the filter;
     · a verified teacher can read any student's path for review.

   WHY localStorage CAN CARRY A SCORE
     A phone in a classroom loses signal. If the POST fails the attempt
     goes into an outbox and is flushed on the next page load, so a
     practice score is never silently lost (same idea as the kid
     homework outbox).

   This is a plain ES module: the static TOEFL pages import it directly
   and vitest imports the identical file.
   ============================================================ */

const PROJECT_ID = 'creative-minds-cambodia';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const API_KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
const OUTBOX_KEY = 'cmc-practice-outbox';
const OUTBOX_MAX = 20;

const SKILLS = ['writing', 'speaking'];

// ── session ─────────────────────────────────────────────────────────

function ls(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

/** { uid, token } for the signed-in student, or null. */
export function currentStudent() {
  if (typeof localStorage === 'undefined') return null;
  const uid = ls('cmc-student-uid');
  const token = ls('cmc-student-token');
  if (!uid || !token) return null;
  return { uid, token };
}

/** Refresh the ID token with the stored refresh token (securetoken grant). */
async function refreshToken() {
  const rt = ls('cmc-student-refresh-token');
  if (!rt) return null;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(rt)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.id_token) return null;
    lsSet('cmc-student-token', data.id_token);
    lsSet('cmc-student-token-expires', String(Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000));
    if (data.refresh_token) lsSet('cmc-student-refresh-token', data.refresh_token);
    return data.id_token;
  } catch {
    return null;
  }
}

/** A token that is valid for the next few minutes, or null. */
async function validToken() {
  const token = ls('cmc-student-token');
  const expiresAt = Number(ls('cmc-student-token-expires') || '0');
  if (token && expiresAt > Date.now() + 5 * 60_000) return token;
  return refreshToken();
}

// ── Firestore value mapping ─────────────────────────────────────────

function toFields(input) {
  const fields = {};
  const doubles = { band: input.band };
  const strings = { skill: input.skill, source: input.source, rubricVersion: input.rubricVersion };
  for (const [key, value] of Object.entries(doubles)) {
    if (Number.isFinite(value)) fields[key] = { doubleValue: value };
  }
  for (const [key, value] of Object.entries(strings)) {
    if (typeof value === 'string' && value) fields[key] = { stringValue: value.slice(0, 120) };
  }
  if (input.traits && typeof input.traits === 'object') {
    const map = {};
    for (const [trait, value] of Object.entries(input.traits)) {
      if (Number.isFinite(value)) map[trait] = { doubleValue: value };
    }
    fields.traits = { mapValue: { fields: map } };
  }
  if (input.stats && typeof input.stats === 'object') {
    const map = {};
    for (const [stat, value] of Object.entries(input.stats)) {
      if (Number.isFinite(value)) map[stat] = { doubleValue: value };
    }
    fields.stats = { mapValue: { fields: map } };
  }
  if (typeof input.text === 'string' && input.text.trim()) {
    fields.text = { stringValue: input.text.trim().slice(0, 4000) };
  }
  fields.uid = { stringValue: input.uid };
  fields.createdAt = { timestampValue: new Date(input.createdAt || Date.now()).toISOString() };
  return fields;
}

/** Firestore REST document -> plain attempt object. */
export function fromDocument(doc) {
  if (!doc || !doc.fields) return null;
  const f = doc.fields;
  const num = (v) => {
    if (!v) return 0;
    if (v.doubleValue != null) return Number(v.doubleValue);
    if (v.integerValue != null) return Number(v.integerValue);
    return 0;
  };
  const map = (v) => {
    const out = {};
    if (v && v.mapValue && v.mapValue.fields) {
      for (const [key, value] of Object.entries(v.mapValue.fields)) out[key] = num(value);
    }
    return out;
  };
  const timestamp = f.createdAt && f.createdAt.timestampValue ? Date.parse(f.createdAt.timestampValue) : 0;
  return {
    id: doc.name ? String(doc.name).split('/').pop() : '',
    skill: f.skill && f.skill.stringValue ? f.skill.stringValue : '',
    band: num(f.band),
    traits: map(f.traits),
    stats: map(f.stats),
    text: f.text && f.text.stringValue ? f.text.stringValue : '',
    source: f.source && f.source.stringValue ? f.source.stringValue : '',
    createdAt: Number.isFinite(timestamp) ? timestamp : 0,
  };
}

// ── trajectory ──────────────────────────────────────────────────────

/**
 * Build the trend a student sees.
 *
 * @param {Array<{band:number, createdAt:number}>} attempts
 * @param {{ limit?: number }} [options]
 * @returns {{
 *   count: number, points: Array<{band:number, createdAt:number}>,
 *   latest: number, previous: number, delta: number, best: number,
 *   direction: 'up'|'down'|'flat'|'first',
 * }}
 */
export function buildTrajectory(attempts, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 8;
  const clean = (Array.isArray(attempts) ? attempts : [])
    .filter((a) => a && Number.isFinite(a.band))
    .filter((a) => a.band >= 0 && a.band <= 5)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const points = clean.slice(-limit).map((a) => ({
    band: Math.round(a.band * 2) / 2,
    createdAt: a.createdAt || 0,
  }));

  if (!points.length) {
    return { count: 0, points: [], latest: 0, previous: 0, delta: 0, best: 0, direction: 'first' };
  }

  const latest = points[points.length - 1].band;
  const previous = points.length > 1 ? points[points.length - 2].band : 0;
  const delta = points.length > 1 ? Math.round((latest - previous) * 2) / 2 : 0;
  const best = points.reduce((max, p) => Math.max(max, p.band), 0);
  const direction = points.length < 2 ? 'first' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return { count: points.length, points, latest, previous, delta, best, direction };
}

const TONE = {
  up: '#10b981',
  down: '#f59e0b',
  flat: '#94a3b8',
  first: '#38bdf8',
};

/**
 * Self-contained markup for a trend line (inline styles on purpose: both
 * static pages and the app can drop it anywhere without a stylesheet).
 *
 * @param {ReturnType<typeof buildTrajectory>} traj
 * @param {{ label?: string, empty?: string, href?: string }} [options]
 */
export function trajectoryMarkup(traj, options = {}) {
  const label = options.label || 'Your last attempts';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  if (!traj || !traj.count) {
    return `<p class="cmc-traj-empty" style="margin:.5rem 0 0;font-size:.8125rem;line-height:1.55;color:#94a3b8">${
      esc(options.empty || 'No saved attempts yet — this score starts your trend.')
    }</p>`;
  }

  const bars = traj.points.map((p) => {
    const height = Math.max(6, Math.round((p.band / 5) * 34));
    return `<span title="${p.band.toFixed(1)} / 5" style="display:inline-block;width:8px;height:${height}px;border-radius:3px;background:${
      p === traj.points[traj.points.length - 1] ? 'var(--section-primary, #38bdf8)' : 'rgba(148,163,184,.45)'
    }"></span>`;
  }).join('');

  const deltaText = traj.direction === 'first'
    ? 'first attempt'
    : traj.delta === 0
      ? 'same as last time'
      : `${traj.delta > 0 ? '+' : ''}${traj.delta.toFixed(1)} vs last time`;

  const summary = `Latest ${traj.latest.toFixed(1)} out of 5, ${deltaText}, best ${traj.best.toFixed(1)}, ${traj.count} saved attempt${traj.count === 1 ? '' : 's'}.`;

  return `<div class="cmc-traj" role="group" aria-label="${esc(label)}: ${esc(summary)}"
    style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin:.75rem 0 0">
    <div style="min-width:8.5rem">
      <div style="font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8">${esc(label)}</div>
      <div style="display:flex;align-items:baseline;gap:.4rem;margin-top:.15rem">
        <strong style="font-size:1.35rem;line-height:1;color:#f8fafc">${traj.latest.toFixed(1)}</strong>
        <span style="font-size:.75rem;color:#94a3b8">/ 5</span>
        <span style="font-size:.75rem;font-weight:700;color:${TONE[traj.direction]}">${esc(deltaText)}</span>
      </div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:4px;height:36px" aria-hidden="true">${bars}</div>
    <div style="font-size:.75rem;color:#94a3b8">best ${traj.best.toFixed(1)} · ${traj.count} saved</div>
  </div>`;
}

// ── network ─────────────────────────────────────────────────────────

function outbox() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setOutbox(items) {
  lsSet(OUTBOX_KEY, JSON.stringify(items.slice(-OUTBOX_MAX)));
}

async function post(doc, token) {
  const res = await fetch(`${FIRESTORE_BASE}/practice_attempts/${encodeURIComponent(doc.uid)}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: toFields(doc) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err && err.error && err.error.message) || `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  return data && data.name ? String(data.name).split('/').pop() : null;
}

/**
 * Save one scored response. Never throws: a failure is queued and reported.
 *
 * @param {{ skill: 'writing'|'speaking', band: number,
 *           traits?: Record<string, number>, stats?: Record<string, number>,
 *           text?: string, source?: string, rubricVersion?: string,
 *           createdAt?: number }} input
 * @returns {Promise<{ id: string|null, queued: boolean, reason?: string }>}
 */
export async function saveAttempt(input) {
  if (typeof window === 'undefined') return { id: null, queued: false, reason: 'no-window' };
  const student = currentStudent();
  if (!student) return { id: null, queued: false, reason: 'signed-out' };
  if (!SKILLS.includes(input.skill)) return { id: null, queued: false, reason: 'bad-skill' };
  if (!Number.isFinite(input.band) || input.band < 0 || input.band > 5) {
    return { id: null, queued: false, reason: 'bad-band' };
  }

  const doc = {
    uid: student.uid,
    skill: input.skill,
    band: Math.round(input.band * 2) / 2,
    traits: input.traits || {},
    stats: input.stats || {},
    text: input.text || '',
    source: input.source || 'toefl-ibt',
    rubricVersion: input.rubricVersion || '',
    createdAt: input.createdAt || Date.now(),
  };

  try {
    const token = await validToken();
    if (!token) throw new Error('no-token');
    const id = await post(doc, token);
    return { id, queued: false };
  } catch (error) {
    const queue = outbox();
    queue.push(doc);
    setOutbox(queue);
    return { id: null, queued: true, reason: String(error && error.message ? error.message : error) };
  }
}

/** Retry anything the outbox is holding. Safe to call on every page load. */
export async function flushOutbox() {
  if (typeof window === 'undefined') return { sent: 0 };
  const queue = outbox();
  if (!queue.length) return { sent: 0 };
  const token = await validToken();
  if (!token) return { sent: 0 };
  const remaining = [];
  let sent = 0;
  for (const doc of queue) {
    try {
      await post(doc, token);
      sent += 1;
    } catch {
      remaining.push(doc);
    }
  }
  setOutbox(remaining);
  return { sent };
}

/**
 * Read the signed-in student's attempts (newest first).
 *
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<{id:string, skill:string, band:number, createdAt:number,
 *   traits:Record<string,number>, stats:Record<string,number>, text:string}>>}
 */
export async function loadAttempts(options = {}) {
  if (typeof window === 'undefined') return [];
  const student = currentStudent();
  if (!student) return [];
  const limit = Number.isFinite(options.limit) ? Math.min(100, options.limit) : 20;
  try {
    const token = await validToken();
    if (!token) return [];
    const res = await fetch(
      `${FIRESTORE_BASE}/practice_attempts/${encodeURIComponent(student.uid)}/attempts?pageSize=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const docs = Array.isArray(data.documents) ? data.documents : [];
    return docs
      .map(fromDocument)
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Convenience: load + build in one call. */
export async function loadTrajectory(options = {}) {
  const attempts = await loadAttempts({ limit: (options.limit || 8) * 3 });
  const filtered = options.skill ? attempts.filter((a) => a.skill === options.skill) : attempts;
  return { attempts: filtered, trajectory: buildTrajectory(filtered, { limit: options.limit }) };
}

export const ATTEMPTS_COLLECTION = 'practice_attempts';
export const ATTEMPTS_RUBRIC_VERSION = '1.0.0';

export default {
  currentStudent,
  saveAttempt,
  flushOutbox,
  loadAttempts,
  loadTrajectory,
  buildTrajectory,
  trajectoryMarkup,
  fromDocument,
  ATTEMPTS_COLLECTION,
  ATTEMPTS_RUBRIC_VERSION,
};
