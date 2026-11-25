/* ============================================================
   CMC SPEAKING RUBRIC — the "Speaking Coach" half of AI Phase 01.
   ------------------------------------------------------------
   Scores a TOEFL speaking response from the AUDIO SIGNAL ONLY.
   No transcript, no upload, no API: the recording is decoded in the
   browser with WebAudio and measured.

   WHAT IT CAN HONESTLY MEASURE
     fluency   pause ratio, pause count, longest pause, pace (syllable
               peaks -> approximate words per minute)
     clarity   speech level, level stability (mic technique), clipping
     pacing    time used against the task's limit, whether it trails off

   WHAT IT CANNOT MEASURE — say this in every UI that shows a score
     · pronunciation accuracy (needs the words — that is the AI Logic
       second-opinion path, not this engine)
     · grammar or content (needs a transcript)

   The engine is deliberately pure: `analyseSpeech(pcm, sampleRate, opts)`
   takes a Float32Array, so vitest can feed it synthetic waveforms.
   `analyseAudioBlob` is the thin browser wrapper that decodes a Blob.
   ============================================================ */

const FRAME_SECONDS = 0.05;      // 50 ms analysis frames
const PAUSE_SECONDS = 0.45;      // silence this long counts as a pause
const LONG_PAUSE_SECONDS = 1.2;  // "you got stuck" threshold

/** Clamp to [lo, hi]. */
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/** Round to half points, like a band. */
function roundHalf(n) {
  return Math.round(n * 2) / 2;
}

/** Value at `p` (0–1) of a sorted copy of `values`. */
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const idx = clamp(Math.round(p * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx];
}

function mean(values) {
  if (!values.length) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i];
  return sum / values.length;
}

function stdev(values, avg) {
  if (values.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    const d = values[i] - avg;
    sum += d * d;
  }
  return Math.sqrt(sum / (values.length - 1));
}

/** Root-mean-square level of each 50 ms frame. */
function frameLevels(pcm, sampleRate) {
  const frameSize = Math.max(1, Math.round(sampleRate * FRAME_SECONDS));
  const levels = [];
  for (let start = 0; start + frameSize <= pcm.length; start += frameSize) {
    let sum = 0;
    for (let i = start; i < start + frameSize; i += 1) sum += pcm[i] * pcm[i];
    levels.push(Math.sqrt(sum / frameSize));
  }
  return { levels, frameSize };
}

/** Count energy peaks in the voiced frames — a rough syllable counter. */
function countSyllablePeaks(levels, threshold) {
  let peaks = 0;
  for (let i = 1; i < levels.length - 1; i += 1) {
    const v = levels[i];
    if (v < threshold) continue;
    if (v >= levels[i - 1] && v > levels[i + 1] && v > threshold * 1.25) peaks += 1;
  }
  return peaks;
}

/**
 * Analyse a speaking response from decoded mono PCM.
 *
 * @param {Float32Array} pcm  mono samples in -1…1
 * @param {number} sampleRate  e.g. 48000
 * @param {{ targetSeconds?: number, kind?: 'repeat'|'interview' }} [options]
 * @returns {{
 *   ok: boolean, reason?: 'silent'|'short',
 *   seconds: number, speechSeconds: number, pauseRatio: number,
 *   pauses: number, longPauses: number, longestPause: number,
 *   wordsPerMinute: number, level: number, levelVariation: number, clipping: number,
 *   trailingSilence: number,
 *   scores: { fluency: number, clarity: number, pacing: number },
 *   band: number,
 *   fixes: Array<{tone:'high'|'med'|'low', title: string, detail: string}>,
 *   strengths: string[],
 * }}
 */
