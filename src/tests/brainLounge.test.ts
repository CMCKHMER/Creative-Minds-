import { describe, expect, it } from 'vitest';
import { BRAIN_GAMES, liveBrainGames, reservedBays, type BrainGameDef } from '../games/registry';
import {
  PAD_COUNT,
  PAD_THEMES,
  TOTAL_STAGES,
  flashMs,
  growSequence,
  newSequence,
  pickPad,
  playbackMs,
  scorePct,
} from '../games/neon-sequence/logic';

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

  it('react cartridges load a default component', async () => {
    const reactGames = BRAIN_GAMES.filter((g) => g.mode === 'react' && g.load) as Required<Pick<BrainGameDef, 'load'>>[] & BrainGameDef[];
    for (const game of reactGames) {
      const mod = await game.load();
      expect(typeof mod.default).toBe('function');
    }
  });
});

describe('neon sequence logic', () => {
  it('pickPad stays within the four pads for any RNG output', () => {
    expect(pickPad(() => 0)).toBe(0);
    expect(pickPad(() => 0.999)).toBe(PAD_COUNT - 1);
    expect(pickPad(() => 0.5)).toBe(2);
    // Property check across a spread of values
    for (let i = 0; i < 50; i++) {
      const pad = pickPad(() => i / 50);
      expect(pad).toBeGreaterThanOrEqual(0);
      expect(pad).toBeLessThan(PAD_COUNT);
    }
  });

  it('growSequence appends without mutating the original', () => {
    const rng = () => 0.25; // deterministic → pad 1
    const first = newSequence(rng);
    expect(first).toEqual([1]);
    const second = growSequence(first, rng);
    expect(first).toEqual([1]); // untouched
    expect(second).toEqual([1, 1]);
  });

  it('flash window shrinks with level but never below 220ms', () => {
    expect(flashMs(1)).toBe(640);
    expect(flashMs(2)).toBe(585);
    expect(flashMs(9)).toBe(220);
    expect(flashMs(20)).toBe(220);
  });

  it('playback covers every pad flash', () => {
    expect(playbackMs(3)).toBe(3 * flashMs(3));
  });

  it('score percent maps levels cleared to stages and caps at 100', () => {
    expect(scorePct(0)).toBe(0);
    expect(scorePct(3)).toBe(30);
    expect(scorePct(TOTAL_STAGES)).toBe(100);
    expect(scorePct(25)).toBe(100);
    expect(scorePct(-2)).toBe(0);
  });

  it('all four pads have distinct tones and themes', () => {
    const tones = PAD_THEMES.map((t) => t.toneHz);
    expect(new Set(tones).size).toBe(PAD_COUNT);
    const labels = PAD_THEMES.map((t) => t.label);
    expect(new Set(labels).size).toBe(PAD_COUNT);
  });
});
