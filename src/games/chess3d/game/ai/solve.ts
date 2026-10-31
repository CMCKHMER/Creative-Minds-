import { BOOK } from "./book";
import { Engine, START_FEN } from "./engine";
import { levelById } from "./levels";
import type { AiRequest, AiResponse } from "./protocol";

function split(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

/** Handles one request against an engine instance (shared by the worker and the main-thread fallback). */
export function solve(engine: Engine, req: AiRequest): AiResponse {
  try {
    engine.setPosition(START_FEN, req.uci);
    const level = levelById(req.level);

    if (req.kind === "eval") {
      const res = engine.think({ maxDepth: 5, timeMs: 500, margin: 0, fullRoot: false });
      if (!res) return { id: req.id, ok: false, error: "no legal moves" };
      return { id: req.id, ok: true, score: res.score, depth: res.depth, nodes: res.nodes };
    }

    if (level.book && req.uci.length < 14) {
      const options = BOOK[req.uci.join(" ")];
      if (options) {
        const legal = new Set(engine.legalUci());
        const ok = options.filter((o) => legal.has(o));
        if (ok.length) {
          const pick = ok[Math.floor(Math.random() * ok.length)];
          return { id: req.id, ok: true, ...split(pick), book: true };
        }
      }
    }

    const res = engine.think({
      maxDepth: level.depth,
      timeMs: level.timeMs,
      margin: level.margin,
      fullRoot: level.fullRoot,
    });
    if (!res) return { id: req.id, ok: false, error: "no legal moves" };
    return { id: req.id, ok: true, ...split(res.uci), score: res.score, depth: res.depth, nodes: res.nodes };
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : "engine error" };
  }
}
