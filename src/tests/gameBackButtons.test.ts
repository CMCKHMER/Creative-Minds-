import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEARNING_GAMES } from '../data/learningGames';
import { BRAIN_GAMES } from '../games/registry';

const publicDir = resolve(process.cwd(), 'public');
const localGamePages = [
  ...LEARNING_GAMES.flatMap((game) => game.externalUrl?.startsWith('./')
    ? [{ name: game.title, file: game.externalUrl.slice(2) }]
    : []),
  ...BRAIN_GAMES.flatMap((game) => game.launchUrl?.startsWith('./')
    ? [{ name: game.title, file: game.launchUrl.slice(2) }]
    : []),
];

describe('standalone CMC games return navigation', () => {
  it('every locally hosted game page includes a visible Back to CMC link', () => {
    for (const game of localGamePages) {
      const html = readFileSync(resolve(publicDir, game.file), 'utf8');
      expect(html, game.name).toContain('id="cmc-back-to-site"');
      expect(html, game.name).toContain('Back to CMC');
      expect(html, game.name).toMatch(/href="(?:\.\/|\.\.\/)+#top"/);
    }
  });
});
