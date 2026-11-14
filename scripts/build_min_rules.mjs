#!/usr/bin/env node
/**
 * Regenerates firestore-min.rules from firestore.rules.
 *
 * firestore-min.rules is the comment-free copy that gets pasted into the
 * Firebase console. It used to be maintained by hand and silently drifted:
 * it missed whole collections and kept weaker access checks than the real
 * file. It is now a build artefact — never edit it directly.
 *
 *   node scripts/build_min_rules.mjs          rewrite firestore-min.rules
 *   node scripts/build_min_rules.mjs --check  exit 1 if it is out of date
 *
 * src/tests/rulesMin.test.ts runs the --check mode, so CI fails when
 * firestore.rules changes without regenerating the minified copy.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'firestore.rules');
const TARGET = resolve(ROOT, 'firestore-min.rules');

/** Remove a trailing `// comment`, ignoring any `//` inside a quoted string. */
function stripLineComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = '';
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '/' && line[i + 1] === '/') {
      return line.slice(0, i);
    }
  }
  return line;
}

export function minifyRules(source) {
  const lines = source
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => stripLineComment(line).replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '');
  return `${lines.join('\n')}\n`;
}

const expected = minifyRules(readFileSync(SOURCE, 'utf8'));

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch {
    /* missing file counts as out of date */
  }
  if (current !== expected) {
    console.error('firestore-min.rules is out of date — run: node scripts/build_min_rules.mjs');
    process.exit(1);
  }
  console.log('firestore-min.rules is in sync with firestore.rules');
} else {
  writeFileSync(TARGET, expected);
  console.log(`Wrote ${TARGET} (${expected.split('\n').length - 1} lines)`);
}
