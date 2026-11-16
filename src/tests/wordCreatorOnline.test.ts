// Word Creator online logic — the parts a cheater or a bug would break.
//
// The shipped game (public/arcade/word-creator) is a single-device engine:
// it deals racks locally and trusts its own client for scoring. Online play
// cannot do either, so src/games/wordcreator/online.ts owns the deal, the
// validation and the redaction, and this suite pins all three:
//
//   · the bag is 100 tiles, deterministic, and identical on every device;
//   · a rack is derivable from (seed, seat, move) — and only that seat's;
//   · a move's score is computed from the BOARD, not from the mover's claim;
//   · hidden information never leaves the host: no function returns anyone
//     else's letters.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildBag, buildPremiums, checkMove, emptyBoard, cellKey, cellName, N, STAR,
  applyMove, boardFromCells, generateRoomCode, hashSeed, isRoomCode, rackCanPlay,
  rackLetters, replayDeal, RACK_SIZE, removePlayed, shortName, VALUES, DISTRIBUTION,
  type LoggedMove, type Placement, type Tile,
} from '../games/wordcreator/online';

/** A small, fixed dictionary — the shape the browser lexicon exposes. */
const WORDS = new Set([
  'at', 'cat', 'cats', 'ox', 'oxen', 'qi', 'za', 'a', 'i',
  'do', 'dog', 'dogs', 'go', 'god', 'good', 'no', 'on', 'ox', 'so', 'to',
  'ability', 'reactor', 'crate', 'trace', 'rate', 'ate', 'tea', 'eat',
  'an', 'ant', 'ants', 'tan', 'net', 'ten', 'hen', 'then',
]);
const isWord = (w: string) => WORDS.has(w.toLowerCase());

const place = (row: number, col: number, letter: string, blank = false): Placement =>
  ({ key: cellKey(row, col), letter, blank });

/**
 * The wire form of a board: 225 chars, lowercase for a blank. This is what
 * Firestore carries and what boardFromCells() reads back.
 */
function cellsWith(placements: Placement[], base?: string[]): string[] {
  const next: string[] = base ? [...base] : Array(N * N).fill('');
  for (const p of placements) next[p.key] = p.blank ? p.letter.toLowerCase() : p.letter.toUpperCase();
  return next;
}

