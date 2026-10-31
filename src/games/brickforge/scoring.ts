/**
 * BrickForge → shared scoreboard mapping.
 *
 * drill_attempts stores a 0–100 scorePct plus a correct/total pair, so an
 * open-ended arcade score needs one honest, bounded interpretation.
 * "How deep into the forge did you get" is that measure: each level cleared
 * is one of 10 milestone stages (level 10+ maxes the board), matching how
 * Neon Sequence mapped levels-cleared before it.
 */
export const MILESTONE_STAGES = 10;

export function milestonePct(level: number): number {
  const safe = Math.max(0, Math.floor(level));
  return Math.min(100, safe * 10);
}
