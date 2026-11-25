// @vitest-environment jsdom
// Score Trajectory (public/assets/js/cmc-practice-attempts.js).
//
// Two things must not break here: a student can only ever write under their own
// uid (the rules rely on the doc shape), and a practice score is never lost to
// a dropped connection — it waits in the outbox and is sent on the next load.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ATTEMPTS_COLLECTION,
  buildTrajectory,
  currentStudent,
  flushOutbox,
  fromDocument,
  loadAttempts,
  saveAttempt,
  trajectoryMarkup,
} from '../../public/assets/js/cmc-practice-attempts.js';

const BASE = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents';

function signIn() {
  localStorage.setItem('cmc-student-uid', 'uid_abc');
  localStorage.setItem('cmc-student-token', 'token_abc');
  localStorage.setItem('cmc-student-token-expires', String(Date.now() + 3_600_000));
}

beforeEach(() => {
  localStorage.clear();
});

describe('buildTrajectory', () => {
  it('returns an empty, quiet trajectory when nothing is saved', () => {
    const traj = buildTrajectory([]);
    expect(traj.count).toBe(0);
    expect(traj.direction).toBe('first');
    expect(traj.latest).toBe(0);
  });

  it('sorts by time, keeps the newest eight, and reports the half-point delta', () => {
    const attempts = [
      { band: 4, createdAt: 400 },
      { band: 2.5, createdAt: 100 },
      { band: 3, createdAt: 200 },
      { band: 3.5, createdAt: 300 },
    ];
    const traj = buildTrajectory(attempts);
    expect(traj.points.map((p) => p.band)).toEqual([2.5, 3, 3.5, 4]);
    expect(traj.latest).toBe(4);
    expect(traj.previous).toBe(3.5);
    expect(traj.delta).toBe(0.5);
    expect(traj.direction).toBe('up');
    expect(traj.best).toBe(4);

    const many = Array.from({ length: 12 }, (_, i) => ({ band: 2, createdAt: i }));
    expect(buildTrajectory(many).points).toHaveLength(8);
    expect(buildTrajectory(many).points[7].createdAt).toBe(11);
  });

  it('marks a drop and a plateau differently', () => {
    expect(buildTrajectory([{ band: 4, createdAt: 1 }, { band: 3, createdAt: 2 }]).direction).toBe('down');
    expect(buildTrajectory([{ band: 3, createdAt: 1 }, { band: 3, createdAt: 2 }]).direction).toBe('flat');
    expect(buildTrajectory([{ band: 3, createdAt: 1 }]).direction).toBe('first');
  });

  it('ignores bands that could not have come from a rubric', () => {
    const traj = buildTrajectory([
      { band: 3, createdAt: 1 },
      { band: 9, createdAt: 2 },
      { band: -1, createdAt: 3 },
      { band: Number.NaN, createdAt: 4 },
    ]);
    expect(traj.points.map((p) => p.band)).toEqual([3]);
  });
});

