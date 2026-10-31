import type { BoardAction } from "./boardModel";
import type { PieceType } from "./types";

/** Board square -> world coordinates (x = file, z = rank, white sits on +z). */
export function sqToWorld(sq: string): { x: number; z: number } {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  return { x: file - 3.5, z: 4.5 - rank };
}

/** Per piece attack choreography (seconds, in "timeline" time). */
export const ATTACKS: Record<PieceType, { dur: number; hit: number; standoff: number }> = {
  p: { dur: 1.0, hit: 0.52, standoff: 0.95 },
  r: { dur: 1.0, hit: 0.58, standoff: 1.05 },
  n: { dur: 1.15, hit: 0.72, standoff: 1.05 },
  b: { dur: 1.35, hit: 0.9, standoff: 2.2 },
  q: { dur: 1.05, hit: 0.4, standoff: 1.0 },
  k: { dur: 1.35, hit: 0.85, standoff: 1.0 },
};

export interface Timeline {
  capture: boolean;
  castle: boolean;
  from: { x: number; z: number };
  to: { x: number; z: number };
  target: { x: number; z: number };
  stand: { x: number; z: number };
  dir: { x: number; z: number };
  moveYaw: number;
  dist: number;
  /** time to reach the destination (plain moves) or the stand-off point (captures) */
  travel: number;
  attackStart: number;
  impact: number;
  attackEnd: number;
  stepStart: number;
  stepEnd: number;
  /** castling: rook leap window */
  rookStart: number;
  rookDur: number;
  /** time the mover finally lands on its destination square */
  landAt: number;
  total: number;
}

export function travelTime(dist: number): number {
  return 0.35 + 0.28 * Math.sqrt(Math.max(dist, 0));
}

export function buildTimeline(a: BoardAction): Timeline {
  const from = sqToWorld(a.from);
  const to = sqToWorld(a.to);
  const capture = !!a.victimId;
  const target = a.victimSquare ? sqToWorld(a.victimSquare) : to;

  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const dist = Math.hypot(dx, dz) || 1;
  const dir = { x: dx / dist, z: dz / dist };
  const moveYaw = Math.atan2(dir.x, dir.z);

  if (!capture) {
    const castle = !!a.rook;
    const travel = travelTime(dist);
    const rookStart = castle ? travel * 0.6 : 0;
    const rookDur = castle ? 1.0 : 0;
    const total = castle ? rookStart + rookDur + 0.2 : travel + (a.promotion ? 0.7 : 0.15);
    return {
      capture,
      castle,
      from,
      to,
      target,
      stand: to,
      dir,
      moveYaw,
      dist,
      travel,
      attackStart: travel,
      impact: travel,
      attackEnd: travel,
      stepStart: travel,
      stepEnd: travel,
      rookStart,
      rookDur,
      landAt: travel,
      total,
    };
  }

  const atk = ATTACKS[a.moverType];
  const approach = Math.max(0, dist - atk.standoff);
  const travel = approach > 0.05 ? travelTime(approach) : 0.28;
  const standDist = Math.min(dist, atk.standoff);
  const stand = {
    x: target.x - dir.x * (approach > 0.05 ? atk.standoff : dist),
    z: target.z - dir.z * (approach > 0.05 ? atk.standoff : dist),
  };
  void standDist;

  const attackStart = travel;
  const impact = attackStart + atk.hit;
  const attackEnd = attackStart + atk.dur;
  // wait until the victim has crumbled before stepping onto its square
  const stepStart = Math.max(attackEnd, impact + 0.8);
  const stepLen = Math.hypot(to.x - stand.x, to.z - stand.z);
  const stepEnd = stepStart + 0.25 + 0.18 * stepLen;
  const total = stepEnd + (a.promotion ? 0.7 : 0.15);

  return {
    capture,
    castle: false,
    from,
    to,
    target,
    stand,
    dir,
    moveYaw,
    dist,
    travel,
    attackStart,
    impact,
    attackEnd,
    stepStart,
    stepEnd,
    rookStart: 0,
    rookDur: 0,
    landAt: stepEnd,
    total,
  };
}
