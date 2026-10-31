import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { restoreSession } from "../../lib/firebaseAuth";
import type { BrainGameProps } from "../registry";
import { isRoomCode, ROOM_CODE_LEN, generateRoomCode, type RoomData } from "./game/online";
import { createRoom, getRoom, RoomAuthError, updateRoom } from "./game/roomClient";
import { getPlayerName, setPlayerName } from "./game/player";
import type { Color } from "./game/types";
import { useSoloGame, type SoloConfig } from "./game/useSoloGame";
import { useLocalGame } from "./game/useGame";
import GameView from "./game/GameView";
import OnlinePlay from "./OnlinePlay";
import { LEVELS, type LevelId } from "./game/ai/levels";

type ColorChoice = "w" | "b" | "random";
type OnlineIdentity = { uid: string; name: string };
type Screen =
  | { kind: "setup" }
  | { kind: "solo"; config: SoloConfig; nonce: number }
  | { kind: "local" }
  | { kind: "online"; code: string; identity: OnlineIdentity; nonce: number };

function SoloPlay({ config, onExit }: { config: SoloConfig; onExit: () => void }) {
  const ctrl = useSoloGame(config, onExit);
  return <GameView ctrl={ctrl} mode="solo" onExit={onExit} />;
}

function LocalPlay({ onExit }: { onExit: () => void }) {
  const ctrl = useLocalGame();
  return <GameView ctrl={ctrl} mode="local" onExit={onExit} />;
}

/**
 * Arena Chess 3D — Brain Lounge cartridge.
 * Ported from the author's Next.js build (three.js board + chess.js rules +
 * built-in engine in a Web Worker). Three battlefields: vs computer,
 * pass & play on one screen, and online duels — a Firestore room document
 * (chess_rooms/{code}) is the shared table, so two students can play from
 * their own devices with a 5-letter room code.
 */
export default function Chess3D({ onExit }: BrainGameProps) {
  const [screen, setScreen] = useState<Screen>({ kind: "setup" });

  if (screen.kind === "solo") {
    return <SoloPlay key={screen.nonce} config={screen.config} onExit={() => setScreen({ kind: "setup" })} />;
  }
  if (screen.kind === "local") {
    return <LocalPlay onExit={() => setScreen({ kind: "setup" })} />;
  }
  if (screen.kind === "online") {
    return (
      <OnlinePlay
        key={screen.nonce}
        code={screen.code}
        identity={screen.identity}
        onExit={() => setScreen({ kind: "setup" })}
      />
    );
  }
  return <Setup onExit={onExit} onStartSolo={(config) => setScreen({ kind: "solo", config, nonce: Date.now() })} onStartLocal={() => setScreen({ kind: "local" })} onStartOnline={(code, identity) => setScreen({ kind: "online", code, identity, nonce: Date.now() })} />;
}

