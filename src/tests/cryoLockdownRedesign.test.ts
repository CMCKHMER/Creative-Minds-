import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

const ROOT = resolve(__dirname, '../..');
const HTML_PATH = resolve(ROOT, 'public/cryo-lockdown.html');
const CSS_PATH = resolve(ROOT, 'public/cryo-lockdown-overhaul.css');

const EXPECTED_ART = [
  'public/images/cryo-lockdown/hero-vault.jpg',
  'public/images/cryo-lockdown/hero-vault-light.jpg',
  'public/images/cryo-lockdown/vault-open.jpg',
  'public/images/cryo-lockdown/vault-thaw.jpg',
  'public/images/cryo-lockdown/term-01-wordlock.jpg',
  'public/images/cryo-lockdown/term-02-sequence.jpg',
  'public/images/cryo-lockdown/term-03-sort.jpg',
  'public/images/cryo-lockdown/term-04-cloze.jpg',
  'public/images/cryo-lockdown/term-05-truth.jpg',
  'public/images/cryo-lockdown/term-06-signal.jpg',
];

async function mountCryoLockdown(initialTheme?: 'light' | 'dark') {
  // Strip external auth-gate script tag so jsdom doesn't try to load from disk;
  // mock CMC_GATE.guard as a no-op before inline scripts run.
  const rawHtml = readFileSync(HTML_PATH, 'utf8').replace(
    '<script src="assets/js/cmc-auth-gate.js"></script>',
    '',
  );

  const dom = new JSDOM(rawHtml, {
    url: 'https://cmckhmer.github.io/Creative-Minds-/cryo-lockdown.html',
    runScripts: 'dangerously',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeParse(win: any) {
      if (initialTheme) {
        win.localStorage.setItem('cmc-theme', initialTheme);
      }
      win.CMC_GATE = { guard: () => {} };
      win.requestAnimationFrame = () => 0;
      win.cancelAnimationFrame = () => {};
      win.scrollTo = () => {};
      if (win.HTMLElement) {
        win.HTMLElement.prototype.scrollIntoView = () => {};
      }
      if (win.HTMLCanvasElement) {
        win.HTMLCanvasElement.prototype.getContext = () => null;
      }
    },
  });

  await new Promise<void>((resolveReady) => {
    if (dom.window.document.readyState !== 'loading') {
      setTimeout(resolveReady, 20);
    } else {
      dom.window.document.addEventListener('DOMContentLoaded', () => {
        setTimeout(resolveReady, 20);
      });
    }
  });

  return dom;
}

