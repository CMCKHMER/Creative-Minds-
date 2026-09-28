import React from 'react';
import { ArrowRight, Check, CircleHelp, Minus } from 'lucide-react';

interface PricingProps {
  onOpenTeacherPass: () => void;
}

const availableNow = [
  'Free, email-verified member account after Supabase setup',
  'Member-only timed practice set with answer explanations',
  'Six original assignment packs with separate teacher keys',
  'Browser print dialog for saving printable PDF copies',
];

const notEnabled = [
  'Paid plans, checkout, and recurring billing',
  'LMS integrations or school rostering',
  'OCR worksheet uploads or AI lesson generation',
  'AI grading, official scores, or assessment analytics',
];

export const Pricing: React.FC<PricingProps> = ({ onOpenTeacherPass }) => {
  return (
    <section id="pricing" className="cmc-section relative scroll-mt-24 border-t border-slate-800/80 bg-slate-950 py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-cyan-200 uppercase"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Pricing status</span>
          <h2 className="mt-5 font-[var(--font-display)] text-3xl font-bold tracking-tight text-white sm:text-5xl">A clear preview, with no pretend plans.</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">There is no paid subscription or checkout in this build. The available member account and classroom materials are free to explore once the live Supabase project is configured.</p>
        </div>

        <div className="mt-12 grid gap-0 border-y border-white/10 md:grid-cols-2">
          <div className="py-7 md:pr-10">
            <p className="text-[10px] font-bold tracking-[0.16em] text-teal-200 uppercase">Available in the current build</p>
            <ul className="mt-5 space-y-4">
              {availableNow.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" /><span>{feature}</span></li>)}
            </ul>
            <button type="button" onClick={onOpenTeacherPass} className="cmc-btn-primary group mt-7 !min-h-11 !px-5 !py-2.5 !text-xs">Create member account <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></button>
          </div>

          <div className="border-t border-white/10 py-7 md:border-t-0 md:border-l md:pl-10">
            <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">Not enabled / not for sale</p>
            <ul className="mt-5 space-y-4">
              {notEnabled.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-slate-500"><Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" /><span>{feature}</span></li>)}
            </ul>
            <p className="mt-7 max-w-lg text-xs leading-relaxed text-slate-500">School licensing, billing, plans, and availability should be published here only after their service, terms, and support arrangements are ready.</p>
          </div>
        </div>
      </div>
    </section>
  );
};