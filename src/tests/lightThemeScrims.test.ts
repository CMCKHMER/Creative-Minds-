// Light theme: the photo/logo bands of the homepage must not keep a dark veil.
//
// Each band is: section colour → background image → veil → text. The light
// theme re-colours text through class remaps in src/index.css, but a veil is
// re-coloured only by a rule written for it. When the planner band's veil
// was rebuilt as a Tailwind gradient (3 Nov 2026) the rule that lightened
// the old one no longer matched: the veil stayed near-black, the text turned
// dark ink — dark on dark (owner report, 15 Nov 2026).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8');
const read = (file: string) => readFileSync(resolve(ROOT, 'src/components', file), 'utf8');

/** class="…" values of every full-bleed overlay (absolute inset-0) that is dark. */
function darkVeils(tsx: string): string[] {
  return [...tsx.matchAll(/className="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((c) => /\babsolute\b/.test(c) && /\binset-0\b/.test(c) && /(?:from|via|to|bg)-slate-950\//.test(c));
}

describe('light theme — band veils', () => {
  it('the planner band: every dark veil carries the class the light theme re-colours', () => {
    const veils = darkVeils(read('BiWeekPlannerCard.tsx'));
    expect(veils.length).toBeGreaterThan(0);
    for (const v of veils) expect(v).toContain('cmc-planner-veil');
  });

  it('the light theme gives that veil a pale gradient on phones and on desktop', () => {
    const rules = [...css.matchAll(/html\.light #toefl-itp-planner \.cmc-planner-veil \{([^}]*)\}/g)].map((m) => m[1]);
    expect(rules).toHaveLength(2); // base (top→bottom) + min-width:1024px (left→right)
    for (const body of rules) {
      expect(body).toContain('background-image: linear-gradient');
      // every stop is a light colour, strong enough to carry dark text
      const stops = [...body.matchAll(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g)];
      expect(stops.length).toBeGreaterThanOrEqual(3);
      for (const [, r, g, b] of stops) expect(Math.min(Number(r), Number(g), Number(b))).toBeGreaterThan(200);
    }
    // the copy side (first stop) is close to opaque
    for (const body of rules) expect(Number(/rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(body)![1])).toBeGreaterThanOrEqual(0.9);
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*html\.light #toefl-itp-planner \.cmc-planner-veil/);
  });

  it('the signed-out card on that band has a solid pale face', () => {
    expect(read('BiWeekPlannerCard.tsx')).toContain('cmc-planner-locked');
    const m = /html\.light #toefl-itp-planner \.cmc-planner-locked \{([^}]*)\}/.exec(css);
    expect(m).not.toBeNull();
    expect(Number(/background-color: rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(m![1])![1])).toBeGreaterThanOrEqual(0.85);
  });

  // The other photo bands still use the scrim class their light rule targets.
  it('the other bands keep the scrim class their light-theme rule is written for', () => {
    const bands: Array<[string, string]> = [
      ['TOEFLiBTCard.tsx', '#toefl-ibt-mock'],
      ['LMSCard.tsx', '#lms-workspace'],
      ['DailyAssessmentCard.tsx', '#daily-assessment'],
      ['GEPISecHub.tsx', '#gep-isec'],
      ['KidGradeHub.tsx', '#kid-grades'],
    ];
    for (const [file, id] of bands) {
      expect(read(file), file).toContain('bg-slate-950/55');
      expect(css, id).toContain(`html.light ${id} .bg-slate-950\\/55`);
    }
  });
});
