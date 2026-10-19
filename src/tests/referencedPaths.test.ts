import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source-path integrity: every site-rooted asset reference that appears in
 * React components/data ("./images/...", "./rfc2/...", "./data/...json", ...)
 * must resolve to a real file in public/. A typo'd card image or a link to
 * a tool page that was never committed would otherwise only surface as a
 * 404 in production.
 */

const PUBLIC_DIR = resolve(process.cwd(), 'public');
const SRC_DIR = resolve(process.cwd(), 'src');

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectSourceFiles(full, out);
    else if ((entry.endsWith('.ts') || entry.endsWith('.tsx')) && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Site-rooted string literals like "./images/card-lms.jpg". */
const REF_RE = /["'](\.\/[A-Za-z0-9_\-./]+\.(?:html|png|jpe?g|svg|webp|mp3|wav|json))["']/g;

describe('source asset references resolve into public/', () => {
  const files = collectSourceFiles(SRC_DIR).filter((f) => !f.includes(`${join('src', 'tests')}`));

  it('found component and data files to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(30);
  });

  it('every "./"-rooted reference in src/ exists in public/', () => {
    const missing: string[] = [];
    let totalRefs = 0;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(REF_RE)) {
        totalRefs += 1;
        const target = join(PUBLIC_DIR, match[1].replace(/^\.\//, ''));
        if (!existsSync(target)) missing.push(`${file.replace(SRC_DIR + '/', '')} -> ${match[1]}`);
      }
    }
    // The scan must actually be seeing references, otherwise it is broken
    // and silently passing.
    expect(totalRefs).toBeGreaterThanOrEqual(20);
    expect(missing, 'references with no file in public/:\n' + missing.join('\n')).toEqual([]);
  });
});
