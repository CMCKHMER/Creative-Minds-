import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEARNING_GAMES } from '../data/learningGames';

const page = readFileSync(resolve(process.cwd(), 'src/components/LearningGamesPage.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/iridescent.css'), 'utf8');

describe('Learning Games — challenge upgrade & iridescent sync', () => {
  it('offers Classic, Time Trial and Survival with XP multipliers', () => {
    for (const token of ['Classic Quest', 'Time Trial', 'Survival', 'multiplier', 'MODE_META']) {
      expect(page).toContain(token);
    }
    expect(page).toContain("mode === 'survival'");
    expect(page).toContain('setLives');
  });

  it('has lives, hint tokens, streak XP, keyboard play and a Boss challenge map', () => {
    for (const token of ['Hint ·', 'useHint', 'eliminated', 'Best streak', 'Challenge map', 'Retry', 'missed', "e.key === 'Enter'", 'Crown']) {
      expect(page, token).toContain(token);
    }
  });

  it('briefs before playing and ranks the finished run (S/A/B/C)', () => {
    for (const token of ["'brief'", 'Choose your challenge mode', 'Rank', 'rankFor', 'Retry', 'gameXpTotal']) {
      expect(page, token).toContain(token);
    }
  });

  it('syncs cards and the player to the iridescent design system', () => {
    expect(page).toContain('cmc-card');
    expect(page).toContain('iri-btn');
    expect(page).toContain('iri-ring');
    expect(page).toContain('cmc-stat-row');
    expect(page).toContain('coverImage');
    // The tokens those classes depend on still exist in both themes.
    for (const token of ['--iri-a', '--iri-b', '--iri-c', '--iri-d', '--iri-edge']) expect(css).toContain(token);
    expect(css).toContain('.cmc-card');
    expect(css).toContain('.iri-btn');
  });

  it('every in-page cover image referenced by the registry exists on disk', () => {
    for (const game of LEARNING_GAMES) {
      if (!game.coverImage) continue;
      const target = resolve(process.cwd(), 'public', game.coverImage.replace(/^\.\//, ''));
      expect(existsSync(target), `${game.id} → ${game.coverImage}`).toBe(true);
    }
  });

  it('keeps guest gating and leaderboard submission for full runs only', () => {
    expect(page).toContain('guestLocked');
    expect(page).toContain('GUEST_SAMPLE_QUESTION_LIMIT');
    expect(page).toContain('submitGameScore');
    expect(page).toContain('Only full runs post to the leaderboard');
  });
});
