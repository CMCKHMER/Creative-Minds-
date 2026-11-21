import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
interface JsdomInstance {
  window: Window & typeof globalThis;
}
const { JSDOM } = require('jsdom') as {
  JSDOM: new (
    html: string,
    options?: {
      url?: string;
      runScripts?: 'dangerously' | 'outside-only';
      beforeParse?: (win: Window & typeof globalThis) => void;
    }
  ) => JsdomInstance;
};

const PUB = join(process.cwd(), 'public');
const HTML = readFileSync(join(PUB, 'reason-lab.html'), 'utf8');
const CSS = readFileSync(join(PUB, 'reason-lab-overhaul.css'), 'utf8');

const EXPECTED_AI_IMAGES = [
  'images/reason-lab/hero-lab.jpg',
  'images/reason-lab/hero-lab-light.jpg',
  'images/reason-lab/mode-campaign.jpg',
  'images/reason-lab/mode-gauntlet.jpg',
  'images/reason-lab/mode-drill.jpg',
  'images/reason-lab/mode-casefile.jpg',
  'images/reason-lab/case-app.jpg',
  'images/reason-lab/case-lunch.jpg',
  'images/reason-lab/case-dispute.jpg',
  'images/reason-lab/case-5am.jpg',
];

async function mountReasonLab(initialTheme?: 'light' | 'dark') {
  // Stub external auth gate script so jsdom executes inline scripts cleanly.
  const prepared = HTML.replace(
    '<script src="assets/js/cmc-auth-gate.js"></script>',
    '<script>window.CMC_GATE = { guard: function () {} };</script>'
  ).replace(
    '<link rel="stylesheet" href="./reason-lab-overhaul.css">',
    ''
  );

  const errors: unknown[] = [];
  const dom = new JSDOM(prepared, {
    url: 'https://cmckhmer.github.io/Creative-Minds-/reason-lab.html',
    runScripts: 'dangerously',
    beforeParse(win) {
      if (initialTheme) {
        win.localStorage.setItem('cmc-theme', initialTheme);
      }
      win.scrollTo = () => {};
      win.requestAnimationFrame = (cb) => {
        cb(0);
        return 0;
      };
      win.addEventListener('error', (e) => errors.push(e.error || e.message));
    },
  });

  if (dom.window.document.readyState === 'loading') {
    await new Promise<void>((resolve) => {
      dom.window.document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    });
  }
  expect(errors).toEqual([]);
  return dom;
}

