import React from 'react';
import { ArrowRight, Check, CircleHelp, Minus } from 'lucide-react';

interface ComparisonTableProps {
  onOpenTeacherPass: () => void;
}

const currentPreview = [
  { feature: 'Classroom-ready assignments', detail: 'Six original packs, each with a printable student copy and a separate teacher key.' },
  { feature: 'Member mini mock', detail: 'Eight original reading, listening, and language-use questions with a timer and explanations.' },
  { feature: 'Workload estimator', detail: 'A transparent calculator based on the assumptions entered by the teacher.' },
  { feature: 'Contact capture', detail: 'Teacher-interest requests and optional newsletter opt-in with explicit consent.' },
];

const notEnabled = [
  'Automatic AI scoring or official TOEFL/CEFR results',
  'OCR uploads, generated worksheets, or downloadable bank exports',
  'Google Classroom, Canvas, Microsoft, or district integrations',
  'Paid checkout, subscriptions, and published school-license terms',
];

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ onOpenTeacherPass }) => {
  return (
    <section aria-labelledby="product-status-title" className="cmc-section relative scroll-mt-24 bg-slate-950 py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] text-cyan-200 uppercase"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Honest product status</span>
          <h2 id="product-status-title" className="font-[var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">See what is live in this preview.</h2>
          <p className="text-sm leading-relaxed text-slate-400 sm:text-base">A clear boundary between working classroom materials and features that still need product development or third-party setup.</p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <div className="grid gap-px bg-white/8 md:grid-cols-2">
            <div className="bg-[#0d1a25] p-5 sm:p-7">
              <h3 className="text-[10px] font-bold tracking-[0.16em] text-teal-200 uppercase">Included in the current build</h3>
              <ul className="mt-5 space-y-4">
                {currentPreview.map((item) => <li key={item.feature} className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" /><span><strong className="block text-sm font-semibold text-slate-100">{item.feature}</strong><span className="mt-1 block text-xs leading-relaxed text-slate-400">{item.detail}</span></span></li>)}
              </ul>
            </div>
            <div className="bg-[#10151f] p-5 sm:p-7">
              <h3 className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">Not enabled yet</h3>
              <ul className="mt-5 space-y-4">
                {notEnabled.map((item) => <li key={item} className="flex items-start gap-3"><Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" /><span className="text-sm leading-relaxed text-slate-500">{item}</span></li>)}
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-start justify-between gap-4 border-t border-white/8 p-5 sm:flex-row sm:items-center sm:px-7">
            <p className="max-w-2xl text-xs leading-relaxed text-slate-500">Member access requires the deployed Supabase project and an email-verified, active account. The preview does not process student answers on a server.</p>
            <button type="button" onClick={onOpenTeacherPass} className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-200/20 px-4 py-2.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-200/5">Create member account <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </section>
  );
};