// The speaking half of AI Phase 01 ("Speaking Coach"). The engine reads the
// recorded audio only — no transcript, no upload — so what has to stay pinned
// is that it reacts to the signal the way a coach would: dead air, rushing,
// mumbling into the mic and using a third of the time all move the band.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseSpeech, RUBRIC_VERSION } from '../../public/assets/js/cmc-speaking-rubric.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const speakingPage = readFileSync(join(root, 'public', 'toefl-ibt', 'toeflspeaking-MIGRATED.html'), 'utf8');

const SR = 16000;

/**
 * Synthetic "speech": a 220 Hz tone amplitude-modulated at `hz` (so the frame
 * envelope has syllable-sized peaks), with a deterministic silent gap each
 * `window` seconds. Silence share = 1 - spoken.
 */
function synth({
  seconds,
  spoken = 0.92,
  hz = 2.8,
  level = 0.25,
  window = 2,
  silentHead = 0,
  silentTail = 0,
}: {
  seconds: number;
  spoken?: number;
  hz?: number;
  level?: number;
  window?: number;
  silentHead?: number;
  silentTail?: number;
}) {
  const n = Math.round(seconds * SR);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    if (t < silentHead || t > seconds - silentTail) continue;
    const phase = (t % window) / window;
    if (phase >= spoken) continue;
    const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * hz * t);
    pcm[i] = Math.sin(2 * Math.PI * 220 * t) * level * env;
  }
  return pcm;
}

