import { ArrowUpRight, BookOpen, CheckCircle2, Clock3, GraduationCap, Layers3, Sparkles } from 'lucide-react';
import { KID_GRADE_RESOURCES } from '../data/kidGradeResources';

export function KidGradeHub() {
  const availableResourceCount = KID_GRADE_RESOURCES.reduce((sum, grade) => sum + grade.materials.length, 0);

  return (
    <section id="kid-grades" aria-labelledby="kid-grade-hub-title" className="cmc-section scroll-mt-24 border-y border-white/10 bg-[#081522] py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-13rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-cyan-500/[0.10] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-indigo-500/[0.14] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_78%)]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="cmc-eyebrow"><GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Kid Program · Grades 5–12</span>
            <h2 id="kid-grade-hub-title" className="cmc-h2">A grade-by-grade home<br /><span className="cmc-gradient-text">for what comes next.</span></h2>
            <p className="cmc-lead">Build a clear path from Kid 5 through Kid 12. Kid 6 now has two Reading Future Connect 2 resources; Kid 11 has a Reading Future Create 3 dictation worksheet.</p>
          </div>
          <div className="flex max-w-md items-start gap-3 border-l border-cyan-200/25 pl-4 text-xs leading-relaxed text-slate-400 lg:mb-1">
            <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
            <p><strong className="font-semibold text-slate-200">One grade, one place.</strong><br />{availableResourceCount} existing worksheet links across two grade groups. New materials can be added as they are created.</p>
          </div>
        </header>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KID_GRADE_RESOURCES.map((resource) => {
            const isAvailable = resource.status === 'available' && resource.materials.length > 0;
            return (
              <article key={resource.grade} aria-label={isAvailable ? `Kid ${resource.grade}, ${resource.materials.length} resources available` : `Kid ${resource.grade}, materials planned`} className={`flex min-h-[190px] flex-col rounded-2xl border p-4 transition duration-300 sm:p-5 ${isAvailable ? 'relative overflow-hidden border-cyan-200/25 bg-gradient-to-br from-cyan-400/[0.10] via-slate-900/90 to-indigo-500/[0.08] shadow-[0_20px_60px_-45px_rgba(34,211,238,.65)] hover:-translate-y-1 hover:border-cyan-100/45 hover:shadow-[0_28px_70px_-42px_rgba(34,211,238,.6)]' : 'border-white/[0.07] bg-slate-950/30 hover:border-white/15 hover:bg-slate-950/55'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`font-[var(--font-display)] text-3xl font-bold tracking-tight ${isAvailable ? 'text-white' : 'text-slate-400'}`}>Kid {resource.grade}</span>
                  {isAvailable
                    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-emerald-100 uppercase"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />{resource.materials.length} resources</span>
                    : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase"><Clock3 className="h-3 w-3" aria-hidden="true" />Planned</span>}
                </div>

                {isAvailable ? (
                  <>
                    <div className="mt-4"><h3 className="text-sm font-semibold leading-snug text-cyan-50">{resource.grade === 6 ? 'Reading Future Connect 2' : 'Reading Future Create 3'}</h3><p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">Select an existing resource to open its worksheet page:</p></div>
                    <div className="mt-3 space-y-2">
                      {resource.materials.map((material) => (
                        <a key={material.id} href={material.href} target="_blank" rel="noopener noreferrer" aria-label={`Open Kid ${resource.grade}: ${material.title} in a new tab`} className="group/link flex items-start gap-2 rounded-lg border border-white/7 bg-slate-950/50 p-2.5 transition hover:border-cyan-200/25 hover:bg-cyan-200/[0.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
                          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200" aria-hidden="true" />
                          <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold leading-snug text-slate-200 group-hover/link:text-cyan-100">{material.title}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-500">{material.kind}{material.units ? ` · ${material.units} units` : ''}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-600">{material.description}</span></span>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200/75" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-4 min-h-[66px]"><h3 className="text-sm font-semibold leading-snug text-slate-300">Kid {resource.grade} learning materials</h3><p className="mt-2 text-[11px] leading-relaxed text-slate-500">Worksheets and created materials will be added here.</p></div>
                    <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-3"><span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-slate-500"><BookOpen className="h-3 w-3" aria-hidden="true" /> Collection space reserved</span><span className="text-[9px] font-semibold text-slate-600">Coming later</span></div>
                  </>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-5 flex items-start gap-2 text-[10px] leading-relaxed text-slate-600"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/60" aria-hidden="true" /><span>Kid 6 and Kid 11 links open separate Reading Future pages. Grades without linked material are intentionally marked planned; no placeholder worksheets are offered.</span></p>
      </div>
    </section>
  );
}