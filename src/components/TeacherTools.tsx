import { useCallback, useEffect, useRef, useState } from 'react';
import { Dice5, Dice3, RefreshCw, Play, Plus, X, Sparkles, Users, RotateCcw } from 'lucide-react';

/* =========================================================================
   3D DICE ROLLER
   ========================================================================= */

// 6 dice faces with their pip layouts. Each face is a 3x3 grid of "on" cells.
const DICE_FACES: { pips: number[]; rot: string }[] = [
  { pips: [4], rot: 'rotateX(0deg) rotateY(0deg)' },                          // 1 (front)
  { pips: [0, 8], rot: 'rotateY(-90deg)' },                                 // 2 (right)
  { pips: [0, 4, 8], rot: 'rotateY(180deg)' },                              // 3 (back)
  { pips: [0, 2, 6, 8], rot: 'rotateY(90deg)' },                            // 4 (left)
  { pips: [0, 2, 4, 6, 8], rot: 'rotateX(-90deg)' },                        // 5 (top)
  { pips: [0, 2, 6, 8, 4, 4], rot: 'rotateX(90deg)' },                       // 6 (bottom)
];

// For each target value (1-6), how many full extra spins on each axis,
// plus the rotation that brings that face to the front.
const ROLL_TO: Record<number, { x: number; y: number; final: string }> = {
  1: { x: 360 * 2, y: 360 * 2, final: 'rotateX(0deg) rotateY(0deg)' },
  2: { x: 360 * 2, y: 360 * 2 - 90, final: 'rotateY(-90deg)' },
  3: { x: 360 * 2, y: 360 * 2 + 180, final: 'rotateY(180deg)' },
  4: { x: 360 * 2, y: 360 * 2 + 90, final: 'rotateY(90deg)' },
  5: { x: 360 * 2 + 90, y: 360 * 2, final: 'rotateX(-90deg)' },
  6: { x: 360 * 2 - 90, y: 360 * 2, final: 'rotateX(90deg)' },
};

function DiceFace({ value }: { value: number }) {
  const face = DICE_FACES[value - 1];
  return (
    <div
      className="absolute inset-0 rounded-xl border-2 border-white/15"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))',
        boxShadow: 'inset 0 0 16px rgba(0,0,0,0.08), inset 4px 4px 12px rgba(255,255,255,0.5), inset -4px -4px 12px rgba(0,0,0,0.08)',
        backfaceVisibility: 'hidden',
      }}
    >
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center justify-center">
            {face.pips.includes(i) && (
              <span
                className="block rounded-full"
                style={{
                  width: '38%',
                  height: '38%',
                  background: 'radial-gradient(circle at 30% 30%, #475569, #0f172a)',
                  boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.4)',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiceCube({ value, rolling }: { value: number; rolling: boolean }) {
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg)');
  useEffect(() => {
    if (rolling) {
      // animate to many extra spins + final face
      const t = ROLL_TO[value];
      setTransform(`rotateX(${t.x}deg) rotateY(${t.y}deg)`);
    } else {
      const t = ROLL_TO[value];
      setTransform(t.final);
    }
  }, [value, rolling]);

  return (
    <div
      style={{ perspective: '800px', width: '76px', height: '76px', display: 'inline-block' }}
      aria-label={`Dice showing ${value}`}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform,
          transition: rolling ? 'transform 1.6s cubic-bezier(.22,.61,.36,1)' : 'transform 0.3s ease',
        }}
      >
        {/* 6 faces positioned around the cube */}
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(0deg) translateZ(38px)' }}>
          <DiceFace value={1} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(90deg) translateZ(38px)' }}>
          <DiceFace value={4} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg) translateZ(38px)' }}>
          <DiceFace value={3} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(-90deg) translateZ(38px)' }}>
          <DiceFace value={2} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateX(90deg) translateZ(38px)' }}>
          <DiceFace value={6} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateX(-90deg) translateZ(38px)' }}>
          <DiceFace value={5} />
        </div>
      </div>
    </div>
  );
}

