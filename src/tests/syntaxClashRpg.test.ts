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
const html = readFileSync(resolve(publicDir, 'syntax-clash-pro.html'), 'utf8');
const rpgCss = readFileSync(resolve(publicDir, 'syntax-clash-rpg.css'), 'utf8');
const rpgJs = readFileSync(resolve(publicDir, 'syntax-clash-rpg.js'), 'utf8');

describe('Syntax Clash Cybernetic Breach RPG', () => {
  it('wires the Cyberpunk RPG CSS, JS, and pre-paint cmc-theme sync while preserving CMC platform hooks', () => {
    expect(html).toContain('syntax-clash-rpg.css');
    expect(html).toContain('syntax-clash-rpg.js');
    expect(html).toContain("localStorage.getItem('cmc-theme')");
    expect(html).toContain('cmc-auth-gate.js');
    expect(html).toContain('id="cmc-share-fab"');
    expect(html).toContain('id="cmc-back-to-site"');
    expect(html).toContain('drill_attempts');
  });

  it('ships all 6 bespoke cyberpunk illustrations referenced by the command center and boss raids', () => {
    const assets = [
      'command-hero.jpg',
      'enemy-grammar-bot.jpg',
      'enemy-syntax-guardian.jpg',
      'enemy-quantum-ai.jpg',
      'vault-breach.jpg',
      'academy-hub.jpg',
    ];
    for (const file of assets) {
      expect(existsSync(resolve(publicDir, 'images/syntax-clash-rpg', file))).toBe(true);
      expect(rpgJs).toContain(`syntax-clash-rpg/${file}`);
    }
  });

  it('includes all 9 hacking protocols, 8 hacking ranks, 6 rogue AIs, 4-phase Mainframe boss, and 4 hacker academies', () => {
    for (const protocol of [
      'Firewall Verification',
      'Code Repair Protocol',
      'Malware Detection',
      'Last Firewall Standing',
      'Emergency System Breach',
      'Rapid Infiltration',
      'Training Simulator',
      'Vault Breach Operation',
    ]) {
      expect(rpgJs).toContain(protocol);
    }
    for (const rank of [
      'Script Kiddie',
      'Network Scout',
      'Security Analyst',
      'Cyber Operator',
      'Penetration Specialist',
      'Digital Assassin',
      'Ghost Hacker',
      'Network Overlord',
    ]) {
      expect(rpgJs).toContain(rank);
    }
    for (const enemy of ['Grammar Bot', 'Spelling Drone', 'Syntax Guardian', 'Punctuation Sentinel', 'Logic Firewall', 'Quantum AI']) {
      expect(rpgJs).toContain(enemy);
    }
    for (const academy of ['Syntax Syndicate', 'Vocabulary Vanguard', 'Pronunciation Protocol', 'Reading Intelligence Agency']) {
      expect(rpgJs).toContain(academy);
    }
    expect(rpgJs).toContain('Infiltrate NexaCorp');
    expect(rpgJs).toContain('PHASE 1 // SUBJECT-VERB AGREEMENT');
    expect(rpgJs).toContain('PHASE 2 // TENSE CORRECTIONS');
    expect(rpgJs).toContain('PHASE 3 // SENTENCE RECONSTRUCTION');
    expect(rpgJs).toContain('PHASE 4 // FINAL LANGUAGE PUZZLE');
    expect(rpgCss).toContain('html.light');
    expect(rpgCss).toContain('scScanSweep');
    expect(rpgCss).toContain('scRedFlash');
  });

  it('boots cleanly in JSDOM, launches THE MAINFRAME 4-phase raid, switches academies, upgrades skills, and toggles light/dark theme', () => {
    const dom = new JSDOM(
      '<!doctype html><html><head></head><body><div id="app"></div></body></html>',
      { url: 'https://cmc.local/syntax-clash-pro.html', runScripts: 'outside-only' },
    );
    const win = dom.window as unknown as Record<string, any>;
    win.requestAnimationFrame = () => 1;
    win.HTMLCanvasElement.prototype.getContext = () => null;
    win.STATS = { money: 0, emblems: [], ach: [] };
    win.ACH = [];
    win.DB = [{ t: "She don't like pizza.", w: ['She', "don't", 'like', 'pizza.'], e: 1, fx: "doesn't", d: 1 }];
    win.localStorage.setItem('cmc-theme', 'dark');
    win.localStorage.setItem('cmc-student-name', 'Vireak');

    dom.window.eval(rpgJs);
    if (dom.window.document.readyState === 'loading') {
      dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    }

    expect(dom.window.document.getElementById('sc-cyber-bg')).not.toBeNull();
    expect(dom.window.document.getElementById('app')?.textContent).toContain('Firewall Verification');
    expect(dom.window.document.getElementById('app')?.textContent).toContain('CAM-04 // NEXACORP VAULT');

    // Launch THE MAINFRAME 4-phase boss raid & answer Phase 1 item 1 correctly
    win.CMC_SC_RPG.launchOperation('op_mainframe');
    const arena = dom.window.document.getElementById('sc-op-arena')!;
    expect(arena.hasAttribute('hidden')).toBe(false);
    expect(arena.textContent).toContain('PHASE 1 // SUBJECT-VERB AGREEMENT');

    const correctBtn = arena.querySelector('[data-op-fix="is"]') as HTMLButtonElement;
    expect(correctBtn).not.toBeNull();
    correctBtn.click();
    expect(arena.textContent).toContain('NODE DEACTIVATED!');
    win.CMC_SC_RPG.closeOpArena();

    // Switch to Academies tab & join Vocabulary Vanguard
    (dom.window.document.querySelector('[data-sc-tab="academies"]') as HTMLButtonElement).click();
    expect(dom.window.document.getElementById('app')?.textContent).toContain('Season 01 Academy Leaderboard');
    (dom.window.document.querySelector('[data-join-academy="vanguard"]') as HTMLButtonElement).click();
    expect(win.CMC_SC_RPG.getState().academy).toBe('vanguard');

    // Switch to Cyber Deck & upgrade Clock Overclock (uses initial 1 SP)
    (dom.window.document.querySelector('[data-sc-tab="deck"]') as HTMLButtonElement).click();
    (dom.window.document.querySelector('[data-upgrade-skill="overclock"]') as HTMLButtonElement).click();
    expect(win.CMC_SC_RPG.getState().skills.overclock).toBe(1);
    expect(win.CMC_SC_RPG.getState().skillPoints).toBe(0);

    // Toggle light theme & verify cmc-theme sync
    (dom.window.document.getElementById('scThemeToggle') as HTMLButtonElement).click();
    expect(dom.window.document.documentElement.classList.contains('light')).toBe(true);
    expect(win.localStorage.getItem('cmc-theme')).toBe('light');

    dom.window.close();
  });
});