describe('Reason Lab redesign — AI artwork, light/dark glass theme & UX flows', () => {
  it('ships all 10 bespoke AI illustrations and references each in reason-lab.html', () => {
    for (const rel of EXPECTED_AI_IMAGES) {
      const abs = join(PUB, rel);
      expect(existsSync(abs), `${rel} must exist`).toBe(true);
      const stat = statSync(abs);
      expect(stat.size, `${rel} must be a non-empty image`).toBeGreaterThan(10_000);
      expect(HTML).toContain(`./${rel}`);
    }
  });

  it('defines both CMC dark smoked-glass and non-glare light milk-glass themes in reason-lab-overhaul.css', () => {
    expect(CSS).toContain('color-scheme: dark;');
    expect(CSS).toContain('html.light');
    expect(CSS).toContain('color-scheme: light;');
    // Matches site-wide CMC dark (#0b1220) and non-glare light grey-blue (#d3d9e3) palette
    expect(CSS).toContain('#0b1220');
    expect(CSS).toContain('#d3d9e3');
    // Iridescent signature border tokens
    expect(CSS).toContain('--iri-border');
    expect(CSS).toContain('--iri-cta');
    // Dual-theme hero studio backdrops
    expect(CSS).toContain('./images/glass-hero-dark.jpg');
    expect(CSS).toContain('./images/glass-hero-light.jpg');
    // Light theme overrides for Back to CMC pill
    expect(CSS).toContain('html.light #cmc-back-to-site');
  });

  it('applies light mode pre-paint when cmc-theme=light and toggles cleanly via #themeBtn + storage sync', async () => {
    const dom = await mountReasonLab('light');
    const { document, localStorage, StorageEvent } = dom.window;

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#d3d9e3');

    const themeBtn = document.getElementById('themeBtn') as HTMLButtonElement;
    expect(themeBtn).toBeTruthy();
    expect(themeBtn.innerHTML).toContain('#i-moon');
    expect(themeBtn.getAttribute('aria-pressed')).toBe('true');

    // Toggle to dark
    themeBtn.click();
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('cmc-theme')).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b1220');
    expect(themeBtn.innerHTML).toContain('#i-sun');

    // Cross-tab storage sync back to light
    dom.window.dispatchEvent(new StorageEvent('storage', { key: 'cmc-theme', newValue: 'light' }));
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(themeBtn.innerHTML).toContain('#i-moon');
  });

  it('renders illustrated mode cards, interactive skill-drill cards, and dual-theme hero art', async () => {
    const dom = await mountReasonLab('dark');
    const { document } = dom.window;

    // Dual-theme hero artwork layers
    expect(document.querySelector('.rl-hero-art-dark')?.getAttribute('src')).toBe('./images/reason-lab/hero-lab.jpg');
    expect(document.querySelector('.rl-hero-art-light')?.getAttribute('src')).toBe('./images/reason-lab/hero-lab-light.jpg');

    // 4 mode cards with AI banners
    const modeImgs = [...document.querySelectorAll('#modeGrid .mode .mode-art img')].map((img) =>
      img.getAttribute('src')
    );
    expect(modeImgs).toEqual([
      './images/reason-lab/mode-campaign.jpg',
      './images/reason-lab/mode-gauntlet.jpg',
      './images/reason-lab/mode-drill.jpg',
      './images/reason-lab/mode-casefile.jpg',
    ]);

    // Clicking a Skill Mastery card launches Drill briefing with that skill pre-selected
    const firstSkill = document.querySelector('#skillGrid .sk') as HTMLElement;
    expect(firstSkill).toBeTruthy();
    firstSkill.click();
    expect(document.getElementById('vSetup')?.hidden).toBe(false);
    expect(document.getElementById('setBannerImg')?.getAttribute('src')).toBe('./images/reason-lab/mode-drill.jpg');
    expect((document.getElementById('startBtn') as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelectorAll('#setSkills .sk.selected').length).toBe(1);
  });

  it('renders illustrated Case File picker cards and in-session dossier artwork across all 5 decisions', async () => {
    const dom = await mountReasonLab('dark');
    const { document } = dom.window;

    // Jump straight to Case File via hero quick-launch pill
    const casePill = document.querySelector('[data-quick-mode="case"]') as HTMLButtonElement;
    expect(casePill).toBeTruthy();
    casePill.click();

    expect(document.getElementById('vSetup')?.hidden).toBe(false);
    const caseCards = [...document.querySelectorAll('#setCases .mode')] as HTMLButtonElement[];
    expect(caseCards).toHaveLength(4);
    expect(caseCards.map((c) => c.querySelector('.mode-art img')?.getAttribute('src'))).toEqual([
      './images/reason-lab/case-app.jpg',
      './images/reason-lab/case-lunch.jpg',
      './images/reason-lab/case-dispute.jpg',
      './images/reason-lab/case-5am.jpg',
    ]);

    // Pick Case 02 (The Lunch Survey) -> briefing banner updates to case-lunch.jpg
    caseCards[1].click();
    expect(document.getElementById('setBannerImg')?.getAttribute('src')).toBe('./images/reason-lab/case-lunch.jpg');

    const events: Array<Record<string, unknown>> = [];
    document.addEventListener('cmcreason:session', (e) => {
      events.push((e as CustomEvent).detail);
    });

    (document.getElementById('startBtn') as HTMLButtonElement).click();
    expect(document.getElementById('vSession')?.hidden).toBe(false);
    expect(document.querySelector('#sDossier .dossier-banner img')?.getAttribute('src')).toBe(
      './images/reason-lab/case-lunch.jpg'
    );

    // Complete all 5 case file decisions
    for (let step = 0; step < 5; step++) {
      const opt = document.querySelector('#optWrap .opt') as HTMLButtonElement;
      expect(opt).toBeTruthy();
      opt.click();
      (document.getElementById('submitBtn') as HTMLButtonElement).click();
      (document.getElementById('nextBtn') as HTMLButtonElement).click();
    }

    expect(document.getElementById('vResults')?.hidden).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].mode).toBe('case');
    expect(events[0].total).toBe(5);
  });
});
