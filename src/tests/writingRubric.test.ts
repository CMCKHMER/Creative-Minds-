// The essay-feedback engine behind AI Phase 01 (public/assets/js/cmc-writing-rubric.js).
//
// It is the one "AI" feature that ships without a paid API, so the thing that
// must not drift is the *reasoning*: a short answer must score lower than a
// complete one, an e-mail without a greeting must lose a point and say why, a
// text full of "i" must be told to capitalise, and the same text must always
// produce the same band (no randomness, no clock).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseEssay, RUBRIC_VERSION } from '../../public/assets/js/cmc-writing-rubric.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const writingPage = readFileSync(join(root, 'public', 'toefl-ibt', 'toeflwriting-MIGRATED.html'), 'utf8');

const EMAIL_PROMPT =
  'You are planning a business trip to another city. Your colleague Maria recently travelled there. ' +
  'Ask for recommendations about restaurants and activities, and mention what you would most like to do and avoid.';

const GOOD_EMAIL = `Dear Maria,

I am writing because I will travel to Phnom Penh next month for a three-day business trip with our finance team. Because you worked there last year, your recommendations would help me a lot.

First, could you suggest a few restaurants near the office? I would like somewhere local and inexpensive, for example the market you mentioned. In addition, I would appreciate ideas for the evening, such as a museum or a walk along the river.

However, I would prefer to avoid anywhere too loud, since I will be working early the next morning. Thank you for your help.

Best regards,
Dara`;

const WEAK_EMAIL = `i go trip next month i want food and things. i think it is good. i like city.`;

function email(text: string) {
  return analyseEssay(text, { kind: 'email', minWords: 70, prompt: EMAIL_PROMPT });
}

