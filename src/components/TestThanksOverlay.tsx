// Full-screen thank-you shown right after a student submits an invited
// bi-weekly test (student-invite.js redirects to /?thanks=1). Reads the
// attempt summary from sessionStorage, celebrates for a few seconds, and
// strips the query param so a refresh never re-pops it.

import React, { useEffect, useState } from 'react';

interface ThanksInfo {
  name: string;
  title: string;
  invite: string;
  cloud: boolean;
  at: string;
}

export const TestThanksOverlay: React.FC = () => {
  const [info, setInfo] = useState<ThanksInfo | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('thanks') !== '1') return;
      // Strip the param first so refresh / back never re-shows the overlay.
      params.delete('thanks');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
      let parsed: ThanksInfo | null = null;
      try { parsed = JSON.parse(sessionStorage.getItem('cmc-invite-thanks') || 'null'); } catch { parsed = null; }
      setInfo(parsed ?? { name: '', title: 'Your test', invite: '', cloud: true, at: new Date().toISOString() });
      const timer = window.setTimeout(() => setInfo(null), 12000);
      return () => window.clearTimeout(timer);
    } catch {
      /* noop */
    }
  }, []);

  const dismiss = () => setInfo(null);

  if (!info) return null;

  return (
    <div
      data-keep-dark
      role="dialog"
      aria-modal="true"
      aria-label="Test submitted"
      className="fixed inset-0 z-[95] flex items-center justify-center p-5"
      style={{ background: 'rgba(2,6,23,.82)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 p-8 text-center"
        style={{
          background: 'linear-gradient(160deg, rgba(139,92,246,.16), rgba(56,189,248,.08) 55%, rgba(2,6,23,.9))',
          boxShadow: '0 40px 90px -40px rgba(139,92,246,.5)',
          animation: 'cmcThanksPop .45s cubic-bezier(.2,1.4,.4,1) both',
        }}
      >
        <style>{`@keyframes cmcThanksPop{from{opacity:0;transform:scale(.85) translateY(14px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes cmcThanksCheck{from{stroke-dashoffset:48}to{stroke-dashoffset:0}}`}</style>
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition hover:text-white"
        >
          ✕
        </button>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="#34d399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 9.5 18 20 6.5" style={{ strokeDasharray: 48, animation: 'cmcThanksCheck .5s .15s ease-out both' }} />
          </svg>
        </div>
        <h2 className="mt-5 font-[var(--font-display)] text-2xl font-extrabold text-white">
          Thank you{info.name ? `, ${info.name}` : ''}!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          <b className="text-white">{info.title || 'Your test'}</b> was submitted{info.cloud ? ' and recorded for your teacher' : ''}.
        </p>
        {!info.cloud && (
          <p className="mx-auto mt-2 max-w-xs rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
            You seem to be offline — your answers were saved on this device and will upload automatically the next time you open a test while connected.
          </p>
        )}
        <p className="mt-4 text-[11px] text-slate-500">You can close this page now — your teacher takes it from here.</p>
        <button
          onClick={dismiss}
          className="mt-5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5"
        >
          Done
        </button>
      </div>
    </div>
  );
};
