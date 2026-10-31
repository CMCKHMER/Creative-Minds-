/**
 * Tiny opening book: space-separated UCI move history -> candidate replies.
 * Repeated entries make a reply more likely. Each reply is checked for legality before use.
 */
export const BOOK: Record<string, string[]> = {
  "": ["e2e4", "e2e4", "d2d4", "d2d4", "g1f3", "c2c4"],

  // 1.e4
  "e2e4": ["e7e5", "c7c5", "e7e6", "c7c6", "d7d5"],
  "e2e4 e7e5": ["g1f3", "g1f3", "f1c4"],
  "e2e4 e7e5 g1f3": ["b8c6", "b8c6", "g8f6"],
  "e2e4 e7e5 g1f3 b8c6": ["f1b5", "f1c4", "d2d4"],
  "e2e4 e7e5 g1f3 b8c6 f1b5": ["a7a6", "g8f6"],
  "e2e4 e7e5 g1f3 b8c6 f1c4": ["f8c5", "g8f6"],
  "e2e4 c7c5": ["g1f3", "b1c3"],
  "e2e4 c7c5 g1f3": ["d7d6", "b8c6", "e7e6"],
  "e2e4 c7c5 g1f3 d7d6": ["d2d4"],
  "e2e4 c7c5 g1f3 d7d6 d2d4": ["c5d4"],
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4": ["f3d4"],
  "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4": ["g8f6"],
  "e2e4 e7e6": ["d2d4"],
  "e2e4 e7e6 d2d4": ["d7d5"],
  "e2e4 e7e6 d2d4 d7d5": ["b1c3", "e4e5"],
  "e2e4 c7c6": ["d2d4"],
  "e2e4 c7c6 d2d4": ["d7d5"],
  "e2e4 c7c6 d2d4 d7d5": ["b1c3", "e4e5"],
  "e2e4 d7d5": ["e4d5"],
  "e2e4 d7d5 e4d5": ["d8d5", "g8f6"],

  // 1.d4
  "d2d4": ["d7d5", "g8f6", "g8f6", "e7e6"],
  "d2d4 d7d5": ["c2c4", "g1f3"],
  "d2d4 d7d5 c2c4": ["e7e6", "c7c6", "d5c4"],
  "d2d4 d7d5 c2c4 e7e6": ["b1c3", "g1f3"],
  "d2d4 d7d5 c2c4 c7c6": ["g1f3", "b1c3"],
  "d2d4 g8f6": ["c2c4", "g1f3"],
  "d2d4 g8f6 c2c4": ["e7e6", "g7g6"],
  "d2d4 g8f6 c2c4 e7e6": ["b1c3", "g1f3"],
  "d2d4 g8f6 c2c4 g7g6": ["b1c3"],
  "d2d4 g8f6 c2c4 g7g6 b1c3": ["f8g7"],
  "d2d4 g8f6 g1f3": ["e7e6", "g7g6", "d7d5"],
  "d2d4 e7e6": ["c2c4", "g1f3"],

  // 1.Nf3 and 1.c4
  "g1f3": ["d7d5", "g8f6", "c7c5"],
  "g1f3 d7d5": ["d2d4", "c2c4", "g2g3"],
  "g1f3 g8f6": ["c2c4", "d2d4", "g2g3"],
  "g1f3 c7c5": ["c2c4", "e2e4"],
  "c2c4": ["e7e5", "g8f6", "c7c5", "e7e6"],
  "c2c4 e7e5": ["b1c3", "g2g3"],
  "c2c4 g8f6": ["b1c3", "g1f3"],
  "c2c4 c7c5": ["g1f3", "b1c3"],
};
