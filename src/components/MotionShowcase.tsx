// Motion showcase — the one page where every shipped button behaviour is
// visible without a login, a teacher account or a specific modal.
//
// Reachable at /?motion=demo (see main.tsx). It uses the REAL classes and the
// REAL components (BusyButton, useMagneticTilt, useIdleNudge), so what you see
// here is exactly what the app does elsewhere — just collected in one place.
import { useEffect, useRef, useState } from 'react';
import { BusyButton } from './BusyButton';
import { useIdleNudge } from '../hooks/useIdleNudge';
import { useMagneticTilt } from '../hooks/useMagneticTilt';

function Card({
  n,
  title,
  where,
  children,
  how,
}: {
  n: string;
  title: string;
  where: string;
  how: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-300/15 text-[11px] font-bold text-cyan-200">{n}</span>
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{where}</p>
      <p className="mt-1 text-[11px] font-semibold leading-relaxed text-cyan-200/90">{how}</p>
      <div className="mt-4 grid min-h-[120px] place-items-center rounded-xl border border-dashed border-white/10 bg-slate-950/50 p-4">
        {children}
      </div>
    </section>
  );
}

/** A short simulated grading run so the busy state can be felt on demand. */
function BusyDemo() {
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const [done, setDone] = useState(0);
  const total = 12;
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const run = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setState('working');
    setDone(0);
    for (let i = 1; i <= total; i += 1) {
      timers.current.push(window.setTimeout(() => setDone(i), i * 170));
    }
    timers.current.push(window.setTimeout(() => setState('done'), total * 170 + 200));
    timers.current.push(window.setTimeout(() => { setState('idle'); setDone(0); }, total * 170 + 3200));
  };

  return (
    <div className="grid justify-items-center gap-3">
      <BusyButton
        state={state}
        stamp
        idleLabel="Grade 12 answers"
        workingLabel={`Grading ${Math.min(done + 1, total)} of ${total}…`}
        doneLabel="12 graded · 9 correct"
        progress={done / total}
        onClick={run}
        className="rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-950"
      />
      <span className="text-[10px] text-slate-500">simulated — the real one writes 14 classes in the assessment workspace</span>
    </div>
  );
}

function TiltDemo() {
  const ref = useMagneticTilt<HTMLButtonElement>();
  return (
    <div className="grid justify-items-center gap-2">
      <button ref={ref} type="button" className="cmc-btn-primary cmc-tilt">
        Explore teacher tools
        <span aria-hidden="true">↗</span>
      </button>
      <span className="text-[10px] text-slate-500">move a mouse across it — a phone cannot show this one</span>
    </div>
  );
}

function NudgeDemo() {
  const ref = useIdleNudge<HTMLButtonElement>(4000);
  return (
    <div className="grid justify-items-center gap-2 pt-6">
      <button ref={ref} type="button" className="cmc-nudge cmc-press relative rounded-lg border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-[11px] font-semibold text-violet-100">
        💡 Find my score
        <span className="cmc-nudge__bubble" aria-hidden="true">The name you wrote on the homework</span>
      </button>
      <span className="text-[10px] text-slate-500">wait 4s without touching it (6s in the app)</span>
    </div>
  );
}

export function MotionShowcase() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-300 uppercase">Motion system · internal</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">The five button behaviours, in one place</h1>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
        Everything here is the real thing — the same classes and components the site uses. Each card says where the
        same effect lives in the actual product, so you can check it there afterwards.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card
          n="1"
          title="Press depth"
          where="Every primary/3D/ghost button on the site, plus anything with .cmc-press."
          how="Press and hold — it sinks 2-3px and the edge collapses."
        >
          <button type="button" className="cmc-press rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-xs font-bold text-cyan-100">
            Press me
          </button>
        </Card>

        <Card
          n="2"
          title="Busy / progress"
          where="Assessment → Kid 5–11 classes → the “Create N classes” button (teacher account)."
          how="Tap it: the label becomes the progress read-out and the bar fills."
        >
          <BusyDemo />
        </Card>

        <Card
          n="3"
          title="Success stamp"
          where="The same class-creation button, when the last class is written."
          how="Bundled into #2: the tick stamps in with a halo, then the dialog closes."
        >
          <span className="text-[11px] text-slate-400">See #2 finish — the stamp is its “done” state.</span>
        </Card>

        <Card
          n="4"
          title="Idle nudge"
          where="“My score” sheet → the “Find my score” button (student, no login needed)."
          how="Wait without touching it; it breathes once and shows the hint."
        >
          <NudgeDemo />
        </Card>

        <Card
          n="5"
          title="Magnetic tilt"
          where="The home hero → “Explore teacher tools”. Exactly one per page."
          how="Hover with a mouse: up to 8° of tilt, and the glare follows the cursor."
        >
          <TiltDemo />
        </Card>

        <Card
          n="—"
          title="Not built yet"
          where="Unfold (button grows into the answer-key panel)."
          how="Only in the design lab — needs an accessible disclosure component."
        >
          <span className="text-[11px] text-slate-500">Planned, not shipped.</span>
        </Card>
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-500">
        If an effect looks dead here: check <span className="text-slate-300">prefers-reduced-motion</span> (the system
        setting turns all of them off by design), and remember hover effects need a mouse. Source and rules live in
        <code className="mx-1 rounded bg-white/10 px-1">src/motion.css</code> and
        <code className="mx-1 rounded bg-white/10 px-1">docs/button-motion.md</code> —{' '}
        <a href="./" className="text-cyan-300 underline underline-offset-2">back to the site</a>.
      </p>
    </main>
  );
}

export default MotionShowcase;
