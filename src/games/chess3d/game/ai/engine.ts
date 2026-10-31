/**
 * Compact chess engine (no dependencies, runs in a worker or on the main thread).
 *
 * - 0x88 mailbox board with incremental Zobrist hashing
 * - Negamax alpha-beta (PVS), iterative deepening, transposition table
 * - Quiescence search, null-move pruning, reverse futility, LMR, killers + history
 * - Tapered evaluation (piece-square tables, pawn structure, king shelter, mop-up)
 */

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const MATE = 30000;
const INF = 32000;
const MAX_PLY = 96;
const STACK = 4096;

const P = 1;
const N = 2;
const B = 3;
const R = 4;
const Q = 5;
const K = 6;

const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;

const F_CAP = 1;
const F_EP = 2;
const F_CASTLE = 4;
const F_DP = 8;

const KNIGHT_D = [33, 31, 18, 14, -33, -31, -18, -14];
const KING_D = [1, -1, 16, -16, 15, 17, -15, -17];
const DIAG_D = [15, 17, -15, -17];
const ORTH_D = [1, -1, 16, -16];

const VAL = [0, 100, 320, 330, 500, 900, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];
const PASSED = [0, 0, 10, 20, 35, 60, 100, 0];

/* ------------------------------------------------------------------ */
/* Piece-square tables (white's view, rank 8 first)                    */
/* ------------------------------------------------------------------ */

// prettier-ignore
const PST_P = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];
// prettier-ignore
const PST_N = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
// prettier-ignore
const PST_B = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
// prettier-ignore
const PST_R = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
];
// prettier-ignore
const PST_Q = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];
// prettier-ignore
const PST_K_MG = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];
// prettier-ignore
const PST_K_EG = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];
const PAWN_EG_ROWS = [0, 80, 45, 25, 12, 5, 0, 0];
const PST_P_EG: number[] = [];
for (let row = 0; row < 8; row++) for (let f = 0; f < 8; f++) PST_P_EG.push(PAWN_EG_ROWS[row]);

const MG_VAL = [0, 100, 320, 330, 500, 900, 0];
const EG_VAL = [0, 118, 310, 320, 520, 920, 0];
const MG_SRC = [[], PST_P, PST_N, PST_B, PST_R, PST_Q, PST_K_MG];
const EG_SRC = [[], PST_P_EG, PST_N, PST_B, PST_R, PST_Q, PST_K_EG];
const MG_TAB: number[][] = MG_SRC.map((t, p) => t.map((v) => v + MG_VAL[p]));
const EG_TAB: number[][] = EG_SRC.map((t, p) => t.map((v) => v + EG_VAL[p]));

/* ------------------------------------------------------------------ */
/* Zobrist keys                                                         */
/* ------------------------------------------------------------------ */

let seed = 0x9e3779b9 | 0;
function rnd(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
}
const Z_LO = new Int32Array(12 * 128);
const Z_HI = new Int32Array(12 * 128);
const C_LO = new Int32Array(16);
const C_HI = new Int32Array(16);
const EP_LO = new Int32Array(8);
const EP_HI = new Int32Array(8);
for (let i = 0; i < Z_LO.length; i++) {
  Z_LO[i] = rnd();
  Z_HI[i] = rnd();
}
for (let i = 1; i < 16; i++) {
  C_LO[i] = rnd();
  C_HI[i] = rnd();
}
for (let i = 0; i < 8; i++) {
  EP_LO[i] = rnd();
  EP_HI[i] = rnd();
}
const SIDE_LO = rnd();
const SIDE_HI = rnd();

const pidx = (piece: number) => (piece > 0 ? piece - 1 : 5 - piece);

const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[4] = 15 & ~(WK | WQ);
CASTLE_MASK[0] = 15 & ~WQ;
CASTLE_MASK[7] = 15 & ~WK;
CASTLE_MASK[116] = 15 & ~(BK | BQ);
CASTLE_MASK[112] = 15 & ~BQ;
CASTLE_MASK[119] = 15 & ~BK;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function sqName(sq: number): string {
  return "abcdefgh"[sq & 7] + String((sq >> 4) + 1);
}
export function sqFromName(name: string): number {
  return name.charCodeAt(0) - 97 + (Number(name[1]) - 1) * 16;
}

export interface ThinkOptions {
  maxDepth: number;
  timeMs: number;
  /** centipawn window for picking a "human" move (needs fullRoot) */
  margin: number;
  /** search every root move with a full window (exact scores for all moves) */
  fullRoot: boolean;
}

export interface ThinkResult {
  uci: string;
  score: number;
  depth: number;
  nodes: number;
}

