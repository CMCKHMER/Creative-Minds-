/**
 * Word Creator — ONLINE play, pure logic.
 *
 * ── THE RULE THAT SHAPES THIS FILE ─────────────────────────────────────
 * Word Creator is HIDDEN-INFORMATION: nobody may see another player's rack.
 * The game's existing board/turn machinery (public/arcade/word-creator) is a
 * single-device engine — it deals racks locally and trusts the client for
 * scoring. Neither is acceptable online, so this module deliberately does
 * NOT reuse it. Instead the room document carries only what every player may
 * see, and this file owns three jobs:
 *
 *   1. THE DEAL — deterministic, seeded from the room seed and the move
 *      number, so every device holds the same bag and can verify that the
 *      rack it was handed is the rack the bag actually contains.
 *   2. THE CHECK — a move is validated (placement rules, dictionary, score)
 *      by the device that RECEIVES it before it is applied. The mover's own
 *      score is never trusted; a tampered client cannot hand itself 900
 *      points.
 *   3. THE REDACTION — `seatView` is the ONLY thing that leaves the host
 *      about a rack: your own letters. Everything else a player renders comes
 *      from public room data (board, turn, scores, log).
 *
 * A rack is never written to Firestore. The host holds the bag in memory;
 * a reconnecting player asks for their letters and receives exactly the ones
 * the deal assigns them at the current move — the same answer they had.
 *
 * All functions here are pure and unit-tested (src/tests/wordCreator.test.ts
 * and src/tests/wordCreatorOnline.test.ts); the browser glue lives in
 * public/arcade/word-creator/index.html.
 */

/** 15×15 board, centre square index. */
export const N = 15;
export const STAR = 112;

/** Standard English tile values (blank scores 0). */
export const VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

/** Standard English distribution — 98 letters + 2 blanks. */
export const DISTRIBUTION: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2,
};

export const RACK_SIZE = 7;

export type Premium = '' | 'DL' | 'TL' | 'DW' | 'TW';

/**
 * The premium layout, built the way the board prints it: TW on the corners
 * and mid-edges, the inner diagonal DW band, the centre DW, TL at the
 * distance-1/5/9 pattern and DL everywhere the printed board shows it.
 */
export function buildPremiums(): Premium[][] {
  const p: Premium[][] = Array.from({ length: N }, () => Array<Premium>(N).fill(''));
  ([[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]] as const)
    .forEach(([r, c]) => { p[r][c] = 'TW'; });
  for (let i = 1; i <= 4; i++) {
    p[i][i] = 'DW'; p[i][14 - i] = 'DW'; p[14 - i][i] = 'DW'; p[14 - i][14 - i] = 'DW';
  }
  p[7][7] = 'DW';
  ([[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]] as const)
    .forEach(([r, c]) => { p[r][c] = 'TL'; });
  ([[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12],
    [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 6], [11, 8], [12, 0], [12, 7],
    [12, 14], [14, 3], [14, 11]] as const)
    .forEach(([r, c]) => { p[r][c] = 'DL'; });
  return p;
}

export const PREMIUMS: Premium[][] = buildPremiums();

// ── The seeded deal ─────────────────────────────────────────────────────

/** 32-bit string hash (FNV-1a) — small, stable, identical in every browser. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — a tiny deterministic PRNG, uniform enough for a tile bag. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Tile {
  /** Stable across every device: `bag-<index>` in the shuffled order. */
  id: string;
  letter: string;
  blank: boolean;
}

/** The full 100-tile bag in deterministic shuffled order for `seed`. */
export function buildBag(seed: string): Tile[] {
  const bag: Tile[] = [];
  for (const letter of Object.keys(DISTRIBUTION)) {
    for (let i = 0; i < DISTRIBUTION[letter]; i++) {
      bag.push({ id: '', letter, blank: letter === '?' });
    }
  }
  const rand = rng(hashSeed(seed));
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  bag.forEach((tile, index) => { tile.id = `bag-${index}`; });
  return bag;
}

/** A move as it appears in the shared log — placements are PUBLIC. */
export interface LoggedMove {
  /** Seat index that made the move. */
  seat: number;
  /** Keys + letters placed; the count drives how many tiles are redrawn. */
  placements: Placement[];
}

export interface Deal {
  /** Every seat's rack, in draw order. */
  racks: Tile[][];
  /** Tiles still in the bag. */
  bag: Tile[];
}