function DiceRoller() {
  const [diceCount, setDiceCount] = useState(2);
  const [values, setValues] = useState<number[]>([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<{ values: number[]; sum: number; at: number }[]>([]);

  const roll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    // Pre-compute final values so the cube animates toward them
    const newValues = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
    setValues(newValues);
    setTimeout(() => {
      setRolling(false);
      setHistory((h) =>
        [{ values: newValues, sum: newValues.reduce((a, b) => a + b, 0), at: Date.now() }, ...h].slice(0, 6),
      );
    }, 1700);
  }, [diceCount, rolling]);

  const changeCount = (delta: number) => {
    if (rolling) return;
    setDiceCount((c) => Math.min(5, Math.max(1, c + delta)));
    setValues((v) => {
      const next = [...v];
      while (next.length < Math.min(5, Math.max(1, diceCount + delta))) next.push(1);
      return next.slice(0, Math.min(5, Math.max(1, diceCount + delta)));
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-end justify-center gap-3" style={{ minHeight: 80 }}>
          {Array.from({ length: diceCount }).map((_, i) => (
            <DiceCube key={i} value={values[i] ?? 1} rolling={rolling} />
          ))}
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-200">Total</span>
          <span className="font-mono text-2xl font-bold text-white">{values.slice(0, diceCount).reduce((a, b) => a + b, 0)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={roll}
          disabled={rolling}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_8px_24px_-10px_rgba(45,212,191,.6)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        >
          {rolling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {rolling ? 'Rolling…' : 'Roll dice'}
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <button
            type="button"
            onClick={() => changeCount(-1)}
            disabled={rolling || diceCount <= 1}
            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            aria-label="Fewer dice"
          >
            <span className="text-base font-bold leading-none">−</span>
          </button>
          <span className="min-w-[3.5rem] text-center text-xs font-semibold text-slate-200">
            {diceCount} {diceCount === 1 ? 'die' : 'dice'}
          </span>
          <button
            type="button"
            onClick={() => changeCount(1)}
            disabled={rolling || diceCount >= 5}
            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            aria-label="More dice"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Recent rolls</p>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <span
                key={h.at + '-' + i}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-300"
              >
                <Dice3 className="h-3 w-3 text-cyan-200" />
                <span className="font-mono font-semibold text-white">{h.values.join('+')}</span>
                <span className="text-slate-500">=</span>
                <span className="font-mono font-bold text-cyan-100">{h.sum}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   WHEEL SPIN PICKER
   ========================================================================= */

const DEFAULT_NAMES = ['Anna', 'Ben', 'Cherry', 'David', 'Emma', 'Felix', 'Grace', 'Henry'];
const WHEEL_COLORS = [
  '#38bdf8', '#a78bfa', '#5eead4', '#fbbf24',
  '#f87171', '#a5b4fc', '#34d399', '#fb923c',
  '#22d3ee', '#c084fc', '#86efac', '#fde047',
  '#fca5a5', '#93c5fd', '#bef264', '#f9a8d4',
];

function WheelSpinPicker() {
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [input, setInput] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 320;

  // Draw the wheel whenever names/rotation change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const n = names.length;
    if (n === 0) return;
    const sliceAngle = (Math.PI * 2) / n;

    // background fills for each slice
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, i * sliceAngle + rotation, (i + 1) * sliceAngle + rotation);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // text labels on each slice
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const midAngle = i * sliceAngle + sliceAngle / 2 + rotation;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      ctx.fillText(names[i].slice(0, 14), radius - 12, 0);
      ctx.restore();
    }

    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,23,42,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56,189,248,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [names, rotation]);

  const spin = useCallback(() => {
    if (spinning || names.length === 0) return;
    setWinner(null);
    setSpinning(true);
    const n = names.length;
    const sliceAngle = (Math.PI * 2) / n;
    const winnerIdx = Math.floor(Math.random() * n);
    // We want slice midpoint aligned to the pointer (top, -90deg).
    // Pointer is at angle -Math.PI/2 (top). Want: winnerIdx * sliceAngle + sliceAngle/2 + rotation === -PI/2 (mod 2PI).
    // Solve for rotation: rotation = -PI/2 - (winnerIdx * sliceAngle + sliceAngle/2)  + extra full spins.
    const targetMid = winnerIdx * sliceAngle + sliceAngle / 2;
    const baseRotation = -Math.PI / 2 - targetMid;
    const fullSpins = Math.PI * 2 * (5 + Math.floor(Math.random() * 3));
    const finalRotation = baseRotation + fullSpins;
    // Animate via rAF from current rotation to final
    const start = rotation;
    const end = finalRotation;
    const duration = 4200;
    const startTs = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - startTs) / duration);
      const eased = easeOut(t);
      const r = start + (end - start) * eased;
      setRotation(r);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        // Normalize so subsequent spins start cleanly
        setRotation(((end % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        setWinner(names[winnerIdx]);
        setHistory((h) => [names[winnerIdx], ...h].slice(0, 8));
        setSpinning(false);
      }
    };
    requestAnimationFrame(step);
  }, [spinning, names, rotation]);

  const addName = () => {
    const v = input.trim();
    if (!v) return;
    if (names.length >= 24) return;
    setNames((n) => [...n, v]);
    setInput('');
  };

  const removeName = (idx: number) => {
    if (spinning) return;
    setNames((n) => n.filter((_, i) => i !== idx));
    setWinner(null);
  };

  const resetToDefault = () => {
    if (spinning) return;
    setNames(DEFAULT_NAMES);
    setWinner(null);
    setHistory([]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          {/* Pointer */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '22px solid #fbbf24',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
              zIndex: 5,
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Add a name
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addName(); }}
              placeholder="Type a name and press Enter"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-300 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={addName}
            disabled={spinning || names.length >= 24}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            disabled={spinning}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>

        {names.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {names.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: WHEEL_COLORS[i % WHEEL_COLORS.length] + '55',
                  background: WHEEL_COLORS[i % WHEEL_COLORS.length] + '15',
                  color: '#e2e8f0',
                }}
              >
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }}
                />
                {name}
                <button
                  type="button"
                  onClick={() => removeName(i)}
                  disabled={spinning}
                  aria-label={`Remove ${name}`}
                  className="text-slate-500 transition hover:text-rose-300 disabled:opacity-40"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No names yet — add at least one to spin.</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={spin}
            disabled={spinning || names.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-300 via-amber-200 to-orange-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_8px_24px_-10px_rgba(251,191,36,.6)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          >
            {spinning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {spinning ? 'Spinning…' : 'Spin the wheel'}
          </button>
          {winner && !spinning && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Winner: <span className="font-mono">{winner}</span>
            </span>
          )}
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Recent picks</p>
            <div className="flex flex-wrap gap-2">
              {history.map((h, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-300"
                >
                  <span className="text-slate-500">#{history.length - i}</span>
                  <span className="font-mono font-semibold text-white">{h}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN SECTION
   ========================================================================= */

export function TeacherTools() {
  return (
    <section
      id="teacher-tools"
      aria-labelledby="teacher-tools-title"
      className="cmc-section scroll-mt-24 border-y border-white/10 bg-[#091725] py-20 sm:py-24 lg:py-28"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-13rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-cyan-500/[0.10] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-amber-500/[0.10] blur-[135px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="cmc-eyebrow"><Dice5 className="h-3.5 w-3.5" aria-hidden="true" /> Quick Classroom Tools</span>
            <h2 id="teacher-tools-title" className="cmc-h2">
              Teacher Tools:<br />
              <span className="cmc-gradient-text">Dice & Wheel of Names.</span>
            </h2>
            <p className="cmc-lead">
              Two instant classroom pickers — no login, no setup, no downloads. Roll up to five 3D dice for warm-ups
              and quick math games, or spin a fair wheel of names to call on students randomly. Both tools run
              entirely in your browser; nothing you type is saved or sent anywhere.
            </p>
          </div>
          <div className="flex max-w-md items-start gap-3 border-l border-cyan-200/25 pl-4 text-xs leading-relaxed text-slate-400 lg:mb-1">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
            <p>
              <strong className="font-semibold text-slate-200">Two classroom pickers.</strong>
              <br />
              Dice rolls animate in 3D with full spins; the wheel uses real easing and snaps to a winner with a clear pointer. Add or remove names any time.
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* DICE CARD */}
          <article className="relative overflow-hidden rounded-2xl border border-cyan-200/25 bg-gradient-to-br from-cyan-400/[0.10] via-slate-900/90 to-sky-500/[0.08] p-6 shadow-[0_20px_60px_-45px_rgba(34,211,238,.65)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-200">
                  <Dice5 className="h-6 w-6" />
                </span>
                <div>
                  <span className="font-[var(--font-display)] text-xl font-bold tracking-tight text-white">3D Dice Roller</span>
                  <p className="mt-0.5 text-[10px] text-slate-500">1–5 dice · random rolls · totals</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-emerald-100 uppercase">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> Live
              </span>
            </div>
            <DiceRoller />
          </article>

          {/* WHEEL CARD */}
          <article className="relative overflow-hidden rounded-2xl border border-amber-200/25 bg-gradient-to-br from-amber-400/[0.10] via-slate-900/90 to-orange-500/[0.08] p-6 shadow-[0_20px_60px_-45px_rgba(251,191,36,.65)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/10 text-amber-200">
                  <RefreshCw className="h-6 w-6" />
                </span>
                <div>
                  <span className="font-[var(--font-display)] text-xl font-bold tracking-tight text-white">Wheel of Names</span>
                  <p className="mt-0.5 text-[10px] text-slate-500">Add names · spin to pick · fair rotation</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-amber-100 uppercase">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> Live
              </span>
            </div>
            <WheelSpinPicker />
          </article>
        </div>

        <p className="mt-5 flex items-start gap-2 text-[10px] leading-relaxed text-slate-600">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/60" aria-hidden="true" />
          <span>
            Both tools run 100% in your browser — no data leaves your device. Use the dice for warm-up math prompts,
            vocabulary roll challenges, or randomizing task counts. Use the wheel for fair cold-call participation,
            group assignment, or game-room pickers.
          </span>
        </p>
      </div>
    </section>
  );
}
