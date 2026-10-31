import type { Engine } from "./engine";
import type { AiRequest, AiResponse } from "./protocol";

interface Pending {
  req: AiRequest;
  resolve: (r: AiResponse) => void;
}

/**
 * Talks to the engine worker. If workers are unavailable (or crash) it falls back
 * to running a reduced-strength search on the main thread so the game stays playable.
 */
class AiClient {
  private worker: Worker | null = null;
  private failed = false;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private mainEngine: Engine | null = null;

  private ensureWorker(): Worker | null {
    if (this.failed || typeof Worker === "undefined") return null;
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<AiResponse>) => {
        const p = this.pending.get(e.data.id);
        if (p) {
          this.pending.delete(e.data.id);
          p.resolve(e.data);
        }
      };
      w.onerror = () => {
        this.failed = true;
        this.worker?.terminate();
        this.worker = null;
        const items = [...this.pending.values()];
        this.pending.clear();
        for (const p of items) void this.runOnMainThread(p.req).then(p.resolve);
      };
      this.worker = w;
      return w;
    } catch {
      this.failed = true;
      return null;
    }
  }

  private async runOnMainThread(req: AiRequest): Promise<AiResponse> {
    const [{ Engine: EngineClass }, { solve }] = await Promise.all([import("./engine"), import("./solve")]);
    if (!this.mainEngine) this.mainEngine = new EngineClass();
    // let the UI paint before blocking the thread; keep searches short here
    await new Promise((r) => setTimeout(r, 30));
    return solve(this.mainEngine, { ...req, level: Math.min(req.level, 3) });
  }

  request(kind: AiRequest["kind"], uci: string[], level: number): Promise<AiResponse> {
    const id = ++this.seq;
    const req: AiRequest = { id, kind, uci, level };
    return new Promise((resolve) => {
      const w = this.ensureWorker();
      if (!w) {
        void this.runOnMainThread(req).then(resolve);
        return;
      }
      this.pending.set(id, { req, resolve });
      w.postMessage(req);
    });
  }

  /** Abandons in-flight searches (the worker is restarted on the next request). */
  cancel() {
    if (this.pending.size === 0) return;
    const items = [...this.pending.values()];
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    for (const p of items) p.resolve({ id: p.req.id, ok: false, error: "cancelled" });
  }
}

export const aiClient = new AiClient();
