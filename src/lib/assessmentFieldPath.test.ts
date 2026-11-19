import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// fsCall resolves a token through firebaseAuth before every REST call; the
// module mock keeps the transport testable without loading the Firebase SDK.
vi.mock('./firebaseAuth', () => ({
  getProjectId: () => 'test-project',
  getValidIdToken: async () => 'tok-123',
}));

import {
  clearAssessmentWeek,
  fsFieldPath,
  patchAssessmentStudentWeek,
} from './assessmentDb';

// The two regexes from Firestore's own rejection message ("Invalid property
// path …") — every updateMask segment must satisfy one of them.
const SEGMENT_UNQUOTED = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
const SEGMENT_QUOTED = /^`(?:[^`\\]|(?:\\.))+`$/;
const legalFieldPath = (path: string): boolean =>
  path.split('.').every((seg) => SEGMENT_UNQUOTED.test(seg) || SEGMENT_QUOTED.test(seg));

/** Walk a nested REST payload, e.g. dig(body,'fields','weeks') … */
function dig(root: unknown, ...keys: string[]): unknown {
  let cur = root as Record<string, unknown> | undefined;
  for (const k of keys) cur = cur?.[k] as Record<string, unknown> | undefined;
  return cur;
}

describe('fsFieldPath (REST field-path syntax)', () => {
  it('leaves plain identifier segments unquoted', () => {
    expect(fsFieldPath('listening')).toBe('listening');
    expect(fsFieldPath('weeks', 'weekOne', 'speaking')).toBe('weeks.weekOne.speaking');
    expect(fsFieldPath('_x', 'X9')).toBe('_x.X9');
  });

  it('backtick-quotes segments that are not identifiers — ISO dates first', () => {
    expect(fsFieldPath('weeks', '2026-11-16', 'speaking')).toBe('weeks.`2026-11-16`.speaking');
    expect(fsFieldPath('weeks', '2026-11-16')).toBe('weeks.`2026-11-16`');
  });

  it('escapes backticks and backslashes inside quoted segments', () => {
    expect(fsFieldPath('weeks', 'a`b')).toBe('weeks.`a\\`b`');
    expect(fsFieldPath('weeks', 'a\\b')).toBe('weeks.`a\\\\b`');
  });

  it('every produced path satisfies the server-side field-path regexes', () => {
    expect(legalFieldPath('weeks.`2026-11-16`.speaking')).toBe(true);
    expect(legalFieldPath('weeks.2026-11-16.speaking')).toBe(false); // the reported bug
    expect(legalFieldPath('`2026`')).toBe(true);
  });
});

describe('assessmentDb weekly writes (masked PATCH wire format)', () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const mockFetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { ok: true, json: async () => ({}) } as unknown as Response;
  });

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('REGRESSION: saving a week score masks the date leaf backtick-quoted, body keys stay raw', async () => {
    await patchAssessmentStudentWeek('c1', 's1', '2026-11-16', { speaking: 12 }, 't@school.edu.kh');

    const url = decodeURIComponent(calls[0].url);
    // The exact request that used to fail with "Invalid property path
    // weeks.2026-11-16.speaking" — the date segment must be quoted.
    expect(url).toContain('updateMask.fieldPaths=weeks.`2026-11-16`.speaking');
    expect(url).toContain('updateMask.fieldPaths=updatedAt');
    expect(url).toContain('updateMask.fieldPaths=updatedBy');
    expect(url).not.toMatch(/fieldPaths=weeks\.2026-11-16[.&]/);
    for (const m of url.matchAll(/fieldPaths=([^&]+)/g)) {
      expect(legalFieldPath(m[1]), m[1]).toBe(true);
    }

    // The DATA body keeps the raw JSON keys (no quoting needed there) and the
    // leaf value rides as a typed integer, exactly like before the fix.
    const body = JSON.parse(String(calls[0].init.body)) as unknown;
    const week = dig(body, 'fields', 'weeks', 'mapValue', 'fields', '2026-11-16', 'mapValue', 'fields');
    expect(dig(week, 'speaking')).toEqual({ integerValue: '12' });
    expect(dig(body, 'fields', 'updatedBy')).toEqual({ stringValue: 't@school.edu.kh' });
  });

  it('REGRESSION: deleting a week masks the week map key quoted; the body omits weeks so the leaf is removed', async () => {
    await clearAssessmentWeek('c1', 's1', '2026-11-16');

    const url = decodeURIComponent(calls[0].url);
    expect(url).toContain('updateMask.fieldPaths=weeks.`2026-11-16`');
    expect(url).not.toMatch(/fieldPaths=weeks\.2026-11-16[.&]/);
    const rootFields = dig(JSON.parse(String(calls[0].init.body)), 'fields') as Record<string, unknown>;
    expect(Object.keys(rootFields)).toEqual(['updatedAt']);
  });

  it('plain week keys (identifiers) still produce unquoted paths', async () => {
    await patchAssessmentStudentWeek('c1', 's1', 'W1', { listening: 7 }, 't@school.edu.kh');
    const url = decodeURIComponent(calls[0].url);
    expect(url).toContain('updateMask.fieldPaths=weeks.W1.listening');
    const week = dig(JSON.parse(String(calls[0].init.body)), 'fields', 'weeks', 'mapValue', 'fields', 'W1', 'mapValue', 'fields');
    expect(dig(week, 'listening')).toEqual({ integerValue: '7' });
  });
});
