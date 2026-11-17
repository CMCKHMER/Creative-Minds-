import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reason Lab and Cryo-Vault Lockdown share the look of Talk to me. Each page
 * keeps the layout its game engine needs in its own <style> block and takes
 * colours, type and the opening 3D scene from a separate skin file.
 */
const publicDir = resolve(process.cwd(), 'public');
const read = (name: string) => readFileSync(resolve(publicDir, name), 'utf8');
const serviceWorker = read('sw.js');

const games = [
  {
    name: 'Reason Lab',
    page: 'reason-lab.html',
    skin: 'reason-lab-overhaul.css',
    scene: '.rl-stage',
    slug: "'reason-lab.html'",
    ids: ['vHome', 'vSetup', 'vSession', 'vResults', 'vReview', 'modeGrid', 'skillGrid', 'startBtn', 'submitBtn', 'nextBtn', 'hintBtn', 'helpBtn', 'soundBtn', 'heroStart'],
  },
  {
    name: 'Cryo-Vault Lockdown',
    page: 'cryo-lockdown.html',
    skin: 'cryo-lockdown-overhaul.css',
    scene: '.cv-stage',
    slug: "'cryo-lockdown.html'",
    ids: ['briefing', 'startBtn', 'diffCards', 'diffSelect', 'soundBtn', 'pauseBtn', 'restartBtn', 'timerVal', 'vault', 'codeSlots', 'keypad', 'termGrid', 'modalWrap', 'hintBtn', 'submitBtn', 'resultOverlay', 'againBtn'],
  },
];

// Emoji and pictograph ranges. Arrows, dots and check marks in running text are fine.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{23E9}-\u{23FF}]/u;

describe.each(games)('$name premium redesign', (game) => {
  const html = read(game.page);
  const css = read(game.skin);
  // What a player sees: the page without scripts, styles and comments.
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');

  it('loads its skin and the shared typefaces', () => {
    expect(existsSync(resolve(publicDir, game.skin))).toBe(true);
    expect(html).toContain(`href="./${game.skin}"`);
    expect(html).toContain('family=Inter');
    expect(html).toContain('family=Syne');
    const version = Number(/const CACHE_VERSION = 'cmc-v(\d+)'/.exec(serviceWorker)?.[1] ?? 0);
    expect(version).toBeGreaterThanOrEqual(93);
  });

  it('uses the Talk to me visual system with a scene built in CSS 3D', () => {
    expect(css).toContain('"Syne"');
    expect(css).toContain('color-scheme: dark');
    expect(css).toContain('#45d7d0');
    expect(css).toContain('perspective: 900px');
    expect(css).toContain('transform-style: preserve-3d');
    expect(css).toContain(game.scene);
    expect(css).toContain('prefers-reduced-motion');
  });

  it('defines every colour and type token the page layout uses', () => {
    const inline = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const used = new Set([...inline.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    const defined = new Set([...`${inline}\n${css}`.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    // --hue is set per card by the game engine.
    const missing = [...used].filter((token) => !defined.has(token) && token !== '--hue');
    expect(missing).toEqual([]);
  });

  it('draws its icons as line art instead of emoji', () => {
    expect(html).toContain('<symbol id="i-');
    expect(markup).toContain('<use href="#i-');
    expect(EMOJI.exec(markup)?.[0]).toBeUndefined();
    for (const [, id] of html.matchAll(/<use href="#(i-[a-z]+)"/g)) {
      expect(html, id).toContain(`<symbol id="${id}"`);
    }
  });

  it('keeps text readable: nothing in the page layout is set under 11px', () => {
    const inline = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const sizes = [...inline.matchAll(/font-size:([0-9.]+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(20);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });

  it('shows one Back button and keeps header controls clear of it', () => {
    expect(html).toContain('id="cmc-back-to-site"');
    expect(css).toMatch(/#cmc(?:BackBtn|-back-btn) \{ display: none; \}/);
    expect(css).toContain('--pill:');
    expect(css).toMatch(/padding: 0 calc\(var\(--pill\) \+ \d+px\)/);
  });

  it('keeps the bottom bar to one row on a phone', () => {
    expect(css).toMatch(/\.cmc-bar \{ flex-wrap: nowrap;/);
  });

  it('leaves the game engine, sign-in gate and leaderboard posting in place', () => {
    for (const id of game.ids) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain('assets/js/cmc-auth-gate.js');
    expect(html).toContain("CMC_GATE.guard('account'");
    expect(html).toContain('drill_attempts');
    expect(html).toContain(game.slug);
    for (const id of ['cmcNameIn', 'cmcIdIn', 'cmcLbName', 'cmcLbId', 'cmcLbSend', 'cmcLbStatus', 'cmcShare']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    for (const hook of ['data-cmc-share', 'data-cmc-copy', 'data-cmc-wa', 'data-cmc-tg', 'data-cmc-email', 'data-cmc-close']) {
      expect(html, hook).toContain(hook);
    }
  });
});
