export interface AiRequest {
  id: number;
  /** "move": choose a reply for the side to move. "eval": evaluate the position (for draw offers). */
  kind: "move" | "eval";
  /** moves played so far from the standard start position, in UCI (e2e4, e7e8q …) */
  uci: string[];
  level: number;
}

export interface AiResponse {
  id: number;
  ok: boolean;
  from?: string;
  to?: string;
  promotion?: string;
  /** centipawns, from the point of view of the side to move */
  score?: number;
  depth?: number;
  nodes?: number;
  book?: boolean;
  error?: string;
}
