import { beforeEach, describe, expect, it } from 'vitest';
import { BRAIN_GAMES, liveBrainGames, reservedBays, type BrainGameDef } from '../games/registry';
import { MILESTONE_STAGES, milestonePct } from '../games/brickforge/scoring';
import { buildLevel, COLS, MAX_ROWS } from '../games/brickforge/levels';
import {
  addScore,
  bestScore,
  loadScores,
  loadLastName,
  qualifies,
  saveLastName,
  MAX_ENTRIES,
  type ScoreEntry,
} from '../games/brickforge/highscores';

/** Minimal localStorage stub — vitest runs in a node environment, but the
 * highscore module (and the game itself) touches localStorage everywhere. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

beforeEach(() => {
  const store = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
});

/** Registry invariants — the lounge page renders straight from this data,
 * so a malformed entry would show up as a broken cartridge card. */
describe('brain lounge registry', () => {
  it('has unique ids', () => {
    const ids = BRAIN_GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every game carries display fields', () => {
    for (const game of BRAIN_GAMES) {
      expect(game.title.length, game.id).toBeGreaterThan(0);
      expect(game.tagline.length, game.id).toBeGreaterThan(0);
      expect(game.genre.length, game.id).toBeGreaterThan(0);
      expect(game.emoji.length, game.id).toBeGreaterThan(0);
      expect(game.gradient.startsWith('from-'), game.id).toBe(true);
      expect([1, 2, 3]).toContain(game.difficulty);
      expect(['live', 'coming-soon']).toContain(game.status);
      expect(game.controls.length, game.id).toBeGreaterThan(0);
    }
  });

  it('live games always have a launch path; coming-soon bays never do', () => {
    for (const game of BRAIN_GAMES) {
      if (game.status === 'live') {
        expect(game.mode, game.id).toBeDefined();
        if (game.mode === 'react') {
          expect(typeof game.load, game.id).toBe('function');
        } else {
          expect(game.launchUrl, game.id).toBeTruthy();
        }
      } else {
        expect(game.load, `${game.id} should not ship a loader`).toBeUndefined();
        expect(game.launchUrl, `${game.id} should not ship a URL`).toBeUndefined();
      }
    }
  });

  it('splits into live games and reserved bays that add back up', () => {
    expect(liveBrainGames().length + reservedBays().length).toBe(BRAIN_GAMES.length);
    expect(liveBrainGames().every((g) => g.status === 'live')).toBe(true);
    expect(reservedBays().every((g) => g.status === 'coming-soon')).toBe(true);
  });

  it('keeps at least one playable cartridge and one open bay', () => {
    expect(liveBrainGames().length).toBeGreaterThanOrEqual(1);
    expect(reservedBays().length).toBeGreaterThanOrEqual(1);
  });

  it('leads the shelf with BrickForge and keeps Neon Sequence retired', () => {
    expect(BRAIN_GAMES[0]?.id).toBe('brickforge');
    expect(BRAIN_GAMES.some((g) => g.id === 'neon-sequence')).toBe(false);
    expect(liveBrainGames().map((g) => g.id)).toEqual(['brickforge', 'chess3d']);
  });

  it('react cartridges load a default component', async () => {
    const reactGames = BRAIN_GAMES.filter((g) => g.mode === 'react' && g.load) as Required<Pick<BrainGameDef, 'load'>>[] & BrainGameDef[];
    for (const game of reactGames) {
      const mod = await game.load();
      expect(typeof mod.default).toBe('function');
    }
  });
});

describe('brickforge scoreboard mapping', () => {
  it('maps each cleared level to 10 points up to the milestone cap', () => {
    expect(milestonePct(0)).toBe(0);
    expect(milestonePct(1)).toBe(10);
    expect(milestonePct(3)).toBe(30);
    expect(milestonePct(MILESTONE_STAGES)).toBe(100);
  });

  it('caps at 100 and floors at 0 for out-of-range input', () => {
    expect(milestonePct(25)).toBe(100);
    expect(milestonePct(-2)).toBe(0);
    expect(milestonePct(1.9)).toBe(10); // floored before clamping
  });

  it('stays consistent with the correct/total pair it submits', () => {
    for (let level = 0; level <= 15; level++) {
      const correct = Math.min(level, MILESTONE_STAGES);
      expect(Math.round((correct / MILESTONE_STAGES) * 100)).toBe(milestonePct(level));
    }
  });
});

