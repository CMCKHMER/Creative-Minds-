import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Dice3, Dice5, Plus, RefreshCw, RotateCcw, Sparkles, X, Palette, ExternalLink, Layers, FileImage } from 'lucide-react';
import { trackDiceRoll, trackWheelSpin } from '../lib/analytics';
import { Reveal } from './Reveal';

/* =========================================================================
   3D DICE ROLLER — compact UI
   ========================================================================= */

const DICE_FACES: { pips: number[] }[] = [
  { pips: [4] },       // 1
  { pips: [0, 8] },    // 2
  { pips: [0, 4, 8] }, // 3
  { pips: [0, 2, 6, 8] }, // 4
  { pips: [0, 2, 4, 6, 8] }, // 5
  { pips: [0, 2, 4, 6, 8, 4] }, // 6
];

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
      className="absolute inset-0 rounded-lg border border-white/15"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.08), inset 3px 3px 8px rgba(255,255,255,0.5), inset -3px -3px 8px rgba(0,0,0,0.08)',
        backfaceVisibility: 'hidden',
      }}
    >
      <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-1.5">
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

function DiceCube({ value, rolling, size }: { value: number; rolling: boolean; size: number }) {
  const [transform, setTransform] = useState('rotateX(0deg) rotateY(0deg)');
  useEffect(() => {
    if (rolling) {
      const t = ROLL_TO[value];
      setTransform(`rotateX(${t.x}deg) rotateY(${t.y}deg)`);
    } else {
      const t = ROLL_TO[value];
      setTransform(t.final);
    }
  }, [value, rolling]);

  const half = size / 2;
  return (
    <div
      style={{ perspective: '600px', width: size, height: size, display: 'inline-block' }}
      aria-label={`Dice showing ${value}`}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform,
          transition: rolling ? 'transform 1.4s cubic-bezier(.22,.61,.36,1)' : 'transform 0.3s ease',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `rotateY(0deg) translateZ(${half}px)` }}><DiceFace value={1} /></div>
        <div style={{ position: 'absolute', inset: 0, transform: `rotateY(90deg) translateZ(${half}px)` }}><DiceFace value={4} /></div>
        <div style={{ position: 'absolute', inset: 0, transform: `rotateY(180deg) translateZ(${half}px)` }}><DiceFace value={3} /></div>
        <div style={{ position: 'absolute', inset: 0, transform: `rotateY(-90deg) translateZ(${half}px)` }}><DiceFace value={2} /></div>
        <div style={{ position: 'absolute', inset: 0, transform: `rotateX(90deg) translateZ(${half}px)` }}><DiceFace value={6} /></div>
        <div style={{ position: 'absolute', inset: 0, transform: `rotateX(-90deg) translateZ(${half}px)` }}><DiceFace value={5} /></div>
      </div>
    </div>
  );
}

