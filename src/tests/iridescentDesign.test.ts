// Iridescent design layer — invariants for the card/button treatment.
//
// Owner request (16 Nov 2026): "make all button and card designs like this
// in light and dark mode. extend design to kid pages section and all cards
// on hero and linked pages" — a reference board with a magenta→cyan gradient
// border, glass fill, glowing icon ring, micro uppercase labels and a
// divided stat row.
//
// These tests guard the two ways that design can silently break:
//
//  1. THE BORDER BOX TRICK. A gradient border is drawn as two background
//     layers: `linear-gradient(...) border-box` under
//     `linear-gradient(...) padding-box`. That only shows an edge if the
//     element has a REAL border width — with `border: 0`, border-box and
//     padding-box are identical and the face paints over the gradient. A
//     `border: 0 !important` on any edge-drawing rule is always a bug.
//
//  2. LOAD ORDER. iridescent.css must load after index.css and glass.css,
//     because it deliberately overrides both without editing 55 components.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const read = (...parts: string[]) => readFileSync(resolve(ROOT, ...parts), 'utf8');

const appCss = read('src/iridescent.css');
const staticCss = read('public/assets/css/cmc-iridescent.css');
const mainTsx = read('src/main.tsx');

/**
 * Every rule that draws a gradient edge (a two-layer background).
 * Parsed with PostCSS rather than a regex: an at-rule wrapper or a selector
 * pattern will happily span a `}` boundary and pair one rule's selector with
 * the next rule's declarations, which produces phantom failures.
 */
function edgeRules(css: string, from: string): Rule[] {
  const rules: Rule[] = [];
  postcss.parse(css, { from }).walkRules((rule) => {
    const text = rule.toString();
    if (text.includes('padding-box') && text.includes('border-box')) rules.push(rule);
  });
  return rules;
}

/** The border width a rule declares, or undefined when it declares none. */
function borderDecl(rule: Rule): string | undefined {
  const decl = rule.nodes.find((n): n is Declaration => n.type === 'decl' && n.prop === 'border');
  return decl?.value;
}

describe('iridescent layer — load order', () => {
  it('loads last, after index.css and glass.css', () => {
    const index = mainTsx.indexOf('./index.css');
    const glass = mainTsx.indexOf('./glass.css');
    const iridescent = mainTsx.indexOf('./iridescent.css');
    expect(index).toBeGreaterThan(-1);
    expect(glass).toBeGreaterThan(index);
    expect(iridescent).toBeGreaterThan(glass);
  });
});

describe('iridescent layer — the gradient border is real', () => {
  it('every edge rule in the app sheet declares a real border width', () => {
    const rules = edgeRules(appCss, 'src/iridescent.css');
    expect(rules.length).toBeGreaterThanOrEqual(20);
    for (const rule of rules) {
      const border = borderDecl(rule);
      expect(border, `${rule.selector} must declare a border`).toBeDefined();
      // A zero width collapses the border box onto the padding box and the
      // face layer paints over the gradient — the edge disappears.
      expect(border, `${rule.selector} border must not be 0`).not.toMatch(/^0\b/);
      expect(border, `${rule.selector} border must be transparent`).toMatch(/solid transparent/);
    }
  });

  it('every edge rule in the static-page sheet declares a real border width', () => {
    const rules = edgeRules(staticCss, 'public/assets/css/cmc-iridescent.css');
    expect(rules.length).toBeGreaterThanOrEqual(10);
    for (const rule of rules) {
      const border = borderDecl(rule);
      expect(border, `${rule.selector} must declare a border`).toBeDefined();
      expect(border, `${rule.selector} border must not be 0`).not.toMatch(/^0\b/);
      expect(border, `${rule.selector} border must be transparent`).toMatch(/solid transparent/);
    }
  });

  it('explains the constraint, so the next edit does not re-break it', () => {
    expect(appCss).toMatch(/REAL 1px border/i);
    expect(staticCss).toMatch(/real 1px border/i);
  });
});

