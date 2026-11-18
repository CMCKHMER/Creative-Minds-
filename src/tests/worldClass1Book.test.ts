// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BOOK_DIR = resolve(ROOT, 'public/gep/world-class-1');

const EXPECTED_UNITS: ReadonlyArray<{ num: number; file: string; title: string }> = [
  { num: 1, file: 'unit.html', title: 'Who We Are' },
  { num: 2, file: 'unit2.html', title: 'The World Awaits' },
  { num: 3, file: 'unit3.html', title: 'The Great Energy Challenge' },
  { num: 4, file: 'unit4.html', title: "The World's a Stage" },
  { num: 5, file: 'unit5.html', title: 'No Need to Panic' },
  { num: 6, file: 'unit6.html', title: 'In Style' },
  { num: 7, file: 'unit7.html', title: 'On the Move' },
  { num: 8, file: 'unit8.html', title: 'Think Twice' },
  { num: 9, file: 'unit9.html', title: 'In the Wild' },
  { num: 10, file: 'unit10.html', title: 'Decisions, Decisions' },
  { num: 11, file: 'unit11.html', title: 'Rain or Shine' },
  { num: 12, file: 'unit12.html', title: "What's Your Game" },
];

function decodeEntities(raw: string): string {
  return raw
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

interface WC1Api {
  UNITS: Array<{ num: number; file: string; title: string }>;
  normalizeAnswer: (raw: string) => string;
  matchAnswer: (given: string, rawExpected: string) => boolean;
  checkExercise: (el: unknown) => { correct: number; total: number };
  toggleExerciseKey: (btn: unknown) => void;
  resetExercise: (btn: unknown) => void;
  resetUnit: () => void;
  toggleTheme: () => void;
  toggleGlobalKeys: () => void;
  readProgress: () => Record<string, { visited: boolean; checked: number; total: number }>;
}

/** Lightweight DOM harness to boot wc1-engine.js in node:vm without browser deps. */
function bootEngine(opts: { unit?: number; store?: Record<string, string> } = {}) {
  const store = new Map<string, string>(Object.entries(opts.store ?? {}));
  const rootAttrs = new Map<string, string>([['data-theme', 'dark']]);
  if (opts.unit) rootAttrs.set('data-unit', String(opts.unit));
  const rootClasses = new Set<string>();

  const makeClassList = (set: Set<string>) => ({
    add: (...names: string[]) => names.forEach((n) => set.add(n)),
    remove: (...names: string[]) => names.forEach((n) => set.delete(n)),
    contains: (n: string) => set.has(n),
    toggle: (n: string, force?: boolean) => {
      const next = force === undefined ? !set.has(n) : Boolean(force);
      if (next) set.add(n);
      else set.delete(n);
      return next;
    },
  });

  const documentElement = {
    classList: makeClassList(rootClasses),
    getAttribute: (k: string) => rootAttrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => { rootAttrs.set(k, String(v)); },
    removeAttribute: (k: string) => { rootAttrs.delete(k); },
  };

  const themeBtnAttrs = new Map<string, string>();
  const themeBtn = {
    textContent: '',
    setAttribute: (k: string, v: string) => { themeBtnAttrs.set(k, v); },
    getAttribute: (k: string) => themeBtnAttrs.get(k) ?? null,
    addEventListener: () => {},
  };

  const keyBtnAttrs = new Map<string, string>();
  const keyBtn = {
    textContent: '',
    setAttribute: (k: string, v: string) => { keyBtnAttrs.set(k, v); },
    getAttribute: (k: string) => keyBtnAttrs.get(k) ?? null,
    addEventListener: () => {},
  };

  const document = {
    readyState: 'complete',
    documentElement,
    querySelectorAll: (sel: string) => {
      if (sel === '[data-wc1-theme]') return [themeBtn];
      if (sel === '[data-wc1-keys]') return [keyBtn];
      return [];
    },
    querySelector: () => null,
    getElementById: () => null,
    createElement: (tag: string) => {
      const cls = new Set<string>();
      const attrs = new Map<string, string>();
      return {
        tagName: tag.toUpperCase(),
        className: '',
        textContent: '',
        style: {},
        classList: makeClassList(cls),
        setAttribute: (k: string, v: string) => { attrs.set(k, v); },
        getAttribute: (k: string) => attrs.get(k) ?? null,
      };
    },
    addEventListener: () => {},
  };

  const win: Record<string, unknown> = {
    document,
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    },
    location: { assign: () => {} },
    print: () => {},
    addEventListener: () => {},
  };

  const engineSrc = readFileSync(join(BOOK_DIR, 'wc1-engine.js'), 'utf8');
  runInNewContext(engineSrc, { window: win, document, console });

  return {
    win: win as unknown as {
      WC1: WC1Api;
      selectTFP: (btn: unknown) => void;
      selectSurvey: (opt: unknown) => void;
      selectTopic: (el: unknown) => void;
      rate: (star: unknown, num: number) => void;
    },
    store,
    rootAttrs,
    rootClasses,
    themeBtn,
    keyBtn,
    makeClassList,
  };
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`;
}

function runTeacherGate(opts: {
  scriptUrl: string | null;
  pathname: string;
  hostname?: string;
  store?: Record<string, string>;
}) {
  const store = new Map<string, string>(Object.entries(opts.store ?? {}));
  const rootAttrs = new Map<string, string>();
  const rootClasses = new Set<string>();
  const bodyChildren: Array<{ id?: string; textContent?: string }> = [];

  const makeEl = (): Record<string, unknown> => {
    const children: Array<Record<string, unknown>> = [];
    const el: Record<string, unknown> = {
      id: '',
      href: '',
      textContent: '',
      style: { cssText: '' },
      children,
      parentNode: null,
      setAttribute: () => {},
      appendChild: (child: Record<string, unknown>) => {
        child.parentNode = el;
        children.push(child);
      },
      removeChild: (child: Record<string, unknown>) => {
        const i = children.indexOf(child);
        if (i >= 0) children.splice(i, 1);
      },
    };
    return el;
  };

  const documentElement = {
    classList: {
      add: (c: string) => rootClasses.add(c),
      remove: (c: string) => rootClasses.delete(c),
      contains: (c: string) => rootClasses.has(c),
    },
    setAttribute: (k: string, v: string) => { rootAttrs.set(k, v); },
    getAttribute: (k: string) => rootAttrs.get(k) ?? null,
    appendChild: () => {},
  };

  const body = {
    appendChild: (el: Record<string, unknown>) => { bodyChildren.push(el); },
  };

  const document = {
    readyState: 'complete',
    hidden: false,
    currentScript: opts.scriptUrl ? { src: opts.scriptUrl } : null,
    documentElement,
    body,
    createElement: () => makeEl(),
    getElementById: (id: string) => bodyChildren.find((c) => c.id === id) ?? null,
    addEventListener: () => {},
  };

  const win: Record<string, unknown> = {
    document,
    location: {
      pathname: opts.pathname,
      search: '',
      hash: '#grammar',
      hostname: opts.hostname ?? 'cmckhmer.github.io',
    },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    },
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    addEventListener: () => {},
  };

  const gateSrc = readFileSync(join(BOOK_DIR, 'teacher-gate.js'), 'utf8');
  runInNewContext(gateSrc, { window: win, document, URL, console });

  return {
    allowed: Boolean(win.CMC_TEACHER_GATE_OK),
    locked: rootClasses.has('cmc-wc1-gate-locked'),
    overlayShown: bodyChildren.some((c) => c.id === 'cmc-wc1-gate-overlay'),
    theme: rootAttrs.get('data-theme'),
    lightClass: rootClasses.has('light'),
    gate: win.CMC_WC1_GATE as { appRoot: () => string; signInUrl: () => string; isTeacher: () => boolean },
  };
}

describe("World Class 1 Teacher's Book — assembly, GEP link & navigation sync", () => {
  it('links the World Class 1 teacher book from the live GEP Program card', () => {
    const hub = readFileSync(resolve(ROOT, 'src/components/GEPISecHub.tsx'), 'utf8');
    expect(hub).toContain("id: 'gep'");
    expect(hub).toContain("status: 'available'");
    expect(hub).toContain('./gep/world-class-1/index.html');
    expect(hub).toContain('./gep/world-class-1/unit.html');
    expect(hub).toContain('./gep/world-class-1/unit5.html');
    expect(hub).toContain('./gep/world-class-1/unit9.html');

    for (const f of ['index.html', 'main.html', 'teacher-gate.js', 'wc1-theme.css', 'wc1-engine.js']) {
      expect(existsSync(join(BOOK_DIR, f)), `${f} exists`).toBe(true);
    }
  });

  it('ships all 12 units with valid anchors, full 12-unit nav (including Unit 8), and no <base target="_blank">', () => {
    const indexHtml = readFileSync(join(BOOK_DIR, 'index.html'), 'utf8');
    expect(indexHtml).not.toMatch(/<base\b/i);
    expect(indexHtml).toContain('teacher-gate.js');
    expect(indexHtml).toContain('wc1-theme.css');
    expect(indexHtml).toContain('wc1-engine.js');

    for (const unit of EXPECTED_UNITS) {
      const full = join(BOOK_DIR, unit.file);
      expect(existsSync(full), unit.file).toBe(true);
      const html = readFileSync(full, 'utf8');

      // Book overview links to every unit and every section jump exists inside the unit
      expect(indexHtml).toContain(`href="${unit.file}"`);
      for (const anchor of ['outcomes', 'vocab', 'grammar', 'listening', 'reading', 'video', 'writing', 'speaking', 'fluency']) {
        expect(html, `${unit.file} has #${anchor}`).toContain(`id="${anchor}"`);
      }

      // Regression pins: no <base target="_blank">, no dead WorldClass1_Overview.html, no undefined --uN vars
      expect(html, `${unit.file} no <base>`).not.toMatch(/<base\b/i);
      expect(html, `${unit.file} no dead overview`).not.toContain('WorldClass1_Overview');
      expect(html, `${unit.file} no legacy --uN vars`).not.toMatch(/var\(--(?:u\d+|unit\d+)\b/);

      // Unit header, gate, theme, engine, all 12 unit pills, and prev/next navigation
      expect(html).toContain(`data-unit="${unit.num}"`);
      expect(decodeEntities(html)).toContain(`<h1>${unit.title}</h1>`);
      expect(html).toContain('<script src="teacher-gate.js"></script>');
      expect(html).toContain('<link rel="stylesheet" href="wc1-theme.css">');
      expect(html).toContain('<script src="wc1-engine.js"></script>');

      const pills = [...html.matchAll(/class="wc1-unit-pill(?:\s+active)?"/g)];
      expect(pills, `${unit.file} has 12 unit pills`).toHaveLength(12);
      expect(html).toContain(`href="${unit.file}" class="wc1-unit-pill active"`);

      if (unit.num > 1) {
        expect(html, `${unit.file} links prev unit`).toContain(`href="${EXPECTED_UNITS[unit.num - 2].file}"`);
      }
      if (unit.num < 12) {
        expect(html, `${unit.file} links next unit`).toContain(`href="${EXPECTED_UNITS[unit.num].file}"`);
      }

      // Every #hash in section-nav matches a real id on the page
      const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
      for (const m of html.matchAll(/href="#([^"]+)"/g)) {
        expect(ids.has(m[1]), `${unit.file} anchor #${m[1]}`).toBe(true);
      }

      // Every gradable exercise has Check, Show Key, Reset, and a feedback status box
      const gradables = [...html.matchAll(/data-gradable="1"/g)].length;
      const checks = [...html.matchAll(/onclick="WC1\.checkExercise\(this\)"/g)].length;
      const keys = [...html.matchAll(/onclick="WC1\.toggleExerciseKey\(this\)"/g)].length;
      const resets = [...html.matchAll(/onclick="WC1\.resetExercise\(this\)"/g)].length;
      expect(gradables, `${unit.file} has gradable exercises`).toBeGreaterThanOrEqual(2);
      expect(checks).toBe(gradables);
      expect(keys).toBe(gradables);
      expect(resets).toBe(gradables);
    }
  });
});

