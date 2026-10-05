import { describe, expect, it } from 'vitest';
import { LEARNING_GAMES } from './learningGames';

describe('student learning games', () => {
  it('provides at least six distinct selectable games', () => {
    expect(LEARNING_GAMES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(LEARNING_GAMES.map((game) => game.id)).size).toBe(LEARNING_GAMES.length);
  });

    it('has valid answer keys, explanations, and at least three rounds per in-page game', () => {
        for (const game of LEARNING_GAMES) {
      // External-link games (e.g. WriteQuest) open in a new tab and have no
      // in-page questions, so skip the question-shape assertions for them.
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
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(question.choices.length);
        expect(question.feedback.trim()).not.toBe('');
      }
    }
  });

  it('includes both passage and audio accessible alternatives in games', () => {
    expect(LEARNING_GAMES.some((game) => game.passage?.length)).toBe(true);
    expect(LEARNING_GAMES.some((game) => game.audioScript)).toBe(true);
  });
});
