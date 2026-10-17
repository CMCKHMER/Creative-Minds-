import { ArrowUpRight, BookOpen, Headphones, Mic, PenLine, LockKeyhole, Clock3 } from 'lucide-react';

// TOEFL iBT mock test files ship in the same CMC repo's public/toefl-ibt/
// folder, so the URL is relative (./toefl-ibt/index.html). When deployed
// to https://cmckhmer.github.io/Creative-Minds-/toefl-ibt/index.html it
// loads the full 4-section mock test with audio + speaking recording.

const TOEFL_IBT_URL = './toefl-ibt/index.html';

const sections = [
  { label: 'Reading section', detail: 'Passages · multiple choice · ~60 min', icon: BookOpen, accent: 'cyan' },
  { label: 'Listening section', detail: 'Audio playback · 2 sets · ~40 min', icon: Headphones, accent: 'violet' },
  { label: 'Speaking section', detail: 'Microphone recording · 4 tasks', icon: Mic, accent: 'teal' },
  { label: 'Writing section', detail: 'Sentence building + free response', icon: PenLine, accent: 'sky' },
];

const accentMap = {
  cyan: { border: 'border-cyan-300/15', bg: 'bg-cyan-300/5', text: 'text-cyan-200' },
  violet: { border: 'border-violet-300/15', bg: 'bg-violet-300/5', text: 'text-violet-200' },
  teal: { border: 'border-teal-300/15', bg: 'bg-teal-300/5', text: 'text-teal-200' },
  sky: { border: 'border-sky-300/15', bg: 'bg-sky-300/5', text: 'text-sky-200' },
};

// Inline SVG preview thumbnail showing the 4 section icons arranged
// around a slate-950 background with cyan/violet radial gradient accents.
const previewSvg = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#020617'/>
        <stop offset='1' stop-color='#0f172a'/>
      </linearGradient>
      <radialGradient id='glow1' cx='0.2' cy='0.3' r='0.4'>
        <stop offset='0' stop-color='#38bdf8' stop-opacity='0.25'/>
        <stop offset='1' stop-color='#38bdf8' stop-opacity='0'/>
      </radialGradient>
      <radialGradient id='glow2' cx='0.8' cy='0.7' r='0.4'>
        <stop offset='0' stop-color='#8b5cf6' stop-opacity='0.22'/>
        <stop offset='1' stop-color='#8b5cf6' stop-opacity='0'/>
      </radialGradient>
    </defs>
    <rect width='400' height='240' fill='url(#bg)'/>
    <rect width='400' height='240' fill='url(#glow1)'/>
    <rect width='400' height='240' fill='url(#glow2)'/>
    <!-- TOEFL badge -->
    <rect x='20' y='22' width='78' height='20' rx='5' fill='rgba(56,189,248,0.18)' stroke='rgba(56,189,248,0.4)' stroke-width='0.6'/>
    <text x='59' y='36' font-family='monospace' font-weight='700' font-size='11' fill='#a5f3fc' text-anchor='middle' letter-spacing='1'>TOEFL iBT</text>
    <!-- Section tiles -->
    <g font-family='sans-serif' font-weight='700' font-size='11' fill='#f1f5f9'>
      <!-- Reading (top-left, cyan) -->
      <rect x='30' y='68' width='160' height='60' rx='10' fill='rgba(56,189,248,0.06)' stroke='rgba(56,189,248,0.35)' stroke-width='0.8'/>
      <text x='44' y='92' fill='#67e8f9' font-size='14'>📖</text>
      <text x='66' y='90'>Reading</text>
      <text x='66' y='106' font-size='9' font-weight='500' fill='#94a3b8'>Passages · 60 min</text>
      <!-- Listening (top-right, violet) -->
      <rect x='210' y='68' width='160' height='60' rx='10' fill='rgba(139,92,246,0.06)' stroke='rgba(139,92,246,0.35)' stroke-width='0.8'/>
      <text x='224' y='92' fill='#c4b5fd' font-size='14'>🎧</text>
      <text x='246' y='90'>Listening</text>
      <text x='246' y='106' font-size='9' font-weight='500' fill='#94a3b8'>Audio · 40 min</text>
      <!-- Speaking (bottom-left, teal) -->
      <rect x='30' y='142' width='160' height='60' rx='10' fill='rgba(94,234,212,0.06)' stroke='rgba(94,234,212,0.35)' stroke-width='0.8'/>
      <text x='44' y='166' fill='#5eead4' font-size='14'>🎤</text>
      <text x='66' y='164'>Speaking</text>
      <text x='66' y='180' font-size='9' font-weight='500' fill='#94a3b8'>Mic recording</text>
      <!-- Writing (bottom-right, sky) -->
      <rect x='210' y='142' width='160' height='60' rx='10' fill='rgba(125,211,252,0.06)' stroke='rgba(125,211,252,0.35)' stroke-width='0.8'/>
      <text x='224' y='166' fill='#7dd3fc' font-size='14'>✍️</text>
      <text x='246' y='164'>Writing</text>
      <text x='246' y='180' font-size='9' font-weight='500' fill='#94a3b8'>Sentence build</text>
    </g>
  </svg>
