import { describe, expect, it } from 'vitest';
import { LEARNING_GAMES, gameXpTotal } from './learningGames';

const TIER_POINTS = { warmup: 10, build: 15, mastery: 20, boss: 30 } as const;
const TIER_ORDER = { warmup: 0, build: 1, mastery: 2, boss: 3 } as const;

describe('student learning games', () => {
  it('provides at least six distinct selectable games', () => {
    expect(LEARNING_GAMES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(LEARNING_GAMES.map((game) => game.id)).size).toBe(LEARNING_GAMES.length);
  });

  it('has valid answer keys, explanations, and at least three rounds per in-page game', () => {
    for (const game of LEARNING_GAMES) {
      if (game.externalUrl) {
        expect(game.externalUrl.trim()).not.toBe('');
        expect(game.description.trim()).not.toBe('');
        continue;
      }
      expect(game.questions.length).toBeGreaterThanOrEqual(3);
      expect(game.description.trim()).not.toBe('');
      for (const question of game.questions) {
        expect(question.choices.length).toBeGreaterThanOrEqual(2);
        expect(new Set(question.choices).size).toBe(question.choices.length);
        expect(question.choices.every((c) => c.trim() === c && c.length > 0)).toBe(true);
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(question.choices.length);
        expect(question.feedback.trim()).not.toBe('');
      }
    }
  });

  it('gives each in-page game a full multi-level challenge instead of a tiny sample set', () => {
    const inPageGames = LEARNING_GAMES.filter((game) => !game.externalUrl);
    expect(inPageGames.length).toBeGreaterThan(0);
    for (const game of inPageGames) {
      expect(game.questions.length, `${game.id} should offer warm-up, build, mastery and boss rounds`).toBeGreaterThanOrEqual(12);
      expect(game.duration).toContain(`${game.questions.length} questions`);
    }
  });

  it('includes both passage and audio accessible alternatives in games', () => {
    expect(LEARNING_GAMES.some((game) => game.passage?.length)).toBe(true);
    expect(LEARNING_GAMES.some((game) => game.audioScript)).toBe(true);
    // Second-passage / second-recording boss material exists.
    expect(LEARNING_GAMES.some((game) => game.questions.some((q) => q.passage?.length))).toBe(true);
    expect(LEARNING_GAMES.some((game) => game.questions.some((q) => q.audioScript && q.audioScript !== game.audioScript))).toBe(true);
  });

  it('runs every in-page game Warm-up → Build → Mastery → Boss with tier XP, hints and challenge tags', () => {
    for (const game of LEARNING_GAMES.filter((g) => !g.externalUrl)) {
      const tiers = game.questions.map((q) => q.tier);
      expect(tiers, `${game.id} tiers`).toContain('warmup');
      expect(tiers).toContain('build');
      expect(tiers).toContain('mastery');
      expect(tiers[tiers.length - 1], `${game.id} must end on a Boss round`).toBe('boss');
      expect(tiers.filter((t) => t === 'boss'), `${game.id} has exactly one Boss round`).toHaveLength(1);
      for (let i = 1; i < tiers.length; i += 1) {
        expect(TIER_ORDER[tiers[i]], `${game.id} tier order at ${i}`).toBeGreaterThanOrEqual(TIER_ORDER[tiers[i - 1]]);
      }
      for (const q of game.questions) {
        expect(q.points, `${game.id} points for ${q.tier}`).toBe(TIER_POINTS[q.tier]);
        expect(q.hint.trim().length, `${game.id} hint`).toBeGreaterThan(8);
        expect(q.challengeTag.trim().length, `${game.id} challenge tag`).toBeGreaterThan(3);
      }
      expect(gameXpTotal(game)).toBe(game.questions.reduce((s, q) => s + q.points, 0));
      expect(gameXpTotal(game)).toBeGreaterThanOrEqual(200);
    }
  });

  it('gives every game AI artwork, difficulty, XP and challenge-mode metadata', () => {
    for (const game of LEARNING_GAMES) {
      expect(game.tagline?.trim(), `${game.id} tagline`).toBeTruthy();
      expect(game.difficultyLabel?.trim(), `${game.id} difficulty`).toBeTruthy();
      expect(game.xpReward ?? gameXpTotal(game), `${game.id} xp`).toBeGreaterThan(0);
      expect(game.lives, `${game.id} lives`).toBeGreaterThanOrEqual(3);
      expect(game.secondsPerQuestion, `${game.id} timer`).toBeGreaterThanOrEqual(25);
      expect((game.challengeModes ?? []).length, `${game.id} challenge modes`).toBeGreaterThanOrEqual(3);
      if (!game.externalUrl) {
        expect(game.coverImage, `${game.id} cover art`).toMatch(/^\.\/images\/games\/.+\.jpg$/);
      }
    }
    const covers = LEARNING_GAMES.map((g) => g.coverImage).filter(Boolean);
    expect(new Set(covers).size).toBe(covers.length);
  });
});
