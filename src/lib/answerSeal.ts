// Answer seal — teacher-side opening and grading of the bi-weekly tests.
//
// The test pages under public/biweek-planner/tests/ no longer carry their
// answer keys: scripts/seal_tests.mjs encrypts them with the school's public
// key, and the matching private key lives only in Firestore
// (teacher_secrets/answer-seal, readable by verified teachers per the
// security rules). Students' browsers therefore submit a raw answer sheet,
// and THIS module — running on the teacher's device — opens the key and
// works out the score.
//
// Everything here is pure (no network, no storage) so it runs unchanged in
// the browser and in the test suite. Fetching the key code and the sealed
// bundle is done by the caller (see BiWeeklyTestsPanel / testDb).
//
// Format v1 (must stay in step with scripts/seal_tests.mjs and
// public/biweek-planner/answer-seal.js):
//   shared = ECDH P-256 (ephemeral key in the seal × school private key)
//   key    = HKDF-SHA256(shared, salt = epk ‖ schoolPublic, info below)
//   answer = AES-256-GCM(key, iv, aad = test slug)

const INFO = 'cmc-answer-seal-v1';
const CODE_PREFIX = 'cmcseal1.';

export interface SealBlob {
  epk: string;
  iv: string;
  ct: string;
  kid?: string;
}

export interface SealPublicKey {
  kid: string;
  x: string;
  y: string;
  /** A sealed `{ ok: true }` — lets a key code be validated before use. */
  check: SealBlob;
}

export interface SealBundle {
  kid: string;
  seals: Record<string, SealBlob>;
}

export type SealAnswer = number | number[];

export interface SealPayload {
  v: number;
  slug: string;
  /** bankId → the answer of each row (0-based option index, or several). */
  banks: Record<string, SealAnswer[]>;
  expl?: Record<string, string[]>;
  /** Rhetorical part A: [error number, kind] per row. */
  ra?: [number, number][];
  /** Rhetorical part B: the ticked numbers per row. */
  rb?: number[][];
}

/** question id ("<bankId>:<row>", "RA:<row>", "RB:<row>") → normalized answer */
export type AnswerKeyMap = Record<string, string>;

export interface SheetGrade {
  correct: number;
  total: number;
  answered: number;
  pct: number;
}

// ── encoding helpers ─────────────────────────────────────────────────

function unb64u(value: string): Uint8Array<ArrayBuffer> {
  let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const utf8 = (text: string): Uint8Array<ArrayBuffer> => {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
};

/** Accepts the code with or without its "cmcseal1." prefix and stray spaces. */
export function cleanSealCode(code: string): string {
  return code.trim().replace(/\s+/g, '').replace(/^cmcseal1\./i, '');
}

/** The form a code is stored and shown in. */
export function formatSealCode(code: string): string {
  return CODE_PREFIX + cleanSealCode(code);
}

// ── answers ──────────────────────────────────────────────────────────

/** The page engine's comparison form: one index → "2"; a multi-select →
 *  its values as strings, sorted (as strings), joined with "|". */
export function normalizeAnswer(answer: SealAnswer): string {
  return Array.isArray(answer) ? answer.map(String).sort().join('|') : String(answer);
}

export function keyMapOf(payload: SealPayload): AnswerKeyMap {
  const map: AnswerKeyMap = {};
  for (const [bankId, answers] of Object.entries(payload.banks ?? {})) {
    answers.forEach((answer, row) => {
      map[`${bankId}:${row}`] = normalizeAnswer(answer);
    });
  }
  (payload.ra ?? []).forEach((pair, row) => {
    map[`RA:${row}`] = `${pair[0]}:${pair[1]}`;
  });
  (payload.rb ?? []).forEach((ticks, row) => {
    map[`RB:${row}`] = normalizeAnswer(ticks);
  });
  return map;
}

/** Parse the `sheet` field a sealed attempt carries: `{"v":1,"a":{id:value}}`. */
export function parseSheet(sheet: string | null | undefined): Record<string, string> | null {
  if (!sheet) return null;
  try {
    const parsed = JSON.parse(sheet) as { a?: unknown };
    if (!parsed || typeof parsed.a !== 'object' || parsed.a === null) return null;
    const out: Record<string, string> = {};
    for (const [id, value] of Object.entries(parsed.a as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number') out[id] = String(value);
    }
    return out;
  } catch {
    return null;
  }
}

/** Grade a raw answer sheet against an opened key. Unanswered and unknown
 *  questions count as incorrect; the total is always the key's size, so a
 *  student cannot shrink the denominator by leaving questions out. */
export function gradeSheet(sheet: Record<string, string>, key: AnswerKeyMap): SheetGrade {
  const ids = Object.keys(key);
  let correct = 0;
  let answered = 0;
  for (const id of ids) {
    const given = sheet[id];
    if (given === undefined || given === '') continue;
    answered += 1;
    if (given === key[id]) correct += 1;
  }
  const total = ids.length;
  return { correct, total, answered, pct: total ? Math.round((correct / total) * 100) : 0 };
}

// ── crypto ───────────────────────────────────────────────────────────

const ECDH: EcKeyImportParams = { name: 'ECDH', namedCurve: 'P-256' };

function rawPublic(pub: Pick<SealPublicKey, 'x' | 'y'>): Uint8Array<ArrayBuffer> {
  return concat(new Uint8Array([4]), unb64u(pub.x), unb64u(pub.y));
}

async function importPrivate(pub: SealPublicKey, code: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y, d: cleanSealCode(code), ext: true },
    ECDH,
    false,
    ['deriveBits'],
  );
}

async function decrypt(pub: SealPublicKey, priv: CryptoKey, slug: string, seal: SealBlob): Promise<unknown> {
  const recipientRaw = rawPublic(pub);
  const epkRaw = unb64u(seal.epk);
  const epk = await crypto.subtle.importKey('raw', epkRaw, ECDH, false, []);
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: epk }, priv, 256);
  const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: concat(epkRaw, recipientRaw), info: utf8(INFO) },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64u(seal.iv), additionalData: utf8(slug) },
    key,
    unb64u(seal.ct),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

/** True when `code` is the private half of the site's public key. Never
 *  throws: a malformed or foreign code is simply `false`. */
export async function sealCodeMatches(pub: SealPublicKey, code: string): Promise<boolean> {
  try {
    const priv = await importPrivate(pub, code);
    const check = (await decrypt(pub, priv, 'check', pub.check)) as { ok?: unknown };
    return check?.ok === true;
  } catch {
    return false;
  }
}

/** Open one test's seal. Throws when the code does not open it. */
export async function openSeal(pub: SealPublicKey, code: string, slug: string, seal: SealBlob): Promise<SealPayload> {
  const priv = await importPrivate(pub, code);
  return (await decrypt(pub, priv, slug, seal)) as SealPayload;
}

/** Open the key of one test from the sealed bundle → question id → answer. */
export async function openAnswerKey(
  pub: SealPublicKey,
  bundle: SealBundle,
  code: string,
  slug: string,
): Promise<AnswerKeyMap | null> {
  const seal = bundle.seals[slug];
  if (!seal) return null;
  return keyMapOf(await openSeal(pub, code, slug, seal));
}
