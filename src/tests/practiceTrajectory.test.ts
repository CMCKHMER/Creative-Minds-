// @vitest-environment jsdom
// AI Phase 01's visible surfaces on the home page + the optional AI coach.
//
// The trend card must never invent data: signed out shows an explanation and
// links, signed in shows the saved bands, and the AI coach only runs on a tap —
// once per click, capped per day, and told not to grade.
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  session: null as { email: string; role?: string; teacherVerified?: boolean } | null,
  load: vi.fn(),
  appCheck: false,
  diag: vi.fn().mockResolvedValue({
    status: 403,
    state: 'rules',
    message: 'Score storage is refused by the database rules. Firestore → Rules → paste firestore-min.rules → Publish.',
  }),
}));

vi.mock('../hooks/useSignedInSession', () => ({
  useSignedInSession: () => h.session,
}));

vi.mock('../lib/practiceAttempts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/practiceAttempts')>();
  return { ...actual, loadMyTrajectory: h.load, diagnosePracticeStore: h.diag };
});

// The real key resolution is env → window → site_config/ai in Firestore, so it
// is async; the tests flip one flag and stand in for all three sources.
vi.mock('../lib/aiCoach', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/aiCoach')>();
  return {
    ...actual,
    appCheckConfigured: () => h.appCheck,
    resolveAppCheckKey: () => Promise.resolve(h.appCheck ? 'test-site-key' : ''),
  };
});

import { buildTrajectory as buildTs } from '../lib/practiceAttempts';
import { buildTrajectory as buildVanilla } from '../../public/assets/js/cmc-practice-attempts.js';
import { PracticeTrajectoryCard } from '../components/PracticeTrajectoryCard';
import { AI_COACH_DAILY_LIMIT, askCoach, coachPrompt, remainingCoachUses } from '../lib/aiCoach';

afterEach(cleanup);

const FIXTURES = [
  [{ band: 3, createdAt: 1 }, { band: 3.5, createdAt: 2 }],
  [{ band: 4, createdAt: 5 }],
  [{ band: 2, createdAt: 9 }, { band: 2, createdAt: 4 }, { band: 4.5, createdAt: 12 }],
  [{ band: 9, createdAt: 1 }, { band: 3, createdAt: 2 }],
  [] as Array<{ band: number; createdAt: number }>,
];

describe('buildTrajectory — the app and the static pages agree', () => {
  it('produces identical results from both implementations', () => {
    for (const fixture of FIXTURES) {
      expect(buildTs(fixture)).toEqual(buildVanilla(fixture));
      expect(buildTs(fixture, { limit: 2 })).toEqual(buildVanilla(fixture, { limit: 2 }));
    }
  });
});

