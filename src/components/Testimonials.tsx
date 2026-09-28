import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Compass, Lightbulb } from 'lucide-react';

const practicePrinciples = [
  {
    number: '01',
    title: 'An assignment with a clear purpose',
    copy: 'Each downloadable pack names the skill students are practicing and offers a printable student version.',
    icon: BookOpen,
  },
  {
    number: '02',
    title: 'An explanation, not only an answer',
    copy: 'The separate teacher copy includes suggested responses and reasoning to support review and discussion.',
    icon: Lightbulb,
  },
  {
    number: '03',
    title: 'Feedback designed for practice',
    copy: 'The mini mock explains each multiple-choice answer. Results are illustrative practice feedback, not a placement or official score.',
    icon: Compass,
  },
];

export const Testimonials: React.FC = () => {
  return (
    <section aria-labelledby="practice-principles-title" className="cmc-section relative scroll-mt-24 overflow-hidden border-t border-slate-800/80 bg-slate-900/30 py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full bg-cyan-500/[0.08] blur-[130px]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-300/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.17em] text-cyan-200 uppercase"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> What is available</span>
            <h2 id="practice-principles-title" className="mt-5 font-[var(--font-display)] text-3xl leading-tight font-bold tracking-tight text-white sm:text-5xl">Useful practice, explained clearly.</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-400">Rather than publish unverified review quotes or school results, here is exactly what teachers can preview and use in this build.</p>
            <a href="#resources" className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white">Browse the assignment library <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></a>
          </div>

          <div className="divide-y divide-white/10 border-y border-white/10">
            {practicePrinciples.map(({ number, title, copy, icon: Icon }) => (
              <article key={number} className="group grid gap-4 py-6 sm:grid-cols-[3rem_1fr] sm:gap-5">
                <span className="font-mono text-sm font-semibold text-cyan-300/75">{number}</span>
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-teal-200 transition group-hover:border-teal-200/30 group-hover:bg-teal-200/5"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <div><h3 className="text-base font-semibold text-white">{title}</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">{copy}</p></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};