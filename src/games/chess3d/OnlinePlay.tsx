import { useState } from "react";
import { Check, Copy, WifiOff } from "lucide-react";
import GameView from "./game/GameView";
import { useOnlineGame, type OnlineIdentity } from "./game/useOnlineGame";

/**
 * Online duel stage — wires the Firestore-backed controller into the
 * shared 3D GameView and adds the two online-only surfaces: the room-code
 * banner while waiting for a challenger, and the connection-loss overlay.
 */
export default function OnlinePlay({
  code,
  identity,
  onExit,
}: {
  code: string;
  identity: OnlineIdentity;
  onExit: () => void;
}) {
  const ctrl = useOnlineGame({ code, identity });
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the code is big on screen anyway */
    }
  };

  const waiting = ctrl.game?.status === "waiting" && !ctrl.error;

  return (
    <>
      {waiting && (
        <div className="fixed left-1/2 top-16 z-[70] w-[min(92vw,30rem)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/30 bg-slate-950/90 px-4 py-3 shadow-2xl shadow-emerald-950/40 backdrop-blur">
            <span className="grid h-10 w-10 shrink-0 animate-pulse place-items-center rounded-xl bg-emerald-400/15 text-xl" aria-hidden="true">
              🌐
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                Waiting for a challenger
              </p>
              <p className="mt-0.5 text-xs leading-snug text-slate-400">
                Share this code — the duel starts the moment they join.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label={`Copy room code ${code}`}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 font-mono text-xl font-bold tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-300/20"
            >
              {code}
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}

      {ctrl.game && <GameView ctrl={ctrl} mode="online" onExit={onExit} />}

      {ctrl.error && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#080b12]/95 p-5 text-slate-100">
          <div className="w-full max-w-sm rounded-3xl border border-red-300/25 bg-slate-950/90 p-8 text-center shadow-2xl">
            <WifiOff className="mx-auto h-8 w-8 text-red-300" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-bold text-white">Table disconnected</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{ctrl.error}</p>
            <button
              type="button"
              onClick={onExit}
              className="mt-6 w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 transition hover:bg-amber-300"
            >
              Back to the arena gate
            </button>
          </div>
        </div>
      )}
    </>
  );
}
