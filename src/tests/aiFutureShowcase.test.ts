import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AI_FUTURE_CARDS } from '../data/aiFutureCards';
import { AiFutureShowcase } from '../components/AiFutureShowcase';
import { findPage, hashKey } from '../lib/sitePages';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const glassCss = readFileSync(join(root, 'src', 'glass.css'), 'utf8');
const appSrc = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');

describe('AiFutureShowcase — futuristic floating-3D holographic AI cards', () => {
  it('defines four holographic cards with unique ids, tones, and valid live routes', () => {
    expect(AI_FUTURE_CARDS.length).toBe(4);
    const ids = new Set(AI_FUTURE_CARDS.map((card) => card.id));
    expect(ids.size).toBe(4);

    for (const card of AI_FUTURE_CARDS) {
      expect(card.liveHref.startsWith('#')).toBe(true);
      const target = findPage(hashKey(card.liveHref));
      expect(target, `expected valid site page for ${card.liveHref}`).toBeDefined();
      expect(card.phase).toMatch(/^AI · PHASE 0[1-4]$/);
      expect(card.tags.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('ships every floating 3D holographic webp asset on disk', () => {
    for (const card of AI_FUTURE_CARDS) {
      const rel = card.image.replace(/^\.\//, '');
      const fullPath = join(root, 'public', rel);
      expect(existsSync(fullPath), `missing image ${fullPath}`).toBe(true);
      expect(statSync(fullPath).size, `empty image ${fullPath}`).toBeGreaterThan(10_000);
    }
  });

  it('renders floating 3D hologram chambers, AI-soon badges, and accessible controls', () => {
    const html = renderToStaticMarkup(React.createElement(AiFutureShowcase));
    expect(html).toContain('Education');
    expect(html).toContain('Reimagined');
    expect(html).toContain('AI-INTEGRATED ROADMAP');
    expect(html).toContain('AI SOON');
    expect(html).toContain('data-keep-dark=""');
    expect(html).toContain('cmc-holo-float-wrap');
    expect(html).toContain('cmc-holo-art');
    for (const card of AI_FUTURE_CARDS) {
      expect(html).toContain(card.title);
      expect(html).toContain(card.pillar);
      expect(html).toContain(`href="${card.liveHref}"`);
    }
  });

  it('mounts on the home page after SectionDirectory without breaking Hero->SectionDirectory order', () => {
    const heroIdx = appSrc.indexOf('<Hero');
    const dirIdx = appSrc.indexOf('<SectionDirectory />');
    const aiIdx = appSrc.indexOf('<AiFutureShowcase />');
    expect(heroIdx).toBeGreaterThan(-1);
    expect(dirIdx).toBeGreaterThan(heroIdx);
    expect(aiIdx).toBeGreaterThan(dirIdx);
  });

  it('provides 3D perspective tilt, floating hologram levitation, light-theme parity, and reduced-motion rules', () => {
    expect(glassCss).toContain('.cmc-holo-card');
    expect(glassCss).toContain('perspective: 1400px;');
    expect(glassCss).toContain('transform-style: preserve-3d;');
    expect(glassCss).toContain('mix-blend-mode: screen;');
    expect(glassCss).toContain('@keyframes cmc-holo-levitate');
    expect(glassCss).toContain('html.light .cmc-holo-card');
    expect(glassCss).toContain('html.light .cmc-holo-stage');
    expect(glassCss).toContain('.cmc-holo-float-wrap');
    expect(glassCss).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('advertises only the phase whose feature actually works, and says which one', () => {
    const html = renderToStaticMarkup(React.createElement(AiFutureShowcase));
    const live = AI_FUTURE_CARDS.filter((card) => card.status === 'live');
    // Phase 01 is the only live phase: essay feedback, speaking coach and the
    // saved trend all ship; nothing else claims to work.
    expect(live.map((card) => card.id)).toEqual(['smart-learning']);
    // twice on purpose: the Phase 01 card pill, plus the live trend strip above
    // the grid (both say the same thing, so the page cannot contradict itself).
    expect(html.match(/PHASE 01 · LIVE/g)?.length).toBe(2);
    expect(html).toContain('cmc-ai-live');
    // the other three keep the honest "not built" pill
    expect(html.match(/AI SOON/g)?.length).toBe(3);
    expect(glassCss).toContain('.cmc-holo-soon[data-live="true"]');
    expect(glassCss).toContain('html.light .cmc-holo-soon[data-live="true"]');
  });
});
