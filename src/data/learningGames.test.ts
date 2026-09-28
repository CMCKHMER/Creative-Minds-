import { describe, expect, it } from 'vitest';
import { LEARNING_GAMES } from './learningGames';

describe('student learning games', () => {
  it('provides six distinct selectable games', () => {
    expect(LEARNING_GAMES).toHaveLength(6);
    expect(new Set(LEARNING_GAMES.map((game) => game.id)).size).toBe(6);
  });

  it('has valid answer keys, explanations, and at least three rounds per game', () => {
    for (const game of LEARNING_GAMES) {
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