import { ArrowUpRight, CalendarCheck, Clock3, FileText, GraduationCap, LockKeyhole } from 'lucide-react';
import { useSignedInSession } from '../hooks/useSignedInSession';

const PLANNER_URL = './biweek-planner/';

const sections = [
  { label: 'Week 2 · Diagnostic', detail: 'Orientation + Grammar + Listening + Structure', icon: FileText, accent: 'teal' },
  { label: 'Week 3 · Listening', detail: 'Prediction, Inference, Short Conversations', icon: GraduationCap, accent: 'cyan' },
  { label: 'Week 4-7 · Drills', detail: 'Reading, Structure, Listening practice drills', icon: Clock3, accent: 'violet' },
  { label: 'Week 8 · Mock Test', detail: 'Full 30-question TOEFL mock with audio', icon: CalendarCheck, accent: 'amber' },
];

const accentMap = {
  teal: { border: 'border-teal-300/15', bg: 'bg-teal-300/5', text: 'text-teal-200' },
  cyan: { border: 'border-cyan-300/15', bg: 'bg-cyan-300/5', text: 'text-cyan-200' },
  violet: { border: 'border-violet-300/15', bg: 'bg-violet-300/5', text: 'text-violet-200' },
  amber: { border: 'border-amber-300/15', bg: 'bg-amber-300/5', text: 'text-amber-200' },
};

const previewSvg = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#020617'/>
        <stop offset='1' stop-color='#0f172a'/>
      </linearGradient>
      <radialGradient id='glow1' cx='0.2' cy='0.3' r='0.4'>
        <stop offset='0' stop-color='#38bdf8' stop-opacity='0.15'/>
        <stop offset='1' stop-color='#38bdf8' stop-opacity='0'/>
      </radialGradient>
      <radialGradient id='glow2' cx='0.8' cy='0.7' r='0.4'>
        <stop offset='0' stop-color='#a78bfa' stop-opacity='0.15'/>
        <stop offset='1' stop-color='#a78bfa' stop-opacity='0'/>
      </radialGradient>
    </defs>
    <rect width='400' height='240' fill='url(#bg)'/>
    <rect width='400' height='240' fill='url(#glow1)'/>
    <rect width='400' height='240' fill='url(#glow2)'/>
    <rect x='20' y='22' width='100' height='20' rx='5' fill='rgba(56,189,248,0.18)' stroke='rgba(56,189,248,0.4)' stroke-width='0.6'/>
    <text x='70' y='36' font-family='monospace' font-weight='700' font-size='11' fill='#a5f3fc' text-anchor='middle'>8-WEEK PLAN</text>
    <g font-family='sans-serif' font-weight='700' font-size='11' fill='#f1f5f9'>
      <rect x='30' y='64' width='160' height='36' rx='8' fill='rgba(94,234,212,0.06)' stroke='rgba(94,234,212,0.3)' stroke-width='0.8'/>
      <text x='40' y='78' fill='#5eead4' font-size='9' font-weight='600'>WEEK 2</text>
      <text x='40' y='92'>Orientation Diagnostic</text>
      <rect x='210' y='64' width='160' height='36' rx='8' fill='rgba(56,189,248,0.06)' stroke='rgba(56,189,248,0.3)' stroke-width='0.8'/>
      <text x='220' y='78' fill='#67e8f9' font-size='9' font-weight='600'>WEEK 3</text>
      <text x='220' y='92'>Listening Drills</text>
      <rect x='30' y='110' width='160' height='36' rx='8' fill='rgba(139,92,246,0.06)' stroke='rgba(139,92,246,0.3)' stroke-width='0.8'/>
      <text x='40' y='124' fill='#c4b5fd' font-size='9' font-weight='600'>WEEK 5-7</text>
      <text x='40' y='138'>Reading + Structure</text>
      <rect x='210' y='110' width='160' height='36' rx='8' fill='rgba(251,191,36,0.06)' stroke='rgba(251,191,36,0.3)' stroke-width='0.8'/>
      <text x='220' y='124' fill='#fbbf24' font-size='9' font-weight='600'>WEEK 8</text>
      <text x='220' y='138'>Full Mock Test</text>
    </g>
    <g font-family='monospace' font-size='9' fill='#64748b' opacity='0.6'>
      <text x='30' y='170'>146 questions</text>
      <text x='130' y='170'>3 audio files</text>
      <text x='220' y='170'>15 test pages</text>
    </g>
  </svg>
`)}`;

