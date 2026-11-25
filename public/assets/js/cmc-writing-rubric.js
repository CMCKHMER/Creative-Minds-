/* ============================================================
   CMC WRITING RUBRIC — the "Essay Feedback" half of AI Phase 01.
   ------------------------------------------------------------
   A deterministic, offline rubric engine for the two TOEFL iBT
   writing tasks (the e-mail task and the academic discussion).
   It is ES-module code with no dependencies so it can be used by
   a static page (`import`) and by vitest (`import`) without a
   build step or a duplicate copy.

   WHY NOT AN LLM
     · cost      every essay would be a paid API call, forever;
     · privacy   a child's essay would leave the device;
     · latency   a band estimate can be ready in ~2 ms;
     · honesty   reading the prompt's own text back with evidence
                 beats a black box that says "6.5/9".
   The interface is intentionally a plain function so a server-side
   model can be added later as a second opinion, keyed off the same
   shape (`analyseEssay` → `{ scores, band, fixes }`).

   WHAT IT MEASURES (all from the text itself)
     task        length vs the task minimum, prompt-keyword
                 coverage, e-mail conventions (greeting + sign-off)
     development paragraphs, sentence count, worked examples
     coherence   connective density, sentence-starter variety
     language    sentence-length band, lexical variety, mechanics
   Scores are 0–5 per trait (TOEFL-style halving), and the band is
   the weighted mean rounded to the nearest 0.5. `estimate` maps it
   onto the 0–30 writing scale for familiarity — it is an ESTIMATE
   and every UI must say so.
   ============================================================ */

const CONNECTIVES = [
  'however', 'therefore', 'moreover', 'furthermore', 'nevertheless', 'meanwhile',
  'although', 'though', 'because', 'since', 'while', 'whereas', 'in addition',
  'for example', 'for instance', 'such as', 'as a result', 'on the other hand',
  'in contrast', 'firstly', 'secondly', 'finally', 'in conclusion', 'to sum up',
  'besides', 'additionally', 'consequently', 'that said', 'instead', 'likewise',
];

const EXAMPLE_MARKERS = ['for example', 'for instance', 'such as', 'e.g.', 'like when', 'in my experience'];

const GREETINGS = ['dear', 'hi ', 'hello', 'good morning', 'good afternoon', 'hi,', 'hey'];
const SIGN_OFFS = ['best', 'regards', 'sincerely', 'thank you', 'thanks', 'best wishes', 'yours', 'cheers'];

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with',
  'about', 'as', 'into', 'than', 'that', 'this', 'these', 'those', 'it', 'its', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'am', 'do', 'does', 'did', 'have', 'has', 'had', 'i', 'you', 'he', 'she', 'we', 'they', 'me',
  'him', 'her', 'us', 'them', 'my', 'your', 'his', 'their', 'our', 'not', 'no', 'yes', 'can', 'could', 'should',
  'would', 'will', 'may', 'might', 'must', 'there', 'here', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
  'how', 'from', 'up', 'down', 'out', 'over', 'under', 'again', 'very', 'just', 'also', 'too', 'more', 'most',
  'some', 'any', 'all', 'both', 'each', 'other', 'own', 'same', 'only', 'such', 'because', 'while', 'during',
]);

/** Lowercase word tokens, punctuation stripped. */
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 0);
}

/** Sentences = spans ending in . ! ? (a trailing fragment still counts). */
function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function roundHalf(n) {
  return Math.round(n * 2) / 2;
}

/** Content words of the prompt, used for on-topic coverage. */
function promptKeywords(prompt) {
  return Array.from(new Set(tokenize(prompt).filter((w) => w.length > 3 && !STOPWORDS.has(w))));
}

function countPhrase(haystackLower, phrase) {
  if (!phrase) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystackLower.indexOf(phrase, from);
    if (at === -1) return count;
    count += 1;
    from = at + phrase.length;
  }
}

