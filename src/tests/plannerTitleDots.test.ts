// The TOEFL ITP Bi-Weekly Planner PAGE draws its title as particles, like the
// hero title of the home page. The page is plain HTML outside the React app,
// so its script is a small bundle built from src/standalone/plannerTitle.ts.
// These tests keep the page, the bundle and their sources in step.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const page = read('public/biweek-planner/index.html');
const built = read('public/biweek-planner/title-dots.js');
const entry = read('src/standalone/plannerTitle.ts');
const core = read('src/lib/titleParticlesCore.ts');
const painter = read('src/lib/titleParticles2d.ts');
const builder = read('scripts/build_planner_title.mjs');
const homeCss = read('src/index.css');

/** The stops of a `linear-gradient(100deg,#a,#b,#c)` as [position, colour], evenly spread. */
const stops = (css: string) => {
  const colours = css.match(/#[0-9a-f]{6}/gi)!;
  return colours.map((c, i) => [i / (colours.length - 1), c.toLowerCase()]);
};
const pick = (name: string) => JSON.parse(entry.match(new RegExp(`${name}: (\\[\\[.*?\\]\\]),`))![1].replace(/'/g, '"'));

describe('planner page title as particles', () => {
  it('the built script matches its sources', () => {
    // the same fingerprint scripts/build_planner_title.mjs writes into the file
    const sources = [...builder.match(/export const SOURCES = \[([^\]]*)\]/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(sources).toEqual(['src/standalone/plannerTitle.ts', 'src/lib/titleParticlesCore.ts', 'src/lib/titleParticles2d.ts', 'src/lib/titleParticlesMath.ts']);
    const hash = createHash('sha256');
    for (const file of sources) hash.update(file).update('\0').update(read(file).replace(/\r\n/g, '\n')).update('\0');
    const expected = hash.digest('hex').slice(0, 16);
    const written = built.match(/^ {3}Sources fingerprint: ([0-9a-f]{16})$/m)?.[1];
    expect(written, 'run: npm run build:planner-title').toBe(expected);
  });

  it('`npm run build` rebuilds the script before the site', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.build).toBe('node scripts/build_planner_title.mjs && vite build');
    expect(pkg.scripts['build:planner-title']).toBe('node scripts/build_planner_title.mjs');
    expect(pkg.devDependencies.esbuild, 'the builder imports esbuild directly').toBeTruthy();
  });

  it('the bundle carries no three.js and stays small', () => {
    expect(entry).not.toMatch(/from 'three'|titleParticles'/);
    expect(core).not.toMatch(/from 'three'/);
    expect(painter).not.toMatch(/from 'three'/);
    expect(built).not.toMatch(/WebGLRenderer|THREE\./);
    expect(built.length).toBeLessThan(24_000);
    // a classic script: the page loads it with a plain <script defer>
    expect(built).not.toMatch(/^\s*(import|export)\s/m);
  });

  it('the page loads the script last, deferred, and it exists', () => {
    expect(page).toMatch(/<script src="\.\/title-dots\.js" defer><\/script>\s*<\/body>/);
    expect(page.match(/title-dots\.js/g)).toHaveLength(2); // the tag and the note in the CSS
  });

  it('the title stays a real <h1> in the hero lettering', () => {
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(page).toContain('<span class="bp-title-solid" data-echo>TOEFL ITP</span>');
    expect(page).toContain('<span class="bp-title-solid" data-dot-gradient>Bi-Weekly Planner</span>');
    // the same family and weight as the home page's hero title
    expect(page.match(/\.bp-title\{([^}]*)\}/)![1]).toMatch(/font-family:'Syne',sans-serif;font-weight:800/);
    expect(homeCss).toMatch(/--font-hero:\s*'Syne'/);
    expect(page).toMatch(/family=[^"]*Syne:wght@[^"&]*800/);
    // each span starts with its text — the sampler reads the first text node
    for (const m of page.matchAll(/<span class="bp-title-solid"[^>]*>([^<]*)</g)) expect(m[1].trim().length).toBeGreaterThan(0);
  });

  it('the letters are hidden from the eye only, and the canvas takes no clicks', () => {
    const hidden = page.match(/\.bp-title-as-dots \.bp-title-solid\{([^}]*)\}/)![1];
    expect(hidden).toBe('opacity:0');
    const canvas = page.match(/\.bp-title-canvas\{([^}]*)\}/)![1];
    expect(canvas).toMatch(/pointer-events:none/);
    expect(canvas).toMatch(/position:absolute;inset:0/);
    expect(entry).toContain("canvas.setAttribute('aria-hidden', 'true')");
    // printed, the real title is back
    expect(page).toMatch(/@media print\{\.bp-title-canvas\{display:none\}/);
  });

  it('the dots of the second line take the colours of the page\'s gradient text', () => {
    const dark = page.match(/\n\.bp-title-row--accent \.bp-title-solid\{([^}]*)\}/)![1];
    const light = page.match(/html\[data-theme="light"\] \.bp-title-row--accent \.bp-title-solid\{([^}]*)\}/)![1];
    expect(pick('dark')).toEqual(stops(dark));
    expect(pick('light')).toEqual(stops(light));
  });

  it('the script follows the page\'s own theme switch and respects the visitor', () => {
    expect(entry).toContain("document.documentElement.getAttribute('data-theme') === 'light'");
    expect(core).toMatch(/attributeFilter: \['class', 'data-theme'\]/);
    // reduced motion, forced colours, data saver, slow connection, little memory: no effect
    expect(entry).toMatch(/shouldAnimateTitle\(\{/);
    expect(entry).toContain('(prefers-reduced-motion: reduce)');
    expect(entry).toContain('(forced-colors: active)');
    // started after the page has loaded and the browser is idle
    expect(entry).toMatch(/requestIdleCallback\(start, \{ timeout: 2500 \}\)/);
  });

  it('the home page still gets its dots from three.js through the same engine', () => {
    const three = read('src/lib/titleParticles.ts');
    expect(three).toMatch(/import \{ mountDots, type DotPainter, type TitleParticlesOptions \} from '\.\/titleParticlesCore'/);
    expect(three).toMatch(/export function mountTitleParticles\(options: TitleParticlesOptions\): \(\) => void/);
    expect(three).toMatch(/return mountDots\(options, painter\)/);
  });
});