describe('iridescent layer — both themes', () => {
  it('defines the same tokens for dark (:root) and light (html.light)', () => {
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    const lightBlock = /html\.light\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    for (const token of ['--iri-edge', '--iri-face', '--iri-bloom', '--iri-ink', '--iri-lip']) {
      expect(rootBlock, `:root ${token}`).toContain(token);
      expect(lightBlock, `html.light ${token}`).toContain(token);
    }
  });

  // The static pages mark light mode on <body>, the app on <html>.
  it('the static sheet keys light mode on body.light, matching those pages', () => {
    expect(staticCss).toMatch(/body\.light\s*\{/);
    expect(staticCss).not.toMatch(/html\.light\s*\{/);
  });

  it('light mode uses a soft fill, never pure white (the owner’s no-glare rule)', () => {
    const lightBlock = /html\.light\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    // No fully-opaque white anywhere in the light face gradient.
    expect(lightBlock).not.toMatch(/rgba\(255,\s*255,\s*255,\s*1\)/);
  });
});

describe('iridescent layer — coverage across surfaces', () => {
  it('styles cards, buttons, icon rings and eyebrows', () => {
    for (const cls of ['.cmc-card', '.cmc-quick', '.cmc-glass', '.cmc-btn-primary', '.cmc-btn-3d', '.cmc-btn-ghost', '.cmc-quick-chip', '.cmc-eyebrow']) {
      expect(appCss, cls).toContain(cls);
    }
  });

  it('reaches the kid-grade cards specifically', () => {
    expect(appCss).toContain('#kid-grades article');
  });

  it('exposes a stat row for the reference’s divided numbers', () => {
    expect(appCss).toContain('.cmc-stat-row');
    expect(appCss).toContain('.cmc-stat-num');
    // The hero quick cards actually use it.
    expect(read('src/components/Hero.tsx')).toContain('cmc-stat-row');
  });

  it('respects prefers-reduced-motion for the lift and sheen', () => {
    expect(appCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(staticCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('keeps focus rings visible on the new gradient surfaces', () => {
    expect(appCss).toContain(':focus-visible');
    expect(appCss).toContain('outline-offset');
  });
});

describe('iridescent layer — the static worksheet pages load it', () => {
  const pages = [
    'public/rfc1/dictation.html',
    'public/rfc1/unit-test.html',
    'public/rfc1/unscramble.html',
    'public/rfc1/word-list.html',
    'public/rfc2/rfc2dic.html',
    'public/rfc2/rfc2un.html',
    'public/rfc2/rfc2unittest.html',
    'public/rfc2/rfc2unitwords.html',
    'public/rfc3/dictation.html',
    'public/rfc3/doctor-fish.html',
    'public/rfc3/review-tests.html',
    'public/rfc3/unit13hw.html',
    'public/rfc3/unit15hw.html',
    'public/rfc3/unit2hw.html',
    'public/rfc3/unit3hw.html',
    'public/rfc3/unit4hw.html',
    'public/rfc3/unscramble.html',
    'public/rfc3/word-list.html',
  ];

  it('every kid worksheet page links the shared stylesheet', () => {
    for (const page of pages) {
      const html = read(page);
      expect(html, page).toContain('/assets/css/cmc-iridescent.css');
    }
  });
});

// ── The cascade, checked the way the browser resolves it ────────────────
// iridescent.css only wins because it loads last. If someone later adds a
// more specific selector to glass.css (or reorders the imports), the design
// silently reverts while every other test still passes. This walks the three
// sheets in load order and asserts the iridescent rule is what the browser
// would actually apply.

interface Decl {
  file: string;
  order: number;
  selector: string;
  prop: string;
  value: string;
  important: number;
  specificity: number;
}

const SHEETS = ['src/index.css', 'src/glass.css', 'src/iridescent.css'];

function declarations(): Decl[] {
  const out: Decl[] = [];
  SHEETS.forEach((file, sheetIndex) => {
    postcss.parse(read(file), { from: file }).walkRules((rule) => {
      const ids = (rule.selector.match(/#/g) ?? []).length;
      const classes = (rule.selector.match(/\.[\w-]+/g) ?? []).length;
      rule.nodes.forEach((node) => {
        if (node.type !== 'decl') return;
        out.push({
          file,
          order: sheetIndex,
          selector: rule.selector.trim(),
          prop: node.prop,
          value: node.value,
          important: node.important ? 1 : 0,
          specificity: ids * 100 + classes * 10,
        });
      });
    });
  });
  return out;
}

/** The declaration a browser would apply for `prop` on `selector`. */
function winningDecl(all: Decl[], selector: string, prop: string): Decl | undefined {
  return all
    .filter((d) => d.prop === prop && d.selector.split(',').some((s) => s.trim() === selector))
    .sort((a, b) => (a.important - b.important) || (a.specificity - b.specificity) || (a.order - b.order))
    .pop();
}

describe('iridescent layer — wins the cascade', () => {
  const all = declarations();

  const surfaces: Array<[string, string, boolean]> = [
    // selector, property, should carry the two-layer gradient edge
    ['.cmc-card', 'background', true],
    ['.cmc-card:hover', 'background', true],
    ['.cmc-glass', 'background', true],
    ['.cmc-quick', 'background', true],
    ['.cmc-btn-ghost', 'background', true],
    ['.cmc-eyebrow', 'background', true],
    ['.cmc-quick-chip', 'background', true],
    // The primary CTA is a saturated gradient fill, not a two-layer edge.
    ['.cmc-btn-primary', 'background', false],
    ['.cmc-stat-num', 'color', false],
  ];

  for (const [selector, prop, wantsEdge] of surfaces) {
    it(`${selector} ${prop} comes from the iridescent layer`, () => {
      const win = winningDecl(all, selector, prop);
      expect(win, `no ${prop} rule matches ${selector}`).toBeDefined();
      expect(win!.file, `${selector} ${prop} is overridden by ${win!.file}`).toBe('src/iridescent.css');
      if (wantsEdge) {
        expect(win!.value).toContain('padding-box');
        expect(win!.value).toContain('border-box');
      }
    });
  }
});