/**
 * TOEFL ITP Bi-Weekly Planner — teacher-account-only.
 *
 * The section shell (background image + glows) always renders so the
 * homepage layout never shifts, but the planner content (8-week plan,
 * "Open the planner" link, preview card) only renders for signed-in
 * teachers — same pattern as TeacherChat. Signed-out visitors and
 * students see a locked "Teacher access required" prompt.
 *
 * The standalone planner hub (public/biweek-planner/) is gated separately
 * by public/biweek-planner/teacher-gate.js; the individual drill pages
 * under tests/ stay open so teachers can keep sharing single-drill links
 * with students directly.
 */
export function BiWeekPlannerCard({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const session = useSignedInSession();
  const isTeacher = session?.role === 'teacher';

  return (
    <section id="toefl-itp-planner" aria-labelledby="biweek-title" className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-violet-100/10 bg-[#0a0f1f] py-20 sm:py-24 lg:py-28">
      {/* Full-bleed semi-transparent card background image */}
      <img src="./images/card-biweek-planner.jpg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/55" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-400/[0.11] blur-[125px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] h-[35rem] w-[35rem] rounded-full bg-cyan-400/[0.10] blur-[135px]" />

      {isTeacher ? (
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_.86fr] lg:gap-16">
        <div>
          <span className="cmc-eyebrow"><span className="h-px w-8 bg-violet-300" aria-hidden="true" />8-Week Study Plan</span>
          <h2 id="biweek-title" className="cmc-h2">TOEFL ITP<br /><span className="cmc-gradient-text">Bi-Weekly Planner.</span></h2>
          <p className="cmc-lead">A structured 8-week preparation plan covering all three TOEFL ITP sections — Listening, Structure & Written Expression, and Reading. Each week includes practice drills with timers, auto-scoring, and individual shareable links. Teacher-made materials from Oxford Skills World and Reading Explorer.</p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a href={PLANNER_URL} target="_blank" rel="noopener noreferrer" aria-label="Open the TOEFL ITP Bi-Weekly Planner in a new tab" className="cmc-btn-3d cmc-btn-3d--violet group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-bold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200">
              Open the planner <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><Clock3 className="h-3 w-3 text-violet-300/70" aria-hidden="true" />15 test pages · 146 questions · 3 audio passages</span>
          </div>
          <a href={PLANNER_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-4 transition hover:text-violet-100">cmckhmer.github.io/Creative-Minds-/biweek-planner <ArrowUpRight className="h-3 w-3" aria-hidden="true" /></a>
          <p className="mt-4 flex max-w-xl items-start gap-2 text-[10px] leading-relaxed text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300/70" aria-hidden="true" /><span>Test answers stay in your browser tab — nothing is submitted or saved to a server. Audio files (MP3s) load from the same CMC deploy.</span></p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-4 rounded-[1.8rem] bg-gradient-to-br from-violet-300/10 via-cyan-400/10 to-transparent blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1724]/90 p-5 shadow-[0_30px_80px_-42px_rgba(0,0,0,.95)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 overflow-hidden rounded-xl border border-white/8" aria-hidden="true">
              <img src={previewSvg} alt="" className="w-full h-auto" style={{ display: 'block' }} />
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-300/5 text-violet-200">
                  <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">8-Week Plan</p>
                  <p className="mt-0.5 text-sm font-bold text-white">Weekly study schedule</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-medium text-slate-400">
                <Clock3 className="h-3 w-3 text-violet-200" aria-hidden="true" />146 questions
              </span>
            </div>
            <div className="mt-5 space-y-2">
              {sections.map(({ label, icon: Icon, accent }) => {
                const cls = accentMap[accent as keyof typeof accentMap];
                return (
                  <div key={label} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.035]">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${cls.border} ${cls.bg} ${cls.text}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-200">{label}</span>
                      <span className="mt-0.5 block text-[9px] text-slate-600">{sections.find(s => s.label === label)?.detail}</span>
                    </span>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" aria-hidden="true" />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-start gap-2.5 border-t border-white/8 pt-4 text-[10px] leading-relaxed text-slate-500">
              <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200/80" aria-hidden="true" />
              <span>Materials from Oxford Skills World, Reading Explorer, Q:Skills, and World Class. Each test has its own shareable link — send individual drills to students directly.</span>
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="relative mx-auto max-w-2xl px-5 sm:px-8">
          <div className="rounded-2xl border border-amber-200/15 bg-amber-100/[0.03] p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] text-amber-200">
              <LockKeyhole className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-5 text-sm font-semibold text-white">Teacher access required</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
              The 8-week TOEFL ITP Bi-Weekly Planner is reserved for Creative Minds teacher accounts. Sign in with a work email containing &quot;edu&quot; (e.g., you@school.edu.kh) to unlock the full weekly schedule, drills, and mock test links.
            </p>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="cmc-btn-3d cmc-btn-3d--violet mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                Sign in as teacher
              </button>
            )}
            <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
              Students don&apos;t need an account — individual drill links shared by your teacher stay open as usual.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
