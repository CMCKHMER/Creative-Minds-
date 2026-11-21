import { LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';

interface PendingTeacherGateProps {
  /** Signs the pending teacher out so they can sign in with another account. */
  onSignOut: () => void;
}

/**
 * Full-screen lock shown while a teacher account is awaiting verification.
 *
 * A teacher account is verified in one of two ways:
 *  - a school address (.edu / .ac) with a verified email link — automatic, or
 *  - approval by the site admin (Admin → Users & Teacher Verification).
 *
 * Until one of these happens the account has no access to the platform, so
 * this card covers the page instead of the normal content.
 */
export function PendingTeacherGate({ onSignOut }: PendingTeacherGateProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-teacher-gate-title"
      data-testid="pending-teacher-gate"
      className="fixed inset-0 z-[400] flex items-center justify-center bg-[#04111c]/95 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border border-amber-300/25 bg-[#0b1d2e] p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-200">
          <LockKeyhole className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200">Teacher account</p>
        <h2 id="pending-teacher-gate-title" className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
          Verification pending
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Teacher accounts can use the platform only after they are verified. A school address (.edu or .ac)
          is verified automatically once you click the link in your verification email. Any other address is
          verified when the site admin approves the account.
        </p>
        <p className="mt-3 flex items-start justify-center gap-2 text-left text-xs leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          Once you are verified, sign out and sign back in to unlock the site.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-5 py-2.5 text-sm font-bold text-[#071522] transition hover:bg-amber-200"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}
