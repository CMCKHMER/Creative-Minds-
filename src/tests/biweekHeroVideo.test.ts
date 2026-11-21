import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom') as {
  JSDOM: new (
    html: string,
    opts?: { url?: string; runScripts?: 'dangerously' | 'outside-only' },
  ) => { window: Window & typeof globalThis & { eval: (code: string) => unknown } };
};

const html = readFileSync(resolve(process.cwd(), 'public/biweek-planner/index.html'), 'utf8');

describe('Bi-Weekly Planner Hero Welcome Video', () => {
  it('stays contained inside the left frosted hero column and blends without hard box borders', () => {
    expect(html).toContain('max-width:min(100%,28rem)');
    expect(html).toContain('border:0');
    expect(html).toContain('mix-blend-mode:lighten');
    expect(html).toContain('mask-composite:intersect');
    expect(html).toContain('aii-language-center-logo.png');
    expect(html).toContain('aii-language-center-logo-print.png');
    // Must never use the old overflowing width:fit-content / 300px height box
    expect(html).not.toContain('height:clamp(150px,24vw,300px)');
  });

  it('never uses autoplay+load() loop attributes on the hero video', () => {
    const videoTag = html.match(/<video[^>]*id="bpHeroVideo"[^>]*>/)?.[0] ?? '';
    expect(videoTag).not.toBe('');
    expect(videoTag).not.toMatch(/\bautoplay\b/i);
    expect(videoTag).not.toMatch(/\bloop\b/i);
    expect(html).not.toContain("addEventListener('ended',function(){v.load()})");
  });

  it('plays once on page load, settles into the blended logo on ended without looping, and supports manual replay', async () => {
    const blockMatch = html.match(
      /<div class="bp-hero-video" id="bpHeroVideoWrap">[\s\S]*?<\/script>/,
    );
    expect(blockMatch).not.toBeNull();
    const snippet = blockMatch![0];
    const scriptMatch = snippet.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const markupOnly = snippet.replace(/<script>[\s\S]*?<\/script>/, '');

    const dom = new JSDOM(`<!doctype html><html><body>${markupOnly}</body></html>`, {
      url: 'https://cmc.local/biweek-planner/',
      runScripts: 'outside-only',
    });
    const win = dom.window;
    const video = win.document.getElementById('bpHeroVideo') as HTMLVideoElement;
    const wrap = win.document.getElementById('bpHeroVideoWrap') as HTMLElement;
    const replay = win.document.getElementById('bpHeroReplay') as HTMLButtonElement;

    const playSpy = vi.fn(() => Promise.resolve());
    const pauseSpy = vi.fn();
    Object.defineProperty(video, 'play', { value: playSpy, configurable: true });
    Object.defineProperty(video, 'pause', { value: pauseSpy, configurable: true });

    win.eval(scriptMatch![1]);
    await Promise.resolve();

    // Played once on initial load
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(video.loop).toBe(false);
    expect(wrap.classList.contains('bp-video-ended')).toBe(false);

    // Ends cleanly without restarting
    video.dispatchEvent(new win.Event('ended'));
    expect(wrap.classList.contains('bp-video-ended')).toBe(true);
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    // Clicking the page or video after it ended must NOT restart playback
    win.document.dispatchEvent(new win.Event('pointerdown'));
    video.click();
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Explicit Replay plays once again and ends cleanly
    replay.click();
    await Promise.resolve();
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(wrap.classList.contains('bp-video-ended')).toBe(false);

    video.dispatchEvent(new win.Event('ended'));
    expect(wrap.classList.contains('bp-video-ended')).toBe(true);

    dom.window.close();
  });
});