const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;

export class Engine {
  board = new Int8Array(128);
  stm = 0;
  castle = 0;
  ep = -1;
  half = 0;
  ksq = [4, 116];
  keyLo = 0;
  keyHi = 0;
  n = 0;
  nodes = 0;

  private stopped = false;
  private deadline = 0;

  private uMove = new Int32Array(STACK);
  private uCap = new Int8Array(STACK);
  private uCastle = new Uint8Array(STACK);
  private uEp = new Int16Array(STACK);
  private uHalf = new Int16Array(STACK);
  private kLo = new Int32Array(STACK + 1);
  private kHi = new Int32Array(STACK + 1);

  private moveBufs: Int32Array[] = Array.from({ length: MAX_PLY + 2 }, () => new Int32Array(256));
  private scoreBufs: Int32Array[] = Array.from({ length: MAX_PLY + 2 }, () => new Int32Array(256));
  private killers = new Int32Array((MAX_PLY + 2) * 2);
  private history = new Int32Array(2 * 128 * 128);

  private ttHi = new Int32Array(TT_SIZE);
  private ttMove = new Int32Array(TT_SIZE);
  private ttScore = new Int16Array(TT_SIZE);
  private ttDepth = new Int8Array(TT_SIZE);
  private ttFlag = new Uint8Array(TT_SIZE);

  private wHi = new Int8Array(8);
  private wLo = new Int8Array(8);
  private bHi = new Int8Array(8);
  private bLo = new Int8Array(8);
  private wC = new Int8Array(8);
  private bC = new Int8Array(8);

  constructor() {
    this.setPosition(START_FEN);
  }

  /* ---------------------------- position ---------------------------- */

  setPosition(fen: string, moves: string[] = []) {
    const [placement, side = "w", cas = "-", ep = "-", half = "0"] = fen.trim().split(/\s+/);
    this.board.fill(0);
    let r = 7;
    let f = 0;
    for (const ch of placement) {
      if (ch === "/") {
        r--;
        f = 0;
      } else if (ch >= "1" && ch <= "8") {
        f += Number(ch);
      } else {
        const lower = ch.toLowerCase();
        const type = "pnbrqk".indexOf(lower) + 1;
        const sq = r * 16 + f;
        const black = ch === lower;
        this.board[sq] = black ? -type : type;
        if (type === K) this.ksq[black ? 1 : 0] = sq;
        f++;
      }
    }
    this.stm = side === "w" ? 0 : 1;
    this.castle = 0;
    if (cas.includes("K")) this.castle |= WK;
    if (cas.includes("Q")) this.castle |= WQ;
    if (cas.includes("k")) this.castle |= BK;
    if (cas.includes("q")) this.castle |= BQ;
    this.ep = ep === "-" ? -1 : sqFromName(ep);
    this.half = Number(half) || 0;
    this.n = 0;
    this.computeHash();
    this.kLo[0] = this.keyLo;
    this.kHi[0] = this.keyHi;

    for (const u of moves) {
      const from = sqFromName(u.slice(0, 2));
      const to = sqFromName(u.slice(2, 4));
      const promo = u.length > 4 ? "pnbrqk".indexOf(u[4]) + 1 : 0;
      const buf = this.moveBufs[0];
      const cnt = this.generate(buf, false);
      let found = false;
      for (let i = 0; i < cnt; i++) {
        const m = buf[i];
        if ((m & 127) === from && ((m >> 7) & 127) === to && ((m >> 14) & 7) === promo) {
          found = this.makeMove(m);
          break;
        }
      }
      if (!found) throw new Error(`Illegal move in history: ${u}`);
    }
  }

