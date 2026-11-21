import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom') as {
  JSDOM: new (
    html: string,
    opts?: { url?: string; runScripts?: 'dangerously' | 'outside-only' },
  ) => { window: Window & typeof globalThis & { eval: (code: string) => unknown } };
};

const publicDir = resolve(process.cwd(), 'public');
const html = readFileSync(resolve(publicDir, 'voice-quest.html'), 'utf8');
const css = readFileSync(resolve(publicDir, 'voice-quest-overhaul.css'), 'utf8');
const enhancement = readFileSync(resolve(publicDir, 'voice-quest-enhance.js'), 'utf8');
const serviceWorker = readFileSync(resolve(publicDir, 'sw.js'), 'utf8');

describe('Talk to me premium voice-lab experience', () => {
  it('loads the redesign assets from the standalone game page', () => {
    expect(html).toContain('voice-quest-overhaul.css');
    expect(html).toContain('voice-quest-enhance.js');
    expect(existsSync(resolve(publicDir, 'voice-quest-overhaul.css'))).toBe(true);
    expect(existsSync(resolve(publicDir, 'voice-quest-enhance.js'))).toBe(true);
    // The redesign shipped with cache v90. Any later version also refreshes
    // the cached page, so later bumps must not fail this check.
    const version = Number(/const CACHE_VERSION = 'cmc-v(\d+)'/.exec(serviceWorker)?.[1] ?? 0);
    expect(version).toBeGreaterThanOrEqual(90);
  });

  it('adds an adult-friendly visual system and a perspective-built mission platform', () => {
    expect(css).toContain('"Syne"');
    expect(css).toContain('color-scheme: dark');
    expect(css).toContain('perspective: 900px');
    expect(css).toContain('.cmc-tower-front');
    expect(css).toContain('.cmc-platform-plinth');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('keeps the native game engine while improving voice guidance and response access', () => {
    expect(html).toContain('SpeechRecognition');
    expect(html).toContain('f.pitch=1;');
    expect(enhancement).toContain('aria-live');
    expect(enhancement).toContain('Command understood');
    expect(enhancement).toContain('Try a simpler phrase');
    expect(enhancement).toContain('data-level');
  });
});

describe('Talk to me Srok Speak Cambodia Adventure RPG', () => {
  const rpgCssPath = resolve(publicDir, 'voice-quest-rpg.css');
  const rpgJsPath = resolve(publicDir, 'voice-quest-rpg.js');
  const rpgCss = readFileSync(rpgCssPath, 'utf8');
  const rpgJs = readFileSync(rpgJsPath, 'utf8');

  it('wires the RPG stylesheet, script, and pre-paint cmc-theme sync into voice-quest.html', () => {
    expect(html).toContain('voice-quest-rpg.css');
    expect(html).toContain('voice-quest-rpg.js');
    expect(html).toContain("localStorage.getItem('cmc-theme')");
    expect(existsSync(rpgCssPath)).toBe(true);
    expect(existsSync(rpgJsPath)).toBe(true);
  });

  it('ships all bespoke Cambodian adventure artwork referenced by the RPG', () => {
    const assets = [
      'world-banner.jpg',
      'npc-dara.jpg',
      'npc-maly.jpg',
      'npc-rithy.jpg',
      'npc-vanna.jpg',
      'npc-leakhena.jpg',
      'npc-bopha.jpg',
      'npc-channary.jpg',
      'npc-sopheak.jpg',
    ];
    for (const file of assets) {
      expect(existsSync(resolve(publicDir, 'images/voice-quest-rpg', file))).toBe(true);
      expect(rpgJs).toContain(`voice-quest-rpg/${file}`);
    }
  });

  it('includes all 8 modern Cambodian locations, living NPC conversations, quests, pronunciation scoring, and dark/light HUD tokens', () => {
    for (const zone of ['Phum Lotus Village', 'Champa Community School', 'Phsar Thmei Market', 'Wat Santipheap Gardens', 'Mekong Riverside Park', 'Bon Om Touk Festival Plaza', 'Tuk-Tuk & Express Hub', 'Hidden Lotus Sanctuary']) {
      expect(rpgJs).toContain(zone);
    }
    expect(rpgJs).toContain('Pronunciation Score:');
    expect(rpgJs).toContain('Market Quick-Order Rush');
    expect(rpgJs).toContain('Secret of the Golden Lotus');
    expect(rpgJs).toContain('drill_attempts');
    expect(rpgCss).toContain('html.light');
    expect(rpgCss).toContain('vq-mode-rpg');
    expect(rpgCss).toContain('vq-mode-classic');
  });

  it('boots cleanly in a DOM, runs multi-turn NPC dialogue with pronunciation feedback, switches zones, toggles theme & classic mode', () => {
    const dom = new JSDOM(
      '<!doctype html><html><head><meta name="theme-color" content="#0b1220"></head><body><div id="root"></div></body></html>',
      { url: 'https://cmc.local/voice-quest.html', runScripts: 'outside-only' },
    );
    const win = dom.window as unknown as Record<string, any>;
    win.requestAnimationFrame = () => 1;
    // Provide a lightweight stubbed 2D canvas context so drawWorld runs cleanly
    win.HTMLCanvasElement.prototype.getContext = () => null;
    win.localStorage.setItem('cmc-theme', 'light');
    win.localStorage.setItem('cmc-student-name', 'Sovann');

    dom.window.eval(rpgJs);
    if (dom.window.document.readyState === 'loading') {
      dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    }

    expect(dom.window.document.getElementById('vq-rpg-shell')).not.toBeNull();
    expect(dom.window.document.documentElement.classList.contains('light')).toBe(true);
    expect(dom.window.document.body.classList.contains('vq-mode-rpg')).toBe(true);

    // Dismiss welcome modal
    const startBtn = dom.window.document.getElementById('rpgStartBtn') as HTMLButtonElement;
    expect(startBtn).not.toBeNull();
    startBtn.click();
    expect(dom.window.document.getElementById('rpgModalWrap')?.hasAttribute('hidden')).toBe(true);

    // Open Dara dialogue & submit spoken English reply
    win.CMC_VQ_RPG.openDialogueById('dara');
    expect(dom.window.document.getElementById('rpgDlgWrap')?.hasAttribute('hidden')).toBe(false);
    expect(dom.window.document.getElementById('rpgNpcName')?.textContent).toBe('Dara');

    win.CMC_VQ_RPG.submitReply('Hello Dara! My name is Sovann and I am happy!');
    const fb = dom.window.document.getElementById('rpgFbSummary')?.textContent ?? '';
    expect(fb).toContain('Great pronunciation!');
    expect(fb).toContain('Pronunciation Score:');
    expect(win.CMC_VQ_RPG.getState().totalSpoken).toBe(1);
    expect(win.CMC_VQ_RPG.getState().xp).toBeGreaterThan(0);

    // Travel to Hidden Lotus Sanctuary & verify secret quest step unlocks
    win.CMC_VQ_RPG.enterZone('secret');
    expect(win.CMC_VQ_RPG.getState().zone).toBe('secret');
    expect(win.CMC_VQ_RPG.getState().quests.q_secret?.steps?.enter).toBe(true);

    // Toggle theme and switch to Classic 15-Level Lab & back
    (dom.window.document.getElementById('rpgThemeBtn') as HTMLButtonElement).click();
    expect(dom.window.document.documentElement.classList.contains('light')).toBe(false);
    expect(win.localStorage.getItem('cmc-theme')).toBe('dark');

    (dom.window.document.getElementById('rpgClassicBtn') as HTMLButtonElement).click();
    expect(dom.window.document.body.classList.contains('vq-mode-classic')).toBe(true);
    (dom.window.document.getElementById('vq-return-rpg-pill') as HTMLButtonElement).click();
    expect(dom.window.document.body.classList.contains('vq-mode-rpg')).toBe(true);

    dom.window.close();
  });
});

