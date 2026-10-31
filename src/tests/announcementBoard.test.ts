// Unit tests for the AnnouncementBoard data helpers.
// The component itself needs a browser (canvas/Firestore) — the pure logic
// lives in exported functions so it can be tested here.
import { describe, expect, it } from 'vitest';
import {
  parseAnnouncementDoc,
  parseApprovedUids,
  sortAnnouncements,
  timeAgo,
  type Announcement,
} from '../components/AnnouncementBoard';

function doc(overrides: Record<string, unknown> = {}) {
  return {
    name: 'projects/p/databases/(default)/documents/announcements/post-1',
    fields: {
      title: { stringValue: 'Welcome back!' },
      body: { stringValue: 'Term 2 starts Monday.' },
      imageUrl: { stringValue: '' },
      pinned: { booleanValue: false },
      authorName: { stringValue: 'Chan' },
      authorUid: { stringValue: 'uid-1' },
      authorEmail: { stringValue: 'chan@school.edu.kh' },
      createdAt: { timestampValue: '2026-10-30T09:00:00.000Z' },
      updatedAt: { timestampValue: '2026-10-30T09:00:00.000Z' },
      ...overrides,
    },
  };
}

describe('parseAnnouncementDoc', () => {
  it('maps a Firestore REST doc onto the Announcement shape', () => {
    const a = parseAnnouncementDoc(doc());
    expect(a).not.toBeNull();
    expect(a!.id).toBe('post-1');
    expect(a!.title).toBe('Welcome back!');
    expect(a!.pinned).toBe(false);
    expect(a!.createdAt).toBe(Date.parse('2026-10-30T09:00:00.000Z'));
    expect(a!.updatedAt).toBe(a!.createdAt);
  });

  it('fills safe defaults for missing optional fields', () => {
    const a = parseAnnouncementDoc({
      name: 'projects/p/databases/(default)/documents/announcements/x',
      fields: { title: { stringValue: 'T' }, body: { stringValue: 'B' } },
    });
    expect(a!.pinned).toBe(false);
    expect(a!.imageUrl).toBe('');
    expect(a!.authorName).toBe('Admin');
  });

  it('returns null for a doc without a parseable id', () => {
    expect(parseAnnouncementDoc({ fields: {} })).toBeNull();
    expect(parseAnnouncementDoc(null)).toBeNull();
  });
});

describe('sortAnnouncements', () => {
  const base: Omit<Announcement, 'id' | 'createdAt'> = {
    title: 't', body: 'b', imageUrl: '', pinned: false,
    authorName: 'A', authorUid: 'u', authorEmail: 'e', updatedAt: 0,
  };
  const mk = (id: string, createdAt: number, pinned = false): Announcement => ({ ...base, id, createdAt, pinned });

  it('floats pinned posts above everything else', () => {
    const sorted = sortAnnouncements([
      mk('new-plain', 300),
      mk('old-pinned', 100, true),
      mk('mid-plain', 200),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['old-pinned', 'new-plain', 'mid-plain']);
  });

  it('orders pinned posts by recency among themselves', () => {
    const sorted = sortAnnouncements([
      mk('pin-old', 100, true),
      mk('pin-new', 500, true),
      mk('plain', 400),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['pin-new', 'pin-old', 'plain']);
  });
});

describe('parseApprovedUids', () => {
  it('reads the uids array from the site_config/admins doc', () => {
    expect(parseApprovedUids({
      fields: { uids: { arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] } } },
    })).toEqual(['a', 'b']);
  });

  it('returns [] when the doc or field is missing', () => {
    expect(parseApprovedUids({})).toEqual([]);
    expect(parseApprovedUids({ fields: {} })).toEqual([]);
    expect(parseApprovedUids(null)).toEqual([]);
  });

  it('drops empty entries', () => {
    expect(parseApprovedUids({
      fields: { uids: { arrayValue: { values: [{ stringValue: '' }, { stringValue: 'ok' }] } } },
    })).toEqual(['ok']);
  });
});

describe('timeAgo', () => {
  it('renders relative labels', () => {
    const now = Date.now();
    expect(timeAgo(0)).toBe('');
    expect(timeAgo(now - 30_000)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000)).toBe('5m ago');
    expect(timeAgo(now - 3 * 3_600_000)).toBe('3h ago');
  });
});
