import { describe, expect, it } from 'vitest';
import { estimateDurationSeconds, formatClock, splitIntoSentences } from './speech';

describe('listening audio helpers', () => {
  it('splits transcripts into sentences', () => {
    const sentences = splitIntoSentences('Hello class. Listen carefully! Are you ready?');
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toContain('Hello');
  });

  it('estimates a sensible playback duration', () => {
    const text = Array(60).fill('word').join(' ');
    const secs = estimateDurationSeconds(text, 1);
    expect(secs).toBeGreaterThan(10);
    expect(secs).toBeLessThan(120);
  });

  it('formats the player clock', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(480)).toBe('08:00');
  });
});