/**
 * Analyse one writing response.
 *
 * @param {string} text  what the student wrote
 * @param {{
 *   kind?: 'email'|'discussion',
 *   minWords?: number,
 *   prompt?: string,
 * }} [options]
 * @returns {{
 *   ok: boolean, reason?: string,
 *   words: number, sentences: number, paragraphs: number, avgSentence: number,
 *   uniqueRatio: number, connectives: {count: number, unique: number, used: string[]},
 *   keywords: {coverage: number, missing: string[]},
 *   mechanics: {startsWithCapital: boolean, endsWithPunctuation: boolean, lowercaseI: number, doubleSpaces: number},
 *   scores: {task: number, development: number, coherence: number, language: number},
 *   band: number, estimate: number,
 *   fixes: Array<{tone: 'high'|'med'|'low', title: string, detail: string}>,
 *   strengths: string[],
 * }}
 */
export function analyseEssay(text, options = {}) {
  const kind = options.kind === 'discussion' ? 'discussion' : 'email';
  const minWords = Number.isFinite(options.minWords) ? options.minWords : kind === 'email' ? 80 : 100;
  const prompt = options.prompt || '';
  const raw = String(text || '');
  const trimmed = raw.trim();
  const tokens = tokenize(trimmed);
  const words = tokens.length;

  if (words < 10) {
    return {
      ok: false,
      reason: 'too-short',
      words,
      sentences: 0,
      paragraphs: 0,
      avgSentence: 0,
      uniqueRatio: 0,
      connectives: { count: 0, unique: 0, used: [] },
      keywords: { coverage: 0, missing: [] },
      mechanics: { startsWithCapital: false, endsWithPunctuation: false, lowercaseI: 0, doubleSpaces: 0 },
      scores: { task: 0, development: 0, coherence: 0, language: 0 },
      band: 0,
      estimate: 8,
      fixes: [{ tone: 'high', title: 'Write at least 10 words', detail: 'There is not enough text to judge yet. Aim for the task minimum so the analysis has something to work with.' }],
      strengths: [],
      };
  }

  const sentences = splitSentences(trimmed);
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length
    || trimmed.split(/\n/).filter((p) => p.trim().length > 0).length;
  const lower = ` ${trimmed.toLowerCase()} `;
  const avgSentence = sentences.length ? words / sentences.length : words;

  const unique = new Set(tokens);
  const uniqueRatio = words ? unique.size / words : 0;

  // ---- connectives -------------------------------------------------------
  const used = CONNECTIVES.filter((c) => countPhrase(lower, c) > 0);
  const connectiveCount = used.reduce((n, c) => n + countPhrase(lower, c), 0);
  const connectivePer100 = words ? (connectiveCount / words) * 100 : 0;

  // ---- on-topic coverage -------------------------------------------------
  const keys = promptKeywords(prompt);
  const covered = keys.filter((k) => lower.includes(k));
  const missing = keys.filter((k) => !covered.includes(k)).slice(0, 8);
  const coverage = keys.length ? covered.length / keys.length : 1;

  // ---- mechanics ---------------------------------------------------------
  const lowercaseI = (raw.match(/(^|[\s("'])i(?=[\s.,!?)"']|$)/g) || []).length;
  const mechanics = {
    startsWithCapital: /^[A-Z0-9"'“‘(]/.test(trimmed),
    endsWithPunctuation: /[.!?]"?$/.test(trimmed),
    lowercaseI,
    doubleSpaces: (raw.match(/ {2,}/g) || []).length,
  };

  // ---- e-mail conventions ------------------------------------------------
  const hasGreeting = GREETINGS.some((g) => lower.slice(0, 60).includes(g));
  const tail = lower.slice(-120);
  const hasSignOff = SIGN_OFFS.some((s) => tail.includes(s));

  // ---- sentence-starter variety -----------------------------------------
  const starters = sentences
    .map((s) => (tokenize(s)[0] || ''))
    .filter(Boolean);
  const starterCounts = starters.reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const worstStarter = Object.entries(starterCounts).sort((a, b) => b[1] - a[1])[0];
  const worstStarterShare = starters.length && worstStarter ? worstStarter[1] / starters.length : 0;

  const exampleCount = EXAMPLE_MARKERS.reduce((n, m) => n + countPhrase(lower, m), 0);

  // ---- trait scores (0–5, half points) -----------------------------------
  let task = 5;
  if (words < minWords) task -= clamp(((minWords - words) / minWords) * 4, 0.5, 3);
  if (coverage < 0.4) task -= 1;
  else if (coverage < 0.6) task -= 0.5;
  if (kind === 'email') {
    if (!hasGreeting) task -= 0.75;
    if (!hasSignOff) task -= 0.75;
  }
  // A perfect task score is reserved for an answer that hits nearly every
  // prompt keyword as well as the conventions — otherwise 4.5 is the ceiling.
  if (task >= 5 && !(coverage >= 0.8 && words >= minWords)) task = 4.5;
  task = roundHalf(clamp(task, 0, 5));

  let development = 1;
  if (words >= minWords * 0.5) development = 3;
  if (words >= minWords) development = 4;
  if (words >= minWords * 1.4) development = 4.5;
  if (paragraphs >= 2) development += 0.5;
  if (exampleCount >= 2) development += 0.5;
  else if (exampleCount === 1) development += 0.25;
  if (sentences.length < 4) development -= 0.5;
  // 5.0 needs both a worked example and real length, not just paragraphs.
  if (development >= 5 && !(words >= minWords * 1.3 && paragraphs >= 2)) development = 4.5;
  development = roundHalf(clamp(development, 0, 5));

  let coherence;
  if (connectivePer100 >= 4) coherence = 5;
  else if (connectivePer100 >= 2.5) coherence = 4;
  else if (connectivePer100 >= 1) coherence = 3;
  else if (connectivePer100 > 0) coherence = 2;
  else coherence = 1;
  if (worstStarterShare > 0.5 && starters.length >= 4) coherence -= 0.5;
  if (paragraphs === 1 && words > 120) coherence -= 0.5;
  // 5.0 needs varied openings and more than one linking habit.
  if (coherence >= 5 && !(used.length >= 4 && paragraphs >= 2 && worstStarterShare <= 0.35)) coherence = 4.5;
  coherence = roundHalf(clamp(coherence, 0, 5));

  let language = 5;
  if (avgSentence < 7) language -= 1.5;
  else if (avgSentence < 10) language -= 0.5;
  if (avgSentence > 28) language -= 1;
  if (uniqueRatio < 0.3) language -= 1.5;
  else if (uniqueRatio < 0.4) language -= 0.5;
  if (lowercaseI > 0) language -= 0.5;
  if (!mechanics.startsWithCapital) language -= 0.5;
  if (!mechanics.endsWithPunctuation) language -= 0.5;
  // 5.0 needs a wide vocabulary, a mid-range sentence length and clean mechanics.
  const languageClean =
    uniqueRatio >= 0.5 &&
    avgSentence >= 10 &&
    avgSentence <= 22 &&
    lowercaseI === 0 &&
    mechanics.startsWithCapital &&
    mechanics.doubleSpaces === 0;
  if (language >= 5 && !languageClean) language = 4.5;
  language = roundHalf(clamp(language, 0, 5));

  const band = roundHalf(task * 0.35 + development * 0.2 + coherence * 0.25 + language * 0.2);
  const estimate = clamp(Math.round(8 + band * 4.4), 8, 30);

  // ---- concrete fixes ----------------------------------------------------
  const fixes = [];
  if (words < minWords) {
    fixes.push({
      tone: 'high',
      title: `Add ${Math.ceil(minWords - words)} more words`,
      detail: `This task needs about ${minWords}. You wrote ${words}. One extra reason plus one example usually covers the gap.`,
    });
  }
  if (kind === 'email' && !hasGreeting) {
    fixes.push({ tone: 'high', title: 'Open with a greeting', detail: 'Start with “Dear Mr Sok,” or “Hi Anna,” — the e-mail task is marked on its conventions.' });
  }
  if (kind === 'email' && !hasSignOff) {
    fixes.push({ tone: 'med', title: 'Close with a sign-off', detail: 'End with “Best regards,” and your name. Without it the response reads as unfinished.' });
  }
  if (connectivePer100 < 2) {
    fixes.push({
      tone: 'high',
      title: 'Link your ideas',
      detail: `Only ${connectiveCount} linking words in ${words} words. Join sentences with “however”, “because”, “for example”, “as a result”.`,
    });
  }
  if (worstStarterShare > 0.4 && starters.length >= 4) {
    fixes.push({
      tone: 'med',
      title: 'Vary your sentence openings',
      detail: `${worstStarter[1]} of your ${starters.length} sentences start with “${worstStarter[0]}”. Move the time or reason phrase to the front instead.`,
    });
  }
  if (uniqueRatio < 0.4) {
    fixes.push({ tone: 'med', title: 'Repeat fewer words', detail: `Only ${Math.round(uniqueRatio * 100)}% of your words are different ones. Swap the repeated noun or verb for a synonym.` });
  }
  if (avgSentence > 26) {
    fixes.push({ tone: 'med', title: 'Split the long sentences', detail: `Your sentences average ${avgSentence.toFixed(0)} words. Break anything over 25 into two — a full stop costs nothing.` });
  }
  if (avgSentence < 8 && words > 40) {
    fixes.push({ tone: 'low', title: 'Combine very short sentences', detail: 'Sentences average under 8 words, which reads choppy. Join two with “because” or “while”.' });
  }
  if (lowercaseI > 0) {
    fixes.push({ tone: 'low', title: 'Capitalise “I”', detail: `“i” appeared ${lowercaseI} time${lowercaseI === 1 ? '' : 's'} lowercase. It is always capital in English.` });
  }
  if (!mechanics.endsWithPunctuation) {
    fixes.push({ tone: 'low', title: 'Finish the last sentence', detail: 'The response ends without . ! or ? — the reader cannot tell it is complete.' });
  }
  if (coverage < 0.5 && keys.length) {
    fixes.push({
      tone: 'high',
      title: 'Answer the prompt more directly',
      detail: `The prompt’s key ideas are thin in your answer. It asks about: ${missing.slice(0, 4).join(', ')}.`,
    });
  }

  const order = { high: 0, med: 1, low: 2 };
  fixes.sort((a, b) => order[a.tone] - order[b.tone]);

  // ---- what went right ---------------------------------------------------
  const strengths = [];
  if (words >= minWords) strengths.push(`Long enough (${words} words against a ${minWords}-word target).`);
  if (connectivePer100 >= 3) strengths.push(`well linked — ${connectiveCount} connecting phrases.`);
  if (paragraphs >= 2) strengths.push(`${paragraphs} paragraphs, so the reader can follow the structure.`);
  if (exampleCount >= 1) strengths.push('You supported your point with an example.');
  if (kind === 'email' && hasGreeting && hasSignOff) strengths.push('Proper e-mail shape: greeting and sign-off.');
  if (uniqueRatio >= 0.45) strengths.push('Varied vocabulary.');
  if (!strengths.length) strengths.push('You wrote something. Now give it one example and one connecting word and it will move.');

  return {
    ok: true,
    words,
    sentences: sentences.length,
    paragraphs,
    avgSentence: Math.round(avgSentence * 10) / 10,
    uniqueRatio: Math.round(uniqueRatio * 100) / 100,
    connectives: { count: connectiveCount, unique: used.length, used: used.slice(0, 8) },
    keywords: { coverage: Math.round(coverage * 100) / 100, missing },
    mechanics,
    scores: { task, development, coherence, language },
    band,
    estimate,
    fixes: fixes.slice(0, 3),
    strengths: strengths.slice(0, 3),
  };
}

/** The engine version, surfaced in the UI so feedback can be traced. */
export const RUBRIC_VERSION = '1.0.0';

export default { analyseEssay, RUBRIC_VERSION };