describe('brickforge level builder', () => {
  it('keeps bricks inside the grid for many random level rolls', () => {
    for (let level = 1; level <= 30; level++) {
      const specs = buildLevel(level);
      expect(specs.length, `level ${level}`).toBeGreaterThan(0);
      for (const s of specs) {
        expect(s.col).toBeGreaterThanOrEqual(0);
        expect(s.col).toBeLessThan(COLS);
        expect(s.row).toBeGreaterThanOrEqual(0);
        expect(s.row).toBeLessThan(MAX_ROWS);
        expect([1, 2, 3, 999]).toContain(s.hp);
      }
    }
  });

  it('level 1 is the full wall — every cell of the top row is a brick', () => {
    const specs = buildLevel(1);
    for (let c = 0; c < COLS; c++) {
      expect(specs.some((s) => s.row === 0 && s.col === c), `col ${c}`).toBe(true);
    }
  });

  it('always leaves at least one gold brick to chase', () => {
    for (let level = 1; level <= 25; level++) {
      const specs = buildLevel(level);
      expect(specs.some((s) => s.kind === 'gold'), `level ${level}`).toBe(true);
    }
  });

  it('reserves anvils for level 5+ and keeps them break-proof but rare', () => {
    for (let i = 0; i < 20; i++) {
      expect(buildLevel(4).every((s) => s.kind !== 'anvil')).toBe(true);
    }
    for (let level = 5; level <= 25; level++) {
      const anvils = buildLevel(level).filter((s) => s.kind === 'anvil');
      for (const a of anvils) {
        expect(a.hp).toBe(999);
        expect(a.row, `level ${level} anvil in top row`).toBeGreaterThan(0);
      }
      expect(anvils.length).toBeLessThanOrEqual(2 + Math.floor(level / 3));
    }
  });

  it('normal bricks never exceed 3 hit points', () => {
    for (let level = 1; level <= 20; level++) {
      for (const s of buildLevel(level)) {
        if (s.kind === 'normal') expect(s.hp).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('brickforge hall of smiths', () => {
  it('starts empty with no qualifying score', () => {
    expect(loadScores()).toEqual([]);
    expect(bestScore()).toBe(0);
    expect(qualifies(0)).toBe(false);
    expect(qualifies(1500)).toBe(true); // any positive score makes the board
  });

  it('adds entries sorted best-first and reports the rank', () => {
    const a: ScoreEntry = { name: 'A', score: 100, level: 1, date: 1 };
    const b: ScoreEntry = { name: 'B', score: 900, level: 3, date: 2 };
    expect(addScore(a)).toBe(1);
    expect(addScore(b)).toBe(1); // 900 takes the crown
    expect(loadScores().map((s) => s.score)).toEqual([900, 100]);
    expect(bestScore()).toBe(900);
  });

  it('trims the board to MAX_ENTRIES and gates new qualifiers', () => {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      addScore({ name: `P${i}`, score: (i + 1) * 100, level: 1, date: i });
    }
    expect(loadScores().length).toBe(MAX_ENTRIES);
    const lastPlace = 100; // a full board is gated by its lowest score
    expect(qualifies(lastPlace - 1)).toBe(false); // worse than last place
    expect(qualifies(lastPlace + 1)).toBe(true); // beats last place
    addScore({ name: 'NEW', score: lastPlace + 1, level: 2, date: 999 });
    expect(loadScores().length).toBe(MAX_ENTRIES);
    expect(loadScores().some((s) => s.name === 'NEW')).toBe(true);
    expect(loadScores().some((s) => s.name === 'P0')).toBe(false); // 100 dropped off
  });

  it('remembers the last smith name for the next run', () => {
    expect(loadLastName()).toBe('');
    saveLastName('ember');
    expect(loadLastName()).toBe('ember');
  });
});