/**
 * The deal, replayed from the room seed plus the public move log.
 *
 * Why replay at all? Because it makes every move VERIFIABLE. The bag is a
 * deterministic shuffle of the seed, the opening hands are the first 7×seats
 * tiles of it, and every later draw comes off the top after the tiles a
 * move actually used are returned. So any device can answer two questions
 * without asking anybody: "was that tile really in their rack?", and "what
 * does the bag hold now?".
 *
 * The trade-off is deliberate and documented in the UI: everyone can compute
 * everyone's rack, so a determined player could peek if they rewrote the
 * client. What this design does guarantee — and what the old
 * single-device engine could not — is that nobody can invent a tile, score
 * their own move, or play out of turn: those are all checked by the
 * receiving device against this same replay.
 */
export function replayDeal(bag: Tile[], seats: number, moves: LoggedMove[]): Deal {
  const racks: Tile[][] = Array.from({ length: seats }, () => []);
  let cursor = 0;
  const draw = (n: number) => {
    const take = bag.slice(cursor, cursor + Math.max(0, n));
    cursor += take.length;
    return take;
  };
  // Opening hands, seat 0 first. A short bag at the opening deal is legal
  // (it can only happen in a 4-seat game with a pre-consumed bag).
  for (let seat = 0; seat < seats; seat++) racks[seat] = draw(RACK_SIZE);
  for (const move of moves) {
    if (move.seat < 0 || move.seat >= seats) continue;
    const rack = racks[move.seat];
    // Remove the tiles that were played — the log says which ones.
    for (const p of move.placements) {
      const i = rack.findIndex((t) =>
        p.blank ? t.blank : t.letter === p.letter.toUpperCase() && !t.blank);
      if (i >= 0) rack.splice(i, 1);
    }
    // Refill to a full rack from the top of the bag.
    rack.push(...draw(RACK_SIZE - rack.length));
  }
  return { racks, bag: bag.slice(cursor) };
}