`)}`;

export function TOEFLiBTCard() {
  return (
    <section id="toefl-ibt-mock" aria-labelledby="toefl-ibt-title" className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-cyan-100/10 bg-[#07131f] py-20 sm:py-24 lg:py-28">
      {/* Full-bleed semi-transparent card background image */}
      <img src="./images/card-toefl-ibt.jpg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/55" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/[0.11] blur-[125px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] h-[35rem] w-[35rem] rounded-full bg-violet-500/[0.13] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_66%_45%,black,transparent_72%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_.86fr] lg:gap-16">
        <div>
          <span className="cmc-eyebrow"><span className="h-px w-8 bg-cyan-300" aria-hidden="true" />Full-length practice exam</span>
          <h2 id="toefl-ibt-title" className="cmc-h2">TOEFL iBT<br /><span className="cmc-gradient-text">Full Mock Test.</span></h2>
          <p className="cmc-lead">Run the complete four-section TOEFL iBT mock test in your browser — Reading, Listening, Speaking (with microphone recording), and Writing. Includes audio playback, a per-section timer, progress tracking, and a security-notice flow that simulates the real exam experience.</p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a href={TOEFL_IBT_URL} target="_blank" rel="noopener noreferrer" aria-label="Open TOEFL iBT full mock test in a new tab" className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-300 via-teal-200 to-violet-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_36px_-14px_rgba(45,212,191,.72)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-14px_rgba(45,212,191,.82)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
              Start the mock test <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><Clock3 className="h-3 w-3 text-cyan-300/70" aria-hidden="true" />Full test runs ~3 hours · opens in a new tab</span>
          </div>
          <a href={TOEFL_IBT_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-4 transition hover:text-cyan-100">cmckhmer.github.io/Creative-Minds-/toefl-ibt <ArrowUpRight className="h-3 w-3" aria-hidden="true" /></a>
          <p className="mt-4 flex max-w-xl items-start gap-2 text-[10px] leading-relaxed text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/70" aria-hidden="true" /><span>Test responses stay in your browser tab — nothing is submitted or saved to a server. Audio files (MP3s) load from the same CMC deploy.</span></p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-4 rounded-[1.8rem] bg-gradient-to-br from-cyan-300/10 via-violet-400/10 to-transparent blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1724]/90 p-5 shadow-[0_30px_80px_-42px_rgba(0,0,0,.95)] backdrop-blur-xl sm:p-6">
            {/* Preview image */}
            <div className="mb-5 overflow-hidden rounded-xl border border-white/8" aria-hidden="true">
              <img src={previewSvg} alt="" className="w-full h-auto" style={{ display: 'block' }} />
            </div>
            {/* Section list */}
            <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">Full mock test</p>
                  <p className="mt-0.5 text-sm font-bold text-white">Four TOEFL iBT sections</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-medium text-slate-400">
                <Clock3 className="h-3 w-3 text-cyan-200" aria-hidden="true" />~3 hr total
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
              <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-200/80" aria-hidden="true" />
              <span>Speaking section uses your browser's microphone API. Allow permission when prompted. Audio is processed locally and never uploaded.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