describe('trajectoryMarkup', () => {
  it('shows the latest band, the delta and an accessible summary', () => {
    const html = trajectoryMarkup(buildTrajectory([
      { band: 3, createdAt: 1 },
      { band: 3.5, createdAt: 2 },
    ]), { label: 'Writing band' });
    expect(html).toContain('Writing band');
    expect(html).toContain('3.5');
    expect(html).toContain('+0.5 vs last time');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Writing band: Latest 3.5 out of 5');
    expect(html).toContain('best 3.5');
  });

  it('invites the first attempt instead of showing an empty chart', () => {
    const html = trajectoryMarkup(buildTrajectory([]), { empty: 'Write one response to start.' });
    expect(html).toContain('Write one response to start.');
    expect(html).not.toContain('role="group"');
  });

  it('escapes anything a student typed', () => {
    const html = trajectoryMarkup(buildTrajectory([{ band: 3, createdAt: 1 }]), {
      label: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('fromDocument', () => {
  it('reads the Firestore REST shape back into a plain attempt', () => {
    const attempt = fromDocument({
      name: 'projects/x/documents/practice_attempts/uid_abc/attempts/doc1',
      fields: {
        band: { doubleValue: 3.5 },
        skill: { stringValue: 'writing' },
        traits: { mapValue: { fields: { task: { doubleValue: 4 }, coherence: { doubleValue: 3 } } } },
        stats: { mapValue: { fields: { words: { doubleValue: 120 } } } },
        text: { stringValue: 'Dear Maria…' },
        createdAt: { timestampValue: '2026-11-17T10:00:00.000Z' },
      },
    });
    expect(attempt).toMatchObject({ id: 'doc1', skill: 'writing', band: 3.5 });
    expect(attempt!.traits).toEqual({ task: 4, coherence: 3 });
    expect(attempt!.createdAt).toBe(Date.parse('2026-11-17T10:00:00.000Z'));
    expect(fromDocument(null)).toBeNull();
  });
});

describe('saveAttempt', () => {
  it('writes nothing when nobody is signed in', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await saveAttempt({ skill: 'writing', band: 3 });
    expect(result).toEqual({ id: null, queued: false, reason: 'signed-out' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a band or skill the rubric cannot produce', async () => {
    signIn();
    expect((await saveAttempt({ skill: 'writing', band: 9 })).reason).toBe('bad-band');
    expect((await saveAttempt({ skill: 'astrology', band: 3 } as never)).reason).toBe('bad-skill');
  });

  it('posts under the student’s own uid with the token as the bearer', async () => {
    signIn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ name: `${BASE}/practice_attempts/uid_abc/attempts/doc9` }), { status: 200 }),
    );
    const result = await saveAttempt({
      skill: 'writing',
      band: 3.46,
      traits: { task: 4, efficiency: 0.9 },
      text: 'Dear Maria, …',
      rubricVersion: '1.0.0',
    });

    expect(result).toEqual({ id: 'doc9', queued: false });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/practice_attempts/uid_abc/attempts`);
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer token_abc');
    const body = JSON.parse(String(init!.body));
    expect(body.fields.uid.stringValue).toBe('uid_abc');
    // the band is stored on the rubric's half-point grid
    expect(body.fields.band.doubleValue).toBe(3.5);
    expect(body.fields.traits.mapValue.fields.task.doubleValue).toBe(4);
  });

  it('queues a failed write and sends it on the next flush', async () => {
    signIn();
    const failing = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'network down' } }), { status: 503 }),
    );
    const first = await saveAttempt({ skill: 'speaking', band: 2.5 });
    expect(first.queued).toBe(true);
    expect(JSON.parse(localStorage.getItem('cmc-practice-outbox')!)).toHaveLength(1);

    failing.mockRestore();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const flushed = await flushOutbox();
    expect(flushed.sent).toBe(1);
    expect(JSON.parse(localStorage.getItem('cmc-practice-outbox')!)).toHaveLength(0);
  });

  it('caps the outbox so a long offline stretch cannot bloat storage', async () => {
    signIn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    for (let i = 0; i < 25; i += 1) {
      await saveAttempt({ skill: 'writing', band: 3 });
    }
    expect(JSON.parse(localStorage.getItem('cmc-practice-outbox')!).length).toBeLessThanOrEqual(20);
  });
});

describe('loadAttempts', () => {
  it('returns the student’s attempts newest first, and nothing when signed out', async () => {
    expect(await loadAttempts()).toEqual([]);
    signIn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      documents: [
        { name: 'a/attempts/one', fields: { band: { doubleValue: 3 }, skill: { stringValue: 'writing' }, createdAt: { timestampValue: '2026-11-01T10:00:00Z' } } },
        { name: 'a/attempts/two', fields: { band: { doubleValue: 4 }, skill: { stringValue: 'writing' }, createdAt: { timestampValue: '2026-11-10T10:00:00Z' } } },
      ],
    }), { status: 200 }));
    const attempts = await loadAttempts({ limit: 5 });
    expect(attempts.map((a) => a.id)).toEqual(['two', 'one']);
  });

  it('stays quiet when Firestore refuses the read', async () => {
    signIn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));
    expect(await loadAttempts()).toEqual([]);
  });
});

describe('currentStudent + collection name', () => {
  it('needs both a uid and a token', () => {
    expect(currentStudent()).toBeNull();
    localStorage.setItem('cmc-student-uid', 'uid_abc');
    expect(currentStudent()).toBeNull();
    localStorage.setItem('cmc-student-token', 'token_abc');
    expect(currentStudent()).toEqual({ uid: 'uid_abc', token: 'token_abc' });
  });

  it('reads from the collection the rules guard', () => {
    expect(ATTEMPTS_COLLECTION).toBe('practice_attempts');
  });
});

describe('firestore rules for practice_attempts', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const rules = readFileSync(join(here, '..', '..', 'firestore.rules'), 'utf8');
  const minRules = readFileSync(join(here, '..', '..', 'firestore-min.rules'), 'utf8');

  it('keeps student work out of the public scoreboard', () => {
    // drill_attempts is world-readable; a student's essay must never land there.
    expect(rules).toContain('match /practice_attempts/{uid}/attempts/{attemptId}');
    expect(minRules).toContain('practice_attempts/{uid}/attempts');
  });

  it('lets a student write only under their own uid, and nobody else write at all', () => {
    expect(rules).toContain('allow create: if isVerifiedUser() && isOwnPracticePath(uid) && isValidPracticeAttempt(uid);');
    expect(rules).toContain('allow read: if isOwnPracticePath(uid) || isVerifiedTeacher();');
    expect(rules).toContain('allow update, delete: if false;');
    expect(rules).toContain('d.uid == uid');
  });

  it('validates the band and the skill the engine can actually produce', () => {
    expect(rules).toContain("d.skill in ['writing', 'speaking']");
    expect(rules).toContain('d.band >= 0');
    expect(rules).toContain('d.band <= 5');
    expect(rules).toContain('d.text.size() <= 4000');
  });
});
