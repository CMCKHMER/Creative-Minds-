/**
 * Firestore REST room client for Arena Chess 3D online duels.
 *
 * Deliberately NOT the Firestore SDK: the site's sessions live in
 * localStorage (REST sign-in flow + Google sessions mirrored there), and
 * the SDK's own auth state only knows about SDK-created sessions. The
 * REST channel rides the same getValidIdToken() pipeline as every other
 * drill write on the site, so BOTH sign-in flavours sit down at the same
 * table. Rules (firestore.rules → chess_rooms) apply identically.
 *
 * The board state is still derived: whoever moves appends SAN via a
 * masked update, both clients re-read the room and replay chess.js.
 */
import { FIREBASE_PROJECT_ID, getValidIdToken } from '../../../lib/firebaseAuth';
import type { GameResult } from './types';
import type { RoomData } from './online';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ── Firestore REST value helpers ────────────────────────────────────────

type FsValue = { stringValue?: string; integerValue?: string; nullValue?: null; arrayValue?: { values?: FsValue[] }; mapValue?: { fields?: Record<string, FsValue> }; timestampValue?: string };

function s(value: string): FsValue {
  return { stringValue: value };
}

function toFsResult(result: GameResult): FsValue {
  return { mapValue: { fields: { winner: s(result.winner), reason: s(result.reason) } } };
}

function fromFsResult(value: FsValue | undefined): GameResult | null {
  const winner = value?.mapValue?.fields?.winner?.stringValue;
  if (winner !== 'w' && winner !== 'b' && winner !== 'draw') return null;
  const reason = value?.mapValue?.fields?.reason?.stringValue;
  return { winner, reason: typeof reason === 'string' ? reason : 'unknown' };
}

/** Firestore document fields → RoomData (defensive against hostile shapes). */
export function parseRoom(fields: Record<string, FsValue> | undefined): RoomData | null {
  if (!fields) return null;
  const code = fields.code?.stringValue;
  const hostUid = fields.hostUid?.stringValue;
  if (!code || !hostUid) return null;
  const hostColor = fields.hostColor?.stringValue === 'b' ? 'b' : 'w';
  const statusRaw = fields.status?.stringValue;
  const status: RoomData['status'] =
    statusRaw === 'active' || statusRaw === 'finished' || statusRaw === 'closed' ? statusRaw : 'waiting';
  const moves = (fields.moves?.arrayValue?.values ?? [])
    .map((v) => v.stringValue)
    .filter((m): m is string => typeof m === 'string');
  const gameNo = Math.max(1, Math.floor(Number(fields.gameNo?.integerValue ?? '1') || 1));
  const drawOfferRaw = fields.drawOffer?.stringValue;
  return {
    code,
    hostUid,
    hostName: fields.hostName?.stringValue ?? 'Host',
    hostColor,
    guestUid: fields.guestUid?.stringValue ?? null,
    guestName: fields.guestName?.stringValue ?? null,
    status,
    moves,
    result: fromFsResult(fields.result),
    drawOffer: drawOfferRaw === 'w' || drawOfferRaw === 'b' ? drawOfferRaw : null,
    gameNo,
  };
}

/** Room patch → { fields, mask } for a masked REST update (create passes the full room). */
export function roomPatchToRest(patch: Partial<RoomData> & { updatedAt?: string }): { fields: Record<string, FsValue>; mask: string[] } {
  const fields: Record<string, FsValue> = {};
  const mask: string[] = [];
  const push = (path: string, value: FsValue) => {
    fields[path] = value;
    mask.push(path);
  };
  if (patch.code !== undefined) push('code', s(patch.code));
  if (patch.hostUid !== undefined) push('hostUid', s(patch.hostUid));
  if (patch.hostName !== undefined) push('hostName', s(patch.hostName));
  if (patch.hostColor !== undefined) push('hostColor', s(patch.hostColor));
  if (patch.guestUid !== undefined) push('guestUid', patch.guestUid === null ? { nullValue: null } : s(patch.guestUid));
  if (patch.guestName !== undefined) push('guestName', patch.guestName === null ? { nullValue: null } : s(patch.guestName));
  if (patch.status !== undefined) push('status', s(patch.status));
  if (patch.moves !== undefined) {
    push('moves', { arrayValue: patch.moves.length ? { values: patch.moves.map(s) } : {} });
  }
  if (patch.result !== undefined) push('result', patch.result === null ? { nullValue: null } : toFsResult(patch.result));
  if (patch.drawOffer !== undefined) push('drawOffer', patch.drawOffer === null ? { nullValue: null } : s(patch.drawOffer));
  if (patch.gameNo !== undefined) push('gameNo', { integerValue: String(patch.gameNo) });
  if (patch.updatedAt !== undefined) push('updatedAt', { timestampValue: patch.updatedAt });
  return { fields, mask };
}

// ── API calls ───────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const idToken = await getValidIdToken();
  if (!idToken) throw new RoomAuthError('signed-out');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
}

export class RoomAuthError extends Error {
  constructor(kind: 'signed-out' | 'denied') {
    super(kind);
    this.name = 'RoomAuthError';
  }
}

/** Read one room, or null when it does not exist (host closed/deleted it). */
export async function getRoom(code: string): Promise<RoomData | null> {
  const res = await fetch(`${FIRESTORE_BASE}/chess_rooms/${code}`, { headers: await authHeaders() });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) throw new RoomAuthError('denied');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  return parseRoom(data.fields);
}

/** Create the room document under an explicit 5-letter code. */
export async function createRoom(room: RoomData): Promise<void> {
  const { fields, mask } = roomPatchToRest({ ...room, updatedAt: new Date().toISOString() });
  const url = `${FIRESTORE_BASE}/chess_rooms?documentId=${encodeURIComponent(room.code)}`;
  const res = await fetch(url, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ fields }) });
  if (res.status === 401 || res.status === 403) throw new RoomAuthError('denied');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  void mask; // create writes every field by definition
}

/** Masked update — only the fields in the patch change, like updateDoc. */
export async function updateRoom(code: string, patch: Partial<RoomData> & { updatedAt?: string }): Promise<void> {
  const { fields, mask } = roomPatchToRest(patch);
  const url = `${FIRESTORE_BASE}/chess_rooms/${encodeURIComponent(code)}?currentDocument.exists=true&${mask
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&')}`;
  const res = await fetch(url, { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ fields }) });
  if (res.status === 401 || res.status === 403) throw new RoomAuthError('denied');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
}
