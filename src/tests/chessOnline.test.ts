import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LEN,
  generateRoomCode,
  hostColorForGame,
  isRoomCode,
  lastMoverColor,
  otherColor,
  outcomeFor,
  seatFor,
  type RoomData,
} from '../games/chess3d/game/online';
import { parseRoom, roomPatchToRest } from '../games/chess3d/game/roomClient';
import { chessScoreFields } from '../games/chess3d/game/stats';
import {
  aggregateBrickforge,
  aggregateChess,
  chessPoints,
  isBrickforgeAttempt,
  isChessAttempt,
  type LoungeAttempt,
} from '../lib/brainLoungeStats';

const attempt = (over: Partial<LoungeAttempt>): LoungeAttempt => ({
  studentName: 'P',
  drillSlug: 'brickforge',
  drillSource: 'brain-lounge',
  scorePct: 0,
  correctCount: 0,
  totalCount: 10,
  submittedAt: 1_000,
  ...over,
});

describe('chess room codes', () => {
  it('uses the 32-character classroom alphabet without lookalikes', () => {
    expect(ROOM_CODE_LEN).toBe(5);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[I1O0]/);
    expect(ROOM_CODE_ALPHABET.length).toBe(32);
  });

  it('generates codes only from the alphabet with a fixed rng', () => {
    // Deterministic rng: every 0.02 step picks a predictable glyph.
    let step = 0;
    const code = generateRoomCode(() => (step++ % 32) / 32);
    expect(code).toHaveLength(ROOM_CODE_LEN);
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
  });

  it('validates room codes strictly', () => {
    expect(isRoomCode('ABCDE')).toBe(true);
    expect(isRoomCode('A234Z')).toBe(true);
    expect(isRoomCode('abcde')).toBe(false); // codes are uppercase
    expect(isRoomCode('AB1DE')).toBe(false); // no 1
    expect(isRoomCode('ABC')).toBe(false);
    expect(isRoomCode('ABCDEF')).toBe(false);
    expect(isRoomCode('ABC E')).toBe(false);
  });
});

describe('chess seats across rematches', () => {
  it('swaps the host colour every game, deterministically', () => {
    expect(hostColorForGame('w', 1)).toBe('w');
    expect(hostColorForGame('w', 2)).toBe('b');
    expect(hostColorForGame('w', 3)).toBe('w');
    expect(hostColorForGame('b', 1)).toBe('b');
    expect(hostColorForGame('b', 2)).toBe('w');
    expect(hostColorForGame('b', 0)).toBe('b'); // degenerate input clamps to game 1
  });

  it('maps players to seats and leaves bystanders standing', () => {
    const room = {
      code: 'ABCDE',
      hostUid: 'host',
      hostName: 'Host',
      hostColor: 'w' as const,
      guestUid: 'guest',
      guestName: 'Guest',
      status: 'active' as const,
      moves: [],
      result: null,
      drawOffer: null,
      gameNo: 1,
    };
    expect(seatFor(room, 'host')).toBe('w');
    expect(seatFor(room, 'guest')).toBe('b');
    expect(seatFor(room, 'stranger')).toBeNull();
    // Rematch: game 2 swaps both seats.
    expect(seatFor({ ...room, gameNo: 2 }, 'host')).toBe('b');
    expect(seatFor({ ...room, gameNo: 2 }, 'guest')).toBe('w');
  });

  it('treats a still-open guest seat as a host-only room', () => {
    const room = {
      code: 'ABCDE',
      hostUid: 'host',
      hostName: 'Host',
      hostColor: 'b' as const,
      guestUid: null,
      guestName: null,
      status: 'waiting' as const,
      moves: [],
      result: null,
      drawOffer: null,
      gameNo: 1,
    };
    expect(seatFor(room, 'host')).toBe('b');
    expect(seatFor(room, 'nobody')).toBeNull();
  });
});