describe("World Class 1 Teacher's Book — grading engine, keys & bug-fix pins", () => {
  it('grades every single data-answer, T/F/P, and MCQ item across all 12 units (368 items) accurately', () => {
    const { win } = bootEngine();
    const { matchAnswer } = win.WC1;
    let totalItems = 0;

    for (const unit of EXPECTED_UNITS) {
      const html = readFileSync(join(BOOK_DIR, unit.file), 'utf8');

      for (const m of html.matchAll(/data-answer="([^"]+)"/g)) {
        const raw = decodeEntities(m[1]);
        const alts = raw.split(/\s*(?:\||\/)\s*/).filter(Boolean);
        expect(alts.length, `${unit.file} non-empty data-answer`).toBeGreaterThan(0);
        for (const alt of alts) {
          expect(matchAnswer(alt, raw), `${unit.file} accepts "${alt}"`).toBe(true);
          expect(matchAnswer(`  ${alt.toUpperCase()}  `, raw), `${unit.file} case-insensitive "${alt}"`).toBe(true);
        }
        expect(matchAnswer('', raw)).toBe(false);
        expect(matchAnswer('zzzz_wrong', raw)).toBe(false);
        totalItems += 1;
      }

      for (const m of html.matchAll(/data-tfp-answer="([^"]+)"/g)) {
        expect(['T', 'F', 'P']).toContain(m[1]);
        totalItems += 1;
      }

      for (const m of html.matchAll(/data-radio-answer="([^"]+)"/g)) {
        expect(['a', 'b', 'c']).toContain(m[1]);
        totalItems += 1;
      }
    }

    expect(totalItems).toBe(368);
  });

  it('rejects partial-substring false positives while accepting contractions and valid alternatives', () => {
    const { win } = bootEngine();
    const { matchAnswer } = win.WC1;

    // Regression: U6–U12 previously used ans.includes(val) && val.length > 2
    expect(matchAnswer('the', 'the following month | the next month')).toBe(false);
    expect(matchAnswer('not', 'not to be')).toBe(false);
    expect(matchAnswer('off', 'turn off')).toBe(false);
    expect(matchAnswer('had', 'had never lost')).toBe(false);
    expect(matchAnswer('did not lived', 'lived')).toBe(false);

    // Contractions, temperature formats, US/UK spelling, and U6 which/that pairs
    expect(matchAnswer("don't leave", 'do not leave')).toBe(true);
    expect(matchAnswer("I'll call", 'I will call')).toBe(true);
    expect(matchAnswer('which lasts for one month', 'which lasts for one month / that lasts for one month')).toBe(true);
    expect(matchAnswer('that lasts for one month', 'which lasts for one month / that lasts for one month')).toBe(true);
    expect(matchAnswer('more expensive', 'much more expensive | more expensive')).toBe(true);
    expect(matchAnswer('practised', 'practiced | practised')).toBe(true);
    expect(
      matchAnswer(
        'Because the temperature dropped to -40 C, the equipment stopped working',
        'The equipment stopped working because the temperature dropped to -40°C. | Because the temperature dropped to -40°C, the equipment stopped working.',
      ),
    ).toBe(true);
  });

  it('isolates vocab and grammar exercises (U4/U5 fix) and handles Reset, Key, selectTopic & rate', () => {
    const { win, store, makeClassList } = bootEngine({ unit: 4 });

    const makeBlank = (ans: string, typed: string) => ({
      textContent: typed,
      classList: makeClassList(new Set()),
      getAttribute: (k: string) => (k === 'data-answer' ? ans : null),
    });

    const makeExercise = (blanks: ReturnType<typeof makeBlank>[]) => {
      const attrs = new Map<string, string>([['data-gradable', '1']]);
      const fb = { textContent: '', classList: makeClassList(new Set()) };
      const keyBtn = {
        textContent: '🔑 Show Key',
        setAttribute: () => {},
      };
      const ex: Record<string, unknown> = {
        classList: makeClassList(new Set()),
        setAttribute: (k: string, v: string) => { attrs.set(k, v); },
        getAttribute: (k: string) => attrs.get(k) ?? null,
        removeAttribute: (k: string) => { attrs.delete(k); },
        closest: (sel: string) => (sel === '.exercise' ? ex : null),
        querySelector: (sel: string) => {
          if (sel === '.blank-input[data-answer]') return blanks[0] ?? null;
          if (sel === '.feedback') return fb;
          if (sel === '.wc1-key-btn') return keyBtn;
          return null;
        },
        querySelectorAll: (sel: string) => {
          if (sel === '.blank-input[data-answer]' || sel === '.blank-input') return blanks;
          return [];
        },
      };
      return { ex, fb, attrs };
    };

    const vocabBlanks = [makeBlank('take off', 'take off'), makeBlank('determined', 'determined')];
    const grammarBlanks = [makeBlank('to move', ''), makeBlank('cry', '')];
    const vocab = makeExercise(vocabBlanks);
    const grammar = makeExercise(grammarBlanks);

    // Checking vocab gives 2/2 and never marks grammar blanks wrong
    expect(win.WC1.checkExercise(vocab.ex)).toEqual({ correct: 2, total: 2 });
    expect(vocab.fb.textContent).toContain('2 out of 2 correct (100%)');
    expect(grammarBlanks[0].classList.contains('wrong')).toBe(false);

    // Checking grammar independently grades only grammar
    grammarBlanks[0].textContent = 'to move';
    grammarBlanks[1].textContent = 'to cry';
    expect(win.WC1.checkExercise(grammar.ex)).toEqual({ correct: 1, total: 2 });
    expect(grammarBlanks[0].classList.contains('correct')).toBe(true);
    expect(grammarBlanks[1].classList.contains('wrong')).toBe(true);

    // Show/Hide key toggles without erasing typed answers; Reset clears cleanly
    win.WC1.toggleExerciseKey(grammar.ex);
    expect((grammar.ex.classList as { contains: (s: string) => boolean }).contains('wc1-local-keys')).toBe(true);
    expect(grammarBlanks[0].textContent).toBe('to move');
    win.WC1.resetExercise(grammar.ex);
    expect(grammarBlanks[0].textContent).toBe('');
    expect(grammarBlanks[0].classList.contains('correct')).toBe(false);

    // Unit 3 selectTopic regression: choosing card B clears card A's highlight
    const makeTopic = (card: Record<string, unknown>) => ({
      style: { background: '#d1fae5', borderColor: 'green' },
      classList: makeClassList(new Set()),
      setAttribute: () => {},
      closest: () => card,
    });
    const card: Record<string, unknown> = {};
    const t1 = makeTopic(card);
    const t2 = makeTopic(card);
    card.querySelectorAll = () => [t1, t2];

    win.selectTopic(t1);
    expect(t1.classList.contains('selected')).toBe(true);
    win.selectTopic(t2);
    expect(t1.classList.contains('selected')).toBe(false);
    expect(t1.style.background).toBe('');
    expect(t2.classList.contains('selected')).toBe(true);

    // Fluency self-check 1–5 star rating + toggle off
    const ratingAttrs = new Map<string, string>();
    const ratingParent: Record<string, unknown> = {
      getAttribute: (k: string) => ratingAttrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => { ratingAttrs.set(k, v); },
    };
    const stars = [1, 2, 3, 4, 5].map(() => ({
      parentElement: ratingParent,
      classList: makeClassList(new Set()),
      setAttribute: () => {},
    }));
    ratingParent.querySelectorAll = () => stars;
    win.rate(stars[3], 4);
    expect(stars.map((s) => s.classList.contains('active'))).toEqual([true, true, true, true, false]);
    win.rate(stars[3], 4);
    expect(stars.every((s) => !s.classList.contains('active'))).toBe(true);

    // Autosaved unit state + progress rollup written to localStorage
    expect(store.has('cmc-wc1-unit:4')).toBe(true);
    expect(win.WC1.readProgress()['4']?.visited).toBe(true);
  });

  it('runs all 57 exercises (368 items) 0% → 100% in live DOM, restores state & syncs Book Hub', () => {
    const engineSrc = readFileSync(join(BOOK_DIR, 'wc1-engine.js'), 'utf8');
    const sharedStorage = new Map<string, string>();

    const mountPage = (file: string) => {
      const html = readFileSync(join(BOOK_DIR, file), 'utf8');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const pageWin: Record<string, unknown> = {
        document: doc,
        localStorage: {
          getItem: (k: string) => (sharedStorage.has(k) ? sharedStorage.get(k)! : null),
          setItem: (k: string, v: string) => { sharedStorage.set(k, String(v)); },
          removeItem: (k: string) => { sharedStorage.delete(k); },
        },
        location: { assign: () => {} },
        print: () => {},
        addEventListener: () => {},
        CMC_WC1_APP_ROOT: '/Creative-Minds-/',
      };
      runInNewContext(engineSrc, { window: pageWin, document: doc, console });
      return {
        doc,
        api: pageWin.WC1 as WC1Api,
        selectTFP: pageWin.selectTFP as (btn: Element) => void,
      };
    };

    let exerciseTotal = 0;
    let itemTotal = 0;

    for (const unit of EXPECTED_UNITS) {
      const { doc, api, selectTFP } = mountPage(unit.file);

      // Back-to-CMC links sync to GitHub Pages subpath root
      const homeLink = doc.querySelector('[data-wc1-cmc-home]');
      expect(homeLink?.getAttribute('href')).toBe('/Creative-Minds-/#gep-isec');

      const exercises = [...doc.querySelectorAll('.exercise[data-gradable="1"]')];
      expect(exercises.length, `${unit.file} exercises`).toBeGreaterThanOrEqual(2);

      for (const ex of exercises) {
        // 0% before filling anything (catches Unit 3 unchecked-checkbox trap)
        const emptyRes = api.checkExercise(ex);
        expect(emptyRes.total, `${unit.file} non-empty exercise`).toBeGreaterThan(0);
        expect(emptyRes.correct, `${unit.file} starts at 0%`).toBe(0);

        // Fill every blank, T/F/P row, or MCQ radio with its verified answer
        for (const blank of ex.querySelectorAll('.blank-input[data-answer]')) {
          const raw = blank.getAttribute('data-answer') ?? '';
          blank.textContent = raw.split(/\s*(?:\||\/)\s*/)[0] ?? '';
        }
        for (const row of ex.querySelectorAll('.tfp-options[data-tfp-answer]')) {
          const target = row.getAttribute('data-tfp-answer');
          const btn = [...row.querySelectorAll('.tfp-btn')].find((b) => b.textContent?.trim() === target);
          expect(btn, `${unit.file} TFP button ${target}`).toBeTruthy();
          selectTFP(btn!);
        }
        for (const q of ex.querySelectorAll('[data-radio-answer]')) {
          const target = q.getAttribute('data-radio-answer');
          const radio = q.querySelector(`input[type="radio"][value="${target}"]`) as HTMLInputElement | null;
          expect(radio, `${unit.file} radio ${target}`).toBeTruthy();
          radio!.checked = true;
        }

        const fullRes = api.checkExercise(ex);
        expect(fullRes.correct, `${unit.file} reaches 100%`).toBe(fullRes.total);
        expect(ex.querySelector('.feedback')?.textContent).toContain('(100%)');

        exerciseTotal += 1;
        itemTotal += fullRes.total;
      }

      expect(doc.querySelector('[data-wc1-unit-progress]')?.textContent).toBe(
        `${exercises.length} / ${exercises.length} exercises checked`,
      );
    }

    expect(exerciseTotal).toBe(57);
    expect(itemTotal).toBe(368);

    // Reload Unit 5 from localStorage and verify answers + exercise progress persisted
    const u5Reload = mountPage('unit5.html');
    expect(u5Reload.doc.querySelector('[data-wc1-unit-progress]')?.textContent).toBe(
      '4 / 4 exercises checked',
    );
    const firstU5Blank = u5Reload.doc.querySelector('.blank-input[data-answer]');
    expect((firstU5Blank?.textContent ?? '').trim().length).toBeGreaterThan(0);

    // Boot index.html Book Overview Hub and verify 57/57 rollup, filters, search & Scope panel
    const { doc: hdoc } = mountPage('index.html');
    expect(hdoc.querySelector('[data-wc1-total-checked]')?.textContent).toBe('57 / 57');
    expect(hdoc.querySelector('[data-wc1-visited-count]')?.textContent).toBe('12 / 12');
    expect(hdoc.querySelectorAll('.wc1-unit-pill.done')).toHaveLength(12);

    const filter7to12 = hdoc.querySelector('[data-wc1-filter="7-12"]') as HTMLButtonElement;
    filter7to12.click();
    const visibleCluster = [...hdoc.querySelectorAll<HTMLElement>('[data-unit-card]')].filter(
      (c) => c.style.display !== 'none',
    );
    expect(visibleCluster).toHaveLength(6);

    (hdoc.querySelector('[data-wc1-filter="all"]') as HTMLButtonElement).click();
    const search = hdoc.querySelector('[data-wc1-search]') as HTMLInputElement;
    search.value = 'passive voice';
    search.dispatchEvent(new Event('input'));
    const passiveMatches = [...hdoc.querySelectorAll<HTMLElement>('[data-unit-card]')].filter(
      (c) => c.style.display !== 'none',
    );
    expect(passiveMatches).toHaveLength(1);
    expect(passiveMatches[0].getAttribute('data-unit-card')).toBe('9');

    const scopeBtn = hdoc.querySelector('[data-wc1-scope-toggle]') as HTMLButtonElement;
    const scopePanel = hdoc.querySelector('[data-wc1-scope-panel]') as HTMLElement;
    expect(scopePanel.hidden).toBe(true);
    scopeBtn.click();
    expect(scopePanel.hidden).toBe(false);
  });
});

