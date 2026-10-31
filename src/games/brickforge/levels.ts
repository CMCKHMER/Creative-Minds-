export type BrickKind = "normal" | "gold" | "anvil";

export interface BrickSpec {
  col: number;
  row: number;
  hp: number;
  kind: BrickKind;
}

export const COLS = 10;
export const MAX_ROWS = 9;

type Pattern = (r: number, c: number, rows: number, cols: number) => boolean;

const patterns: Pattern[] = [
  // full wall
  () => true,
  // checkerboard
  (r, c) => (r + c) % 2 === 0,
  // pyramid
  (r, c, _rows, cols) => Math.abs(c - (cols - 1) / 2) <= r + 0.5,
  // diamond
  (r, c, rows, cols) =>
    Math.abs(c - (cols - 1) / 2) / (cols / 2) + Math.abs(r - (rows - 1) / 2) / (rows / 2) <= 1,
  // pillars with cap
  (r, c, rows) => c % 2 === 0 || r === 0 || r === rows - 1,
  // ellipse
  (r, c, rows, cols) => {
    const dx = (c - (cols - 1) / 2) / (cols / 2);
    const dy = (r - (rows - 1) / 2) / (rows / 2);
    return dx * dx + dy * dy <= 1.05;
  },
  // frame
  (r, c, rows, cols) => !(r >= 2 && r <= rows - 3 && c >= 3 && c <= cols - 4),
  // zigzag
  (r, c) => (c + r) % 3 !== 0,
  // inverted pyramid
  (r, c, rows, cols) => Math.abs(c - (cols - 1) / 2) <= rows - r - 0.5,
];

export function buildLevel(level: number): BrickSpec[] {
  const rows = Math.min(5 + Math.floor((level - 1) / 2), MAX_ROWS);
  const pattern = patterns[(level - 1) % patterns.length];
  const p3 = Math.min(Math.max((level - 3) * 0.07, 0), 0.35);
  const p2 = Math.min(Math.max((level - 1) * 0.12, 0), 0.4);
  const anvilChance = level >= 5 ? Math.min(0.03 + (level - 5) * 0.005, 0.06) : 0;
  const maxAnvils = Math.min(2 + Math.floor(level / 3), 8);

  const specs: BrickSpec[] = [];
  let anvils = 0;
  let golds = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!pattern(r, c, rows, COLS)) continue;
      const roll = Math.random();
      let kind: BrickKind = "normal";
      let hp: number;
      if (anvilChance > 0 && anvils < maxAnvils && roll < anvilChance && r > 0) {
        kind = "anvil";
        hp = 999;
        anvils++;
      } else if (Math.random() < 0.05) {
        kind = "gold";
        hp = 1;
        golds++;
      } else {
        const h = Math.random();
        // top rows are tougher
        const bonus = level >= 3 && r < 2 ? 0.15 : 0;
        if (h < p3 + bonus * 0.5) hp = 3;
        else if (h < p3 + p2 + bonus) hp = 2;
        else hp = 1;
      }
      specs.push({ col: c, row: r, hp, kind });
    }
  }

  // guarantee at least one gold brick
  if (golds === 0) {
    const candidates = specs.filter((s) => s.kind === "normal");
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.kind = "gold";
      pick.hp = 1;
    }
  }
  return specs;
}
