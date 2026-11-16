// Profile picture — a photo the user uploads, or one of the built-in avatars.
//
// Owner request (Nov 2026): "give signed in users an option panel that allows
// them to upload a photo or avatar."
//
// Where it lives: one small document per account, `user_avatars/{uid}`.
//   kind   'photo' | 'preset'
//   photo  a data: URL — the picture itself, shrunk in the browser to a
//          160 px square JPEG (a few kilobytes) before it is sent. Nothing is
//          uploaded at its original size, and no file storage is involved.
//   preset the id of a built-in avatar (see AVATAR_PRESETS)
//
// Who can see it: only the account itself (and the site owner, who can remove
// a picture). Many users are children, so a photo is private until the owner
// decides where else it should appear. See the user_avatars block in
// firestore.rules.
//
// The pure parts (presets, validation, sizing math) have no DOM and no
// network, so they are unit-tested; the canvas and REST parts sit below.

import { getProjectId, getValidIdToken } from './firebaseAuth';

export interface AvatarPreset {
  id: string;
  /** Shown to screen readers and as the tooltip. */
  label: string;
  /** Two colours of the disc behind the drawing. */
  from: string;
  to: string;
}

/** Built-in avatars: no upload, no photo of the child. Each is a drawing from
 *  the site's own icon set (AvatarBadge maps the id to it), not an emoji, so
 *  it looks the same on every phone and computer. Ids are stored, so never
 *  rename one — add new ones at the end. */
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'cat', label: 'Cat', from: '#fb923c', to: '#e11d48' },
  { id: 'dog', label: 'Dog', from: '#fbbf24', to: '#c2410c' },
  { id: 'rabbit', label: 'Rabbit', from: '#f9a8d4', to: '#be185d' },
  { id: 'bird', label: 'Bird', from: '#38bdf8', to: '#1d4ed8' },
  { id: 'fish', label: 'Fish', from: '#22d3ee', to: '#0f766e' },
  { id: 'turtle', label: 'Turtle', from: '#4ade80', to: '#047857' },
  { id: 'squirrel', label: 'Squirrel', from: '#fdba74', to: '#9a3412' },
  { id: 'panda', label: 'Panda', from: '#94a3b8', to: '#1e293b' },
  { id: 'rocket', label: 'Rocket', from: '#818cf8', to: '#be185d' },
  { id: 'star', label: 'Star', from: '#facc15', to: '#d97706' },
  { id: 'book', label: 'Book', from: '#34d399', to: '#0e7490' },
  { id: 'palette', label: 'Palette', from: '#f472b6', to: '#6d28d9' },
  { id: 'music', label: 'Music', from: '#c084fc', to: '#0369a1' },
  { id: 'robot', label: 'Robot', from: '#67e8f9', to: '#334155' },
  { id: 'flower', label: 'Flower', from: '#fda4af', to: '#9d174d' },
  { id: 'trophy', label: 'Trophy', from: '#fcd34d', to: '#b45309' },
];

export const presetById = (id: string | null | undefined): AvatarPreset | null =>
  AVATAR_PRESETS.find((p) => p.id === id) ?? null;

export type Avatar =
  | { kind: 'photo'; photo: string }
  | { kind: 'preset'; preset: string };

/** Side of the stored square, in pixels. */
export const AVATAR_SIZE = 160;
/** Largest data: URL the database accepts (the rules check the same number). */
export const AVATAR_MAX_CHARS = 90_000;
/** Largest file a user may pick. Bigger files are refused before decoding. */
export const AVATAR_MAX_FILE_BYTES = 12 * 1024 * 1024;

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

/** True for a picture this module would store: a small base64 image. */
export function isAvatarDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= AVATAR_MAX_CHARS && DATA_URL.test(value);
}

/** Read a stored record (database document or cache) — null when it is not a usable avatar. */
export function parseAvatar(raw: unknown): Avatar | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === 'photo') return isAvatarDataUrl(r.photo) ? { kind: 'photo', photo: r.photo } : null;
  if (r.kind === 'preset') return typeof r.preset === 'string' && presetById(r.preset) ? { kind: 'preset', preset: r.preset } : null;
  return null;
}

/** The centred square to cut from a picture of this size, so nothing is stretched.
 *  `zoom` 1 keeps as much as fits; 2 shows the middle half. `dx`/`dy` slide the
 *  square from -1 (left / top edge) to 1 (right / bottom edge). */
export function cropSquare(width: number, height: number, zoom = 1, dx = 0, dy = 0): { sx: number; sy: number; side: number } {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const z = Math.min(4, Math.max(1, zoom || 1));
  const side = Math.min(w, h) / z;
  const clamp = (v: number) => Math.min(1, Math.max(-1, v || 0));
  const sx = (w - side) / 2 * (1 + clamp(dx));
  const sy = (h - side) / 2 * (1 + clamp(dy));
  return { sx, sy, side };
}