describe("World Class 1 Teacher's Book — CMC theme sync & verified teacher gate", () => {
  it('syncs dark smoked-glass and non-glare #cbd5e1 light milk-glass themes via cmc-theme', () => {
    const css = readFileSync(join(BOOK_DIR, 'wc1-theme.css'), 'utf8');
    expect(css).toContain('--wc-bg: #0b1220;');
    expect(css).toContain('--wc-bg: #cbd5e1;');
    expect(css).toContain('html[data-theme="light"]');

    const session = bootEngine({ store: { 'cmc-theme': 'light' } });
    expect(session.rootAttrs.get('data-theme')).toBe('light');
    expect(session.rootClasses.has('light')).toBe(true);

    session.win.WC1.toggleTheme();
    expect(session.store.get('cmc-theme')).toBe('dark');
    expect(session.rootAttrs.get('data-theme')).toBe('dark');
    expect(session.rootClasses.has('light')).toBe(false);

    session.win.WC1.toggleGlobalKeys();
    expect(session.store.get('cmc-wc1-show-keys')).toBe('1');
    expect(session.rootClasses.has('wc1-show-keys')).toBe(true);
  });

  it('blocks guests, students & pending teachers while unlocking for verified teachers on GH Pages & root', () => {
    const scriptUrl = 'https://cmckhmer.github.io/Creative-Minds-/gep/world-class-1/teacher-gate.js';
    const pathname = '/Creative-Minds-/gep/world-class-1/unit8.html';

    // 1. Guest blocked & routed through /Creative-Minds-/?auth=teacher&next=...
    const guest = runTeacherGate({ scriptUrl, pathname, store: { 'cmc-theme': 'light' } });
    expect(guest.allowed).toBe(false);
    expect(guest.locked).toBe(true);
    expect(guest.overlayShown).toBe(true);
    expect(guest.theme).toBe('light');
    expect(guest.lightClass).toBe(true);
    expect(guest.gate.appRoot()).toBe('/Creative-Minds-/');
    expect(guest.gate.signInUrl()).toBe(
      '/Creative-Minds-/?auth=teacher&next=%2FCreative-Minds-%2Fgep%2Fworld-class-1%2Funit8.html%23grammar#gep-isec',
    );

    // 2. Verified student blocked
    const student = runTeacherGate({
      scriptUrl,
      pathname,
      store: {
        'cmc-student-token': makeFakeJwt({ email_verified: true }),
        'cmc-student-uid': 'stu-1',
        'cmc-student-email': 'student@gmail.com',
        'cmc-student-role': 'student',
      },
    });
    expect(student.allowed).toBe(false);
    expect(student.locked).toBe(true);

    // 3. Pending teacher (awaiting admin approval) blocked
    const pending = runTeacherGate({
      scriptUrl,
      pathname,
      store: {
        'cmc-student-token': makeFakeJwt({ email_verified: true }),
        'cmc-student-uid': 'tch-pending',
        'cmc-student-email': 'teacher@gmail.com',
        'cmc-account-type': 'teacher',
        'cmc-student-role': 'teacher',
        'cmc-teacher-verified': '0',
      },
    });
    expect(pending.allowed).toBe(false);
    expect(pending.locked).toBe(true);

    // 4. Verified teacher allowed cleanly (and works at custom domain root too)
    const teacher = runTeacherGate({
      scriptUrl: 'https://example.edu/gep/world-class-1/teacher-gate.js',
      pathname: '/gep/world-class-1/index.html',
      hostname: 'example.edu',
      store: {
        'cmc-student-token': makeFakeJwt({ email_verified: true }),
        'cmc-student-uid': 'tch-verified',
        'cmc-student-email': 'instructor@aii.edu.kh',
        'cmc-student-role': 'teacher',
        'cmc-teacher-verified': '1',
      },
    });
    expect(teacher.allowed).toBe(true);
    expect(teacher.locked).toBe(false);
    expect(teacher.overlayShown).toBe(false);
    expect(teacher.gate.appRoot()).toBe('/');
  });
});