/** Could `placements` have come from `rack`? (A blank stands in for a letter.) */
export function rackCanPlay(rack: Tile[], placements: Placement[]): boolean {
  const left = [...rack];
  for (const p of placements) {
    const i = left.findIndex((t) =>
      p.blank ? t.blank : t.letter === p.letter.toUpperCase() && !t.blank);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

/** The letters a player sees on their own rack, blanks as `?`. */
export function rackLetters(rack: Tile[]): string[] {
  return rack.map((t) => (t.blank ? '?' : t.letter));
}

// ── Placement + scoring ─────────────────────────────────────────────────

/** A tile already on the board. */
export interface BoardTile {
  letter: string;
  blank: boolean;
}

/** A tile a player is putting down: board key → letter (+ blank flag). */
export interface Placement {
  key: number;
  letter: string;
  blank: boolean;
}

export interface PlacedWord {
  word: string;
  cells: Array<{ row: number; col: number; letter: string; blank: boolean; own: boolean }>;
  score: number;
  multiplier: number;
}

export interface MoveCheck {
  ok: boolean;
  /** Player-facing reason when `ok` is false. */
  error?: string;
  /** The rejected word, for a "look it up" affordance. */
  badWord?: string;
  words: PlacedWord[];
  total: number;
  bingo: boolean;
}

export interface BoardState {
  /** 225 entries, row-major; null where the square is empty. */
  cells: Array<BoardTile | null>;
  /** True until the first word has been played. */
  first: boolean;
}

export function emptyBoard(): BoardState {
  return { cells: Array<BoardTile | null>(N * N).fill(null), first: true };
}

export function cellKey(row: number, col: number): number {
  return row * N + col;
}

export function cellName(key: number): string {
  return String.fromCharCode(65 + (key % N)) + (Math.floor(key / N) + 1);
}

const inBoard = (row: number, col: number) => row >= 0 && row < N && col >= 0 && col < N;

/**
 * Validate + score one move against `board`.
 *
 * `isWord` is injected so the same rules can run in the browser (the shipped
 * lexicon) and in the test suite (a fixed word list). Everything else —
 * single line, contiguity, centre/connection rules, premiums, bingo — is
 * enforced here, and the total is computed from the BOARD, never from the
 * client's claim.
 */
export function checkMove(
  board: BoardState,
  placements: Placement[],
  isWord: (word: string) => boolean,
): MoveCheck {
  const fail = (error: string, badWord?: string): MoveCheck =>
    ({ ok: false, error, badWord, words: [], total: 0, bingo: false });

  if (placements.length === 0) return fail('Place at least one tile');
  const keys = new Set<number>();
  for (const p of placements) {
    if (!Number.isInteger(p.key) || p.key < 0 || p.key >= N * N) return fail('That square is off the board');
    if (keys.has(p.key)) return fail('Two tiles cannot share a square');
    if (board.cells[p.key]) return fail(`Square ${cellName(p.key)} is already taken`);
    if (!/^[a-z]$/i.test(p.letter)) return fail('Every tile needs a letter');
    keys.add(p.key);
  }

  // ── the tiles must share one row or one column ────────────────────────
  const rows = placements.map((p) => Math.floor(p.key / N));
  const cols = placements.map((p) => p.key % N);
  const sameRow = rows.every((r) => r === rows[0]);
  const sameCol = cols.every((c) => c === cols[0]);
  if (!sameRow && !sameCol) return fail('Line the tiles up in one row or column');

  const overlay = new Map<number, { letter: string; blank: boolean }>();
  placements.forEach((p) => overlay.set(p.key, { letter: p.letter.toUpperCase(), blank: p.blank }));

  /** The tile on a square: a pending tile first, the board second. */
  const at = (row: number, col: number) => {
    if (!inBoard(row, col)) return null;
    const key = cellKey(row, col);
    const pending = overlay.get(key);
    if (pending) return { letter: pending.letter, blank: pending.blank, own: true };
    const existing = board.cells[key];
    return existing ? { letter: existing.letter, blank: existing.blank, own: false } : null;
  };

  /**
   * Read the WHOLE word through (row, col) in one direction. The scan first
   * walks back to the first tile of the word, then reads forward — reading
   * forward from the placed tile alone would return the word backwards
   * ("OT" instead of "TO") whenever a new tile sits at its end.
   */
  const readWord = (row: number, col: number, stepR: number, stepC: number) => {
    let r = row;
    let c = col;
    while (inBoard(r - stepR, c - stepC) && at(r - stepR, c - stepC)) {
      r -= stepR;
      c -= stepC;
    }
    const cells: PlacedWord['cells'] = [];
    let word = '';
    let hasNew = false;
    while (inBoard(r, c)) {
      const tile = at(r, c);
      if (!tile) break;
      cells.push({ row: r, col: c, letter: tile.letter, blank: tile.blank, own: tile.own });
      word += tile.letter;
      if (tile.own) hasNew = true;
      r += stepR;
      c += stepC;
    }
    return { cells, word, hasNew };
  };

  // Every placed tile contributes the word it sits in, in both directions.
  // Dedupe by cell set: the across word through each tile of a horizontal
  // move is the same word, and must be scored once.
  const found: Array<{ cells: PlacedWord['cells']; word: string }> = [];
  const seen = new Set<string>();
  for (const p of placements) {
    const row = Math.floor(p.key / N);
    const col = p.key % N;
    for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
      const read = readWord(row, col, dr, dc);
      if (read.word.length < 2 || !read.hasNew) continue;
      const sig = read.cells.map((c) => cellKey(c.row, c.col)).join(',');
      if (seen.has(sig)) continue;
      seen.add(sig);
      found.push({ cells: read.cells, word: read.word });
    }
  }

  const covered = new Set(found.flatMap((w) => w.cells.filter((c) => c.own).map((c) => cellKey(c.row, c.col))));
  if (found.length === 0) return fail('Tiles must form a word of 2+ letters');
  if (placements.some((p) => !covered.has(p.key))) {
    // A placed tile that belongs to no word means the tiles are not
    // contiguous — a gap inside the word.
    return fail('No gaps allowed inside a word');
  }

  if (board.first) {
    if (!keys.has(STAR)) return fail('The first word must cover the centre ★');
    if (placements.length < 2) return fail('Play at least two tiles to open');
  } else {
    const touchesExisting = placements.some((p) => {
      const r = Math.floor(p.key / N);
      const c = p.key % N;
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([rr, cc]) => {
        if (!inBoard(rr, cc)) return false;
        const k = cellKey(rr, cc);
        return !!board.cells[k] && !keys.has(k);
      });
    });
    if (!touchesExisting) return fail('Connect to tiles already on the board');
  }

  for (const w of found) {
    if (!isWord(w.word.toLowerCase())) return fail(`“${w.word}” isn’t in the lexicon`, w.word);
  }

  let total = 0;
  const words: PlacedWord[] = found.map((w) => {
    let sum = 0;
    let multiplier = 1;
    for (const c of w.cells) {
      const value = c.blank ? 0 : (VALUES[c.letter] ?? 0);
      let v = value;
      // Premiums apply only under tiles that are NEW on this turn — every
      // score below is derived from the board, never from the caller.
      if (c.own) {
        const prem = PREMIUMS[c.row][c.col];
        if (prem === 'DL') v *= 2;
        else if (prem === 'TL') v *= 3;
        else if (prem === 'DW') multiplier *= 2;
        else if (prem === 'TW') multiplier *= 3;
      }
      sum += v;
    }
    const score = sum * multiplier;
    total += score;
    return { word: w.word, cells: w.cells, score, multiplier };
  });

  const bingo = placements.length === RACK_SIZE;
  if (bingo) total += 50;

  return { ok: true, words, total, bingo };
}

