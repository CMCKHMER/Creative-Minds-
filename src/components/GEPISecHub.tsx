import { ArrowUpRight, BookOpen, CheckCircle2, Clock3, GraduationCap, Layers3, Sparkles, Headphones, PenLine, BookMarked } from 'lucide-react';
import { Reveal } from './Reveal';

interface Program {
  id: string;
  name: string;
  level: string;
  description: string;
  status: 'available' | 'planned';
  resources: { title: string; href: string; kind: string; description: string; icon: typeof BookOpen }[];
  color: string;
  bgColor: string;
  borderColor: string;
}

const PROGRAMS: Program[] = [
  {
    id: 'gep',
    name: 'GEP Program',
    level: 'General English Program · All Levels',
    description: 'General English Program resources covering listening, speaking, reading, and writing across multiple proficiency levels. Worksheet and audio materials will be linked as they are created.',
    status: 'planned',
    color: 'cyan',
    bgColor: 'from-cyan-400/[0.10] via-slate-900/90 to-sky-500/[0.08]',
    borderColor: 'border-cyan-200/25',
    resources: [],
  },
  {
    id: 'isec',
    name: 'ISEC Program',
    level: 'Intensive English Course · L12B',
    description: 'Intensive English Course materials for Level 12B students. Includes TOEFL drills, grammar exercises, listening practice with audio, and C2-level reading comprehension.',
    status: 'available',
    color: 'violet',
    bgColor: 'from-violet-400/[0.10] via-slate-900/90 to-indigo-500/[0.08]',
    borderColor: 'border-violet-200/25',
    resources: [
      {
        title: 'TOEFL ITP Bi-Weekly Planner',
        href: 'https://cmckhmer.github.io/Creative-Minds-/biweek-planner/',
        kind: '8-week study plan',
        description: '21 test pages, 192 questions, 6 audio files. Listening, Structure, and Reading drills.',
        icon: GraduationCap,
      },
      {
        title: 'Business Listening (B2 + C2)',
        href: 'https://cmckhmer.github.io/Creative-Minds-/biweek-planner/tests/isec2-w2-listening.html',
        kind: 'Listening drill',
        description: 'Business interview + job interview, 12 questions with audio.',
        icon: Headphones,
      },
      {
        title: 'C2 Grammar: Advanced Modals',
        href: 'https://cmckhmer.github.io/Creative-Minds-/biweek-planner/tests/isec2-w6-grammar.html',
        kind: 'Grammar drill',
        description: '15 questions on conditionals, modals, and subjunctive structures.',
        icon: PenLine,
      },
      {
        title: 'C2 Reading: The Algorithmic Enterprise',
        href: 'https://cmckhmer.github.io/Creative-Minds-/biweek-planner/tests/isec2-w7-reading.html',
        kind: 'Reading drill',
        description: '5 analytical questions on argument evaluation and bias detection.',
        icon: BookOpen,
      },
    ],
  },
];

export function GEPISecHub() {
  return (
    <section id="gep-isec" aria-labelledby="gep-isec-hub-title" className="cmc-section scroll-mt-24 border-y border-white/10 bg-[#0a1a2c] py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-13rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-cyan-500/[0.10] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-violet-500/[0.14] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_78%)]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 relative">
        <Reveal>
        <header className="grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="cmc-eyebrow"><Layers3 className="h-3.5 w-3.5" aria-hidden="true" /> Academic Programs</span>
            <h2 id="gep-isec-hub-title" className="cmc-h2">GEP & ISEC<br /><span className="cmc-gradient-text">Program Resources.</span></h2>
            <p className="cmc-lead">General English Program (GEP) and Intensive English Course (ISEC) materials for older learners — TOEFL drills, C2-level grammar, listening with audio, and analytical reading. For Kid 5–12 materials, see the section above.</p>
          </div>
          <div className="flex max-w-md items-start gap-3 border-l border-cyan-200/25 pl-4 text-xs leading-relaxed text-slate-400 lg:mb-1">
            <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
            <p><strong className="font-semibold text-slate-200">Two programs, one hub.</strong><br />4 ISEC resources linked so far. GEP worksheet pages will be added as they are built.</p>
          </div>
        </header>
        </Reveal>

        <Reveal stagger className="mt-10 grid gap-5 lg:grid-cols-2">
          {PROGRAMS.map((program) => {
            const isAvailable = program.status === 'available' && program.resources.length > 0;
            return (
              <article key={program.id} aria-label={`${program.name} — ${program.resources.length} resources`} className={`flex flex-col rounded-2xl border p-5 transition duration-300 sm:p-6 ${isAvailable ? `relative overflow-hidden border ${program.borderColor} bg-gradient-to-br ${program.bgColor} shadow-[0_20px_60px_-45px_rgba(34,211,238,.65)] hover:-translate-y-1 hover:border-opacity-50 hover:shadow-[0_28px_70px_-42px_rgba(34,211,238,.6)]` : 'border-white/[0.07] bg-slate-950/30 hover:border-white/15 hover:bg-slate-950/55'}`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-xl border" style={{ borderColor: program.color === 'cyan' ? 'rgba(34,211,238,0.25)' : 'rgba(139,92,246,0.25)', background: program.color === 'cyan' ? 'rgba(34,211,238,0.08)' : 'rgba(139,92,246,0.08)' }}>
                      {program.color === 'cyan' ? <BookMarked className="h-6 w-6 text-cyan-200" /> : <Layers3 className="h-6 w-6 text-violet-200" />}
                    </span>
                    <div>
                      <span className={`font-[var(--font-display)] text-2xl font-bold tracking-tight ${isAvailable ? 'text-white' : 'text-slate-400'}`}>{program.name}</span>
                      <p className="mt-0.5 text-[10px] text-slate-500">{program.level}</p>
                    </div>
                  </div>
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-emerald-100 uppercase">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />{program.resources.length} resources
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />Planned
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-slate-400 mb-4">{program.description}</p>

                {isAvailable ? (
                  <div className="mt-auto space-y-2">
                    {program.resources.map((resource, idx) => {
                      const Icon = resource.icon;
                      return (
                        <a key={idx} href={resource.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${resource.title} in a new tab`} className="group/link flex items-start gap-2.5 rounded-lg border border-white/7 bg-slate-950/50 p-3 transition hover:border-violet-200/25 hover:bg-violet-200/[0.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-200" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold leading-snug text-slate-200 group-hover/link:text-violet-100">{resource.title}</span>
                            <span className="mt-1 block text-[9px] leading-relaxed text-slate-500">{resource.kind}</span>
                            <span className="mt-0.5 block text-[9px] leading-relaxed text-slate-600">{resource.description}</span>
                          </span>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-200/75" aria-hidden="true" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-auto flex items-center justify-between border-t border-white/8 pt-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Worksheet pages coming soon
                    </span>
                    <span className="text-[9px] font-semibold text-slate-600">Planned</span>
                  </div>
                )}
              </article>
            );
          })}
        </Reveal>

        <Reveal className="mt-5">
        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-600"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300/60" aria-hidden="true" /><span>ISEC resources link to the Bi-Weekly Planner test pages on the CMC site. GEP worksheet pages are being prepared and will be linked here as they go live. For younger learners (Kid 5–12), see the Kid Program section above.</span></p>
        </Reveal>
      </div>
    </section>
  );
}