describe('analyseEssay — e-mail task', () => {
  it('is deterministic (same text, same band, no clock or random)', () => {
    const a = email(GOOD_EMAIL);
    const b = email(GOOD_EMAIL);
    expect(a).toEqual(b);
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('rewards a complete, structured e-mail', () => {
    const r = email(GOOD_EMAIL);
    expect(r.ok).toBe(true);
    expect(r.words).toBeGreaterThanOrEqual(70);
    expect(r.mechanics.startsWithCapital).toBe(true);
    expect(r.mechanics.endsWithPunctuation).toBe(false); // it ends with a signature line
    expect(r.scores.task).toBeGreaterThanOrEqual(4);
    expect(r.band).toBeGreaterThanOrEqual(3.5);
    expect(r.estimate).toBeGreaterThanOrEqual(20);
    expect(r.strengths.join(' ')).toMatch(/greeting and sign-off|Long enough/i);
  });

  it('scores a short, unpunctuated answer well below a complete one', () => {
    const weak = email(WEAK_EMAIL);
    const good = email(GOOD_EMAIL);
    expect(weak.band).toBeLessThan(good.band);
    expect(weak.scores.task).toBeLessThan(good.scores.task);
    expect(weak.words).toBeLessThan(70);
    // and it must SAY what to fix, starting with length
    expect(weak.fixes[0].title).toMatch(/Add \d+ more words/i);
    expect(weak.fixes.map((f) => f.title)).toContain('Open with a greeting');
    expect(weak.mechanics.lowercaseI).toBeGreaterThan(0);
    expect(weak.scores.language).toBeLessThan(good.scores.language);
  });

  it('notices a missing greeting and a missing sign-off separately', () => {
    const noGreeting = email(GOOD_EMAIL.replace('Dear Maria,', 'Hello there,').replace('Hello there,', 'I am writing to you.'));
    expect(noGreeting.fixes.map((f) => f.title)).toContain('Open with a greeting');
    const noSignOff = email(GOOD_EMAIL.replace('Thank you for your help.\n\nBest regards,\nDara', 'That is all.'));
    expect(noSignOff.fixes.map((f) => f.title)).toContain('Close with a sign-off');
  });

  it('asks for linking words when there are none', () => {
    const monotone = email(
      'Dear Maria, I am going to the city. The city is big. The food is good. The people are kind. I want to see the river. I want to eat rice. Thank you. Best regards, Dara.',
    );
    expect(monotone.connectives.count).toBe(0);
    expect(monotone.fixes.map((f) => f.title)).toContain('Link your ideas');
    expect(monotone.scores.coherence).toBeLessThanOrEqual(2);
  });

  it('counts the connectives it says it found', () => {
    const r = email(GOOD_EMAIL);
    expect(r.connectives.count).toBeGreaterThanOrEqual(3);
    expect(r.connectives.used.length).toBeGreaterThanOrEqual(3);
    expect(r.connectives.used).toContain('because');
    expect(r.connectives.used).toContain('however');
  });

  it('detects prompt coverage and names what is missing', () => {
    const offTopic = email(
      'Dear Maria, I am writing about my new bicycle. It is red and very fast. I ride it every morning before school because the roads are quiet. It was not expensive, and the shop gave me a free helmet. Best regards, Dara.',
    );
    expect(offTopic.keywords.coverage).toBeLessThan(0.5);
    expect(offTopic.keywords.missing.length).toBeGreaterThan(0);
    expect(offTopic.fixes.map((f) => f.title)).toContain('Answer the prompt more directly');
  });

  it('caps "fixes" at three and orders them by severity', () => {
    for (const text of [GOOD_EMAIL, WEAK_EMAIL, 'x '.repeat(80)]) {
      const r = email(text);
      expect(r.fixes.length).toBeLessThanOrEqual(3);
      const tones = r.fixes.map((f) => f.tone);
      const rank = { high: 0, med: 1, low: 2 } as const;
      const sorted = [...tones].sort((a, b) => rank[a] - rank[b]);
      expect(tones).toEqual(sorted);
    }
  });
});

describe('analyseEssay — discussion task', () => {
  const PROMPT = 'Some people believe digital nomadism will keep growing. Claire disagrees, Andrew agrees. Express and support your opinion.';

  it('applies the 100-word minimum of the discussion task', () => {
    const short = analyseEssay('I agree with Andrew because travel and internet access are both easier now.', { kind: 'discussion', prompt: PROMPT });
    expect(short.ok).toBe(true);
    expect(short.fixes.some((f) => /more words/i.test(f.title))).toBe(true);

    const long = analyseEssay(
      'I agree with Andrew, although Claire makes a fair point about stability. ' +
        'Because remote tools improve every year, a designer can work from Kampong Cham as easily as from Phnom Penh. ' +
        'For example, my cousin writes software for a company in Singapore while living with his family in the province. ' +
        'However, digital nomadism is not only about travel: it gives small towns a chance to keep their young people. ' +
        'For instance, a coworking space opened in Battambang last year and now employs twelve graduates. ' +
        'Therefore I believe the trend will grow, as long as internet access keeps improving across the country. ' +
        'Claire is right that not every job can move, but many can, and the number is rising every single month.',
      { kind: 'discussion', prompt: PROMPT },
    );
    expect(long.words).toBeGreaterThanOrEqual(100);
    expect(long.scores.development).toBeGreaterThanOrEqual(3.5);
    expect(long.band).toBeGreaterThan(short.band);
  });
});

describe('analyseEssay — guard rails', () => {
  it('refuses to score almost nothing, and says so', () => {
    const empty = analyseEssay('', { kind: 'email' });
    expect(empty.ok).toBe(false);
    expect(empty.reason).toBe('too-short');
    expect(empty.band).toBe(0);
    expect(empty.fixes[0].title).toMatch(/at least 10 words/i);

    const stub = analyseEssay('I agree because it is good.', { kind: 'discussion' });
    expect(stub.ok).toBe(false);
  });

  it('keeps every score inside 0…5 and the band inside 0…5', () => {
    const texts = [GOOD_EMAIL, WEAK_EMAIL, 'a '.repeat(400), 'Word '.repeat(90).trim()];
    for (const text of texts) {
      const r = email(text);
      for (const v of Object.values(r.scores)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      }
      expect(r.band).toBeGreaterThanOrEqual(0);
      expect(r.band).toBeLessThanOrEqual(5);
      expect(r.estimate).toBeGreaterThanOrEqual(8);
      expect(r.estimate).toBeLessThanOrEqual(30);
      // half-point granularity, like a TOEFL band
      expect(Math.round(r.band * 2)).toBe(r.band * 2);
    }
  });

  it('does not blow up on punctuation-only or emoji input', () => {
    expect(() => analyseEssay('!!! ??? ...', { kind: 'email' })).not.toThrow();
    expect(() => analyseEssay('😀'.repeat(30), { kind: 'email' })).not.toThrow();
  });
});

// The engine is only worth anything if a student meets it in normal use, so the
// wiring on the real TOEFL writing page is pinned here too.
describe('essay feedback — wired into the TOEFL writing page', () => {
  it('shows the panel, loads the same engine file the tests use, and fills it on submit', () => {
    expect(writingPage).toContain('id="rubric-feedback"');
    expect(writingPage).toContain("import { analyseEssay, RUBRIC_VERSION } from '../assets/js/cmc-writing-rubric.js';");
    expect(writingPage).toContain("import * as practice from '../assets/js/cmc-practice-attempts.js';");
    expect(existsSync(join(root, 'public', 'assets', 'js', 'cmc-writing-rubric.js'))).toBe(true);

    // the call sits inside submitWriting, before the modal opens
    const submit = writingPage.slice(writingPage.indexOf('function submitWriting()'));
    const callIdx = submit.indexOf('cmcRenderRubric(emailText, discussionText);');
    const modalIdx = submit.indexOf("document.getElementById('results-modal').classList.remove('hidden');");
    expect(callIdx).toBeGreaterThan(-1);
    expect(modalIdx).toBeGreaterThan(callIdx);
  });

  it('tells students the feedback exists, and that it is an estimate', () => {
    expect(writingPage).toContain('scores both responses against the class rubric');
    expect(writingPage).toContain('not an official TOEFL score');
    expect(writingPage).toContain('nothing is uploaded');
  });

  it('degrades quietly if the engine fails to load', () => {
    expect(writingPage).toContain('if (!lib) { panel.hidden = true; return; }');
    expect(writingPage).toContain('<div id="rubric-feedback" class="cmc-rubric" aria-live="polite" hidden></div>');
  });
});
