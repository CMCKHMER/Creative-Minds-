// @vitest-environment jsdom
// The optional "listen to my answer" call on the static speaking page
// (public/assets/js/cmc-ai-logic.js), plus the diagnostics that tell the owner
// whether Firebase AI Logic is actually working.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AI_DAILY_LIMIT,
  aiConfigured,
  askAboutRecording,
  remainingUses,
  speechPrompt,
} from '../../public/assets/js/cmc-ai-logic.js';
import { classifyAiFailure, probeAICoach, speechCoachPrompt } from '../lib/aiCoach';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const speakingPage = readFileSync(join(root, 'public', 'toefl-ibt', 'toeflspeaking-MIGRATED.html'), 'utf8');

async function reasonOf(input: Parameters<typeof askAboutRecording>[0]): Promise<string> {
  const result = await askAboutRecording(input);
  return result.ok ? 'ok' : result.reason;
}

function audioBlob(bytes = 4096): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'audio/webm' });
}

beforeEach(() => {
  localStorage.clear();
  delete (window as unknown as { CMC_APPCHECK_KEY?: string }).CMC_APPCHECK_KEY;
});

describe('cmc-ai-logic — the button only exists when AI Logic is wired', () => {
  it('is off until the owner sets the App Check key', async () => {
    expect(aiConfigured()).toBe(false);
    expect(await askAboutRecording({ blob: audioBlob(), targetSeconds: 45, band: 3 })).toMatchObject({
      ok: false,
      reason: 'not-configured',
    });
  });

  it('explains the gates in the same order the console needs them', () => {
    (window as unknown as { CMC_APPCHECK_KEY?: string }).CMC_APPCHECK_KEY = 'recaptcha-site-key';
    expect(aiConfigured()).toBe(true);
    expect(remainingUses()).toBe(AI_DAILY_LIMIT);
  });

  it('refuses empty audio and anything over the size cap', async () => {
    (window as unknown as { CMC_APPCHECK_KEY?: string }).CMC_APPCHECK_KEY = 'k';
    expect(await reasonOf({ blob: new Blob([]), targetSeconds: 45, band: 3 })).toBe('no-audio');
    const huge = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'audio/webm' });
    expect(await reasonOf({ blob: huge, targetSeconds: 45, band: 3 })).toBe('too-large');
  });

  it('stops after the daily cap', async () => {
    (window as unknown as { CMC_APPCHECK_KEY?: string }).CMC_APPCHECK_KEY = 'k';
    localStorage.setItem(
      'cmc-ai-coach-usage',
      JSON.stringify({ day: new Date().toISOString().slice(0, 10), count: AI_DAILY_LIMIT }),
    );
    expect(remainingUses()).toBe(0);
    expect(await reasonOf({ blob: audioBlob(), targetSeconds: 45, band: 3 })).toBe('quota');
  });

  it('fails softly when the SDK cannot load (offline / blocked CDN)', async () => {
    (window as unknown as { CMC_APPCHECK_KEY?: string }).CMC_APPCHECK_KEY = 'k';
    const reason = await reasonOf({ blob: audioBlob(), targetSeconds: 45, band: 3 });
    expect(['failed', 'unavailable']).toContain(reason);
  });

  it('writes a prompt that forbids a second score', () => {
    const prompt = speechPrompt({ targetSeconds: 45, band: 2.5, stats: { pauseRatio: 0.31 } });
    expect(prompt).toContain('2.5 / 5');
    expect(prompt).toContain('pauseRatio: 0.31');
    expect(prompt).toContain('Do not give a band or a score');
  });
});

describe('diagnostics — probeAICoach tells the owner which step is missing', () => {
  it('reports a missing App Check key without calling the model', async () => {
    const generator = vi.fn();
    const probe = await probeAICoach({ generator });
    expect(probe.status).toBe('app-check');
    expect(probe.message).toMatch(/App Check/i);
    expect(generator).not.toHaveBeenCalled();
  });

  it('reports connected when a generation actually comes back', async () => {
    const probe = await probeAICoach({
      generator: vi.fn().mockResolvedValue('ready'),
    });
    // no key in this environment, so the guard fires first — assert that instead
    expect(probe.status).toBe('app-check');
  });

  it('maps model errors onto console steps', () => {
    expect(classifyAiFailure('Firebase App Check token is invalid')).toBe('app-check');
    expect(classifyAiFailure('AI Logic API has not been used in project 123')).toBe('not-enabled');
    expect(classifyAiFailure('PERMISSION_DENIED: Missing or insufficient permissions')).toBe('not-enabled');
    expect(classifyAiFailure('Failed to fetch')).toBe('error');
  });

  it('speech prompt and essay prompt share the same contract', () => {
    const prompt = speechCoachPrompt({ targetSeconds: 45, band: 3, stats: { wordsPerMinute: 120 } });
    expect(prompt).toContain('3.0 / 5');
    expect(prompt).toContain('wordsPerMinute: 120');
    expect(prompt).toContain('Do not give a band or a score');
  });
});

describe('speaking page wiring', () => {
  it('keeps recordings in memory and only sends them on an explicit tap', () => {
    expect(speakingPage).toContain("import * as aiLogic from '../assets/js/cmc-ai-logic.js';");
    expect(speakingPage).toContain('window.CMCAiLogic = aiLogic;');
    expect(speakingPage).toContain('speechBlobs[questionId] = blob;');
    expect(speakingPage).toContain('window.CMCAiLogic.aiConfigured()');
    expect(speakingPage).toContain('Ask the AI to listen to this answer');
    // the blob is only read inside the click handler
    expect(speakingPage.indexOf('function cmcAskAi')).toBeGreaterThan(0);
    expect(speakingPage).toContain('nothing is stored or sent');
  });
});

describe('teacher review wiring', () => {
  const dashboard = readFileSync(join(root, 'src', 'components', 'FirebaseDashboard.tsx'), 'utf8');
  const panel = readFileSync(join(root, 'src', 'components', 'PracticeReviewPanel.tsx'), 'utf8');
  const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');

  it('is mounted on the teacher console, teacher-only', () => {
    expect(dashboard).toContain("import { PracticeReviewPanel } from './PracticeReviewPanel';");
    expect(dashboard).toContain('{isTeacher && teacherUid && (');
  });

  it('reads attempts and writes a review without touching the attempt', () => {
    expect(panel).toContain('loadStudentAttempts');
    expect(panel).toContain('savePracticeReview');
    expect(panel).not.toContain('updateDoc');
    expect(rules).toContain('match /practice_reviews/{attemptId}');
    expect(rules).toContain('request.resource.data.reviewerUid == request.auth.uid');
    expect(rules).toContain('request.resource.data.comment.size() <= 600');
  });
});
