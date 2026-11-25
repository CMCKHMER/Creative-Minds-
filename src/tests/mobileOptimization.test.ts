import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('Mobile optimization & layout bug guards', () => {
  it('enables viewport-fit=cover in index.html for notched mobile safe areas', () => {
    const html = read('index.html');
    expect(html).toContain('viewport-fit=cover');
  });

  it('prevents horizontal scroll wobble, 300ms tap delay, and iOS input auto-zoom in src/index.css', () => {
    const css = read('src/index.css');
    expect(css).toContain('overflow-x: clip');
    expect(css).toContain('touch-action: manipulation');
    expect(css).toContain('font-size: max(16px, 1em)');
  });

  it('keeps the mobile Navbar dropdown scrollable, auto-closing on Escape/hashchange, and clears the top banner close icon', () => {
    const nav = read('src/components/Navbar.tsx');
    expect(nav).toContain('max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain');
    expect(nav).toContain("window.addEventListener('hashchange', onHash)");
    expect(nav).toContain('pr-10');
    expect(nav).toContain('max-w-[calc(100vw-1.5rem)]');
  });

  it('restores prior document.body.style.overflow in QuickDrawer instead of clobbering overflow-x with auto', () => {
    const drawer = read('src/components/QuickDrawer.tsx');
    expect(drawer).not.toContain("document.body.style.overflow = 'auto'");
    expect(drawer).toContain('document.body.style.overflow = previousOverflow');
    expect(drawer).toContain('h-[100dvh]');
  });

  it('bounds mobile modals to 92dvh with vertical scroll and cancels speech on StudentDemoModal close', () => {
    const studentAuth = read('src/components/StudentAuthModal.tsx');
    const studentDemo = read('src/components/StudentDemoModal.tsx');
    const transfer = read('src/components/TransferStudentModal.tsx');

    expect(studentAuth).toContain('max-h-[92dvh] overflow-y-auto overscroll-contain');
    expect(studentAuth).toContain("if (e.key === 'Escape') onClose()");

    expect(studentDemo).toContain('max-h-[92dvh] overflow-y-auto overscroll-contain');
    expect(studentDemo).toContain('window.speechSynthesis.cancel()');

    expect(transfer).toContain('max-h-[92dvh] overflow-y-auto overscroll-contain');
  });

  it('respects iOS safe-area-inset-bottom on fixed bottom TickerBanner and floating dock', () => {
    const ticker = read('src/components/TickerBanner.tsx');
    const app = read('src/App.tsx');

    expect(ticker).toContain('pb-[env(safe-area-inset-bottom)]');
    expect(ticker).toContain('active:[animation-play-state:paused]');
    expect(app).toContain('env(safe-area-inset-bottom)');
  });

  it('uses 100dvh and mobile touch optimizations across standalone interactive games', () => {
    const syntaxCss = read('public/syntax-clash-rpg.css');
    const voiceCss = read('public/voice-quest-rpg.css');
    const cryoHtml = read('public/cryo-lockdown.html');
    const reasonHtml = read('public/reason-lab.html');

    expect(syntaxCss).toContain('height: 100dvh;');
    expect(syntaxCss).toContain('overflow-x: auto;');
    expect(voiceCss).toContain('min-height: 100dvh;');
    expect(voiceCss).toContain('env(safe-area-inset-bottom)');
    expect(cryoHtml).toContain('min-height:100dvh');
    expect(cryoHtml).toContain('background-attachment:scroll');
    expect(reasonHtml).toContain('min-height:100dvh');
    expect(reasonHtml).toContain('background-attachment:scroll');
  });
});
