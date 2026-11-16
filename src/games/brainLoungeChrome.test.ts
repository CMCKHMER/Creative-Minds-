// @vitest-environment jsdom
//
// The shared CMC game chrome (public/assets/js/cmc-game-chrome.js) is the one
// piece of furniture every standalone cartridge loads: ← Back to CMC, the class
// board, share-with-class and the how-to-play sheet. It is plain ES5 with no
// build step, so the only way to keep it honest is to run it.
//
// What this covers
//   bar     a back link to #brain-lounge labelled "Back to CMC" (the audit's
//           requirement, asserted from the other side)
//   share   the sheet lists copy / WhatsApp / Telegram / email / class board
//   pause   opening a sheet dispatches cmc-chrome:modal so the game freezes,
//           and closing it dispatches the unlock again
//   esc     Escape closes the sheet
//   inline  a page with its own header (Word Creator) mounts a compact cluster
//           into a slot instead of the fixed corner bar
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SRC = readFileSync(resolve(process.cwd(), 'public/assets/js/cmc-game-chrome.js'), 'utf8');

const HELP = {
  intro: 'A vertical arcade shooter.',
  sections: [{ h: 'Flying', items: ['← → to move', 'Z to fire'] }],
  art: [{ src: 'art/galica-sector-1.jpg', title: 'Sector 1', sub: 'Deep Space' }],
};

function mount(config: Record<string, unknown> = {}) {
  (window as unknown as { CMC_GAME_CHROME?: unknown }).CMC_GAME_CHROME = {
    theme: 'neon',
    title: 'Galica',
    bay: 'Bay 03',
    help: HELP,
    ...config,
  };
  new Function(SRC)();
  // The script mounts on DOMContentLoaded when it loads early; jsdom reports
  // "loading" until the test's own document finishes, so nudge it.
  if (!document.getElementById('cmc-gc')) {
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
  return document.getElementById('cmc-gc') as HTMLElement;
}

function cleanup() {
  for (const id of ['cmc-gc', 'cmc-gc-modal', 'cmc-gc-toast']) {
    document.getElementById(id)?.remove();
  }
  document.querySelectorAll('style').forEach((node) => {
    if (node.textContent?.includes('--cmc-gc-accent')) node.remove();
  });
  document.documentElement.removeAttribute('data-cmc-gc-modal');
}

afterEach(cleanup);

describe('CMC game chrome', () => {
  it('always offers a way back to CMC', () => {
    const bar = mount();
    const back = bar.querySelector<HTMLAnchorElement>('#cmc-gc-back');
    expect(back).toBeTruthy();
    expect(back!.getAttribute('href')).toMatch(/#brain-lounge$/);
    expect(back!.textContent).toContain('Back to CMC');
    // the class board is one click away from every cartridge
    const board = bar.querySelector<HTMLAnchorElement>('[data-act="board"]');
    expect(board!.getAttribute('href')).toMatch(/#brain-lounge$/);
  });

  it('opens a share sheet with the class channels', () => {
    const bar = mount();
    bar.querySelector<HTMLButtonElement>('[data-act="share"]')!.click();
    const sheet = document.querySelector('#cmc-gc-modal .sheet')!;
    expect(document.getElementById('cmc-gc-modal')!.classList.contains('open')).toBe(true);
    const text = sheet.textContent || '';
    for (const channel of ['Copy link', 'WhatsApp', 'Telegram', 'Email', 'Class leaderboard']) {
      expect(text).toContain(channel);
    }
    expect(sheet.querySelector('a[href^="https://wa.me/"]')).toBeTruthy();
    expect(sheet.querySelector('a[href^="https://t.me/share/url"]')).toBeTruthy();
  });

  it('tells the game to freeze while a sheet is open, and to resume after', () => {
    const bar = mount();
    const seen: boolean[] = [];
    const onChange = (e: Event) => seen.push((e as CustomEvent<{ open: boolean }>).detail.open);
    window.addEventListener('cmc-chrome:modal', onChange);

    bar.querySelector<HTMLButtonElement>('[data-act="help"]')!.click();
    expect(seen).toEqual([true]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(seen).toEqual([true, false]);
    window.removeEventListener('cmc-chrome:modal', onChange);
  });

  it('keeps the how-to-play sheet readable and closes on Escape', () => {
    const bar = mount();
    bar.querySelector<HTMLButtonElement>('[data-act="help"]')!.click();
    const sheet = document.querySelector('#cmc-gc-modal .sheet')!;
    expect(sheet.textContent).toContain('Flying');
    expect(sheet.textContent).toContain('← → to move');
    expect(sheet.querySelector('img')!.getAttribute('src')).toBe('art/galica-sector-1.jpg');

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('cmc-gc-modal')!.classList.contains('open')).toBe(false);
  });

  it('mounts a compact cluster into a page header when asked', () => {
    const slot = document.createElement('div');
    slot.id = 'cmcGcSlot';
    document.body.appendChild(slot);
    const bar = mount({ mount: '#cmcGcSlot', inline: true, actions: ['back'], help: undefined });
    expect(slot.contains(bar)).toBe(true);
    expect(bar.classList.contains('cmc-gc-inline')).toBe(true);
    expect(bar.querySelector('#cmc-gc-back')).toBeTruthy();
    // actions:['back'] means no share dock was rendered
    expect(bar.querySelector('[data-act="share"]')).toBeNull();
    slot.remove();
  });
});