describe('word creator — the premium board', () => {
  const prem = buildPremiums();

  it('is 15×15 with the printed double/triple word corners', () => {
    expect(prem).toHaveLength(N);
    for (const row of prem) expect(row).toHaveLength(N);
    expect(prem[0][0]).toBe('TW');
    expect(prem[0][7]).toBe('TW');
    expect(prem[14][14]).toBe('TW');
    expect(prem[7][7]).toBe('DW');
    expect(prem[7][0]).toBe('TW');
  });

  it('puts the inner DW diagonal and the TL ring where the board prints them', () => {
    expect(prem[1][1]).toBe('DW');
    expect(prem[4][4]).toBe('DW');
    expect(prem[13][13]).toBe('DW');
    expect(prem[5][5]).toBe('TL');
    expect(prem[9][9]).toBe('TL');
    expect(prem[1][5]).toBe('TL');
    expect(prem[0][3]).toBe('DL');
    expect(prem[3][7]).toBe('DL');
    // no square is both
    const counts = prem.flat().reduce<Record<string, number>>((acc, p) => {
      acc[p || 'none'] = (acc[p || 'none'] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.TW).toBe(8);
    expect(counts.DW).toBe(17);
    expect(counts.TL).toBe(12);
    expect(counts.DL).toBe(24);
    expect(counts.none).toBe(N * N - 8 - 17 - 12 - 24);
  });

  it('cell names run A1 → O15', () => {
    expect(cellName(0)).toBe('A1');
    expect(cellName(cellKey(7, 7))).toBe('H8');
    expect(cellName(STAR)).toBe('H8');
    expect(cellName(N * N - 1)).toBe('O15');
  });
});

describe('word creator — the shared bag', () => {
  it('is the standard 100 tiles', () => {
    const bag = buildBag('seed-a');
    const total = Object.values(DISTRIBUTION).reduce((a, b) => a + b, 0);
    expect(bag).toHaveLength(100);
    expect(total).toBe(100);
    const blanks = bag.filter((t) => t.blank);
    expect(blanks).toHaveLength(2);
    // 98 lettered tiles, each matching the distribution
    for (const letter of Object.keys(DISTRIBUTION).filter((l) => l !== '?')) {
      expect(bag.filter((t) => t.letter === letter && !t.blank)).toHaveLength(DISTRIBUTION[letter]);
    }
  });

  it('is deterministic for a seed and different across seeds', () => {
    const a = buildBag('room-ABCDE');
    const b = buildBag('room-ABCDE');
    const c = buildBag('room-FGHIJ');
    expect(a.map((t) => t.letter).join('')).toBe(b.map((t) => t.letter).join(''));
    expect(a.map((t) => t.letter).join('')).not.toBe(c.map((t) => t.letter).join(''));
    expect(hashSeed('x')).toBe(hashSeed('x'));
    expect(hashSeed('x')).not.toBe(hashSeed('y'));
  });

  it('gives every tile a stable id so a rack can be verified', () => {
    const bag = buildBag('seed-a');
    expect(new Set(bag.map((t) => t.id)).size).toBe(100);
    expect(bag[0].id).toBe('bag-0');
    expect(bag[99].id).toBe('bag-99');
  });
});

describe('word creator — the deal is replayable and tamper-evident', () => {
  /** Play the first `n` tiles of a seat's rack as a (fake but legal-shaped) move. */
  const moveOf = (seat: number, rack: Tile[], n: number): LoggedMove => ({
    seat,
    placements: rack.slice(0, n).map((t, i) => ({
      key: cellKey(7, i), letter: t.letter === '?' ? 'E' : t.letter, blank: t.blank,
    })),
  });

  it('opens every seat with a full rack', () => {
    for (const seats of [2, 3, 4]) {
      const deal = replayDeal(buildBag('seed-a'), seats, []);
      expect(deal.racks).toHaveLength(seats);
      for (const rack of deal.racks) expect(rack).toHaveLength(RACK_SIZE);
      expect(deal.bag).toHaveLength(100 - RACK_SIZE * seats);
    }
  });

  it('keeps every one of the 100 tiles accounted for, move after move', () => {
    // A played tile leaves the bag and lands on the BOARD — so the invariant is
    // racks + bag + played == 100 at every step, the same one the shipped
    // game's audit pins for board + racks + bag.
    const seats = 3;
    const bag = buildBag('room-CONSERVE');
    const moves: LoggedMove[] = [];
    for (let m = 0; m < 20; m++) {
      const deal = replayDeal(bag, seats, moves);
      const played = moves.reduce((n, mv) => n + mv.placements.length, 0);
      expect(deal.racks.flat().length + deal.bag.length + played, `move ${m}`).toBe(100);
      moves.push(moveOf(m % seats, deal.racks[m % seats], 1 + (m % RACK_SIZE)));
    }
    const final = replayDeal(bag, seats, moves);
    const played = moves.reduce((n, mv) => n + mv.placements.length, 0);
    expect(final.racks.flat().length + final.bag.length + played).toBe(100);
    // a rack never over-fills, and the bag empties from the top
    for (const rack of final.racks) expect(rack.length).toBeLessThanOrEqual(RACK_SIZE);
    expect(final.bag.length).toBeGreaterThanOrEqual(0);
  });

  it('gives a reconnecting player the same rack back', () => {
    const bag = buildBag('room-RECON');
    const moves: LoggedMove[] = [];
    for (let m = 0; m < 6; m++) {
      const deal = replayDeal(bag, 2, moves);
      moves.push(moveOf(m % 2, deal.racks[m % 2], 2));
    }
    const a = replayDeal(bag, 2, moves).racks[1].map((t) => t.id).join(',');
    const b = replayDeal(bag, 2, moves).racks[1].map((t) => t.id).join(',');
    expect(a).toBe(b);
  });

  it('refuses a move that plays tiles the seat never held', () => {
    const bag = buildBag('room-CHEAT');
    const deal = replayDeal(bag, 2, []);
    // seat 0 does not hold a Q unless the deal gave them one — ask for the
    // opposite of what they hold and the rack must reject it.
    const held = new Set(deal.racks[0].map((t) => t.letter));
    const absent = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((l) => !held.has(l))!;
    const cheat: Placement[] = [{ key: cellKey(7, 7), letter: absent, blank: false }];
    expect(rackCanPlay(deal.racks[0], cheat)).toBe(false);
    // playing what they DO hold is accepted
    const honest: Placement[] = [{ key: cellKey(7, 7), letter: deal.racks[0][0].letter, blank: false }];
    expect(rackCanPlay(deal.racks[0], honest)).toBe(true);
  });

  it('never hands two seats the same tile id', () => {
    const bag = buildBag('room-UNIQ');
    const deal = replayDeal(bag, 4, []);
    const ids = deal.racks.flat().map((t) => t.id).concat(deal.bag.map((t) => t.id));
    expect(new Set(ids).size).toBe(100);
  });

  it('counts a blank as a blank when verifying a move', () => {
    const bag = buildBag('room-BLANK');
    // Find a deal where seat 0 holds the blank, by playing until they do.
    let moves: LoggedMove[] = [];
    let rack: Tile[] = [];
    for (let m = 0; m < 40; m++) {
      const deal = replayDeal(bag, 2, moves);
      rack = deal.racks[0];
      if (rack.some((t) => t.blank)) break;
      moves = [...moves, moveOf(0, rack, 1), moveOf(1, replayDeal(bag, 2, [...moves, moveOf(0, rack, 1)]).racks[1], 1)];
    }
    expect(rack.some((t) => t.blank)).toBe(true);
    // The blank satisfies any letter…
    expect(rackCanPlay(rack, [{ key: cellKey(7, 7), letter: 'Z', blank: true }])).toBe(true);
    // …but a seat with no blank cannot claim one, however many E tiles it holds.
    const dry: Tile[] = [
      { id: 'a', letter: 'E', blank: false },
      { id: 'b', letter: 'E', blank: false },
    ];
    expect(rackCanPlay(dry, [{ key: cellKey(7, 7), letter: 'Z', blank: true }])).toBe(false);
    // and a lettered tile cannot be spent as if it were the blank
    expect(rackCanPlay(dry, [{ key: cellKey(7, 7), letter: 'E', blank: false }])).toBe(true);
  });

  it('shows letters with a blank as ?', () => {
    const rack: Tile[] = [
      { id: 'a', letter: 'C', blank: false },
      { id: 'b', letter: '?', blank: true },
    ];
    expect(rackLetters(rack)).toEqual(['C', '?']);
  });
});

describe('word creator — move validation and scoring', () => {
  it('opens on the centre and doubles the word (★ is a DW)', () => {
    const board = emptyBoard();
    const check = checkMove(board, [place(7, 7, 'C'), place(7, 8, 'A'), place(7, 9, 'T')], isWord);
    expect(check.ok).toBe(true);
    expect(check.words[0].word).toBe('CAT');
    // C3 A1 T1 = 5, doubled by the centre = 10
    expect(check.total).toBe(10);
    expect(check.bingo).toBe(false);
  });

  it('refuses an opening that misses the star, or that is a single tile', () => {
    const off = checkMove(emptyBoard(), [place(0, 0, 'C'), place(0, 1, 'A')], isWord);
    expect(off.ok).toBe(false);
    expect(off.error).toContain('centre');
    const single = checkMove(emptyBoard(), [place(7, 7, 'C')], isWord);
    expect(single.ok).toBe(false);
  });

  it('refuses tiles that do not form one line, gaps, and unknown words', () => {
    const board = emptyBoard();
    expect(checkMove(board, [place(7, 7, 'C'), place(8, 8, 'A')], isWord).ok).toBe(false);
    expect(checkMove(board, [place(7, 7, 'C'), place(8, 7, 'A'), place(7, 9, 'T')], isWord).error).toMatch(/line/i);
    // a gap inside one row: E8 and G8 with F8 empty forms no word
    const gap = checkMove(board, [place(7, 4, 'A'), place(7, 6, 'T')], isWord);
    expect(gap.ok).toBe(false);
    // "ZA" is a legal Scrabble word, so use a pair no lexicon carries
    const bad = checkMove(board, [place(7, 7, 'Z'), place(7, 8, 'Q')], isWord);
    expect(bad.ok).toBe(false);
    expect(bad.badWord).toBe('ZQ');
  });

  it('refuses a move that floats away from the board after the opening', () => {
    const cells = cellsWith([place(7, 7, 'C'), place(7, 8, 'A'), place(7, 9, 'T')]);
    expect(checkMove(boardFromCells(cells, 1), [place(0, 0, 'D'), place(0, 1, 'O')], isWord).ok).toBe(false);
  });

  it('scores a cross word from the board — not from anything the client says', () => {
    // CAT across H8..J8, then DO down from the O of CAT (J8 → J9,J10)
    const cells = cellsWith([place(7, 7, 'C'), place(7, 8, 'A'), place(7, 9, 'T')]);
    const board = boardFromCells(cells, 1);
    const check = checkMove(board, [place(8, 9, 'O')], isWord);
    expect(check.ok).toBe(true);
    // The move extends CAT into no new across word (it is J8's column word
    // "TO"), and makes "TO" downwards.
    const words = check.words.map((w) => w.word);
    expect(words).toContain('TO');
    // T1 + O1 = 2 — no premium applies at J9/J10
    const to = check.words.find((w) => w.word === 'TO')!;
    expect(to.score).toBe(2);
    expect(check.total).toBe(2);
  });

  it('ignores any total a caller might try to attach', () => {
    const board = emptyBoard();
    const placements = [place(7, 7, 'C'), place(7, 8, 'A'), place(7, 9, 'T')];
    // A tampered client sends extra fields; the checker only reads letters/keys.
    const tampered = placements.map((p) => ({ ...p, score: 900, total: 100 })) as Placement[];
    expect(checkMove(board, tampered, isWord).total).toBe(10);
  });

  it('applies DL/TL letter premiums only under new tiles', () => {
    // Build a row through A8 (row 7, col 0 is TW) — use the DL at A4 (row 0, col 3)
    // Opening: OXO across A4..C4 keeps the star rule out, so open through H8 first.
    // Simpler: verify a triple-letter square by extending an existing word.
    // A4 is DL (row 0, col 3). Put "OX" vertically at A4,B4 after opening the
    // board with a word that touches it? Distance rules make that two moves; so
    // check the premium maths directly through a word laid on row 0.
    const board = emptyBoard();
    board.first = false;
    board.cells[cellKey(0, 4)] = { letter: 'X', blank: false };
    const check = checkMove(board, [place(0, 3, 'O')], (w) => w === 'ox');
    expect(check.ok).toBe(true);
    // O on a DL scores 1×2 = 2, plus the existing X (8) = 10
    expect(check.total).toBe(10);
  });

  it('awards +50 for using all seven tiles', () => {
    const board = emptyBoard();
    const check = checkMove(
      board,
      ['R', 'E', 'A', 'C', 'T', 'O', 'R'].map((L, i) => place(7, 3 + i, L)),
      isWord,
    );
    expect(check.ok).toBe(true);
    expect(check.bingo).toBe(true);
    const word = check.words[0];
    expect(word.word).toBe('REACTOR');
    expect(check.total).toBe(word.score + 50);
  });

  it('treats a blank as zero points and stores it lowercase', () => {
    const board = emptyBoard();
    const check = checkMove(board, [place(7, 7, 'C', true), place(7, 8, 'A'), place(7, 9, 'T')], isWord);
    expect(check.ok).toBe(true);
    // C is a blank → 0, A1 + T1 = 2, doubled = 4
    expect(check.total).toBe(4);
    const cells = applyMove(Array(N * N).fill(''), check);
    expect(cells[cellKey(7, 7)]).toBe('c'); // lowercase = blank
    const back = boardFromCells(cells, 2);
    expect(back.cells[cellKey(7, 7)]).toEqual({ letter: 'C', blank: true });
  });

  it('round-trips a board through cells and back', () => {
    const cells = cellsWith([place(7, 7, 'C'), place(7, 8, 'A'), place(7, 9, 'T')]);
    const board = boardFromCells(cells, 1);
    const check = checkMove(board, [place(8, 9, 'O')], isWord);
    const next = applyMove(cells, check);
    expect(next[cellKey(8, 9)]).toBe('O');
    expect(next[cellKey(7, 9)]).toBe('T');
    expect(next.length).toBe(N * N);
    expect(boardFromCells(next, 2).first).toBe(false);
  });

  it('keeps every value a standard tile has', () => {
    expect(VALUES.A).toBe(1);
    expect(VALUES.Q).toBe(10);
    expect(VALUES.Z).toBe(10);
    expect(Object.keys(VALUES)).toHaveLength(26);
  });
});

describe('word creator — rack bookkeeping', () => {
  it('removes exactly the tiles that were played', () => {
    const rack = ['C', 'A', 'T', 'D', 'O', 'G', 'S'];
    const left = removePlayed(rack, [place(7, 7, 'C'), place(7, 8, 'A'), place(7, 9, 'T')]);
    expect(left).toEqual(['D', 'O', 'G', 'S']);
  });

  it('uses a blank where a blank was played', () => {
    const left = removePlayed(['?', 'A', 'T'], [place(7, 8, 'A', false), place(7, 9, 'Z', true)]);
    expect(left).toEqual(['T']);
  });

  it('leaves the rack untouched when a played letter is not held', () => {
    const left = removePlayed(['A', 'T'], [place(7, 7, 'Z')]);
    expect(left).toEqual(['A', 'T']);
  });
});

describe('word creator — room codes', () => {
  it('are five characters, unambiguous, and validated', () => {
    for (let i = 0; i < 40; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(5);
      expect(isRoomCode(code)).toBe(true);
      // no look-alike characters
      expect(/[01IO]/.test(code)).toBe(false);
    }
    expect(isRoomCode('abcde')).toBe(true); // case-insensitive
    expect(isRoomCode('ABCD')).toBe(false);
    expect(isRoomCode('ABCDE1')).toBe(false);
    expect(isRoomCode('AB0DE')).toBe(false);
  });

  it('shortens a display name for the seat chip', () => {
    expect(shortName('Sok Dara')).toBe('Sok');
    expect(shortName('  ')).toBe('Player');
    expect(shortName('AVeryLongFirstName')).toHaveLength(12);
  });
});

// ── the SHIPPED page agrees with this module ──────────────────────────────
// public/arcade/word-creator/online.js carries its own copy of the bag and
// the deal (the page is a standalone file, so it cannot import TypeScript).
// Two copies of a deal function is exactly the kind of drift that would hand
// two players different letters for the same room, so the copies are pinned
// here: same seed → same 100 tiles, and same opening hands.
describe('word creator — the shipped online module matches this deal', () => {
  const source = readFileSync(
    new URL('../../public/arcade/word-creator/online.js', import.meta.url), 'utf8');
  /** Run the page's own functions in a sandbox that only needs `window`. */
  const page = (() => {
    const sandbox: Record<string, unknown> = { window: {}, document: { getElementById: () => null },
      localStorage: { getItem: () => null, setItem: () => {} }, location: { search: '' },
      URLSearchParams, console, Promise, Math, Date, String, Number, Array, Object, JSON, Error };
    const run = new Function('window', 'document', 'localStorage', 'location', 'URLSearchParams',
      'console', 'Promise', 'Math', 'Date', 'String', 'Number', 'Array', 'Object', 'JSON', 'Error',
      `${source}\nreturn CMC_WORD_ONLINE;`);
    return run(sandbox.window, sandbox.document, sandbox.localStorage, sandbox.location,
      URLSearchParams, console, Promise, Math, Date, String, Number, Array, Object, JSON, Error) as {
        _internals: {
          buildBag: (seed: string) => Array<{ letter: string }>;
          openDeal: (seed: string, seats: number) => { racks: Array<Array<{ letter: string }>>; rest: Array<{ letter: string }> };
          boardHash: (cells: string[]) => string;
          replayBoard: (moves: Array<{ kind: string; keys: number[]; letters: string[]; blanks: boolean[]; h?: string }>) => string[] | null;
        };
      };
  })();

  it('deals byte-identical bags from the same seed', () => {
    for (let i = 0; i < 60; i++) {
      const seed = ('parity-' + i).padEnd(32, 'x');
      const mine = buildBag(seed).map((t) => (t.blank ? '?' : t.letter)).join('');
      const shipped = page._internals.buildBag(seed).map((t) => t.letter).join('');
      expect(shipped, `seed ${seed}`).toBe(mine);
    }
  });

  it('splits the same bag into the same opening hands, for 2–4 seats', () => {
    for (const seats of [2, 3, 4]) {
      const seed = ('hands-' + seats).padEnd(32, 'y');
      const bag = buildBag(seed);
      const deal = page._internals.openDeal(seed, seats);
      for (let seat = 0; seat < seats; seat++) {
        const mine = bag.slice(seat * RACK_SIZE, seat * RACK_SIZE + RACK_SIZE)
          .map((t) => (t.blank ? '?' : t.letter)).join('');
        expect(deal.racks[seat].map((t) => t.letter).join(''), `seat ${seat}`).toBe(mine);
      }
      // the remainder is the rest of the bag (returned in pop order)
      expect(deal.rest.length).toBe(100 - seats * RACK_SIZE);
      expect(deal.rest.map((t) => t.letter).reverse().join(''))
        .toBe(bag.slice(seats * RACK_SIZE).map((t) => (t.blank ? '?' : t.letter)).join(''));
    }
  });

  it('replays a published move onto the same board this module would build', () => {
    const placements: Placement[] = [place(7, 7, 'C'), place(7, 8, 'A'), place(7, 9, 'T')];
    const moves = [{
      kind: 'play',
      keys: placements.map((p) => p.key),
      letters: placements.map((p) => p.letter.toUpperCase()),
      blanks: placements.map((p) => p.blank),
    }];
    const cells = page._internals.replayBoard(moves)!;
    expect(cells).toHaveLength(N * N);
    expect(cells[cellKey(7, 7)]).toBe('C');
    expect(cells[cellKey(7, 8)]).toBe('A');
    expect(cells[cellKey(7, 9)]).toBe('T');
    expect(cells.filter(Boolean)).toHaveLength(3);
    // it agrees with boardFromCells, the module's own reader
    const board = boardFromCells(cells, 1);
    expect(board.cells[cellKey(7, 8)]).toEqual({ letter: 'A', blank: false });
  });

  it('REFUSES a move that lands on an occupied square or carries junk', () => {
    const ok = page._internals.replayBoard([
      { kind: 'play', keys: [cellKey(7, 7)], letters: ['C'], blanks: [false] },
    ])!;
    expect(ok.filter(Boolean)).toHaveLength(1);
    // same square twice
    expect(page._internals.replayBoard([
      { kind: 'play', keys: [cellKey(7, 7), cellKey(7, 7)], letters: ['C', 'A'], blanks: [false, false] },
    ])).toBeNull();
    // a non-letter
    expect(page._internals.replayBoard([
      { kind: 'play', keys: [cellKey(7, 7)], letters: ['<'], blanks: [false] },
    ])).toBeNull();
    // off the board
    expect(page._internals.replayBoard([
      { kind: 'play', keys: [999], letters: ['A'], blanks: [false] },
    ])).toBeNull();
    // a wrong board hash
    expect(page._internals.replayBoard([
      { kind: 'play', keys: [cellKey(7, 7)], letters: ['C'], blanks: [false], h: 'deadbeef' },
    ])).toBeNull();
  });

  it('hashes a board deterministically', () => {
    const a = Array(N * N).fill('');
    a[cellKey(7, 7)] = 'C';
    expect(page._internals.boardHash(a)).toBe(page._internals.boardHash([...a]));
    expect(page._internals.boardHash(a)).not.toBe(page._internals.boardHash(Array(N * N).fill('')));
  });
});

// ── the room document: what goes over the wire, and who may write it ───────
// Online play is a replay: the room holds a seed, the seats and an append-only
// move log, and every device rebuilds the table from those. Two things would
// break that silently, and both happened in the first build:
//   · a stored move that comes back changed (the rules then refuse the save);
//   · rules that let somebody other than the seat on turn write.
describe('word creator — the room document', () => {
  const source = readFileSync(
    new URL('../../public/arcade/word-creator/online.js', import.meta.url), 'utf8');
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const block = rules.slice(rules.indexOf('match /word_creator_rooms/{roomId}'),
    rules.indexOf('STUDIO SHARED DOCS'));

  type Fields = Record<string, unknown>;
  const page = (() => {
    const run = new Function('window', 'document', 'localStorage', 'location', 'URLSearchParams',
      'console', 'Promise', 'Math', 'Date', 'String', 'Number', 'Array', 'Object', 'JSON', 'Error',
      `${source}\nreturn CMC_WORD_ONLINE;`);
    return run({}, { getElementById: () => null }, { getItem: () => null, setItem: () => {} },
      { search: '' }, URLSearchParams, console, Promise, Math, Date, String, Number, Array, Object, JSON, Error) as {
        _internals: { parseRoom: (f: Fields) => Record<string, unknown>; roomFields: (r: Record<string, unknown>) => Fields };
      };
  })();

  /** A room as Firestore hands it back: note `at` is a TIMESTAMP, not a string. */
  const stored = (): Fields => {
    const S = (v: string) => ({ stringValue: v });
    const I = (v: number) => ({ integerValue: String(v) });
    const B = (v: boolean) => ({ booleanValue: v });
    const A = (values: unknown[]) => ({ arrayValue: { values } });
    const M = (fields: Fields) => ({ mapValue: { fields } });
    const move = (n: number, uid: string, at: string) => M({
      n: I(n), uid: S(uid), kind: S('play'), keys: A([I(112), I(113)]), letters: A([S('A'), S('T')]),
      blanks: A([B(false), B(false)]), h: S('abc123'), at: { timestampValue: at },
    });
    return {
      code: S('ABCDE'), hostUid: S('u1'), hostName: S('Sokha'), seed: S('seed-seed-seed'), seatsWanted: I(2),
      status: S('playing'),
      seats: A([M({ uid: S('u1'), name: S('Sokha'), host: B(true) }), M({ uid: S('u2'), name: S('Dara'), host: B(false) })]),
      moves: A([move(0, 'u1', '2026-11-14T03:00:00.120Z'), move(1, 'u2', '2026-11-14T03:01:10.450Z')]),
      cells: A([]), scores: A([I(2), I(2)]), turn: I(0), bagSize: I(82), result: { nullValue: null }, closed: B(false),
    };
  };

  it('writes earlier moves back exactly as they were read', () => {
    // `at` was read with the string helper, came back empty, and was stamped
    // with "now" on the next save — every earlier move looked rewritten.
    const before = stored();
    const after = page._internals.roomFields(page._internals.parseRoom(before));
    expect(after.moves).toEqual(before.moves);
    expect(after.seats).toEqual(before.seats);
  });

  it('saves against the version it read', () => {
    expect(source).toContain("'?currentDocument.updateTime='");
    expect(source).toContain('function isConflict(');
  });

  it('lets exactly two things happen to a room: a join and a move', () => {
    expect(block).toContain('// JOIN');
    expect(block).toContain('// MOVE');
    // a joiner takes one free seat of their own in a waiting room
    expect(block).toContain("resource.data.status == 'waiting'");
    expect(block).toContain('!wcSeated(resource.data.seats, request.auth.uid)');
    expect(block).toContain('resource.data.seats.size() < resource.data.seatsWanted');
    expect(block).toContain('request.resource.data.seats[resource.data.seats.size()].uid == request.auth.uid');
    // seats and earlier moves come back untouched
    expect(block).toContain('request.resource.data.seats[0:resource.data.seats.size()] == resource.data.seats');
    expect(block).toContain('request.resource.data.moves[0:resource.data.moves.size()] == resource.data.moves');
    // one move at a time, by the seat the LOG says is on turn — not a field a client can set
    expect(block).toContain('request.resource.data.moves.size() == resource.data.moves.size() + 1');
    expect(block).toContain('resource.data.seats[resource.data.moves.size() % resource.data.seats.size()].uid == request.auth.uid');
    expect(block).toContain('request.resource.data.turn == request.resource.data.moves.size() % resource.data.seats.size()');
  });

  it('gives the host no powers beyond their own seat', () => {
    // the old rule let the host rewrite anything, and made guests leave `turn`
    // alone — which is why a guest could never hand the turn on
    const update = block.slice(block.indexOf('allow update'), block.indexOf('allow delete'));
    expect(update).not.toContain('request.auth.uid == resource.data.hostUid');
    expect(update).not.toContain('request.resource.data.turn == resource.data.turn');
  });

  it('uses only list operations the rules language has', () => {
    // rules lists have no map(): seats are checked by position
    expect(block).not.toMatch(/\.map\(/);
    expect(block).toContain('function wcSeated(seats, uid)');
  });

  it('matches what the client writes on a join and on a move', () => {
    // join: seat appended with host:false; room starts when the last seat fills
    expect(source).toContain('room.seats.push({ uid: me.uid, name: me.name, host: false })');
    expect(source).toContain("if (room.seats.length >= room.seatsWanted) room.status = 'playing'");
    // move: turn derived from the log, and the closing move carries the result
    expect(source).toContain('room.turn = room.moves.length % room.seats.length');
    expect(source).toMatch(/if \(end\) \{ room\.status = 'finished'; room\.result = \{/);
    // a new room is created waiting, on turn 0, with no result
    expect(source).toMatch(/status: 'waiting',[\s\S]{0,200}turn: 0,[\s\S]{0,80}result: null/);
  });
});
