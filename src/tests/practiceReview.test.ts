// @vitest-environment jsdom
// Teacher review of practice attempts (src/lib/practiceAttempts.ts).
// The attempt is a fact; the review is an opinion. These pins keep the two
// apart and keep a failed save visible instead of silently "done".
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  diagnosePracticeStore,
  loadPracticeReview,
  loadStudentAttempts,
  savePracticeReview,
} from '../lib/practiceAttempts';
import { uidFromIdToken } from '../lib/submitScore';

// Minimal unsigned JWT with a uid claim — enough for uidFromIdToken.
function fakeToken(uid: string): string {
  const payload = btoa(JSON.stringify({ user_id: uid }));
  return `header.${payload}.signature`;
}

const BASE = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cmc-student-uid', 'teacher_1');
  localStorage.setItem('cmc-student-token', fakeToken('teacher_1'));
  localStorage.setItem('cmc-student-token-expires', String(Date.now() + 3_600_000));
});

describe('uidFromIdToken (used to attribute the review)', () => {
  it('reads user_id from the JWT payload', () => {
    expect(uidFromIdToken(fakeToken('abc123'))).toBe('abc123');
    expect(uidFromIdToken('not-a-token')).toBe('');
  });
});

describe('loadStudentAttempts', () => {
  it('reads another student’s attempts with the teacher token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        documents: [
          { name: 'a/attempts/x1', fields: { band: { doubleValue: 4 }, skill: { stringValue: 'writing' }, createdAt: { timestampValue: '2026-11-17T09:00:00Z' } } },
        ],
      }), { status: 200 }),
    );
    const rows = await loadStudentAttempts('student_9', 5);
    expect(rows.map((r) => r.id)).toEqual(['x1']);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/practice_attempts/student_9/attempts?pageSize=5`);
    expect((init!.headers as Record<string, string>).Authorization).toMatch(/^Bearer header\./);
  });

  it('returns nothing (never throws) when the rules refuse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));
    expect(await loadStudentAttempts('student_9')).toEqual([]);
  });
});

describe('savePracticeReview', () => {
  it('writes the reviewer’s own uid and can say "keep the automatic band"', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const res = await savePracticeReview({
      attemptId: 'x1',
      studentUid: 'student_9',
      band: null,
      comment: 'Good structure — link your reasons next time.',
      reviewerName: 'Mr Sok',
    });
    expect(res.ok).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/practice_reviews/x1`);
    expect(init!.method).toBe('PATCH');
    const body = JSON.parse(String(init!.body));
    expect(body.fields.reviewerUid.stringValue).toBe('teacher_1');
    expect(body.fields.band.nullValue).toBeNull();
    expect(body.fields.comment.stringValue).toContain('link your reasons');
  });

  it('rounds an override onto the rubric’s half-point grid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await savePracticeReview({ attemptId: 'x1', studentUid: 's', band: 3.7, comment: '' });
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]!.body));
    expect(body.fields.band.doubleValue).toBe(3.5);
  });

  it('reports a refused save instead of pretending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Missing or insufficient permissions' } }), { status: 403 }),
    );
    const res = await savePracticeReview({ attemptId: 'x1', studentUid: 's', band: 4, comment: 'x' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/permission/i);
  });

  it('refuses a band outside 0–5 and a missing attempt', async () => {
    expect((await savePracticeReview({ attemptId: 'x1', studentUid: 's', band: 7, comment: '' })).error).toMatch(/0–5/);
    expect((await savePracticeReview({ attemptId: '', studentUid: 's', band: 3, comment: '' })).error).toMatch(/Missing/);
  });

  it('asks for a teacher session when signed out', async () => {
    localStorage.clear();
    expect((await savePracticeReview({ attemptId: 'x1', studentUid: 's', band: 3, comment: '' })).error).toMatch(/verified teacher/i);
  });
});

describe('loadPracticeReview', () => {
  it('reads an existing review back into band + comment', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      fields: {
        attemptId: { stringValue: 'x1' },
        studentUid: { stringValue: 'student_9' },
        reviewerUid: { stringValue: 'teacher_1' },
        reviewerName: { stringValue: 'Mr Sok' },
        band: { doubleValue: 3.5 },
        comment: { stringValue: 'Tighter topic sentences.' },
        createdAt: { timestampValue: '2026-11-17T10:00:00Z' },
      },
    }), { status: 200 }));
    const review = await loadPracticeReview('x1');
    expect(review).toMatchObject({ attemptId: 'x1', band: 3.5, comment: 'Tighter topic sentences.' });
  });

  it('treats a missing review as "none" rather than an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
    expect(await loadPracticeReview('x1')).toBeNull();
  });
});

describe('diagnosePracticeStore — why is the chart empty?', () => {
  it('names the rules when Firestore refuses (403)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));
    const diag = await diagnosePracticeStore();
    expect(diag.state).toBe('rules');
    expect(diag.status).toBe(403);
    expect(diag.message).toMatch(/firestore-min\.rules/);
  });

  it('reports storage as reachable when the read succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await diagnosePracticeStore()).toMatchObject({ state: 'ok', status: 200 });
  });

  it('separates "no session" from "no data"', async () => {
    localStorage.clear();
    expect(await diagnosePracticeStore()).toMatchObject({ state: 'no-session', status: 0 });
  });

  it('treats an unreachable Firestore as a network problem', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await diagnosePracticeStore()).toMatchObject({ state: 'network' });
  });
});