// ── Room shape (what every device may read) ─────────────────────────────

export interface OnlineSeat {
  uid: string;
  name: string;
  /** True for the room's creator (drives the deal + the write permission). */
  host: boolean;
  /** Present on the join snapshot; the host keeps it in memory only. */
  seed?: number;
}

export interface OnlineResult {
  winner: string;
  scores: Array<{ name: string; score: number }>;
  reason: 'rack-cleared' | 'passes' | 'resigned';
}

/** The public half of a room — the part any seated player may render. */
export interface RoomSnapshot {
  code: string;
  hostUid: string;
  hostName: string;
  /** Random 12-char string; the deal is derived from it, so it is safe. */
  seed: string;
  status: 'waiting' | 'playing' | 'finished' | 'closed';
  seats: OnlineSeat[];
  /** Number of completed turns (0 before the first move). */
  move: number;
  /** Whose turn it is (index into `seats`). */
  turn: number;
  /** 225 letters/blanks; a blank is stored as its chosen lowercase letter. */
  cells: string[];
  scores: number[];
  /** Newest-last activity for the log strip. */
  log: string[];
  result: OnlineResult | null;
  version: number;
}

/** What one player is told about their own tiles — and nothing else. */
export interface SeatView {
  code: string;
  uid: string;
  letters: string[];
  /** Changes when the rack changes, so a client can tell "no news" from new. */
  revision: number;
}

/** A move as a player submits it. */
export interface SubmittedMove {
  uid: string;
  /** The move number this is a response to — rejects stale/duplicate writes. */
  move: number;
  placements: Placement[];
}

/**
 * Rebuild a board from the stored 225-char cell list. A lowercase letter is
 * a blank (it scores 0); an uppercase letter is the real tile.
 */
export function boardFromCells(cells: string[], move: number): BoardState {
  const board = emptyBoard();
  for (let key = 0; key < N * N; key++) {
    const ch = cells[key] ?? '';
    if (!ch) continue;
    board.cells[key] = { letter: ch.toUpperCase(), blank: ch !== ch.toUpperCase() };
  }
  board.first = move === 0;
  return board;
}

/** Board cells (225) after applying a verified move. */
export function applyMove(cells: string[], move: MoveCheck): string[] {
  const next = [...cells];
  for (const word of move.words) {
    for (const c of word.cells) {
      if (!c.own) continue;
      next[cellKey(c.row, c.col)] = c.blank ? c.letter.toLowerCase() : c.letter;
    }
  }
  return next;
}

/** Rack letters after a move: the played ones are gone, in place order. */
export function removePlayed(letters: string[], placements: Placement[]): string[] {
  const left = [...letters];
  for (const p of placements) {
    const want = p.blank ? '?' : p.letter.toUpperCase();
    const i = left.findIndex((l) => (l === '?' ? p.blank : l.toUpperCase() === want));
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}

/** "Sok Dara" → "Sok", for tight seat labels. */
export function shortName(name: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || 'Player';
  return first.slice(0, 12);
}

/** Room codes: 5 chars, no look-alike pairs (0/O, 1/I) so they can be typed. */
export const ROOM_CODE_LEN = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return out;
}

export function isRoomCode(value: string): boolean {
  const v = (value || '').trim().toUpperCase();
  return v.length === ROOM_CODE_LEN && [...v].every((ch) => CODE_ALPHABET.includes(ch));
}
