import React, { useRef, useState } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { captureLead } from '../lib/leads';

interface CtaSectionProps {
  onSuccess: () => void;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const websiteRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    setBusy(true);
    setError('');
    try {
      await captureLead({ kind: 'teacher_interest', email, consent: true, website: websiteRef.current?.value ?? '' });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not save your request. Please try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
    setIsSubmitted(true);
  };

  return (
    <section className="cmc-section relative scroll-mt-24 overflow-hidden bg-slate-950 py-20 sm:py-24 lg:py-28">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-cyan-600/20 via-indigo-600/20 to-purple-600/20 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="rounded-3xl p-8 sm:p-14 lg:p-16 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-cyan-500/30 shadow-2xl shadow-cyan-950/40 relative overflow-hidden text-center">
          
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-xs font-semibold text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Teacher resources · Member access</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              Make room for the teaching that matters.
            </h2>

            <p className="text-base sm:text-xl text-slate-300 font-normal max-w-2xl mx-auto">
              Create a verified teacher account to explore the member practice room and classroom-ready assignments.
            </p>

            {/* Form */}
            {isSubmitted ? (
                <div role="status" aria-live="polite" className="p-5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-100 text-sm max-w-md mx-auto animate-in zoom-in-95 duration-200">
                <p className="flex items-center justify-center gap-2 font-semibold"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Request received</p>
                <p className="mt-2 text-xs leading-relaxed text-emerald-100/75">Your contact request is stored securely for up to 90 days. Automated email delivery is not enabled in this preview.</p>
                <button type="button" onClick={onSuccess} className="mt-4 rounded-lg bg-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-950">Continue to account sign-up</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="max-w-md mx-auto flex flex-col gap-3 pt-4">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    aria-label="Email address for teacher account information"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="you@school.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
                <label className="flex items-start gap-2.5 text-left text-[11px] leading-relaxed text-slate-400">
                  <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 accent-cyan-300" />
                  <span>I agree that CMC may use this email to respond to my teacher-resource request. It is not newsletter consent. See the <a href="#privacy-notice" className="underline underline-offset-2 hover:text-white">privacy notice</a>.</span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="cmc-btn-primary w-full shrink-0 uppercase tracking-wide disabled:cursor-wait disabled:opacity-60"
                >
                  <span>{busy ? 'Saving request…' : 'Request account access'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><label>Leave this field empty<input ref={websiteRef} name="website" tabIndex={-1} autoComplete="off" /></label></div>
              </form>
            )}

            {error && !isSubmitted && <p role="alert" className="max-w-md mx-auto text-left text-xs leading-relaxed text-rose-200">{error}</p>}

            {/* Subtext Guarantees */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Email verification required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> Practice-only score feedback
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> No practice answers stored
              </span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