describe('chess outcome encoding', () => {
  it('maps results to win/draw/loss from the mover’s point of view', () => {
    expect(outcomeFor({ winner: 'w', reason: 'checkmate' }, 'w')).toBe('win');
    expect(outcomeFor({ winner: 'w', reason: 'checkmate' }, 'b')).toBe('loss');
    expect(outcomeFor({ winner: 'draw', reason: 'agreement' }, 'w')).toBe('draw');
  });

  it('encodes outcomes into drill fields that mirror the percentage', () => {
    const win = chessScoreFields('win');
    expect(win).toEqual({ scorePct: 100, correctCount: 1, totalCount: 1 });
    const draw = chessScoreFields('draw');
    expect(draw).toEqual({ scorePct: 50, correctCount: 1, totalCount: 2 });
    const loss = chessScoreFields('loss');
    expect(loss).toEqual({ scorePct: 0, correctCount: 0, totalCount: 1 });
    for (const fields of [win, draw, loss]) {
      expect(Math.round((fields.correctCount / fields.totalCount) * 100)).toBe(fields.scorePct);
    }
  });

  it('knows who moved last', () => {
    expect(lastMoverColor(0)).toBe('b'); // no moves yet — nothing moved
    expect(lastMoverColor(1)).toBe('w');
    expect(lastMoverColor(2)).toBe('b');
    expect(lastMoverColor(7)).toBe('w');
  });

  it('flips colours correctly', () => {
    expect(otherColor('w')).toBe('b');
    expect(otherColor('b')).toBe('w');
  });
});

describe('lounge stats filters', () => {
  it('only accepts brain-lounge rows of the matching slug', () => {
    expect(isBrickforgeAttempt(attempt({}))).toBe(true);
    expect(isBrickforgeAttempt(attempt({ drillSource: 'learning-games' }))).toBe(false);
    expect(isBrickforgeAttempt(attempt({ drillSlug: 'chess3d' }))).toBe(false);
    expect(isChessAttempt(attempt({ drillSlug: 'chess3d' }))).toBe(true);
    expect(isChessAttempt(attempt({ drillSlug: 'brickforge' }))).toBe(false);
  });
});

describe('brickforge leaderboard aggregation', () => {
  it('keeps the deepest run per player and ranks by it', () => {
    const entries = aggregateBrickforge([
      attempt({ studentName: 'A', scorePct: 30, submittedAt: 100 }),
      attempt({ studentName: 'A', scorePct: 70, submittedAt: 200 }),
      attempt({ studentName: 'B', scorePct: 50, submittedAt: 300 }),
      attempt({ studentName: 'C', scorePct: 0, submittedAt: 400 }),
    ]);
    expect(entries.map((e) => e.name)).toEqual(['A', 'B', 'C']);
    expect(entries[0]).toMatchObject({ bestPct: 70, bestLevel: 7, plays: 2, lastPlayed: 200 });
  });

  it('caps best level at the 10 milestone stages', () => {
    const entries = aggregateBrickforge([attempt({ studentName: 'A', scorePct: 100 })]);
    expect(entries[0].bestLevel).toBe(10);
  });

  it('breaks best-pct ties by plays then recency', () => {
    const entries = aggregateBrickforge([
      attempt({ studentName: 'A', scorePct: 40, submittedAt: 100 }),
      attempt({ studentName: 'B', scorePct: 40, submittedAt: 500, correctCount: 4 }),
      attempt({ studentName: 'B', scorePct: 40, submittedAt: 600 }),
    ]);
    expect(entries.map((e) => e.name)).toEqual(['B', 'A']);
  });
});

