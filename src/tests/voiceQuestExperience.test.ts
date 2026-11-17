import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