describe('analyseSpeech — a good answer', () => {
  it('scores a full, steady 43-second answer near the top and stays deterministic', () => {
    const pcm = synth({ seconds: 43, spoken: 0.93 });
    const a = analyseSpeech(pcm, SR, { targetSeconds: 45 });
    const b = analyseSpeech(pcm, SR, { targetSeconds: 45 });

    expect(a).toEqual(b); // no clock, no randomness
    expect(a.ok).toBe(true);
    expect(a.pauseRatio).toBeLessThan(0.15);
    expect(a.scores.pacing).toBe(5);
    expect(a.band).toBeGreaterThanOrEqual(4);
    expect(a.wordsPerMinute).toBeGreaterThan(60);
    expect(a.fixes.length).toBeLessThanOrEqual(3);
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('says nothing was recorded when the mic captured silence', () => {
    const silent = analyseSpeech(new Float32Array(SR * 45), SR, { targetSeconds: 45 });
    expect(silent.ok).toBe(false);
    expect(silent.reason).toBe('silent');
    expect(silent.band).toBe(0);
    expect(silent.fixes[0].title).toMatch(/Nothing was recorded/i);
  });

  it('does not invent a score from a fraction of a second', () => {
    const blip = analyseSpeech(synth({ seconds: 0.4 }), SR, { targetSeconds: 45 });
    expect(blip.ok).toBe(false);
  });
});

describe('analyseSpeech — the mistakes students actually make', () => {
  it('drops fluency for long silences and tells the student how much was silence', () => {
    const hesitant = synth({ seconds: 45, spoken: 0.55, window: 2 });
    const r = analyseSpeech(hesitant, SR, { targetSeconds: 45 });
    expect(r.ok).toBe(true);
    expect(r.pauseRatio).toBeGreaterThan(0.3);
    expect(r.scores.fluency).toBeLessThan(3);
    expect(r.fixes.some((f) => /silent/i.test(f.title))).toBe(true);
    // the number of pauses must appear in the advice, not a vague "speak more"
    expect(r.fixes[0].detail).toMatch(/pause/i);
    expect(r.fixes[0].detail).toContain(String(r.pauses));
  });

  it('penalises an answer that uses a third of the time, and says so with the number', () => {
    const short = synth({ seconds: 14, spoken: 0.95 });
    const r = analyseSpeech(short, SR, { targetSeconds: 45 });
    expect(r.ok).toBe(true);
    expect(r.scores.pacing).toBeLessThanOrEqual(3);
    expect(r.fixes.map((f) => f.title).join(' ')).toMatch(/Use the whole 45 seconds/);
    const full = analyseSpeech(synth({ seconds: 43 }), SR, { targetSeconds: 45 });
    expect(r.band).toBeLessThan(full.band);
  });

  it('flags a mumble and a clipped recording — different fixes for different signals', () => {
    const quiet = analyseSpeech(synth({ seconds: 40, level: 0.012 }), SR, { targetSeconds: 45 });
    expect(quiet.scores.clarity).toBeLessThanOrEqual(2);
    expect(quiet.fixes.map((f) => f.title).join(' ')).toMatch(/Speak up/i);

    const clipped = analyseSpeech(synth({ seconds: 40, level: 0.999 }), SR, { targetSeconds: 45 });
    expect(clipped.clipping).toBeGreaterThan(0.005);
    expect(clipped.fixes.map((f) => f.title).join(' ')).toMatch(/Back away from the microphone/i);
  });

  it('notices trailing off instead of counting the tail as a pause', () => {
    const tailing = synth({ seconds: 45, spoken: 0.95, silentTail: 6 });
    const r = analyseSpeech(tailing, SR, { targetSeconds: 45 });
    expect(r.trailingSilence).toBeGreaterThan(3);
    expect(r.fixes.map((f) => f.title)).toContain('Finish with a full sentence');
  });

  it('keeps every trait and the band inside 0…5 on half points, for any input', () => {
    const cases = [
      synth({ seconds: 45, spoken: 0.2 }),
      synth({ seconds: 3, spoken: 0.9 }),
      synth({ seconds: 60, spoken: 0.99, hz: 6 }),
      new Float32Array(SR * 2),
    ];
    for (const pcm of cases) {
      const r = analyseSpeech(pcm, SR, { targetSeconds: 45 });
      for (const v of Object.values(r.scores)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
        expect(Math.round(v * 2)).toBe(v * 2);
      }
      expect(r.band).toBeGreaterThanOrEqual(0);
      expect(r.band).toBeLessThanOrEqual(5);
      expect(r.fixes.length).toBeLessThanOrEqual(3);
    }
  });

  it('orders fixes by severity so the biggest problem is read first', () => {
    const rough = synth({ seconds: 12, spoken: 0.5, level: 0.02 });
    const r = analyseSpeech(rough, SR, { targetSeconds: 45 });
    const rank = { high: 0, med: 1, low: 2 } as const;
    const tones = r.fixes.map((f) => f.tone);
    expect(tones).toEqual([...tones].sort((a, b) => rank[a] - rank[b]));
  });
});

// The recorder used to throw the audio away ("in a real app you would upload
// this"). These pins keep the scoring wired into the real page.
describe('speaking feedback — wired into the TOEFL speaking page', () => {
  it('scores every recording with the file the tests use, and never uploads it', () => {
    expect(speakingPage).toContain("import { analyseAudioBlob, RUBRIC_VERSION } from '../assets/js/cmc-speaking-rubric.js';");
    expect(speakingPage).toContain("import * as practice from '../assets/js/cmc-practice-attempts.js';");
    expect(speakingPage).toContain('window.CMCSpeakingRubric = { analyseAudioBlob, RUBRIC_VERSION };');
    expect(speakingPage).toContain('cmcAnalyseResponse(questionId, audioBlob);');
    expect(speakingPage).toContain('your audio is never uploaded');
  });

  it('keeps the recorder\'s real mime type instead of claiming wav', () => {
    // Regression: chunks were webm/opus but the blob was labelled audio/wav,
    // so decoders rejected it and every recording scored as silence.
    expect(speakingPage).toContain('mediaRecorder.mimeType');
    expect(speakingPage).not.toContain("new Blob(audioChunks, { type: 'audio/wav' })");
  });

  it('gives each question a delivery chip and the results modal a summary', () => {
    expect(speakingPage).toContain('id="speaking-feedback"');
    expect(speakingPage).toContain("chip.id = 'delivery-' + id");
    expect(speakingPage).toContain('cmcRenderSpeakingSummary();');
    expect(speakingPage).toContain("skill: 'speaking'");
    expect(speakingPage).toContain('href="../assets/css/cmc-coach.css"');
  });

  it('does not pretend to judge pronunciation or content from audio alone', () => {
    expect(speakingPage).toContain('pronunciation and content need a listener or a transcript');
    expect(speakingPage).toContain('Delivery only');
  });
});