describe('PracticeTrajectoryCard', () => {
  beforeEach(() => {
    localStorage.clear();
    h.load.mockReset();
    h.appCheck = false;
  });

  it('asks signed-out visitors to sign in and links straight to both practices', async () => {
    h.session = null;
    render(React.createElement(PracticeTrajectoryCard));
    expect(screen.getByText(/Sign in to keep your band history/i)).toBeTruthy();
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toContain('toefl-ibt/toeflwriting-MIGRATED.html');
    expect(links).toContain('toefl-ibt/toeflspeaking-MIGRATED.html');
    expect(h.load).not.toHaveBeenCalled();
  });

  it('shows the saved writing and speaking bands, with the delta since last time', async () => {
    h.session = { email: 'kid@example.com' };
    h.load.mockResolvedValue({
      attempts: [],
      writing: buildTs([{ band: 3, createdAt: 1 }, { band: 3.5, createdAt: 2 }]),
      speaking: buildTs([{ band: 2.5, createdAt: 3 }]),
      lastEssay: '',
      lastWriting: null,
      lastSpeaking: null,
    });
    render(React.createElement(PracticeTrajectoryCard));

    await waitFor(() => expect(screen.getByText('Writing band')).toBeTruthy());
    expect(screen.getByText('3.5')).toBeTruthy();
    expect(screen.getByText(/\+0\.5 since last/)).toBeTruthy();
    expect(screen.getByText('Speaking delivery')).toBeTruthy();
    expect(screen.getByText(/first attempt/)).toBeTruthy();
  });

  it('says "no saved attempts yet" rather than drawing an empty chart', async () => {
    h.session = { email: 'new@example.com' };
    h.load.mockResolvedValue({
      attempts: [],
      writing: buildTs([]),
      speaking: buildTs([]),
      lastEssay: '',
      lastWriting: null,
      lastSpeaking: null,
    });
    render(React.createElement(PracticeTrajectoryCard));
    await waitFor(() => expect(screen.getAllByText(/No saved attempts yet/).length).toBe(2));
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toContain(
      'toefl-ibt/toeflwriting-MIGRATED.html',
    );
  });

  it('says nothing about the AI coach to a student while AI is switched off', async () => {
    h.session = { email: 'kid@example.com', role: 'student' };
    h.load.mockResolvedValue({
      attempts: [],
      writing: buildTs([{ band: 4, createdAt: 1 }]),
      speaking: buildTs([]),
      lastEssay: '',
      lastWriting: null,
      lastSpeaking: null,
    });
    render(React.createElement(PracticeTrajectoryCard));
    await waitFor(() => expect(screen.getByText('Writing band')).toBeTruthy());
    // no console instructions, no dead button, no promise of a disabled feature
    expect(screen.queryByText(/App Check/i)).toBeNull();
    expect(screen.queryByText(/Firebase →/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Ask the AI coach/i })).toBeNull();
    expect(screen.queryByText(/the AI coach can read it back/i)).toBeNull();
  });

  it('shows the setup checklist to a teacher, and never to a student', async () => {
    h.load.mockResolvedValue({
      attempts: [],
      writing: buildTs([]),
      speaking: buildTs([]),
      lastEssay: '',
      lastWriting: null,
      lastSpeaking: null,
    });
    h.session = { email: 'owner@aii.edu.kh', role: 'teacher', teacherVerified: true };
    const { unmount } = render(React.createElement(PracticeTrajectoryCard));
    await waitFor(() => expect(screen.getByText(/App Check key not set/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /Test connection/i })).toBeTruthy();
    // every console step is a link, so the owner never has to hunt the left nav
    const steps = Array.from(document.querySelectorAll('.cmc-ai-steps a')).map((a) => a.getAttribute('href'));
    expect(steps).toContain('https://console.firebase.google.com/project/creative-minds-cambodia/appcheck/apps');
    expect(steps).toContain(
      'https://console.firebase.google.com/project/creative-minds-cambodia/firestore/data/~2Fsite_config~2Fai',
    );
    // and when the charts are empty, the teacher is told WHY in one line
    await waitFor(() => expect(screen.getByText(/Score storage:/)).toBeTruthy());
    expect(screen.getByText(/HTTP 403/)).toBeTruthy();
    unmount();

    h.session = { email: 'kid@example.com', role: 'student' };
    render(React.createElement(PracticeTrajectoryCard));
    await waitFor(() => expect(screen.getByText('Writing band')).toBeTruthy());
    expect(screen.queryByText(/App Check key not set/i)).toBeNull();
  });

  it('offers the coach to a student once App Check is wired and an essay exists', async () => {
    h.appCheck = true;
    h.session = { email: 'kid@example.com', role: 'student' };
    h.load.mockResolvedValue({
      attempts: [],
      writing: buildTs([{ band: 4, createdAt: 1 }]),
      speaking: buildTs([]),
      lastEssay: '',
      lastWriting: null,
      lastSpeaking: null,
    });
    render(React.createElement(PracticeTrajectoryCard));
    await waitFor(() => expect(screen.getByText('Writing band')).toBeTruthy());
    expect(screen.getByText(/Submit a writing response and the AI coach/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ask the AI coach/i })).toBeNull();
  });

  it('runs the coach on a tap and shows the second opinion', async () => {
    h.appCheck = true;
    h.session = { email: 'kid@example.com', role: 'student' };
    h.load.mockResolvedValue({
      attempts: [],
      writing: buildTs([{ band: 4, createdAt: 1 }]),
      speaking: buildTs([]),
      lastEssay: 'Dear Maria, I am writing because I will travel to Phnom Penh next month for work.',
      lastWriting: { id: 'w1', skill: 'writing', band: 4, traits: { task: 4 }, stats: {}, text: 'x', createdAt: 1 },
      lastSpeaking: null,
    });

    // Keep the network out of the test: the generator is what we stub.
    vi.spyOn(await import('../lib/aiCoach'), 'askCoach').mockResolvedValue({
      ok: true,
      text: 'Your clearest phrase is "I am writing because" — keep that direct opening.',
    });

    render(React.createElement(PracticeTrajectoryCard));
    await waitFor(() => expect(screen.getByRole('button', { name: /Ask the AI coach/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Ask the AI coach/i }));
    await waitFor(() => expect(screen.getByText(/keep that direct opening/)).toBeTruthy());
  });
});

describe('aiCoach', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes a prompt that forbids a second grade and names the real band', () => {
    const prompt = coachPrompt({
      essay: 'Dear Maria, I am writing because I will travel to Phnom Penh next month.',
      band: 3.5,
      traits: { task: 4, coherence: 3 },
      fixes: ['Link your ideas'],
    });
    expect(prompt).toContain('3.5 / 5');
    expect(prompt).toContain('task: 4.0/5');
    expect(prompt).toContain('Do NOT give a new band or score');
    expect(prompt).toContain('Dear Maria');
    expect(prompt).toContain('Link your ideas');
  });

  it('refuses a response too short to read', async () => {
    const generator = vi.fn();
    expect(await askCoach({ essay: 'too short', band: 2 }, { generator })).toEqual({
      ok: false,
      reason: 'no-essay',
    });
    expect(generator).not.toHaveBeenCalled();
  });

  it('caps the reviews per day', async () => {
    const generator = vi.fn().mockResolvedValue('Fine.');
    const essay = 'x'.repeat(80);
    for (let i = 0; i < AI_COACH_DAILY_LIMIT; i += 1) {
      const result = await askCoach({ essay, band: 3 }, { generator });
      expect(result.ok).toBe(true);
    }
    expect(remainingCoachUses()).toBe(0);
    expect(await askCoach({ essay, band: 3 }, { generator })).toEqual({ ok: false, reason: 'quota' });
    expect(generator).toHaveBeenCalledTimes(AI_COACH_DAILY_LIMIT);
  });

  it('reports a disabled AI backend calmly instead of throwing', async () => {
    const generator = vi.fn().mockRejectedValue(new Error('Firebase App Check token is invalid'));
    const result = await askCoach({ essay: 'y'.repeat(80), band: 3 }, { generator });
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('trims what the model says so the card cannot grow unbounded', async () => {
    const generator = vi.fn().mockResolvedValue('z'.repeat(5000));
    const result = await askCoach({ essay: 'q'.repeat(80), band: 3 }, { generator });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text.length).toBeLessThanOrEqual(900);
  });
});