describe('Cryo-Vault Lockdown CMC Glass + Iridescent Redesign', () => {
  it('ships all 10 bespoke AI artwork assets and references each in cryo-lockdown.html', () => {
    const html = readFileSync(HTML_PATH, 'utf8');
    for (const rel of EXPECTED_ART) {
      const abs = resolve(ROOT, rel);
      expect(existsSync(abs), `missing asset ${rel}`).toBe(true);
      expect(statSync(abs).size, `empty asset ${rel}`).toBeGreaterThan(15_000);
      const htmlRef = `./${rel.replace(/^public\//, '')}`;
      expect(html, `HTML missing reference to ${htmlRef}`).toContain(htmlRef);
    }
  });

  it('defines both Dark Smoked Glass and Light Non-Glare Milk Glass themes in cryo-lockdown-overhaul.css', () => {
    const css = readFileSync(CSS_PATH, 'utf8');
    expect(css).toContain('color-scheme: dark');
    expect(css).toContain('color-scheme: light');
    expect(css).toContain('html.light');
    expect(css).toContain('./images/glass-hero-dark.jpg');
    expect(css).toContain('./images/glass-hero-light.jpg');
    expect(css).toContain('--iri-border');
    expect(css).toContain('--iri-cta');
    expect(css).toContain('.term-art');
    expect(css).toContain('.modal-banner-img');
    expect(css).toContain('.result-banner');
  });

  it('syncs light/dark theme pre-paint and via both Briefing and HUD theme toggles', async () => {
    const dom = await mountCryoLockdown('light');
    const { document, localStorage } = dom.window;

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#d3d9e3');

    // Toggle to dark from briefing button
    (document.getElementById('briefThemeBtn') as HTMLButtonElement).click();
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('cmc-theme')).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0b1220');

    // Toggle back to light from HUD button
    (document.getElementById('themeBtn') as HTMLButtonElement).click();
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.getItem('cmc-theme')).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#d3d9e3');

    dom.window.close();
  });

  it('renders 6 illustrated terminal cards, updates modal artwork, solves all 6 terminals, and opens the vault with victory banner', async () => {
    const dom = await mountCryoLockdown('dark');
    const { document } = dom.window;

    const runEvents: Array<Record<string, unknown>> = [];
    document.addEventListener('cryo:run', ((ev: CustomEvent) => {
      runEvents.push(ev.detail as Record<string, unknown>);
    }) as EventListener);

    // Start game
    (document.getElementById('startBtn') as HTMLButtonElement).click();
    expect(document.getElementById('briefing')?.hidden).toBe(true);

    const cards = Array.from(document.querySelectorAll('#termGrid .term')) as HTMLButtonElement[];
    expect(cards.length).toBe(6);

    for (const card of cards) {
      const img = card.querySelector('.term-art img') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toMatch(/^\.\/images\/cryo-lockdown\/term-0[1-6]-.+\.jpg$/);
      expect(card.querySelector('.term-ic svg use')).not.toBeNull();
    }

    // Solve every terminal via the live UI
    for (let idx = 0; idx < 6; idx++) {
      const card = document.querySelector(`#termGrid .term[data-i="${idx}"]`) as HTMLButtonElement;
      expect(card).not.toBeNull();
      const expectedArt = card.querySelector('.term-art img')?.getAttribute('src');
      card.click();

      const modalWrap = document.getElementById('modalWrap') as HTMLElement;
      expect(modalWrap.hidden).toBe(false);
      expect(document.getElementById('modalBannerImg')?.getAttribute('src')).toBe(expectedArt);

      const modalBody = document.getElementById('modalBody') as HTMLElement;
      if (idx === 0) {
        // WORD LOCK (match)
        modalBody.querySelectorAll('.pz-row').forEach((row) => {
          const sel = row.querySelector('select') as HTMLSelectElement;
          sel.value = row.getAttribute('data-key') || '';
        });
      } else if (idx === 1) {
        // SEQUENCE RELAY (order)
        const order = ['bees', 'plants', 'eaters', 'food', 'env'];
        const ol = modalBody.querySelector('ol') as HTMLOListElement;
        for (const key of order) {
          const li = ol.querySelector(`li[data-key="${key}"]`);
          if (li) ol.appendChild(li);
        }
      } else if (idx === 2) {
        // SAMPLE SORT (sort)
        const causeBin = modalBody.querySelector('.bin[data-bin="cause"]') as HTMLElement;
        const effectBin = modalBody.querySelector('.bin[data-bin="effect"]') as HTMLElement;
        modalBody.querySelectorAll('.tray .card').forEach((c) => {
          (c as HTMLButtonElement).click();
          if (c.getAttribute('data-correct') === 'cause') causeBin.click();
          else effectBin.click();
        });
      } else if (idx === 3) {
        // CLOZE SEAL (cloze)
        const answers = ['extinct', 'global', 'samples', 'support'];
        modalBody.querySelectorAll('.cloze input').forEach((inp, i) => {
          (inp as HTMLInputElement).value = answers[i];
        });
      } else if (idx === 4 || idx === 5) {
        // TRUTH SCAN (tf) & MAIN SIGNAL (mcq)
        modalBody.querySelectorAll('.pz-q').forEach((q) => {
          const key = q.getAttribute('data-key');
          const opt = q.querySelector(`.opt[data-val="${key}"]`) as HTMLButtonElement;
          opt.click();
        });
      }

      (document.getElementById('submitBtn') as HTMLButtonElement).click();
      expect(modalWrap.hidden).toBe(true);
      expect(card.classList.contains('solved')).toBe(true);
      expect(card.querySelector('.badge')?.textContent).toBe('AUTHENTICATED');
    }

    // Read released 6-digit code in slot order T1 -> T6
    const digits = (Array.from(document.querySelectorAll('#codeSlots .slot')) as Element[]).map(
      (s) => s.textContent?.trim() || '',
    );
    expect(digits.length).toBe(6);
    expect(digits.every((d) => /^\d$/.test(d))).toBe(true);

    // Keypad is now enabled — enter all 6 digits + ENT
    const keypadBtns = Array.from(document.querySelectorAll('#keypad .key')) as HTMLButtonElement[];
    expect(keypadBtns.every((b) => !b.disabled)).toBe(true);
    for (const d of digits) {
      const btn = keypadBtns.find((b) => b.textContent === d);
      expect(btn).toBeDefined();
      btn?.click();
    }
    keypadBtns.find((b) => b.textContent === 'ENT')?.click();

    expect(document.getElementById('vault')?.classList.contains('open')).toBe(true);
    expect(document.getElementById('resultBannerImg')?.getAttribute('src')).toBe('./images/cryo-lockdown/vault-open.jpg');
    expect(runEvents.length).toBe(1);
    expect(runEvents[0].outcome).toBe('won');
    expect(runEvents[0].solved).toBe(6);

    dom.window.close();
  });
});
