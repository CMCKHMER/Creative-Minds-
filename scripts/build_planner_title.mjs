// Builds public/biweek-planner/title-dots.js — the planner page's title drawn
// as particles — from src/standalone/plannerTitle.ts.
//
// The planner page is plain HTML outside the React app, so it cannot load the
// app's hashed chunks. This bundles the same engine the home page uses
// (src/lib/titleParticlesCore.ts + titleParticlesMath.ts) with the 2-D canvas
// painter into one small classic script.
//
//   node scripts/build_planner_title.mjs          write the file
//   node scripts/build_planner_title.mjs --check  exit 1 when the file is stale
//
// `npm run build` runs it first, so dist/ always carries a fresh copy. The
// file's first lines carry a fingerprint of its sources; `--check` and a unit
// test (src/tests/plannerTitleDots.test.ts) compare that fingerprint with the
// sources as they are now, so a forgotten rebuild fails CI while a new
// esbuild version (different bytes, same sources) does not.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'public', 'biweek-planner', 'title-dots.js');

/** Every file that ends up in the bundle, entry first. */
export const SOURCES = [
  'src/standalone/plannerTitle.ts',
  'src/lib/titleParticlesCore.ts',
  'src/lib/titleParticles2d.ts',
  'src/lib/titleParticlesMath.ts',
];

/** A fingerprint of the sources as they are on disk. */
export async function sourceHash() {
  const hash = createHash('sha256');
  for (const file of SOURCES) hash.update(file).update('\0').update((await readFile(join(ROOT, file), 'utf8')).replace(/\r\n/g, '\n')).update('\0');
  return hash.digest('hex').slice(0, 16);
}

/** The fingerprint written into a built file, or '' when there is none. */
export const hashOf = (text) => (text.match(/^   Sources fingerprint: ([0-9a-f]{16})$/m) || [])[1] || '';

/** The bundle as text. */
export async function bundle() {
  const banner = `/* GENERATED FILE — do not edit.
   Source: ${SOURCES[0]} (+ ${SOURCES.slice(1).map((f) => f.split('/').pop()).join(', ')})
   Rebuild: npm run build:planner-title
   Sources fingerprint: ${await sourceHash()}
*/`;
  const result = await build({
    entryPoints: [join(ROOT, SOURCES[0])],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
    banner: { js: banner },
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  // the fingerprint is only worth something if it covers everything bundled
  const inputs = Object.keys(result.metafile.inputs).map((f) => relative(ROOT, join(process.cwd(), f)).split('\\').join('/'));
  const unlisted = inputs.filter((f) => !SOURCES.includes(f));
  if (unlisted.length) throw new Error(`build_planner_title: add to SOURCES: ${unlisted.join(', ')}`);
  return result.outputFiles[0].text;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const current = await readFile(OUT, 'utf8').catch(() => '');
    if (!current || hashOf(current) !== await sourceHash()) {
      console.error('public/biweek-planner/title-dots.js is out of date — run: npm run build:planner-title');
      process.exit(1);
    }
    console.log('planner title script: up to date');
  } else {
    const text = await bundle();
    await writeFile(OUT, text);
    console.log(`planner title script: ${text.length} bytes → public/biweek-planner/title-dots.js`);
  }
}
