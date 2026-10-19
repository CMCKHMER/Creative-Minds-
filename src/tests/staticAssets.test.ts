import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static-asset integrity checker.
 *
 * Crawls every HTML and CSS file under public/ and verifies that each
 * locally-referenced asset (link/script/img/audio/video/href targets,
 * url() references in CSS, and asset-looking string literals inside page
 * scripts) actually exists on disk. This is the guard that would have
 * caught, at CI time:
 *   - the 12 dead Speaking/ audio files (404s on the TOEFL iBT page)
 *   - the 404 stylesheet link on toeflspeaking-MIGRATED.html
 *   - the mis-pathed test-bg.png across 22 biweek-planner pages
 *   - links from the planner to test pages that were never added
 */

const PUBLIC_DIR = resolve(process.cwd(), 'public');

/** Recursively collect files under a directory with a given extension. */
function collectFiles(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectFiles(full, ext, out);
    else if (entry.endsWith(ext)) out.push(full);
  }
  return out;
}

/** True when a reference is external or non-filesystem and must be skipped. */
function isNonFileRef(ref: string): boolean {
  const r = ref.trim();
  if (!r) return true;
  return (
    r.startsWith('http://') ||
    r.startsWith('https://') ||
    r.startsWith('//') ||
    r.startsWith('data:') ||
    r.startsWith('mailto:') ||
    r.startsWith('tel:') ||
    r.startsWith('javascript:') ||
    r.startsWith('blob:') ||
    r.startsWith('#') ||
    r.includes('${') // template-literal interpolation, not a real path
  );
}

/** Strip query string / fragment so ?v=3#top becomes a plain path. */
function stripQueryAndHash(ref: string): string {
  return ref.split('#')[0].split('?')[0];
}

interface BrokenRef {
  page: string; // public-relative path of the containing file
  ref: string; // the raw reference as written
}

function checkRefs(files: string[], refsOf: (file: string) => Array<{ ref: string; raw: string }>): BrokenRef[] {
  const broken: BrokenRef[] = [];
  for (const file of files) {
    for (const { ref, raw } of refsOf(file)) {
      if (isNonFileRef(ref)) continue;
      const clean = stripQueryAndHash(ref);
      if (!clean) continue;
      const target = resolve(dirname(file), clean);
      if (!existsSync(target)) {
        broken.push({ page: relative(PUBLIC_DIR, file), ref: raw });
      }
    }
  }
  return broken;
}

/** Extract local references from an HTML file's markup and inline scripts. */
function htmlRefs(file: string): Array<{ ref: string; raw: string }> {
  const text = readFileSync(file, 'utf8');
  const refs: Array<{ ref: string; raw: string }> = [];

  // src=/href=/poster=/data-src= attribute values (markup).
  const attrRe = /(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']/gi;
  for (const m of text.matchAll(attrRe)) refs.push({ ref: m[1], raw: m[1] });

  // Asset-looking string literals inside page <script> blocks — catches
  // audio files wired up through JavaScript (e.g. the TOEFL iBT listening
  // player) that never appear as markup attributes. Requires a "/" so that
  // filename suffixes (".png" in a download dialog) and optional local
  // fallbacks ("qr.png" behind an embedded QR_BASE64) are not flagged.
  const jsRe = /["']([^"'\n]*\/[^"'\n]*\.(?:mp3|wav|ogg|m4a|png|jpe?g|gif|svg|webp|css))["']/gi;
  for (const m of text.matchAll(jsRe)) refs.push({ ref: m[1], raw: m[1] });

  return refs;
}

/** Extract local url(...) references from a CSS file. */
function cssRefs(file: string): Array<{ ref: string; raw: string }> {
  const text = readFileSync(file, 'utf8');
  const refs: Array<{ ref: string; raw: string }> = [];
  const urlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  for (const m of text.matchAll(urlRe)) refs.push({ ref: m[1], raw: m[1] });
  return refs;
}

describe('static asset integrity (public/)', () => {
  const htmlFiles = collectFiles(PUBLIC_DIR, '.html');
  const cssFiles = collectFiles(PUBLIC_DIR, '.css');

  it('found the tool pages to check', () => {
    // Guard against the checker silently scanning nothing (e.g. a path
    // change that makes PUBLIC_DIR wrong) and always passing.
    expect(htmlFiles.length).toBeGreaterThanOrEqual(40);
    expect(cssFiles.length).toBeGreaterThanOrEqual(2);
  });

  it('every locally referenced asset in HTML exists (links, audio, images, scripts)', () => {
    const broken = checkRefs(htmlFiles, htmlRefs);
    expect(broken, 'missing files referenced from HTML:\n' + broken.map((b) => `  ${b.page} -> ${b.ref}`).join('\n')).toEqual([]);
  });

  it('every url(...) reference in CSS exists', () => {
    const broken = checkRefs(cssFiles, cssRefs);
    expect(broken, 'missing files referenced from CSS:\n' + broken.map((b) => `  ${b.page} -> ${b.ref}`).join('\n')).toEqual([]);
  });

  it('every biweek-planner dashboard card links to a page that exists', () => {
    const planner = htmlFiles.filter((f) => f.includes('biweek-planner'));
    const broken = checkRefs(planner, htmlRefs);
    expect(broken, 'planner pages with dead links:\n' + broken.map((b) => `  ${b.page} -> ${b.ref}`).join('\n')).toEqual([]);
  });
});
