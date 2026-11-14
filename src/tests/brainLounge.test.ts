import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { aggregateMafia } from '../lib/brainLoungeStats';

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

  it('leads the shelf with BrickForge, Galica in bay 2, Mafia Noir in bay 4, Neon Sequence retired', () => {
    expect(BRAIN_GAMES[0]?.id).toBe('brickforge');
    expect(BRAIN_GAMES.some((g) => g.id === 'neon-sequence')).toBe(false);
    expect(liveBrainGames().map((g) => g.id)).toEqual(['brickforge', 'chess3d', 'galica', 'mafia']);
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

/** Galica cartridge — the lounge's first standalone shooter. The registry
 * points at a shipped file, so this pins the file, its score-sync wiring and
 * the entry shape together: editing or losing any one of them fails here
 * instead of showing a dead "Open game" link on the live shelf. */
describe('galica standalone cartridge', () => {
  const galica = BRAIN_GAMES.find((g) => g.id === 'galica');

  it('is registered as a live standalone cartridge', () => {
    expect(galica).toBeDefined();
    expect(galica!.status).toBe('live');
    expect(galica!.mode).toBe('standalone');
    expect(galica!.launchUrl).toBe('./arcade/galica/index.html');
  });

  it('ships the game file with its page-sync hook intact', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public', 'arcade', 'galica', 'index.html'),
      'utf8',
    );
    expect(html).toContain('var CMC_GALICA_SUBMIT'); // sync block defined…
    expect(html.match(/CMC_GALICA_SUBMIT\(/g)?.length).toBeGreaterThanOrEqual(2); // …and fired from both game-over sites
    expect(html).toContain("drillSource:{stringValue:'brain-lounge'}");
    expect(html).toContain('</html>');
  });
});

/** Mafia Noir cartridge — the lounge's standalone social-deduction game.
 * Pins the shipped file together with its CMC integration (identity,
 * leaderboard POST, narrator audio, AI art) and the three bug fixes the
 * audit made, so none of them can silently regress. */
describe('mafia noir standalone cartridge', () => {
  const mafia = BRAIN_GAMES.find((g) => g.id === 'mafia');

  it('is registered as a live standalone cartridge in bay 04', () => {
    expect(mafia).toBeDefined();
    expect(mafia!.status).toBe('live');
    expect(mafia!.mode).toBe('standalone');
    expect(mafia!.launchUrl).toBe('./mafia.html');
    expect(mafia!.genre).toBe('Deduction');
  });

  it('ships the game file with the CMC integration block intact', () => {
    const html = readFileSync(resolve(process.cwd(), 'public', 'mafia.html'), 'utf8');
    expect(html).toContain('cmcmafia:game'); // engine result event…
    expect(html.match(/cmcmafia:phase/g)?.length).toBeGreaterThanOrEqual(4); // …+ phase narrator hooks
    expect(html).toContain("stringValue: 'brain-lounge'"); // lounge leaderboard source
    expect(html).toContain("stringValue: 'mafia.html'"); // lounge slug
    expect(html).toContain('cmcNameIn'); // identity inputs on the hub
    expect(html).toContain('cmc-student-name'); // email-guard/heal shared keys
    expect(html).toContain('mafia-audio/narr-night.mp3'); // narrator wired
    expect(html).toContain('mafia-art/mafia-city.jpg'); // AI hero art wired
    expect(html).toContain('mafia-art/mafia-${k}.jpg'); // AI fan portraits wired
    expect(html).toContain('</html>');
  });

  it('carries the three audit bug fixes', () => {
    const html = readFileSync(resolve(process.cwd(), 'public', 'mafia.html'), 'utf8');
    // F1: human influence statements are PUBLIC, not syndicate whispers
    expect(html).not.toContain('"mafia");applyAccuse');
    expect(html).not.toContain('"mafia");applyClaim');
    expect(html).toContain('"public");applyAccuse');
    expect(html).toContain('"public");applyClaim');
    // F11: typing a seat name no longer rebuilds the roster (focus loss)
    expect(html).toContain('renderSetupMeta()');
    // F3: the online mode explains itself when no game server exists
    expect(html).toContain('onlineUnavailable');
  });
});

/** Mafia lounge aggregation — decodes the case outcome the game posts. */
describe('mafia lounge aggregation', () => {
  const attempt = (over: Partial<import('../lib/brainLoungeStats').LoungeAttempt>) => ({
    studentName: 'Dara', drillSlug: 'mafia.html', drillSource: 'brain-lounge',
    scorePct: 100, correctCount: 1, totalCount: 1, submittedAt: 1000, ...over,
  });

  it('decodes team wins and losses from the correct/total pair', () => {
    const rows = aggregateMafia([
      attempt({}),                                   // team win
      attempt({ correctCount: 0, scorePct: 50 }),    // loss but survived
      attempt({ correctCount: 0, scorePct: 25, submittedAt: 2000 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Dara', cases: 3, wins: 1, losses: 2, lastPlayed: 2000 });
  });

  it('ignores other cartridges and sorts by wins, then losses, then cases', () => {
    const rows = aggregateMafia([
      attempt({ studentName: 'B', correctCount: 0 }),
      attempt({ studentName: 'A', correctCount: 0, submittedAt: 500 }),
      attempt({ studentName: 'A', submittedAt: 900 }),
      attempt({ studentName: 'C', drillSlug: 'galica', correctCount: 5, totalCount: 0 }),
      attempt({ studentName: 'C', drillSource: 'learning-games' }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
    expect(rows[0]).toMatchObject({ wins: 1, losses: 1, cases: 2 });
  });
});
