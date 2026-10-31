export type LevelId = 1 | 2 | 3 | 4 | 5;

export interface Level {
  id: LevelId;
  name: string;
  glyph: string;
  tagline: string;
  blurb: string;
  /** maximum search depth (plies) */
  depth: number;
  /** search time budget in ms */
  timeMs: number;
  /** picks among near-best moves (centipawns) to play like a human; 0 = always the best move */
  margin: number;
  fullRoot: boolean;
  book: boolean;
  /** the computer always "thinks" for at least this long so replies feel natural */
  minThinkMs: number;
}

export const LEVELS: Level[] = [
  {
    id: 1,
    name: "Squire",
    glyph: "♙",
    tagline: "Just learning the ropes",
    blurb: "Looks one move ahead and happily blunders pieces. Perfect for a first game.",
    depth: 1,
    timeMs: 300,
    margin: 260,
    fullRoot: true,
    book: false,
    minThinkMs: 500,
  },
  {
    id: 2,
    name: "Knight-errant",
    glyph: "♘",
    tagline: "Casual and careless",
    blurb: "Sees simple tactics but misses anything deeper. Leaves the odd piece hanging.",
    depth: 2,
    timeMs: 500,
    margin: 110,
    fullRoot: true,
    book: false,
    minThinkMs: 650,
  },
  {
    id: 3,
    name: "Baron",
    glyph: "♗",
    tagline: "A solid club player",
    blurb: "Plays sensible chess, spots forks and pins, and punishes obvious mistakes.",
    depth: 4,
    timeMs: 1000,
    margin: 28,
    fullRoot: true,
    book: true,
    minThinkMs: 800,
  },
  {
    id: 4,
    name: "Warlord",
    glyph: "♖",
    tagline: "Tactically sharp",
    blurb: "Calculates deeply, defends accurately and rarely gives you a free piece.",
    depth: 10,
    timeMs: 2000,
    margin: 0,
    fullRoot: false,
    book: true,
    minThinkMs: 900,
  },
  {
    id: 5,
    name: "Sovereign",
    glyph: "♔",
    tagline: "Merciless",
    blurb: "Searches as deep as it can for several seconds a move. Bring your best game.",
    depth: 18,
    timeMs: 4000,
    margin: 0,
    fullRoot: false,
    book: true,
    minThinkMs: 1000,
  },
];

export function levelById(id: number): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[2];
}