/** Why a picked file cannot be used — null when it can. */
export function fileProblem(file: { type: string; size: number }): string | null {
  if (!/^image\//i.test(file.type)) return 'That file is not a picture. Choose a photo (JPG, PNG or similar).';
  if (file.size > AVATAR_MAX_FILE_BYTES) return 'That picture is too large. Choose one under 12 MB.';
  return null;
}

// ── browser: decode, crop, shrink ───────────────────────────────────────

/** Decode a picked file to something a canvas can draw. */
export async function loadPicture(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` applies the phone's rotation, so portraits are not sideways
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('This picture could not be opened. Try another one.'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Draw the chosen square at AVATAR_SIZE and return it as a small JPEG data: URL. */
export function renderAvatar(
  picture: { source: CanvasImageSource; width: number; height: number },
  crop: { zoom?: number; dx?: number; dy?: number } = {},
): string {
  const { sx, sy, side } = cropSquare(picture.width, picture.height, crop.zoom, crop.dx, crop.dy);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot prepare the picture.');
  // a transparent PNG would turn black as a JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(picture.source, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  for (const quality of [0.86, 0.74, 0.6, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (isAvatarDataUrl(url)) return url;
  }
  throw new Error('This picture could not be made small enough. Try another one.');
}

// ── this device: remember the picture so it shows at once ───────────────

const cacheKey = (uid: string) => `cmc-avatar:${uid}`;
export const AVATAR_EVENT = 'cmc-avatar-changed';

export function readCachedAvatar(uid: string): Avatar | null {
  if (!uid) return null;
  try { return parseAvatar(JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null')); } catch { return null; }
}

function writeCachedAvatar(uid: string, avatar: Avatar | null): void {
  try {
    if (avatar) localStorage.setItem(cacheKey(uid), JSON.stringify(avatar));
    else localStorage.removeItem(cacheKey(uid));
  } catch { /* storage is full or off: the picture still shows from the database */ }
  try { window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { uid } })); } catch { /* non-DOM */ }
}

// ── the database ────────────────────────────────────────────────────────

export class AvatarError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const docUrl = (uid: string) =>
  `https://firestore.googleapis.com/v1/projects/${getProjectId()}/databases/(default)/documents/user_avatars/${encodeURIComponent(uid)}`;

async function call(uid: string, init?: RequestInit): Promise<Response> {
  const token = await getValidIdToken();
  if (!token) throw new AvatarError(401, 'Your session has ended. Sign in again, then choose your picture.');
  try {
    return await fetch(docUrl(uid), {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AvatarError(0, 'No connection. Check the internet and try again.');
  }
}

function explain(status: number): string {
  if (status === 403) return 'The picture was refused by the database. If you have just signed up, confirm your email first; otherwise tell your teacher.';
  if (status === 429) return 'The site is busy right now. Try again in a little while.';
  return 'The picture could not be saved just now. Try again.';
}

/** The picture stored for this account, or null. Also refreshes this device's copy. */
export async function loadAvatar(uid: string): Promise<Avatar | null> {
  const res = await call(uid);
  if (res.status === 404) { writeCachedAvatar(uid, null); return null; }
  if (!res.ok) throw new AvatarError(res.status, explain(res.status));
  const doc = await res.json() as { fields?: Record<string, { stringValue?: string }> };
  const f = doc.fields ?? {};
  const avatar = parseAvatar({ kind: f.kind?.stringValue, photo: f.photo?.stringValue, preset: f.preset?.stringValue });
  writeCachedAvatar(uid, avatar);
  return avatar;
}

/** Store the picture for this account (replaces the one before). */
export async function saveAvatar(uid: string, avatar: Avatar): Promise<void> {
  const clean = parseAvatar(avatar);
  if (!clean) throw new AvatarError(400, 'That picture cannot be used. Choose another one.');
  const fields = {
    uid: { stringValue: uid },
    kind: { stringValue: clean.kind },
    photo: { stringValue: clean.kind === 'photo' ? clean.photo : '' },
    preset: { stringValue: clean.kind === 'preset' ? clean.preset : '' },
    updatedAt: { timestampValue: new Date().toISOString() },
  };
  const res = await call(uid, { method: 'PATCH', body: JSON.stringify({ fields }) });
  if (!res.ok) throw new AvatarError(res.status, explain(res.status));
  writeCachedAvatar(uid, clean);
}

/** Remove the picture: the account goes back to its initial. */
export async function removeAvatar(uid: string): Promise<void> {
  const res = await call(uid, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new AvatarError(res.status, explain(res.status));
  writeCachedAvatar(uid, null);
}
