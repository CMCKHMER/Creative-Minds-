import React, { useRef, useState } from 'react';
import { Sparkles, Shield, Heart, Send, Check } from 'lucide-react';
import { captureLead } from '../lib/leads';

interface FooterProps {
  onOpenQuickLinks: () => void;
  onOpenTeacherPass: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenQuickLinks, onOpenTeacherPass }) => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterError, setNewsletterError] = useState('');
  const websiteRef = useRef<HTMLInputElement>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterConsent) return;
    setNewsletterBusy(true);
    setNewsletterError('');
    try {
      await captureLead({ kind: 'newsletter', email: newsletterEmail, consent: true, website: websiteRef.current?.value ?? '' });
    } catch (error) {
      setNewsletterError(error instanceof Error ? error.message : 'Your opt-in could not be saved. Please try again later.');
      setNewsletterBusy(false);
      return;
    }
    setNewsletterBusy(false);
    setNewsletterSubscribed(true);
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-xs pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Newsletter & Brand Bar */}
        <div className="pb-12 border-b border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-sky-400 flex items-center justify-center font-black text-white text-sm shadow-md shadow-cyan-500/20">
                CMC
              </div>
              <span className="font-extrabold text-lg text-white tracking-tight">
                Creative Minds Network
              </span>
            </div>
            <p className="text-slate-400 max-w-md text-xs leading-relaxed">
              Original classroom assignments and a member-only TOEFL-style practice set, created to make focused preparation easier to explore.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Optional Teacher Resource Updates
                </span>
                <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950 px-2 py-0.5 rounded">
                  Newsletter opt-in
                </span>
              </div>
              
              {newsletterSubscribed ? (
                <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Your newsletter opt-in has been recorded. Automated email delivery is not enabled in this preview.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      aria-label="Email for optional teacher resource updates"
                      autoComplete="email"
                      maxLength={254}
                      required
                      placeholder="you@school.org"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={newsletterBusy || !newsletterConsent}
                      className="cmc-btn-primary !min-h-0 shrink-0 !rounded-xl !px-4 !py-2.5 !text-xs disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span>{newsletterBusy ? 'Saving…' : 'Opt in'}</span>
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <label className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-400">
                    <input type="checkbox" required checked={newsletterConsent} onChange={(event) => setNewsletterConsent(event.target.checked)} className="mt-0.5 accent-cyan-300" />
                    <span>I agree to receive occasional teacher resource email. I can withdraw consent by contacting the site operator.</span>
                  </label>
                  <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"><label>Leave this field empty<input ref={websiteRef} name="website" tabIndex={-1} autoComplete="off" /></label></div>
                </form>
              )}
              {newsletterError && <p role="alert" className="mt-2 text-[10px] leading-relaxed text-rose-200">{newsletterError}</p>}
            </div>
          </div>

        </div>

        {/* Links Grid */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          
          {/* Col 1 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Teacher Tools</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <a href="#interactive-demo" className="hover:text-cyan-300 transition">Feedback preview (sample only)</a>
              </li>
              <li>
                <a href="#resources" className="hover:text-cyan-300 transition">Assignment library</a>
              </li>
              <li>
                <a href="#toefl-mini-test" className="hover:text-cyan-300 transition">Member mini mock</a>
              </li>
              <li>
                <a href="#features" className="hover:text-cyan-300 transition">Prefix & Suffix Morphology Lab</a>
              </li>
              <li>
                <a href="#resources" className="hover:text-cyan-300 transition">Printable student copies</a>
              </li>
              <li>
                <button onClick={onOpenQuickLinks} className="hover:text-cyan-300 transition text-left cursor-pointer text-cyan-400 font-semibold">
                  Open Quick Links Menu →
                </button>
              </li>
            </ul>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Curriculum Levels</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <a href="#resources" className="hover:text-cyan-300 transition">Pre-Kid Early Phonics</a>
              </li>
              <li>
                <a href="#kid-grades" className="hover:text-cyan-300 transition">Kid Program (Grades 5-12)</a>
              </li>
              <li>
                <a href="#kid-grades" className="hover:text-cyan-300 transition">Kid 6 · Reading Future Connect 2</a>
              </li>
              <li>
                <a href="#toefl-junior-assessments" className="hover:text-cyan-300 transition">TOEFL Junior Speaking & Listening</a>
              </li>
              <li>
                <a href="#resources" className="hover:text-cyan-300 transition">Academic Writing & Paraphrasing</a>
              </li>
              <li>
                <a href="#resources" className="hover:text-cyan-300 transition">Speaking & writing practice</a>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Schools & Admin</h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <button onClick={onOpenTeacherPass} className="hover:text-cyan-300 transition text-left cursor-pointer">Create a member account</button>
              </li>
              <li>
                <span className="text-slate-500">LMS integrations are not enabled</span>
              </li>
              <li>
                <span className="text-slate-500">Classroom syncing is not enabled</span>
              </li>
              <li>
                <a href="#roi-calc" className="hover:text-cyan-300 transition">Workload estimator</a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-cyan-300 transition">Current availability</a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-cyan-300 transition">Pricing status</a>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Standards & Safety</h4>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Verified-email member accounts</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Practice answers stay in the browser</span>
              </li>
              <li>
                <span>Original practice items, not ETS materials</span>
              </li>
              <li>
                <a href="#faq" className="hover:text-cyan-300 transition">Teacher Help Center & FAQ</a>
              </li>
              <li>
                <a href="#privacy-notice" className="hover:text-cyan-300 transition">Privacy & data use</a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <span>© {new Date().getFullYear()} Creative Minds Network. Made for teachers with</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
            <span>care.</span>
          </div>

          <div className="flex items-center gap-4">
            <a href="#privacy-notice" className="hover:text-slate-300">Privacy information</a>
            <span>•</span>
            <a href="#privacy-notice" className="hover:text-slate-300">Data requests</a>
            <span>•</span>
            <a href="#toefl-mini-test" className="hover:text-slate-300">Member practice</a>
          </div>
        </div>

        <details id="privacy-notice" className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-white">Privacy information for this preview</summary>
          <div className="mt-3 max-w-4xl space-y-2 text-[11px] leading-relaxed text-slate-400">
            <p><strong className="text-slate-200">Accounts:</strong> Supabase Auth handles passwords. After email verification, the member profile stores name, email, school, role, member ID, and membership status. Delete-account requests remove the Auth profile and matching contact records through a protected server function.</p>
            <p><strong className="text-slate-200">Contact requests:</strong> Teacher-interest emails require separate contact consent. Newsletter enrollment is optional and requires its own opt-in. These records are scheduled for deletion after 90 days. The preview records the opt-in but does not send newsletters or confirmation emails.</p>
            <p><strong className="text-slate-200">Practice:</strong> The question bank is returned only to verified members with an active entitlement. Answer selections and scores stay in the open browser tab; they are not submitted or retained.</p>
            <p><strong className="text-slate-200">Before launch:</strong> This is a technical preview, not a final legal policy or compliance certification. The site operator must add its legal name, a privacy contact address, subprocessors/regions, and any applicable rights process, then review the policy with counsel.</p>
          </div>
        </details>

      </div>
    </footer>
  );
};
