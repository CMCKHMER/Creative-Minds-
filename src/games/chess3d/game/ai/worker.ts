import { Engine } from "./engine";
import type { AiRequest, AiResponse } from "./protocol";
import { solve } from "./solve";

/**
 * Web Worker entry: keeps one engine alive (so its transposition table survives
 * between moves) and answers search requests without blocking the 3D scene.
 */
const engine = new Engine();

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const res: AiResponse = solve(engine, e.data);
  (self as unknown as { postMessage: (m: AiResponse) => void }).postMessage(res);
};