describe('chess ladder aggregation', () => {
  const win = attempt({ drillSlug: 'chess3d', correctCount: 1, totalCount: 1 });
  const draw = attempt({ drillSlug: 'chess3d', scorePct: 50, correctCount: 1, totalCount: 2 });
  const loss = attempt({ drillSlug: 'chess3d', scorePct: 0, correctCount: 0, totalCount: 1 });

  it('decodes W-D-L from the correct/total pairs', () => {
    const ladder = aggregateChess([
      { ...win, studentName: 'A', submittedAt: 50 },
      { ...loss, studentName: 'A', submittedAt: 60 },
      { ...draw, studentName: 'A', submittedAt: 70 },
      { ...win, studentName: 'B', submittedAt: 80 },
      { ...win, studentName: 'B', submittedAt: 90 },
    ]);
    expect(ladder.map((r) => r.name)).toEqual(['B', 'A']);
    expect(ladder[0]).toMatchObject({ wins: 2, draws: 0, losses: 0 });
    expect(ladder[1]).toMatchObject({ wins: 1, draws: 1, losses: 1 });
    expect(chessPoints(ladder[0])).toBe(4);
    expect(chessPoints(ladder[1])).toBe(3);
  });

  it('ranks by points, then wins, then fewer losses', () => {
    const ladder = aggregateChess([
      { ...win, studentName: 'A' },
      { ...win, studentName: 'B' },
      { ...draw, studentName: 'B', submittedAt: 10 },
      { ...win, studentName: 'C' },
      { ...loss, studentName: 'C', submittedAt: 10 },
      { ...loss, studentName: 'D' },
    ]);
    // A: 1W = 2 pts; B: 1W1D = 3 pts; C: 1W1L = 2 pts; D: 1L = 0 pts
    expect(ladder.map((r) => r.name)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('ignores malformed outcome pairs instead of corrupting the ladder', () => {
    const ladder = aggregateChess([
      attempt({ drillSlug: 'chess3d', correctCount: 9, totalCount: 12 }),
      attempt({ drillSlug: 'chess3d', correctCount: 0, totalCount: 0 }),
    ]);
    expect(ladder[0]).toMatchObject({ wins: 0, draws: 0, losses: 0 });
  });
});

describe('room REST codec', () => {
  const room: RoomData = {
    code: 'AB2CD',
    hostUid: 'host',
    hostName: 'Host',
    hostColor: 'w',
    guestUid: 'guest',
    guestName: 'Guest',
    status: 'active',
    moves: ['e4', 'e5', 'Nf3'],
    result: null,
    drawOffer: 'b',
    gameNo: 2,
  };

  function fieldsOf(patch: Partial<RoomData> & { updatedAt?: string }) {
    return roomPatchToRest(patch).fields;
  }

  it('round-trips a room through the Firestore REST value shapes', () => {
    const fields = fieldsOf(room) as Record<string, any>;
    const parsed = parseRoom(fields);
    expect(parsed).toEqual(room);
  });

  it('serialises every field type the room uses', () => {
    const fields = fieldsOf({ ...room, result: { winner: 'draw', reason: 'agreement' } }) as Record<string, any>;
    expect(fields.moves.arrayValue.values.map((v: any) => v.stringValue)).toEqual(['e4', 'e5', 'Nf3']);
    expect(fields.result.mapValue.fields.winner.stringValue).toBe('draw');
    expect(fields.drawOffer.stringValue).toBe('b');
    expect(fields.gameNo.integerValue).toBe('2');
    expect(fields.guestUid.stringValue).toBe('guest');
  });

  it('encodes nulls and empty move lists correctly', () => {
    const fields = fieldsOf({ guestUid: null, guestName: null, moves: [], result: null, drawOffer: null }) as Record<string, any>;
    expect(fields.guestUid.nullValue).toBeNull();
    expect(fields.moves.arrayValue.values).toBeUndefined(); // empty array shape
    expect(fields.result.nullValue).toBeNull();
  });

  it('lists only the patched paths in the update mask', () => {
    const { mask } = roomPatchToRest({ moves: ['e4'], updatedAt: '2026-11-01T00:00:00.000Z' });
    expect(mask).toEqual(['moves', 'updatedAt']);
  });

  it('defends against garbage documents instead of crashing the table', () => {
    expect(parseRoom(undefined)).toBeNull();
    expect(parseRoom({})).toBeNull();
    const junk = fieldsOf(room) as Record<string, any>;
    junk.status = { stringValue: 'hacked' };
    junk.drawOffer = { stringValue: 'purple' };
    junk.gameNo = { integerValue: 'not-a-number' };
    junk.moves = { arrayValue: { values: [{ stringValue: 'e4' }, { integerValue: '7' }] } };
    const parsed = parseRoom(junk)!;
    expect(parsed.status).toBe('waiting'); // unknown → safe default
    expect(parsed.drawOffer).toBeNull();
    expect(parsed.gameNo).toBe(1);
    expect(parsed.moves).toEqual(['e4']); // non-string entries dropped
  });
});
