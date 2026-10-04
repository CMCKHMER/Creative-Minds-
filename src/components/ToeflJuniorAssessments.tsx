import { Suspense, lazy, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, CheckCircle2, Headphones, Mic2, PenLine, Volume2 } from 'lucide-react';
import { TOEFL_JUNIOR_ASSESSMENTS, type JuniorAssessment, type JuniorAssessmentSkill } from '../data/toeflJuniorAssessments';

// The full assessment text and its print/PDF/audio preview are only needed once a
// teacher clicks "Open assessment", so keep them out of the landing-page chunk.
const AssignmentPreview = lazy(() =>
  import('./AssignmentPreview').then((m) => ({ default: m.AssignmentPreview })),
);

const skillTabs: Array<{ id: 'All' | JuniorAssessmentSkill; label: string; icon: typeof BookOpen }> = [
  { id: 'All', label: 'All skills', icon: CheckCircle2 },
  { id: 'Speaking', label: 'Speaking', icon: Mic2 },
  { id: 'Listening', label: 'Listening', icon: Headphones },
  { id: 'Writing', label: 'Writing', icon: PenLine },
];

function skillTone(skill: JuniorAssessmentSkill) {
  if (skill === 'Speaking') return 'border-violet-300/20 bg-violet-300/5 text-violet-200';
  if (skill === 'Listening') return 'border-cyan-300/20 bg-cyan-300/5 text-cyan-200';
  return 'border-amber-200/20 bg-amber-200/5 text-amber-100';
}

function questionCount(assessment: JuniorAssessment) {
  return assessment.assignment.sections.reduce((sum, section) => sum + section.questions.length, 0);
}

export function ToeflJuniorAssessments() {
  const [activeSkill, setActiveSkill] = useState<'All' | JuniorAssessmentSkill>('All');
  const [selectedAssessment, setSelectedAssessment] = useState<JuniorAssessment | null>(null);

  // Derived lists are recomputed only when the filter changes instead of on every render.
  const assessments = useMemo(
    () => TOEFL_JUNIOR_ASSESSMENTS.filter((item) => activeSkill === 'All' || item.skill === activeSkill),
    [activeSkill],
  );
  const skillCounts = useMemo(() => {
    const counts: Record<JuniorAssessmentSkill, number[]> = { Speaking: [], Listening: [], Writing: [] };
    TOEFL_JUNIOR_ASSESSMENTS.forEach((item) => counts[item.skill].push(item.id));
    return counts;
  }, []);
  const speakingCount = skillCounts.Speaking.length;
  const listeningCount = skillCounts.Listening.length;
  const writingCount = skillCounts.Writing.length;

  return (
    <section id="toefl-junior-assessments" className="cmc-section relative scroll-mt-24 overflow-hidden border-t border-slate-800/80 bg-[#09131e] py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -right-48 top-4 h-[36rem] w-[36rem] rounded-full bg-indigo-500/[0.09] blur-[140px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-52 bottom-0 h-[30rem] w-[30rem] rounded-full bg-cyan-400/[0.07] blur-[130px]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#122337] via-[#0e1a2a] to-[#11142a] px-6 py-9 sm:px-10 sm:py-12 lg:px-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-cyan-300/10 blur-[90px]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:linear-gradient(90deg,black,transparent_90%)]" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.17em] text-cyan-100 uppercase"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> TOEFL Junior-style assessment studio</span>
            <h2 className="mt-5 max-w-3xl font-[var(--font-display)] text-3xl leading-tight font-bold tracking-tight text-white sm:text-5xl">Practice the voice, ear, and pen.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">Fifteen original classroom assessments: five speaking tasks, five listening sets, and five writing assignments. Each includes student prompts, teacher guidance, and a scoring rubric.</p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] text-slate-400">
              <span><strong className="font-mono text-violet-200">{speakingCount}</strong> speaking assessments</span>
              <span><strong className="font-mono text-cyan-200">{listeningCount}</strong> listening assessments</span>
              <span><strong className="font-mono text-amber-100">{writingCount}</strong> writing assessments</span>
            </div>
            <p className="mt-5 max-w-2xl text-[10px] leading-relaxed text-slate-500">All sets are original TOEFL Junior-style practice materials, not official TOEFL forms or ETS-endorsed content. Every listening set now includes a full audio player — play / replay, voice choice, 0.85×–1.05× speed, live sentence tracking, and a hidden-until-needed transcript. Audio is synthesized on-device, not professionally recorded.</p>
          </div>
        </header>

        <div className="mt-10 flex flex-col items-start justify-between gap-5 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">Assessment library</p>
            <h3 className="mt-1.5 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white">Choose a skill to practice.</h3>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60 p-1" role="tablist" aria-label="Filter by assessment skill">
            {skillTabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={activeSkill === id} onClick={() => setActiveSkill(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition sm:px-4 ${activeSkill === id ? 'bg-white/[0.09] text-white shadow-inner' : 'text-slate-400 hover:text-white'}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-x-7 gap-y-0 md:grid-cols-2 lg:grid-cols-3">
          {assessments.map((assessment) => (
            <article key={assessment.id} className="group flex flex-col border-b border-white/10 py-6 transition-colors hover:border-cyan-200/25">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold tracking-[0.12em] uppercase ${skillTone(assessment.skill)}`}>
                  {String(skillCounts[assessment.skill].indexOf(assessment.id) + 1).padStart(2, '0')} <span aria-hidden="true">/</span> {assessment.skill}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{assessment.assignment.duration}</span>
              </div>
              <h4 className="mt-4 font-[var(--font-display)] text-lg leading-snug font-bold text-white transition group-hover:text-cyan-100">{assessment.title}</h4>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">{assessment.summary}</p>
              <div className="mt-4 flex items-center gap-3 border-t border-white/8 pt-3 text-[10px] text-slate-500">
                <span>{questionCount(assessment)} prompts</span>
                <span aria-hidden="true">·</span>
                <span>Teacher key + rubric</span>
                {(assessment.skill === 'Speaking' || assessment.skill === 'Listening') && <span className="inline-flex items-center gap-1 text-teal-200/80"><Volume2 className="h-3 w-3" aria-hidden="true" /> Device voice</span>}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500">{assessment.assignment.gradeBand}</span>
                <button type="button" onClick={() => setSelectedAssessment(assessment)} className="group/button inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-[10px] font-semibold text-slate-200 transition hover:border-cyan-200/35 hover:bg-cyan-200/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                  Open assessment <ArrowRight className="h-3 w-3 transition-transform group-hover/button:translate-x-0.5" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-[10px] leading-relaxed text-slate-500"><ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" /><p>Open any set to preview its student copy and teacher guide separately. Listening transcripts appear only in the teacher key. Use Print / save PDF for a browser-generated paper copy.</p></div>
      </div>

      {selectedAssessment && (
        <Suspense fallback={null}>
          <AssignmentPreview assignment={selectedAssessment.assignment} onClose={() => setSelectedAssessment(null)} />
        </Suspense>
      )}
    </section>
  );
}