function DiceRoller() {
  const [diceCount, setDiceCount] = useState(2);
  const [values, setValues] = useState<number[]>([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<{ sum: number; at: number }[]>([]);

  const roll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
    const newValues = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
    setValues(newValues);
    trackDiceRoll({
      diceCount,
      total: newValues.reduce((a, b) => a + b, 0),
      values: newValues,
    });
    setTimeout(() => {
      setRolling(false);
      setHistory((h) => [{ sum: newValues.reduce((a, b) => a + b, 0), at: Date.now() }, ...h].slice(0, 5));
    }, 1500);
  }, [diceCount, rolling]);

  const changeCount = (delta: number) => {
    if (rolling) return;
    setDiceCount((c) => Math.min(5, Math.max(1, c + delta)));
    setValues((v) => {
      const target = Math.min(5, Math.max(1, diceCount + delta));
      while (v.length < target) v.push(1);
      return v.slice(0, target);
    });
  };

  const total = values.slice(0, diceCount).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Dice + total — single compact row */}
      <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: diceCount }).map((_, i) => (
            <DiceCube key={i} value={values[i] ?? 1} rolling={rolling} size={56} />
          ))}
        </div>
        <div className="ml-auto flex flex-col items-end gap-0.5 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3.5 py-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-200">Total</span>
          <span className="font-mono text-2xl font-bold leading-none text-white">{total}</span>
        </div>
      </div>

      {/* Controls — compact row */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={roll}
          disabled={rolling}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-[0_6px_18px_-8px_rgba(45,212,191,.6)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        >
          {rolling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Dice3 className="h-3.5 w-3.5" />}
          {rolling ? 'Rolling…' : 'Roll'}
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1">
          <button
            type="button"
            onClick={() => changeCount(-1)}
            disabled={rolling || diceCount <= 1}
            className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            aria-label="Fewer dice"
          >
            <span className="text-sm font-bold leading-none">−</span>
          </button>
          <span className="min-w-[2.5rem] text-center text-[11px] font-semibold text-slate-200">{diceCount} {diceCount === 1 ? 'die' : 'dice'}</span>
          <button
            type="button"
            onClick={() => changeCount(1)}
            disabled={rolling || diceCount >= 5}
            className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            aria-label="More dice"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto text-[10px] text-slate-500">
            <span className="uppercase tracking-wider">Recent:</span>
            {history.map((h, i) => (
              <span key={h.at + '-' + i} className="font-mono font-semibold text-cyan-100">{h.sum}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   WHEEL SPIN PICKER — compact UI
   ========================================================================= */

const DEFAULT_NAMES = ['Anna', 'Ben', 'Cherry', 'David', 'Emma', 'Felix', 'Grace', 'Henry'];
const WHEEL_COLORS = [
  '#38bdf8', '#a78bfa', '#5eead4', '#fbbf24',
  '#f87171', '#a5b4fc', '#34d399', '#fb923c',
  '#22d3ee', '#c084fc', '#86efac', '#fde047',
];

function WheelSpinPicker({ size = 240 }: { size?: number }) {
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [input, setInput] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, i * sliceAngle + rotation, (i + 1) * sliceAngle + rotation);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const midAngle = i * sliceAngle + sliceAngle / 2 + rotation;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      ctx.fillText(names[i].slice(0, 12), radius - 10, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,23,42,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56,189,248,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [names, rotation, size]);

  const spin = useCallback(() => {
    if (spinning || names.length === 0) return;
    setWinner(null);
    setSpinning(true);
    const n = names.length;
    const sliceAngle = (Math.PI * 2) / n;
    const winnerIdx = Math.floor(Math.random() * n);
    trackWheelSpin({ namesCount: n, winner: names[winnerIdx] });
    const targetMid = winnerIdx * sliceAngle + sliceAngle / 2;
    const baseRotation = -Math.PI / 2 - targetMid;
    const fullSpins = Math.PI * 2 * (4 + Math.floor(Math.random() * 3));
    const finalRotation = baseRotation + fullSpins;
    const start = rotation;
    const end = finalRotation;
    const duration = 3800;
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
        setRotation(((end % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        setWinner(names[winnerIdx]);
        setHistory((h) => [names[winnerIdx], ...h].slice(0, 6));
        setSpinning(false);
      }
    };
    requestAnimationFrame(step);
  }, [spinning, names, rotation]);

  const addName = () => {
    const v = input.trim();
    if (!v || names.length >= 24) return;
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
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        {/* Wheel */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -5,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '18px solid #fbbf24',
              filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.4))',
              zIndex: 5,
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>

        {/* Controls panel — right side, compact */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addName(); }}
              placeholder="Add a name…"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={addName}
              disabled={spinning || names.length >= 24}
              className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-cyan-200 transition hover:bg-white/10 disabled:opacity-50"
              aria-label="Add name"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1 content-start max-h-[120px] overflow-y-auto pr-1">
            {names.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  borderColor: WHEEL_COLORS[i % WHEEL_COLORS.length] + '55',
                  background: WHEEL_COLORS[i % WHEEL_COLORS.length] + '15',
                  color: '#e2e8f0',
                }}
              >
                <span className="block h-1.5 w-1.5 rounded-full" style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} />
                {name}
                <button
                  type="button"
                  onClick={() => removeName(i)}
                  disabled={spinning}
                  aria-label={`Remove ${name}`}
                  className="text-slate-500 transition hover:text-rose-300 disabled:opacity-40"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={spin}
              disabled={spinning || names.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-amber-300 via-amber-200 to-orange-300 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-[0_6px_18px_-8px_rgba(251,191,36,.6)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            >
              {spinning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {spinning ? 'Spinning…' : 'Spin'}
            </button>
            <button
              type="button"
              onClick={resetToDefault}
              disabled={spinning}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            {winner && !spinning && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[11px] font-bold text-amber-100">
                <Sparkles className="h-3 w-3 text-amber-300" />
                {winner}
              </span>
            )}
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="uppercase tracking-wider">Recent:</span>
              {history.map((h, i) => (
                <span key={i} className="font-mono font-semibold text-amber-100">{h}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   SLIM HOMEPAGE TEASER CARD — replaces the inline section on the homepage.
   Clicking the "Open Teacher Tools" CTA routes to #teacher-tools (full page).
   ========================================================================= */

export function TeacherToolsCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section
      id="teacher-tools-card"
      aria-labelledby="teacher-tools-card-title"
      className="cmc-section scroll-mt-24 border-y border-white/10 bg-[#091725] py-16 sm:py-20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-13rem] -z-10 h-[32rem] w-[32rem] rounded-full bg-cyan-500/[0.10] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] -z-10 h-[32rem] w-[32rem] rounded-full bg-amber-500/[0.10] blur-[135px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 relative">
        <Reveal stagger className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          {/* Left: copy + CTA */}
          <div>
            <span className="cmc-eyebrow"><Dice5 className="h-3.5 w-3.5" aria-hidden="true" /> Quick Classroom Tools</span>
            <h2 id="teacher-tools-card-title" className="cmc-h2 mt-4">
              Pick a student.<br />
              <span className="cmc-gradient-text">Roll the dice.</span>
            </h2>
            <p className="cmc-lead">
              Two instant classroom pickers — a 3D dice roller (1–5 dice, animated rolls, totals, recent-roll history)
              and a fair Wheel of Names (up to 24 names, smooth easing, clear winner, recent-pick history). Plus
              <span className="text-violet-200"> Creative Minds Studio</span> — a full creative editor with layers,
              photo filters, page presets, Word + Excel modes, and PDF export. All three run entirely in your
              browser; nothing is saved or sent anywhere.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_36px_-14px_rgba(45,212,191,.72)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-14px_rgba(45,212,191,.82)]"
              >
                Open Teacher Tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-[11px] text-slate-500">No login · 100% in-browser · nothing saved</span>
            </div>
          </div>

          {/* Right: visual preview — static dice + wheel mockup */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-cyan-400/15 via-amber-400/10 to-transparent blur-2xl" aria-hidden="true" />
            <div className="relative rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {/* Dice preview tile */}
                <div className="rounded-xl border border-cyan-200/20 bg-gradient-to-br from-cyan-400/[0.08] via-slate-900/80 to-sky-500/[0.06] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-cyan-200/25 bg-cyan-200/10 text-cyan-200">
                      <Dice5 className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[11px] font-bold text-white">Dice Roller</span>
                  </div>
                  <div className="flex items-end gap-2">
                    {[5, 3, 6].map((v, i) => (
                      <div
                        key={i}
                        className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-gradient-to-br from-white to-slate-100 text-slate-900 shadow-md"
                        aria-hidden="true"
                      >
                        <div className="grid grid-cols-3 grid-rows-3 gap-0.5 p-1.5">
                          {DICE_FACES[v - 1].pips.slice(0, 6).map((p, j) => (
                            <span key={j} className="block h-1 w-1 rounded-full bg-slate-900" style={{ gridColumn: (p % 3) + 1, gridRow: Math.floor(p / 3) + 1 }} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">1–5 dice · totals</p>
                </div>

                {/* Wheel preview tile */}
                <div className="rounded-xl border border-amber-200/20 bg-gradient-to-br from-amber-400/[0.08] via-slate-900/80 to-orange-500/[0.06] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-amber-200/25 bg-amber-200/10 text-amber-200">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[11px] font-bold text-white">Wheel of Names</span>
                  </div>
                  <div
                    className="mx-auto h-16 w-16 rounded-full border-2 border-amber-300/40"
                    style={{
                      background: `conic-gradient(${WHEEL_COLORS.slice(0, 8).map((c, i) => `${c} ${i * 45}deg ${(i + 1) * 45}deg`).join(', ')})`,
                    }}
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-[10px] text-slate-400">Spin · pick</p>
                </div>

                {/* Studio preview tile */}
                <a
                  href="./studio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/studio rounded-xl border border-violet-200/25 bg-gradient-to-br from-violet-400/[0.10] via-slate-900/80 to-indigo-500/[0.06] p-4 transition hover:-translate-y-0.5 hover:border-violet-200/45"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-violet-200/25 bg-violet-200/10 text-violet-200">
                      <Palette className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[11px] font-bold text-white">CM Studio</span>
                  </div>
                  <div className="mx-auto grid h-16 place-items-center rounded-md border border-violet-300/30 bg-gradient-to-br from-violet-500/15 via-cyan-500/10 to-amber-500/10">
                    <Layers className="h-7 w-7 text-violet-200/80" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400 group-hover/studio:text-violet-100">Edit · layer · export PDF →</p>
                </a>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
                <Sparkles className="h-3 w-3 text-cyan-300/60" />
                Click "Open Teacher Tools" to launch the live dice + wheel. Click the Studio tile to open the full editor in a new tab.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* =========================================================================
   FULL TEACHER TOOLS PAGE — dedicated #teacher-tools route
   ========================================================================= */

export function TeacherToolsPage({ onBackHome }: { onBackHome: () => void }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070d17] text-slate-100">
      {/* Sticky top bar — matches LearningGamesPage */}
      <div className="sticky top-0 z-40 border-b border-white/8 bg-[#070d17]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="#teacher-tools" className="flex items-center gap-3" aria-label="Creative Minds Teacher Tools">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-amber-300 text-slate-950">
              <Dice5 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold tracking-tight text-white">
              Creative Minds <span className="text-cyan-200">Teacher Tools</span>
            </span>
          </a>
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to CMC
          </button>
        </div>
      </div>

      {/* Hero band */}
      <section className="relative isolate overflow-hidden border-b border-white/8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_72%_34%,rgba(34,211,238,.16),transparent_38%),radial-gradient(ellipse_at_16%_88%,rgba(251,191,36,.14),transparent_38%),linear-gradient(125deg,#091421,#0c1122_60%,#101326)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(90deg,black,transparent_90%)]"
        />
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.17em] text-cyan-100 uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> The CMC Teacher Tools room
            </span>
            <h1 className="mt-5 font-[var(--font-display)] text-4xl leading-[1.04] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Pick a student.<br />
              <span className="bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200 bg-clip-text text-transparent">Roll the dice. Create.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Three instant classroom tools — a 3D dice roller, a fair Wheel of Names, and Creative Minds Studio
              (a full creative editor with layers, filters, Word + Excel modes, and PDF export). All run entirely
              in your browser; nothing is saved or sent anywhere.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">1–5 dice</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">Up to 24 names</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">Layers + PDF export</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">No login required</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">100% in-browser</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tools — compact grid */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* DICE CARD — compact */}
          <article className="relative overflow-hidden rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-cyan-400/[0.08] via-slate-900/90 to-sky-500/[0.06] p-5 shadow-[0_16px_50px_-40px_rgba(34,211,238,.55)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-200">
                  <Dice5 className="h-4.5 w-4.5" />
                </span>
                <div>
                  <span className="font-[var(--font-display)] text-base font-bold tracking-tight text-white">3D Dice Roller</span>
                  <p className="text-[10px] text-slate-500">Roll · total · repeat</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-emerald-100 uppercase">
                <Sparkles className="h-2.5 w-2.5" /> Live
              </span>
            </div>
            <DiceRoller />
          </article>

          {/* WHEEL CARD — compact */}
          <article className="relative overflow-hidden rounded-2xl border border-amber-200/20 bg-gradient-to-br from-amber-400/[0.08] via-slate-900/90 to-orange-500/[0.06] p-5 shadow-[0_16px_50px_-40px_rgba(251,191,36,.55)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-amber-200/25 bg-amber-200/10 text-amber-200">
                  <RotateCcw className="h-4.5 w-4.5" />
                </span>
                <div>
                  <span className="font-[var(--font-display)] text-base font-bold tracking-tight text-white">Wheel of Names</span>
                  <p className="text-[10px] text-slate-500">Add · spin · pick</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-amber-100 uppercase">
                <Sparkles className="h-2.5 w-2.5" /> Live
              </span>
            </div>
            <WheelSpinPicker size={240} />
          </article>
        </div>

        {/* Creative Minds Studio — full creative editor (opens in new tab) */}
        <Reveal className="mt-6">
          <a
            href="./studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block overflow-hidden rounded-2xl border border-violet-200/25 bg-gradient-to-br from-violet-400/[0.08] via-slate-900/90 to-indigo-500/[0.06] transition hover:-translate-y-0.5 hover:border-violet-200/45"
          >
            {/* Showcase image */}
            <div className="relative aspect-[1344/500] w-full overflow-hidden">
              <img
                src="./images/teacher-tools/studio-card.png"
                alt="Creative Minds Studio — layers, blend modes, fonts, photo filters, Word + Excel modes, PDF export"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                decoding="async"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              {/* Badge */}
              <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-violet-200/30 bg-slate-950/80 px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-violet-200 uppercase backdrop-blur-sm">
                <Sparkles className="h-2.5 w-2.5" /> New
              </span>
            </div>

            {/* Content below image — tools & customization grid (no duplicate title) */}
            <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { icon: Layers, label: 'Layers + 16 blend modes', color: 'violet' },
                { icon: FileImage, label: 'PNG · JPG · SVG · PDF', color: 'cyan' },
                { icon: Palette, label: '14 fonts + letter spacing', color: 'amber' },
                { label: 'Word + Excel modes', color: 'emerald' },
                { label: 'Photo filters + grain', color: 'rose' },
                { label: 'Background removal', color: 'sky' },
                { label: 'Image move + resize', color: 'teal' },
                { label: 'Header + Footer', color: 'indigo' },
                { label: 'Page size presets', color: 'orange' },
                { label: 'Margins + guides', color: 'lime' },
                { label: 'Insert tables', color: 'pink' },
                { label: 'Link pasting', color: 'purple' },
              ].map((item, i) => {
              const Icon = item.icon;
              const colorMap: Record<string, string> = {
                violet: 'border-violet-200/20 bg-violet-200/[0.05] text-violet-100',
                cyan: 'border-cyan-200/20 bg-cyan-200/[0.05] text-cyan-100',
                amber: 'border-amber-200/20 bg-amber-200/[0.05] text-amber-100',
                emerald: 'border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-100',
                rose: 'border-rose-200/20 bg-rose-200/[0.05] text-rose-100',
                sky: 'border-sky-200/20 bg-sky-200/[0.05] text-sky-100',
                teal: 'border-teal-200/20 bg-teal-200/[0.05] text-teal-100',
                indigo: 'border-indigo-200/20 bg-indigo-200/[0.05] text-indigo-100',
                orange: 'border-orange-200/20 bg-orange-200/[0.05] text-orange-100',
                lime: 'border-lime-200/20 bg-lime-200/[0.05] text-lime-100',
                pink: 'border-pink-200/20 bg-pink-200/[0.05] text-pink-100',
                purple: 'border-purple-200/20 bg-purple-200/[0.05] text-purple-100',
              };
              return (
                <div key={i} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold ${colorMap[item.color] || colorMap.violet}`}>
                  {Icon && <Icon className="h-3 w-3" />}
                  {item.label}
                </div>
              );
              })}
            </div>

            {/* CTA */}
            <div className="flex items-center justify-center gap-2 p-4 border-t border-white/8">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-300 to-indigo-300 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-[0_8px_24px_-10px_rgba(139,92,246,.6)] transition group-hover:-translate-y-0.5">
                Open Studio <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </a>
        </Reveal>

        <p className="mt-6 flex items-start gap-2 text-[10px] leading-relaxed text-slate-600">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/60" aria-hidden="true" />
          <span>
            Both tools run 100% in your browser — no data leaves your device. Use the dice for warm-up math prompts,
            vocabulary roll challenges, or randomizing task counts. Use the wheel for fair cold-call participation,
            group assignment, or game-room pickers. Use Creative Minds Studio for worksheets, posters, slides,
            and photo editing — all without installing any software.
          </span>
        </p>
      </section>
    </main>
  );
}
