/*
 * The newest announcement titles, for the first card on the home page.
 *
 * The board itself (components/AnnouncementBoard.tsx) now lives on its own
 * page, so this small reader keeps the news in front of every visitor: it asks
 * Firestore for three fields only (never the post body or its picture, which
 * can be most of a megabyte) and returns pinned posts first, then newest.
 */
import { FIREBASE_PROJECT_ID } from './firebaseAuth';

export interface AnnouncementTeaser {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: number;
}

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/** Same page size as the board, so a pinned older post is not missed. */
const PAGE_SIZE = 50;

export function teaserUrl(): string {
  const mask = ['title', 'pinned', 'createdAt'].map((field) => `mask.fieldPaths=${field}`).join('&');
  return `${BASE}/announcements?pageSize=${PAGE_SIZE}&orderBy=createdAt%20desc&${mask}`;
}

/** Firestore REST list response → teasers: pinned first, then newest;
 *  posts without a title are left out. Never throws on odd input. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw REST payload
export function parseTeasers(data: any, limit = 3): AnnouncementTeaser[] {
  const docs = Array.isArray(data?.documents) ? data.documents : [];
  const list: AnnouncementTeaser[] = [];
  for (const doc of docs) {
    const id = typeof doc?.name === 'string' ? doc.name.split('/').pop() || '' : '';
    const fields = doc?.fields || {};
    const title = typeof fields.title?.stringValue === 'string' ? fields.title.stringValue.trim() : '';
    if (!id || !title) continue;
    const stamp = fields.createdAt?.timestampValue ? Date.parse(fields.createdAt.timestampValue) : 0;
    list.push({
      id,
      title,
      pinned: fields.pinned?.booleanValue === true,
      createdAt: Number.isFinite(stamp) ? stamp : 0,
    });
  }
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
  return list.slice(0, Math.max(0, limit));
}

export async function fetchTeasers(limit = 3, signal?: AbortSignal): Promise<AnnouncementTeaser[]> {
  const res = await fetch(teaserUrl(), { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseTeasers(await res.json().catch(() => ({})), limit);
}

/** "today", "3 days ago", or a short date for older posts. */
export function teaserAge(createdAt: number, now: number = Date.now()): string {
  if (!createdAt) return '';
  const days = Math.floor((now - createdAt) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