function Setup({
  onExit,
  onStartSolo,
  onStartLocal,
  onStartOnline,
}: {
  onExit: () => void;
  onStartSolo: (c: SoloConfig) => void;
  onStartLocal: () => void;
  onStartOnline: (code: string, identity: OnlineIdentity) => void;
}) {
  const [level, setLevel] = useState<LevelId>(3);
  const [color, setColor] = useState<ColorChoice>("random");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const session = useMemo(() => (typeof window === "undefined" ? null : restoreSession()), []);
  const signedIn = !!(session?.localId && session.emailVerified !== false);

  useEffect(() => {
    setName(getPlayerName());
    const lv = Number(window.localStorage.getItem("chess3d:solo-level"));
    if (lv >= 1 && lv <= 5) setLevel(lv as LevelId);
    const c = window.localStorage.getItem("chess3d:solo-color");
    if (c === "w" || c === "b" || c === "random") setColor(c);
  }, []);

  const startSolo = () => {
    setPlayerName(name);
    window.localStorage.setItem("chess3d:solo-level", String(level));
    window.localStorage.setItem("chess3d:solo-color", color);
    const resolved: Color = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    onStartSolo({ level, color: resolved });
  };

  const onlineName = () => (session?.displayName || name.trim() || "Player").slice(0, 20);

  const createRoomAction = async () => {
    setOnlineError(null);
    if (!session?.localId) return;
    setOnlineBusy(true);
    try {
      const code = generateRoomCode();
      const resolved: Color = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
      const room: RoomData = {
        code,
        hostUid: session.localId,
        hostName: onlineName(),
        hostColor: resolved,
        guestUid: null,
        guestName: null,
        status: "waiting",
        moves: [],
        result: null,
        drawOffer: null,
        gameNo: 1,
      };
      await createRoom(room);
      onStartOnline(code, { uid: session.localId, name: onlineName() });
    } catch (e) {
      console.warn("[chess3d] create room failed:", e);
      setOnlineError(
        e instanceof RoomAuthError
          ? "Sign in with your verified CMC account to open an online table."
          : "Could not open a table — check your connection and try again.",
      );
    } finally {
      setOnlineBusy(false);
    }
  };

  const joinRoomAction = async () => {
    setOnlineError(null);
    if (!session?.localId) return;
    const code = joinCode.trim().toUpperCase();
    if (!isRoomCode(code)) {
      setOnlineError(`Room codes are ${ROOM_CODE_LEN} letters — check the invite.`);
      return;
    }
    setOnlineBusy(true);
    try {
      const data = await getRoom(code);
      if (!data) {
        setOnlineError("No table with that code — ask your friend to re-check it.");
        return;
      }
      if (data.hostUid === session.localId) {
        onStartOnline(code, { uid: session.localId, name: onlineName() }); // host reopening own table
        return;
      }
      if (data.guestUid && data.guestUid !== session.localId) {
        setOnlineError("That table is already full — start a new one.");
        return;
      }
      if (data.status === "closed" || data.status === "finished") {
        setOnlineError("That game is already over — open a fresh table.");
        return;
      }
      if (data.guestUid !== session.localId) {
        await updateRoom(code, {
          guestUid: session.localId,
          guestName: onlineName(),
          status: "active",
          updatedAt: new Date().toISOString(),
        });
      }
      onStartOnline(code, { uid: session.localId, name: onlineName() });
    } catch (e) {
      console.warn("[chess3d] join room failed:", e);
      setOnlineError(
        e instanceof RoomAuthError
          ? "Only verified CMC accounts can join online tables — sign in first."
          : "Could not join that table — check your connection and try again.",
      );
    } finally {
      setOnlineBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#080b12] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.12),transparent_50%)]" />
      <div className="relative mx-auto max-w-3xl px-5 py-8">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Lounge shelf
        </button>

        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-emerald-300/80">The Brain Lounge presents</p>
          <h1 className="mt-2 bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
            Arena Chess 3D
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Hand-sculpted figures, animated duels and a real chess engine — pick your battlefield.
          </p>
        </div>

        {/* mode cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            onClick={onStartLocal}
            className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-left transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-slate-900"
          >
            <span className="text-4xl">🤝</span>
            <h2 className="mt-3 text-lg font-bold text-white">Pass &amp; play</h2>
            <p className="mt-1 text-sm leading-snug text-slate-400">
              Two players, one screen. The camera can swing around the board after every move.
            </p>
          </button>
          <div className="rounded-3xl border border-amber-300/40 bg-amber-300/[0.06] p-6">
            <span className="text-4xl">🤖</span>
            <h2 className="mt-3 text-lg font-bold text-white">Challenge the computer</h2>
            <p className="mt-1 text-sm leading-snug text-slate-400">
              Five strengths, from careless to merciless. Every capture is still a full 3D duel.
            </p>
          </div>
        </div>

        {/* solo setup */}
        <div className="mt-6 space-y-2.5">
          {LEVELS.map((l) => {
            const active = l.id === level;
            return (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                aria-pressed={active}
                className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition ${
                  active
                    ? "border-amber-300/70 bg-amber-300/10 shadow-[0_0_30px_rgba(251,191,36,0.15)]"
                    : "border-white/10 bg-slate-900/60 hover:border-white/25 hover:bg-slate-900"
                }`}
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-3xl ${active ? "bg-amber-300/20 text-amber-100" : "bg-slate-800 text-slate-300"}`}>
                  {l.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-lg font-semibold text-white">{l.name}</span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">{l.tagline}</span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-slate-400">{l.blurb}</span>
                </span>
                <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex" aria-label={`Strength ${l.id} of 5`}>
                  <span className="flex gap-1">
                    {LEVELS.map((p) => (
                      <span key={p.id} className={`h-2.5 w-2.5 rounded-full ${p.id <= l.id ? (active ? "bg-amber-300" : "bg-slate-400") : "bg-slate-700"}`} />
                    ))}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">strength</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Play as</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(
                [
                  ["w", "White", "♔"],
                  ["random", "Random", "⚄"],
                  ["b", "Black", "♚"],
                ] as const
              ).map(([v, label, glyph]) => (
                <button
                  key={v}
                  onClick={() => setColor(v)}
                  aria-pressed={color === v}
                  className={`rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                    color === v ? "border-amber-300/70 bg-amber-300/15 text-amber-100" : "border-white/10 bg-slate-950/50 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="mr-1 text-lg">{glyph}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="You"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-amber-300/60"
            />
          </div>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto]">
            <button
              onClick={startSolo}
              className="rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-3.5 text-base font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:brightness-110"
            >
              Begin the duel
            </button>
            <button
              onClick={onStartLocal}
              className="rounded-xl border border-white/10 bg-slate-950/60 px-5 py-3.5 text-base font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Or start pass &amp; play
            </button>
          </div>
        </div>

        {/* online duels */}
        <div className="mt-6 rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.05] p-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <span aria-hidden="true">🌐</span> Online duel
            </h2>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
              Room code · live opponent
            </span>
          </div>

          {signedIn ? (
            <>
              <p className="mt-2 text-sm leading-snug text-slate-400">
                Open a table and share its 5-letter code, or enter a friend's code to sit down across from them. Colours swap on every rematch, and every result feeds the Lounge leaderboard.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, ROOM_CODE_LEN))}
                    maxLength={ROOM_CODE_LEN}
                    placeholder="CODE"
                    aria-label="Room code"
                    className="w-36 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.25em] text-emerald-100 outline-none placeholder:text-slate-600 focus:border-emerald-300/60"
                  />
                  <button
                    onClick={() => void joinRoomAction()}
                    disabled={onlineBusy || joinCode.trim().length !== ROOM_CODE_LEN}
                    className="flex-1 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-5 py-3.5 text-base font-bold text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-6"
                  >
                    Join table
                  </button>
                </div>
                <button
                  onClick={() => void createRoomAction()}
                  disabled={onlineBusy}
                  className="rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 px-5 py-3.5 text-base font-bold text-slate-900 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-60"
                >
                  {onlineBusy ? <Loader2 className="inline h-4 w-4 animate-spin" aria-hidden="true" /> : "Open a new table"}
                </button>
              </div>
              {onlineError && <p className="mt-3 text-sm font-semibold text-red-300">{onlineError}</p>}
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Playing as <span className="font-semibold text-slate-300">{onlineName()}</span> · stay on this screen while you wait — the table rings the moment your opponent sits down.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Sign in with your CMC account (top of the page → <span className="font-semibold text-slate-200">Join CMC</span>) to duel a classmate online with a room code. The computer and pass &amp; play need no account.
            </p>
          )}
        </div>

        <p className="mt-6 pb-4 text-center text-[11px] leading-relaxed text-slate-600">
          Every finished duel — against the machine or a classmate — is recorded on the Brain Lounge leaderboard.
        </p>
      </div>
    </div>
  );
}
