#!/usr/bin/env node
/**
 * Build the Word Creator tournament lexicon.
 * ========================================
 *
 * WHY THIS EXISTS
 *   The game shipped with ~7,300 hand-curated words (the W2–W7 + WX strings
 *   in public/arcade/word-creator/index.html). The audit found it rejected
 *   real words — REACTOR among them. The official North American tournament
 *   list (TWL) has 178,691 playable words, so 171,403 valid plays were being
 *   refused.
 *
 *   Shipping all of it inline would add ~1.8 MB to the page before a single
 *   tile is dealt, on a page that already carries the whole engine. Instead
 *   the list ships as its own gzip-compressed asset and the page upgrades to
 *   it in the background: play starts instantly on the built-in words, and
 *   every tournament word is live a moment later.
 *
 * SOURCE
 *   `scrabble-dictionary` (npm, MIT, © Laurent Debacker) — en/twl.txt, the
 *   NASPA Word List / TWL06. The package is a build-time dependency only; the
 *   generated asset is what ships. Its attribution and licence are copied
 *   next to the output so the provenance travels with the file.
 *
 *     npm install --no-save scrabble-dictionary
 *     node scripts/build_word_lexicon.mjs
 *
 * OUTPUT
 *   public/arcade/word-creator/lexicon.txt.gz  — words joined by \n, gzipped
 *
 *   The loader indexes by length on the client, so the file needs no header:
 *   one word per line, lowercase, 2–15 letters, already filtered to the same
 *   rule the in-page lexicon uses (/^[a-z]{2,15}$/).
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'node_modules/scrabble-dictionary/en/twl.txt');
const OUT_DIR = resolve(ROOT, 'public/arcade/word-creator');
const OUT = resolve(OUT_DIR, 'lexicon.txt.gz');
const ATTRIB = resolve(OUT_DIR, 'lexicon-SOURCE.txt');

/** The in-page rule, mirrored: playable words are 2–15 lowercase letters. */
const WORD = /^[a-z]{2,15}$/;

function main() {
  let raw;
  try {
    raw = readFileSync(SRC, 'utf8');
  } catch {
    console.error(
      `\nMissing ${SRC}\n\n` +
        'Install the word list first:\n' +
        '  npm install --no-save scrabble-dictionary\n' +
        '  node scripts/build_word_lexicon.mjs\n',
    );
    process.exit(1);
  }

  // One word per line; normalise whitespace, drop anything outside the rule,
  // and de-duplicate (the upstream file is already sorted and unique, but the
  // generated asset must not depend on that promise).
  const seen = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const word = line.trim().toLowerCase();
    if (!word || !WORD.test(word) || seen.has(word)) continue;
    seen.add(word);
  }
  const words = [...seen].sort();

  // Sanity floors: a truncated or wrong-column file must fail the build
  // rather than silently ship a smaller dictionary (the bug this whole file
  // exists to fix).
  const floor = 150_000;
  if (words.length < floor) {
    console.error(`Refusing to write ${words.length} words — expected at least ${floor}.`);
    process.exit(1);
  }
  for (const must of ['reactor', 'ability', 'qi', 'za', 'cat']) {
    if (!seen.has(must)) {
      console.error(`Refusing to write: the list is missing "${must}".`);
      process.exit(1);
    }
  }

  const body = words.join('\n');
  const gz = gzipSync(Buffer.from(body, 'utf8'), { level: 9 });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, gz);
  writeFileSync(
    ATTRIB,
    [
      'Word Creator — tournament lexicon (lexicon.txt.gz)',
      '',
      `Generated ${new Date().toISOString().slice(0, 10)} by scripts/build_word_lexicon.mjs.`,
      `Words: ${words.length.toLocaleString()} (2–15 letters, lowercase, one per line).`,
      '',
      'Source: scrabble-dictionary v1.3.0 — en/twl.txt (NASPA Word List / TWL06)',
      '        https://github.com/FlandersBurger/scrabble-dictionary',
      '        MIT License, Copyright (c) 2026 Laurent Debacker',
      '        Upstream: kamilmielnik/scrabble-dictionaries, originally wordgamedictionary.com',
      '',
      'The word list itself is distributed under the MIT licence of the package that',
      'ships it. Rebuild it with:',
      '',
      '  npm install --no-save scrabble-dictionary',
      '  node scripts/build_word_lexicon.mjs',
      '',
    ].join('\n'),
  );

  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(`words     ${words.length.toLocaleString()}`);
  console.log(`raw       ${kb(body.length)}`);
  console.log(`gzipped   ${kb(gz.length)}  -> ${OUT.replace(ROOT + '/', '')}`);
  console.log(`actual    ${kb(statSync(OUT).size)} on disk`);
}

main();