export function analyseSpeech(pcm, sampleRate, options = {}) {
  const sr = Number(sampleRate) > 0 ? Number(sampleRate) : 48000;
  const target = Number.isFinite(options.targetSeconds) ? Number(options.targetSeconds) : 45;
  const samples = pcm && typeof pcm.length === 'number' ? pcm : new Float32Array(0);

  const seconds = samples.length / sr;
  const { levels } = frameLevels(samples, sr);

  // Adaptive speech threshold: a quiet room still has a noise floor, and a
  // loud room still has peaks. 12% of the loud level, but never below 0.006.
  const loud = percentile(levels, 0.95);
  const threshold = Math.max(0.006, loud * 0.12);

  const voiced = levels.map((v) => v > threshold);
  const voicedCount = voiced.filter(Boolean).length;
  const speechSeconds = voicedCount * FRAME_SECONDS;
  const pauseRatio = seconds > 0 ? 1 - speechSeconds / seconds : 0;

  // Pause runs
  let pauses = 0;
  let longPauses = 0;
  let longestPause = 0;
  let run = 0;
  let trailingSilence = 0;
  for (let i = 0; i < voiced.length; i += 1) {
    if (!voiced[i]) {
      run += 1;
    } else if (run > 0) {
      const secs = run * FRAME_SECONDS;
      if (secs >= PAUSE_SECONDS) pauses += 1;
      if (secs >= LONG_PAUSE_SECONDS) longPauses += 1;
      longestPause = Math.max(longestPause, secs);
      run = 0;
    }
  }
  if (run > 0) {
    // Silence at the end is "trailing off", not a pause.
    trailingSilence = run * FRAME_SECONDS;
    if (trailingSilence < 3) {
      const secs = trailingSilence;
      if (secs >= PAUSE_SECONDS) pauses += 1;
      longestPause = Math.max(longestPause, secs);
    }
  }

  const voicedLevels = levels.filter((v, i) => voiced[i]);
  const level = mean(voicedLevels);
  const levelVariation = level > 0 ? stdev(voicedLevels, level) / level : 0;

  let clipping = 0;
  for (let i = 0; i < samples.length; i += 1) {
    if (Math.abs(samples[i]) >= 0.985) clipping += 1;
  }
  clipping = samples.length ? clipping / samples.length : 0;

  const peaks = countSyllablePeaks(levels, threshold);
  // ~1.5 syllables per English word is the usual rule of thumb.
  const wordsPerMinute = speechSeconds > 0.5 ? (peaks / speechSeconds) * 60 / 1.5 : 0;

  const base = {
    seconds: Math.round(seconds * 10) / 10,
    speechSeconds: Math.round(speechSeconds * 10) / 10,
    pauseRatio: Math.round(pauseRatio * 100) / 100,
    pauses,
    longPauses,
    longestPause: Math.round(longestPause * 10) / 10,
    wordsPerMinute: Math.round(wordsPerMinute),
    level: Math.round(level * 1000) / 1000,
    levelVariation: Math.round(levelVariation * 100) / 100,
    clipping: Math.round(clipping * 10000) / 10000,
    trailingSilence: Math.round(trailingSilence * 10) / 10,
    scores: { fluency: 0, clarity: 0, pacing: 0 },
    band: 0,
    fixes: [{ tone: 'high', title: 'Nothing was recorded', detail: 'The microphone captured silence. Check the mic permission and record again.' }],
    strengths: [],
  };

  if (seconds < 1.5 || speechSeconds < 0.8) {
    return { ok: false, reason: 'silent', ...base };
  }

  // ---- fluency -----------------------------------------------------------
  let fluency;
  if (pauseRatio <= 0.08) fluency = 5;
  else if (pauseRatio <= 0.15) fluency = 4.5;
  else if (pauseRatio <= 0.25) fluency = 3.5;
  else if (pauseRatio <= 0.35) fluency = 2.5;
  else fluency = 2;
  if (longPauses >= 3) fluency -= 1;
  else if (longPauses >= 1) fluency -= 0.5;
  if (wordsPerMinute > 0) {
    if (wordsPerMinute < 60 || wordsPerMinute > 220) fluency -= 1;
    else if (wordsPerMinute < 85 || wordsPerMinute > 180) fluency -= 0.5;
  }
  fluency = roundHalf(clamp(fluency, 0, 5));

  // ---- clarity -----------------------------------------------------------
  let clarity = 5;
  if (level < 0.02) clarity = 1.5;
  else if (level < 0.04) clarity = 3;
  else if (level < 0.06) clarity = 4;
  if (clipping > 0.02) clarity -= 2;
  else if (clipping > 0.005) clarity -= 1;
  if (levelVariation > 0.9) clarity -= 1.5;
  else if (levelVariation > 0.6) clarity -= 0.75;
  clarity = roundHalf(clamp(clarity, 0, 5));

  // ---- pacing (time management) -----------------------------------------
  const used = seconds / target;
  let pacing;
  if (used >= 0.75 && used <= 1.1) pacing = 5;
  else if (used >= 0.6) pacing = 4;
  else if (used >= 0.4) pacing = 3;
  else if (used >= 0.2) pacing = 2;
  else pacing = 1;
  if (trailingSilence >= 3) pacing -= 0.5; // ran out of words, sat there
  pacing = roundHalf(clamp(pacing, 0, 5));

  const band = roundHalf(fluency * 0.4 + clarity * 0.3 + pacing * 0.3);

  // ---- fixes -------------------------------------------------------------
  const fixes = [];
  if (pauseRatio > 0.25) {
    fixes.push({
      tone: 'high',
      title: `Fill ${Math.round(pauseRatio * 100)}% of the time you were silent`,
      detail: `${pauses} pause${pauses === 1 ? '' : 's'}${longestPause >= 1.2 ? `, longest ${longestPause.toFixed(1)} s` : ''}. Prepare two reasons before you start so you always have the next sentence ready.`,
    });
  }
  if (longPauses >= 2) {
    fixes.push({
      tone: 'high',
      title: 'Do not restart after a long pause',
      detail: `You stopped for over a second ${longPauses} times. A short filler ("so, for example…") keeps the answer moving and costs less than silence.`,
    });
  }
  if (level > 0 && level < 0.04) {
    fixes.push({ tone: 'high', title: 'Speak up or move closer to the mic', detail: `Your voice sits at ${(level * 100).toFixed(0)}% of full scale. Aim for roughly half — quiet speech is scored as unclear.` });
  }
  if (clipping > 0.005) {
    fixes.push({ tone: 'med', title: 'Back away from the microphone', detail: `The recording clipped for ${(clipping * 100).toFixed(1)}% of the samples, which distorts consonants.` });
  }
  if (used < 0.6) {
    fixes.push({
      tone: 'high',
      title: `Use the whole ${Math.round(target)} seconds`,
      detail: `You spoke for ${base.seconds} s. Add one example after your opinion: name a person, a place or a number.`,
    });
  }
  if (wordsPerMinute > 0 && wordsPerMinute < 85) {
    fixes.push({ tone: 'med', title: 'Pick up the pace a little', detail: `About ${wordsPerMinute} words per minute — a comfortable range is 110–150. Short sentences help more than speed.` });
  }
  if (wordsPerMinute > 180) {
    fixes.push({ tone: 'med', title: 'Slow down slightly', detail: `About ${wordsPerMinute} words per minute. Pause at commas so the listener can follow.` });
  }
  if (trailingSilence >= 3) {
    fixes.push({ tone: 'low', title: 'Finish with a full sentence', detail: `The last ${trailingSilence.toFixed(0)} s were silent — end on a complete point instead of running out.` });
  }
  if (levelVariation > 0.6) {
    fixes.push({ tone: 'low', title: 'Keep a steady distance from the mic', detail: 'Your volume swings a lot, which usually means the phone moved. Rest it on the desk.' });
  }

  const order = { high: 0, med: 1, low: 2 };
  fixes.sort((a, b) => order[a.tone] - order[b.tone]);

  // ---- strengths ---------------------------------------------------------
  const strengths = [];
  if (pauseRatio <= 0.15) strengths.push('You kept talking — almost no dead air.');
  if (used >= 0.75) strengths.push(`You used ${Math.round(used * 100)}% of the time available.`);
  if (level >= 0.06 && clipping <= 0.005) strengths.push('Clear, steady volume.');
  if (wordsPerMinute >= 100 && wordsPerMinute <= 160) strengths.push(`Good pace (~${wordsPerMinute} words per minute).`);
  if (!strengths.length) strengths.push('You recorded a full answer — that is the hard part. Fix the pause habit next.');

  return {
    ok: true,
    ...base,
    scores: { fluency, clarity, pacing },
    band,
    fixes: fixes.slice(0, 3),
    strengths: strengths.slice(0, 3),
  };
}

/** Browser helper: decode a recorded Blob and score it. Returns null when the
 *  browser cannot decode the format (the caller then shows no score, never a
 *  fake one). */
export async function analyseAudioBlob(blob, options = {}) {
  if (typeof window === 'undefined' || !blob || !blob.size) return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const buffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => ctx.decodeAudioData(reader.result, resolve, reject);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    // Mix to mono — a phone may record stereo.
    const channels = buffer.numberOfChannels;
    let mono = buffer.getChannelData(0);
    if (channels > 1) {
      const mixed = new Float32Array(buffer.length);
      for (let c = 0; c < channels; c += 1) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i += 1) mixed[i] += data[i] / channels;
      }
      mono = mixed;
    }
    return analyseSpeech(mono, buffer.sampleRate, options);
  } catch {
    return null;
  } finally {
    try { await ctx.close(); } catch { /* already closed */ }
  }
}

/** Version surfaced in the UI so a score can be traced to its rules. */
export const RUBRIC_VERSION = '1.0.0';

export default { analyseSpeech, analyseAudioBlob, RUBRIC_VERSION };