  private computeHash() {
    let lo = 0;
    let hi = 0;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = r * 16 + f;
        const p = this.board[sq];
        if (p !== 0) {
          const zi = pidx(p) * 128 + sq;
          lo ^= Z_LO[zi];
          hi ^= Z_HI[zi];
        }
      }
    }
    if (this.stm === 1) {
      lo ^= SIDE_LO;
      hi ^= SIDE_HI;
    }
    lo ^= C_LO[this.castle];
    hi ^= C_HI[this.castle];
    if (this.ep >= 0) {
      lo ^= EP_LO[this.ep & 7];
      hi ^= EP_HI[this.ep & 7];
    }
    this.keyLo = lo;
    this.keyHi = hi;
  }

  uci(m: number): string {
    const promo = (m >> 14) & 7;
    return sqName(m & 127) + sqName((m >> 7) & 127) + (promo ? "pnbrqk"[promo - 1] : "");
  }

  legalMoves(): number[] {
    const out: number[] = [];
    const buf = this.moveBufs[0];
    const cnt = this.generate(buf, false);
    for (let i = 0; i < cnt; i++) {
      const m = buf[i];
      if (this.makeMove(m)) {
        this.unmakeMove();
        out.push(m);
      }
    }
    return out;
  }

  legalUci(): string[] {
    return this.legalMoves().map((m) => this.uci(m));
  }

  inCheck(): boolean {
    return this.isAttacked(this.ksq[this.stm], this.stm ^ 1);
  }

  /* ------------------------- attack detection ------------------------ */

  private isAttacked(sq: number, by: number): boolean {
    const b = this.board;
    let t: number;
    if (by === 0) {
      t = sq - 15;
      if (!(t & 0x88) && b[t] === P) return true;
      t = sq - 17;
      if (!(t & 0x88) && b[t] === P) return true;
    } else {
      t = sq + 15;
      if (!(t & 0x88) && b[t] === -P) return true;
      t = sq + 17;
      if (!(t & 0x88) && b[t] === -P) return true;
    }
    const s = by === 0 ? 1 : -1;
    for (let i = 0; i < 8; i++) {
      t = sq + KNIGHT_D[i];
      if (!(t & 0x88) && b[t] === s * N) return true;
      t = sq + KING_D[i];
      if (!(t & 0x88) && b[t] === s * K) return true;
    }
    for (let i = 0; i < 4; i++) {
      const d = DIAG_D[i];
      t = sq + d;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p !== 0) {
          if (p === s * B || p === s * Q) return true;
          break;
        }
        t += d;
      }
      const o = ORTH_D[i];
      t = sq + o;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p !== 0) {
          if (p === s * R || p === s * Q) return true;
          break;
        }
        t += o;
      }
    }
    return false;
  }

  /* --------------------------- move generation ----------------------- */

  private generate(buf: Int32Array, noisy: boolean): number {
    const b = this.board;
    const us = this.stm;
    const sign = us === 0 ? 1 : -1;
    const them = us ^ 1;
    let c = 0;

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const from = r * 16 + f;
        const p = b[from] * sign;
        if (p <= 0) continue;

        if (p === P) {
          const fwd = us === 0 ? 16 : -16;
          const promoRank = us === 0 ? 6 : 1;
          const startRank = us === 0 ? 1 : 6;
          const one = from + fwd;
          if (b[one] === 0) {
            if (r === promoRank) {
              for (let pr = Q; pr >= N; pr--) buf[c++] = from | (one << 7) | (pr << 14);
            } else if (!noisy) {
              buf[c++] = from | (one << 7);
              if (r === startRank && b[one + fwd] === 0) buf[c++] = from | ((one + fwd) << 7) | (F_DP << 17);
            }
          }
          for (let k = -1; k <= 1; k += 2) {
            const to = one + k;
            if (to & 0x88) continue;
            const t = b[to] * sign;
            if (t < 0) {
              if (r === promoRank) {
                for (let pr = Q; pr >= N; pr--) buf[c++] = from | (to << 7) | (pr << 14) | (F_CAP << 17);
              } else {
                buf[c++] = from | (to << 7) | (F_CAP << 17);
              }
            } else if (t === 0 && to === this.ep) {
              buf[c++] = from | (to << 7) | ((F_CAP | F_EP) << 17);
            }
          }
        } else if (p === N) {
          for (let i = 0; i < 8; i++) {
            const to = from + KNIGHT_D[i];
            if (to & 0x88) continue;
            const t = b[to] * sign;
            if (t === 0) {
              if (!noisy) buf[c++] = from | (to << 7);
            } else if (t < 0) {
              buf[c++] = from | (to << 7) | (F_CAP << 17);
            }
          }
        } else if (p === K) {
          for (let i = 0; i < 8; i++) {
            const to = from + KING_D[i];
            if (to & 0x88) continue;
            const t = b[to] * sign;
            if (t === 0) {
              if (!noisy) buf[c++] = from | (to << 7);
            } else if (t < 0) {
              buf[c++] = from | (to << 7) | (F_CAP << 17);
            }
          }
          if (!noisy) {
            if (us === 0 && from === 4) {
              if (
                this.castle & WK &&
                b[5] === 0 &&
                b[6] === 0 &&
                b[7] === R &&
                !this.isAttacked(4, them) &&
                !this.isAttacked(5, them) &&
                !this.isAttacked(6, them)
              )
                buf[c++] = 4 | (6 << 7) | (F_CASTLE << 17);
              if (
                this.castle & WQ &&
                b[3] === 0 &&
                b[2] === 0 &&
                b[1] === 0 &&
                b[0] === R &&
                !this.isAttacked(4, them) &&
                !this.isAttacked(3, them) &&
                !this.isAttacked(2, them)
              )
                buf[c++] = 4 | (2 << 7) | (F_CASTLE << 17);
            } else if (us === 1 && from === 116) {
              if (
                this.castle & BK &&
                b[117] === 0 &&
                b[118] === 0 &&
                b[119] === -R &&
                !this.isAttacked(116, them) &&
                !this.isAttacked(117, them) &&
                !this.isAttacked(118, them)
              )
                buf[c++] = 116 | (118 << 7) | (F_CASTLE << 17);
              if (
                this.castle & BQ &&
                b[115] === 0 &&
                b[114] === 0 &&
                b[113] === 0 &&
                b[112] === -R &&
                !this.isAttacked(116, them) &&
                !this.isAttacked(115, them) &&
                !this.isAttacked(114, them)
              )
                buf[c++] = 116 | (114 << 7) | (F_CASTLE << 17);
            }
          }
        } else {
          const diag = p === B || p === Q;
          const orth = p === R || p === Q;
          for (let i = 0; i < 4; i++) {
            for (let pass = 0; pass < 2; pass++) {
              if (pass === 0 ? !diag : !orth) continue;
              const d = pass === 0 ? DIAG_D[i] : ORTH_D[i];
              let to = from + d;
              while (!(to & 0x88)) {
                const t = b[to] * sign;
                if (t === 0) {
                  if (!noisy) buf[c++] = from | (to << 7);
                } else {
                  if (t < 0) buf[c++] = from | (to << 7) | (F_CAP << 17);
                  break;
                }
                to += d;
              }
            }
          }
        }
      }
    }
    return c;
  }

  /* ----------------------------- make / unmake ----------------------- */

  /** Plays a pseudo-legal move. Returns false (and restores the board) if it leaves the king in check. */
  makeMove(m: number): boolean {
    const from = m & 127;
    const to = (m >> 7) & 127;
    const promo = (m >> 14) & 7;
    const flags = m >> 17;
    const b = this.board;
    const us = this.stm;
    const sign = us === 0 ? 1 : -1;
    const piece = b[from];
    const n = this.n;
    let lo = this.keyLo;
    let hi = this.keyHi;

    this.uMove[n] = m;
    this.uCastle[n] = this.castle;
    this.uEp[n] = this.ep;
    this.uHalf[n] = this.half;

    if (this.ep >= 0) {
      lo ^= EP_LO[this.ep & 7];
      hi ^= EP_HI[this.ep & 7];
    }

    let cap = 0;
    let zi: number;
    if (flags & F_EP) {
      const cs = to + (us === 0 ? -16 : 16);
      cap = b[cs];
      b[cs] = 0;
      zi = pidx(cap) * 128 + cs;
      lo ^= Z_LO[zi];
      hi ^= Z_HI[zi];
    } else if (b[to] !== 0) {
      cap = b[to];
      zi = pidx(cap) * 128 + to;
      lo ^= Z_LO[zi];
      hi ^= Z_HI[zi];
    }
    this.uCap[n] = cap;

    zi = pidx(piece) * 128 + from;
    lo ^= Z_LO[zi];
    hi ^= Z_HI[zi];
    const placed = promo ? sign * promo : piece;
    b[from] = 0;
    b[to] = placed;
    zi = pidx(placed) * 128 + to;
    lo ^= Z_LO[zi];
    hi ^= Z_HI[zi];

    if (flags & F_CASTLE) {
      let rf: number;
      let rt: number;
      if (to > from) {
        rf = from + 3;
        rt = from + 1;
      } else {
        rf = from - 4;
        rt = from - 1;
      }
      const rook = b[rf];
      b[rf] = 0;
      b[rt] = rook;
      zi = pidx(rook) * 128 + rf;
      lo ^= Z_LO[zi];
      hi ^= Z_HI[zi];
      zi = pidx(rook) * 128 + rt;
      lo ^= Z_LO[zi];
      hi ^= Z_HI[zi];
    }

    if (piece === sign * K) this.ksq[us] = to;

    lo ^= C_LO[this.castle];
    hi ^= C_HI[this.castle];
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    lo ^= C_LO[this.castle];
    hi ^= C_HI[this.castle];

    if (flags & F_DP) {
      this.ep = (from + to) >> 1;
      lo ^= EP_LO[this.ep & 7];
      hi ^= EP_HI[this.ep & 7];
    } else {
      this.ep = -1;
    }

    this.half = piece === sign * P || cap !== 0 ? 0 : this.half + 1;
    this.stm = us ^ 1;
    lo ^= SIDE_LO;
    hi ^= SIDE_HI;
    this.n = n + 1;
    this.keyLo = lo;
    this.keyHi = hi;
    this.kLo[n + 1] = lo;
    this.kHi[n + 1] = hi;

    if (this.isAttacked(this.ksq[us], us ^ 1)) {
      this.unmakeMove();
      return false;
    }
    return true;
  }

  unmakeMove() {
    this.n--;
    const n = this.n;
    const m = this.uMove[n];
    const from = m & 127;
    const to = (m >> 7) & 127;
    const promo = (m >> 14) & 7;
    const flags = m >> 17;
    this.stm ^= 1;
    const us = this.stm;
    const sign = us === 0 ? 1 : -1;
    const b = this.board;
    const cap = this.uCap[n];

    b[from] = promo ? sign * P : b[to];
    if (flags & F_EP) {
      b[to] = 0;
      b[to + (us === 0 ? -16 : 16)] = cap;
    } else {
      b[to] = cap;
    }
    if (flags & F_CASTLE) {
      if (to > from) {
        b[from + 3] = b[from + 1];
        b[from + 1] = 0;
      } else {
        b[from - 4] = b[from - 1];
        b[from - 1] = 0;
      }
    }
    if (b[from] === sign * K) this.ksq[us] = from;

    this.castle = this.uCastle[n];
    this.ep = this.uEp[n];
    this.half = this.uHalf[n];
    this.keyLo = this.kLo[n];
    this.keyHi = this.kHi[n];
  }

  private makeNull() {
    const n = this.n;
    this.uMove[n] = 0;
    this.uEp[n] = this.ep;
    this.uHalf[n] = this.half;
    this.uCastle[n] = this.castle;
    let lo = this.keyLo ^ SIDE_LO;
    let hi = this.keyHi ^ SIDE_HI;
    if (this.ep >= 0) {
      lo ^= EP_LO[this.ep & 7];
      hi ^= EP_HI[this.ep & 7];
      this.ep = -1;
    }
    this.half++;
    this.stm ^= 1;
    this.n = n + 1;
    this.keyLo = lo;
    this.keyHi = hi;
    this.kLo[n + 1] = lo;
    this.kHi[n + 1] = hi;
  }

  private unmakeNull() {
    this.n--;
    const n = this.n;
    this.stm ^= 1;
    this.ep = this.uEp[n];
    this.half = this.uHalf[n];
    this.keyLo = this.kLo[n];
    this.keyHi = this.kHi[n];
  }

  /* ------------------------------ perft ------------------------------ */

  perft(depth: number, ply = 0): number {
    if (depth === 0) return 1;
    const buf = this.moveBufs[ply];
    const cnt = this.generate(buf, false);
    let total = 0;
    for (let i = 0; i < cnt; i++) {
      if (!this.makeMove(buf[i])) continue;
      total += depth === 1 ? 1 : this.perft(depth - 1, ply + 1);
      this.unmakeMove();
    }
    return total;
  }

  /* ---------------------------- evaluation --------------------------- */

  private hasNonPawn(side: number): boolean {
    const s = side === 0 ? 1 : -1;
    const b = this.board;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = b[r * 16 + f] * s;
        if (p >= N && p <= Q) return true;
      }
    }
    return false;
  }

  private mopUp(strong: number, weak: number): number {
    const wf = weak & 7;
    const wr = weak >> 4;
    const cmd = Math.max(3 - wf, wf - 4) + Math.max(3 - wr, wr - 4);
    const dist = Math.abs(wf - (strong & 7)) + Math.abs(wr - (strong >> 4));
    return 6 * cmd + 3 * (14 - dist);
  }

  /** Static evaluation in centipawns from the side to move's point of view. */
  evaluate(): number {
    const b = this.board;
    const wHi = this.wHi;
    const wLo = this.wLo;
    const bHi = this.bHi;
    const bLo = this.bLo;
    const wC = this.wC;
    const bC = this.bC;
    wHi.fill(-1);
    wLo.fill(8);
    bHi.fill(-1);
    bLo.fill(8);
    wC.fill(0);
    bC.fill(0);

    let mg = 0;
    let eg = 0;
    let phase = 0;
    let pawns = 0;
    let majors = 0;
    let wb = 0;
    let bb = 0;

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = b[r * 16 + f];
        if (p === 0) continue;
        if (p > 0) {
          const i = (7 - r) * 8 + f;
          mg += MG_TAB[p][i];
          eg += EG_TAB[p][i];
          phase += PHASE[p];
          if (p === P) {
            pawns++;
            wC[f]++;
            if (r > wHi[f]) wHi[f] = r;
            if (r < wLo[f]) wLo[f] = r;
          } else if (p === B) wb++;
          else if (p === R || p === Q) majors++;
        } else {
          const a = -p;
          const i = r * 8 + f;
          mg -= MG_TAB[a][i];
          eg -= EG_TAB[a][i];
          phase += PHASE[a];
          if (a === P) {
            pawns++;
            bC[f]++;
            if (r > bHi[f]) bHi[f] = r;
            if (r < bLo[f]) bLo[f] = r;
          } else if (a === B) bb++;
          else if (a === R || a === Q) majors++;
        }
      }
    }

    if (pawns === 0 && majors === 0 && phase <= 1) return 0;

    if (wb >= 2) {
      mg += 30;
      eg += 45;
    }
    if (bb >= 2) {
      mg -= 30;
      eg -= 45;
    }

    for (let f = 0; f < 8; f++) {
      const wl = f > 0 ? wC[f - 1] : 0;
      const wr = f < 7 ? wC[f + 1] : 0;
      if (wC[f] > 0) {
        if (wC[f] > 1) {
          mg -= 10 * (wC[f] - 1);
          eg -= 18 * (wC[f] - 1);
        }
        if (wl + wr === 0) {
          mg -= 10;
          eg -= 14;
        }
        const rr = wHi[f];
        if (bHi[f] <= rr && (f === 0 || bHi[f - 1] <= rr) && (f === 7 || bHi[f + 1] <= rr)) {
          mg += PASSED[rr] >> 1;
          eg += PASSED[rr];
        }
      }
      if (bC[f] > 0) {
        const bl = f > 0 ? bC[f - 1] : 0;
        const br = f < 7 ? bC[f + 1] : 0;
        if (bC[f] > 1) {
          mg += 10 * (bC[f] - 1);
          eg += 18 * (bC[f] - 1);
        }
        if (bl + br === 0) {
          mg += 10;
          eg += 14;
        }
        const s = bLo[f];
        if (wLo[f] >= s && (f === 0 || wLo[f - 1] >= s) && (f === 7 || wLo[f + 1] >= s)) {
          mg -= PASSED[7 - s] >> 1;
          eg -= PASSED[7 - s];
        }
      }
    }

    // king shelter (middlegame only)
    const wk = this.ksq[0];
    const bk = this.ksq[1];
    const wkr = wk >> 4;
    const wkf = wk & 7;
    if (wkr <= 1) {
      let shield = 0;
      for (let df = -1; df <= 1; df++) {
        const ff = wkf + df;
        if (ff < 0 || ff > 7) continue;
        if (b[(wkr + 1) * 16 + ff] === P) shield += 2;
        else if (b[(wkr + 2) * 16 + ff] === P) shield += 1;
      }
      mg += shield * 6;
    }
    const bkr = bk >> 4;
    const bkf = bk & 7;
    if (bkr >= 6) {
      let shield = 0;
      for (let df = -1; df <= 1; df++) {
        const ff = bkf + df;
        if (ff < 0 || ff > 7) continue;
        if (b[(bkr - 1) * 16 + ff] === -P) shield += 2;
        else if (b[(bkr - 2) * 16 + ff] === -P) shield += 1;
      }
      mg -= shield * 6;
    }

    const ph = phase > 24 ? 24 : phase;
    let score = ((mg * ph + eg * (24 - ph)) / 24) | 0;
    if (ph <= 10) {
      if (score > 200) score += this.mopUp(wk, bk);
      else if (score < -200) score -= this.mopUp(bk, wk);
    }
    return (this.stm === 0 ? score : -score) + 8;
  }

  /* ------------------------------- search ---------------------------- */

  private isRepetition(): boolean {
    const n = this.n;
    const lo = this.keyLo;
    const hi = this.keyHi;
    for (let i = n - 2; i >= 0 && i >= n - this.half; i -= 2) {
      if (this.kLo[i] === lo && this.kHi[i] === hi) return true;
    }
    return false;
  }

  private scoreMoves(buf: Int32Array, sc: Int32Array, cnt: number, ttMove: number, ply: number) {
    const b = this.board;
    const side = this.stm * 16384;
    const k0 = this.killers[ply * 2];
    const k1 = this.killers[ply * 2 + 1];
    for (let i = 0; i < cnt; i++) {
      const m = buf[i];
      const from = m & 127;
      const to = (m >> 7) & 127;
      const promo = (m >> 14) & 7;
      const flags = m >> 17;
      let s: number;
      if (m === ttMove) s = 2000000;
      else if (flags & F_CAP) {
        const victim = flags & F_EP ? P : Math.abs(b[to]);
        s = 1000000 + victim * 16 - Math.abs(b[from]) + promo * 40;
      } else if (promo) s = 900000 + promo;
      else if (m === k0) s = 800000;
      else if (m === k1) s = 790000;
      else s = this.history[side + from * 128 + to];
      sc[i] = s;
    }
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stopped = true;
    if (this.stopped) return 0;

    const stand = this.evaluate();
    if (ply >= MAX_PLY - 1) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;

    const buf = this.moveBufs[ply];
    const sc = this.scoreBufs[ply];
    const cnt = this.generate(buf, true);
    this.scoreMoves(buf, sc, cnt, 0, ply);
    const b = this.board;

    for (let i = 0; i < cnt; i++) {
      let bi = i;
      let bs = sc[i];
      for (let j = i + 1; j < cnt; j++) {
        if (sc[j] > bs) {
          bs = sc[j];
          bi = j;
        }
      }
      const m = buf[bi];
      buf[bi] = buf[i];
      sc[bi] = sc[i];

      const to = (m >> 7) & 127;
      const promo = (m >> 14) & 7;
      const flags = m >> 17;
      if (!promo) {
        const gain = flags & F_EP ? 100 : VAL[Math.abs(b[to])];
        if (stand + gain + 200 < alpha) continue;
      }
      if (!this.makeMove(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      this.unmakeMove();
      if (this.stopped) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private search(depth: number, alpha: number, beta: number, ply: number, nullOk: boolean): number {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stopped = true;
    if (this.stopped) return 0;

    const us = this.stm;
    const inCheck = this.isAttacked(this.ksq[us], us ^ 1);
    if (ply > 0 && (this.half >= 100 || this.isRepetition())) return 0;
    if (ply >= MAX_PLY - 1) return this.evaluate();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    // mate distance pruning
    if (alpha < -MATE + ply) alpha = -MATE + ply;
    if (beta > MATE - ply - 1) beta = MATE - ply - 1;
    if (alpha >= beta) return alpha;

    const pv = beta - alpha > 1;

    // transposition table
    let ttMove = 0;
    const idx = this.keyLo & TT_MASK;
    if (this.ttFlag[idx] !== 0 && this.ttHi[idx] === this.keyHi) {
      ttMove = this.ttMove[idx];
      if (!pv && this.ttDepth[idx] >= depth) {
        let s = this.ttScore[idx];
        if (s >= MATE - 200) s -= ply;
        else if (s <= -MATE + 200) s += ply;
        const flag = this.ttFlag[idx];
        if (flag === TT_EXACT) return s;
        if (flag === TT_LOWER && s >= beta) return s;
        if (flag === TT_UPPER && s <= alpha) return s;
      }
    }

    if (!pv && !inCheck) {
      const staticEval = this.evaluate();
      // reverse futility pruning
      if (depth <= 3 && staticEval - 120 * depth >= beta && Math.abs(beta) < MATE - 200) {
        return staticEval - 120 * depth;
      }
      // null move pruning
      if (nullOk && depth >= 3 && staticEval >= beta && this.hasNonPawn(us)) {
        this.makeNull();
        const s = -this.search(depth - 1 - (depth >= 6 ? 3 : 2), -beta, -beta + 1, ply + 1, false);
        this.unmakeNull();
        if (this.stopped) return 0;
        if (s >= beta) return s >= MATE - 200 ? beta : s;
      }
    }

    const buf = this.moveBufs[ply];
    const sc = this.scoreBufs[ply];
    const cnt = this.generate(buf, false);
    this.scoreMoves(buf, sc, cnt, ttMove, ply);

    const origAlpha = alpha;
    let best = -INF;
    let bestMove = 0;
    let legal = 0;

    for (let i = 0; i < cnt; i++) {
      let bi = i;
      let bs = sc[i];
      for (let j = i + 1; j < cnt; j++) {
        if (sc[j] > bs) {
          bs = sc[j];
          bi = j;
        }
      }
      const m = buf[bi];
      buf[bi] = buf[i];
      sc[bi] = sc[i];

      if (!this.makeMove(m)) continue;
      legal++;
      const quiet = ((m >> 17) & (F_CAP | F_EP)) === 0 && ((m >> 14) & 7) === 0;
      const newDepth = depth - 1;
      let score: number;

      if (legal === 1) {
        score = -this.search(newDepth, -beta, -alpha, ply + 1, true);
      } else {
        let red = 0;
        if (depth >= 3 && legal > 3 && quiet && !inCheck && !this.isAttacked(this.ksq[this.stm], this.stm ^ 1)) {
          red = legal > 8 ? 2 : 1;
        }
        score = -this.search(newDepth - red, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && red > 0) score = -this.search(newDepth, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -this.search(newDepth, -beta, -alpha, ply + 1, true);
      }
      this.unmakeMove();
      if (this.stopped) return 0;

      if (score > best) {
        best = score;
        bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) {
            if (quiet) {
              const k = ply * 2;
              if (this.killers[k] !== m) {
                this.killers[k + 1] = this.killers[k];
                this.killers[k] = m;
              }
              const hi = us * 16384 + (m & 127) * 128 + ((m >> 7) & 127);
              this.history[hi] += depth * depth;
              if (this.history[hi] > 600000) {
                for (let h = 0; h < this.history.length; h++) this.history[h] >>= 1;
              }
            }
            break;
          }
        }
      }
    }

    if (legal === 0) return inCheck ? -MATE + ply : 0;

    let stored = best;
    if (stored >= MATE - 200) stored += ply;
    else if (stored <= -MATE + 200) stored -= ply;
    this.ttHi[idx] = this.keyHi;
    this.ttMove[idx] = bestMove;
    this.ttScore[idx] = stored;
    this.ttDepth[idx] = depth;
    this.ttFlag[idx] = best >= beta ? TT_LOWER : best > origAlpha ? TT_EXACT : TT_UPPER;
    return best;
  }

  /** Iterative-deepening search from the current position. Returns null when there are no legal moves. */
  think(opts: ThinkOptions): ThinkResult | null {
    this.nodes = 0;
    this.stopped = false;
    const start = Date.now();
    this.deadline = start + opts.timeMs;
    this.killers.fill(0);
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 2;

    let root = this.legalMoves();
    if (root.length === 0) return null;
    if (root.length === 1) return { uci: this.uci(root[0]), score: 0, depth: 0, nodes: 0 };

    // order the root: captures / promotions first
    const b = this.board;
    root.sort((x, y) => {
      const vx = (x >> 17) & F_CAP ? Math.abs(b[(x >> 7) & 127]) * 16 - Math.abs(b[x & 127]) + 100 : 0;
      const vy = (y >> 17) & F_CAP ? Math.abs(b[(y >> 7) & 127]) * 16 - Math.abs(b[y & 127]) + 100 : 0;
      return vy - vx;
    });

    let ordered = root.slice();
    let orderedScores: number[] = ordered.map(() => 0);
    let doneDepth = 0;

    for (let depth = 1; depth <= opts.maxDepth; depth++) {
      let alpha = -INF;
      const scores: number[] = new Array(root.length).fill(-INF);
      let completed = true;

      for (let i = 0; i < root.length; i++) {
        const m = root[i];
        if (!this.makeMove(m)) continue;
        let s: number;
        if (opts.fullRoot) {
          s = -this.search(depth - 1, -INF, INF, 1, true);
        } else if (i === 0) {
          s = -this.search(depth - 1, -INF, -alpha, 1, true);
        } else {
          s = -this.search(depth - 1, -alpha - 1, -alpha, 1, true);
          if (s > alpha && !this.stopped) s = -this.search(depth - 1, -INF, -alpha, 1, true);
        }
        this.unmakeMove();
        if (this.stopped) {
          completed = false;
          break;
        }
        scores[i] = s;
        if (s > alpha) alpha = s;
      }
      if (!completed) break;

      const idxs = root.map((_, i) => i).sort((x, y) => scores[y] - scores[x] || x - y);
      root = idxs.map((i) => root[i]);
      ordered = root.slice();
      orderedScores = idxs.map((i) => scores[i]);
      doneDepth = depth;

      if (Math.abs(orderedScores[0]) >= MATE - 100) break;
      if (Date.now() - start > opts.timeMs * 0.45) break;
    }

    let pick = 0;
    const bestScore = orderedScores[0];
    if (opts.fullRoot && opts.margin > 0 && bestScore < MATE - 100) {
      const cand: number[] = [];
      const weights: number[] = [];
      for (let i = 0; i < ordered.length; i++) {
        const s = orderedScores[i];
        if (s < bestScore - opts.margin) break;
        if (s <= -MATE + 100 && bestScore > -MATE + 100) continue;
        cand.push(i);
        weights.push(Math.exp(-(bestScore - s) / Math.max(10, opts.margin / 2)));
      }
      let total = 0;
      for (const w of weights) total += w;
      let roll = Math.random() * total;
      for (let i = 0; i < cand.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          pick = cand[i];
          break;
        }
      }
    }

    return { uci: this.uci(ordered[pick]), score: orderedScores[pick], depth: doneDepth, nodes: this.nodes };
  }
}
