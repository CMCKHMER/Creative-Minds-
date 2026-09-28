import { ArrowUpRight, BarChart3, ClipboardCheck, FileText, FolderKanban, ListChecks, LockKeyhole, MessageSquareText } from 'lucide-react';

const ASSESSMENT_RECORDS_URL = 'https://cmckhmer.github.io/Student-Assesment-Records/';

const recordAreas = [
  { label: 'Reading & literacy', detail: 'Comprehension · vocabulary · accuracy', icon: FileText },
  { label: 'Listening & speaking', detail: 'Auditory comprehension · fluency · pronunciation', icon: MessageSquareText },
  { label: 'Project & quiz assessments', detail: 'Project work · term quiz scores', icon: FolderKanban },
  { label: 'Homework & participation', detail: 'Daily completion · classroom participation', icon: ClipboardCheck },
  { label: 'Overall student score', detail: 'Combined daily assessment view', icon: BarChart3 },
];

export function DailyAssessmentCard() {
  return (
    <section id="daily-assessment" aria-labelledby="daily-assessment-title" className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-cyan-100/10 bg-[#07131f] py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/[0.11] blur-[125px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] h-[35rem] w-[35rem] rounded-full bg-indigo-500/[0.13] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_66%_45%,black,transparent_72%)]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_.86fr] lg:gap-16">
        <div>
          <span className="cmc-eyebrow"><span className="h-px w-8 bg-cyan-300" aria-hidden="true" />CMC connected workspace</span>
          <h2 id="daily-assessment-title" className="cmc-h2">Daily Student<br /><span className="cmc-gradient-text">Assessment Records.</span></h2>
          <p className="cmc-lead">Continue into the existing CMC assessment workspace to review daily records across literacy, speaking, projects, quizzes, homework, participation, and overall progress.</p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a href={ASSESSMENT_RECORDS_URL} target="_blank" rel="noopener noreferrer" aria-label="Open Student Assessment Records in a new tab" className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_36px_-14px_rgba(45,212,191,.72)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-14px_rgba(45,212,191,.82)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">
              Open the assessment workspace <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <span className="text-[10px] text-slate-500">Opens in a new tab</span>
          </div>
          <a href={ASSESSMENT_RECORDS_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[10px] text-slate-500 underline decoration-slate-700 underline-offset-4 transition hover:text-cyan-100">cmckhmer.github.io/Student-Assesment-Records <ArrowUpRight className="h-3 w-3" aria-hidden="true" /></a>
          <p className="mt-4 flex max-w-xl items-start gap-2 text-[10px] leading-relaxed text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/70" aria-hidden="true" /><span>This is a separate service, outside the current site’s Supabase membership checks. Verify its access controls, storage, and privacy with that site’s administrator before entering student records.</span></p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-4 rounded-[1.8rem] bg-gradient-to-br from-cyan-300/10 via-indigo-400/10 to-transparent blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1724]/90 p-5 shadow-[0_30px_80px_-42px_rgba(0,0,0,.95)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200"><ClipboardCheck className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">Student assessment workspace</p><p className="mt-0.5 text-sm font-bold text-white">Daily record sections</p></div></div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-medium text-slate-400"><ListChecks className="h-3 w-3 text-cyan-200" aria-hidden="true" />Daily overview</span>
            </div>
            <div className="mt-5 space-y-2">
              {recordAreas.map(({ label, icon: Icon }, index) => (
                <div key={label} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.035]">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${index % 2 === 1 ? 'border-violet-300/15 bg-violet-300/5 text-violet-200' : 'border-cyan-300/15 bg-cyan-300/5 text-cyan-200'}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-slate-200">{label}</span><span className="mt-0.5 block text-[9px] text-slate-600">{recordAreas[index].detail}</span></span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2.5 border-t border-white/8 pt-4 text-[10px] leading-relaxed text-slate-500"><MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-200/80" aria-hidden="true" /><span>The linked workspace also includes student comments, teacher notes, and an overall score view.</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}