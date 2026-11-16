import { useEffect, useState, type ReactNode } from 'react';
import { GraduationCap, LockKeyhole, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { restoreSession, type RestoredSession } from '../lib/firebaseAuth';
import { requestAuth } from '../lib/authPrompt';

interface GateCopy {
  title: string;
  description: string;
  cta: string;
}

/** Copy for a locked teacher-only surface, tailored to WHO is looking at it. */
function teacherGateCopy(session: RestoredSession | null, fallbackTitle: string): GateCopy {
  if (!session) {
    return {
      title: fallbackTitle,
      description: 'A free account is required. Create one — or sign in — to continue.',
      cta: 'Create a free account',
    };
  }
  if (session.isRevokedTeacher) {
    return {
      title: 'Teacher access was revoked',
      description: 'The site admin revoked teacher access for this account. Everything for students still works — contact the admin if you believe this is a mistake.',
      cta: 'Back to your account',
    };
  }
  if (session.accountType === 'teacher') {
    return {
      title: 'Teacher verification pending',
      description: 'This section is for verified teachers. School (.edu) addresses unlock it automatically once your email is verified; other addresses unlock after the site admin approves your account.',
      cta: 'View account status',
    };
  }
  return {
    title: 'Verified teacher access required',
    description: session.accountType === 'user'
      ? 'This section is for verified teachers. Your general-user account keeps everything else open — games, worksheets, tests and downloads.'
      : 'This section is for verified teachers. Your student account keeps everything else open — games, worksheets, tests and downloads.',
    cta: 'View account status',
  };
}

interface RoleGateProps {
  /** Children only render if the current user is a verified teacher (or admin). */
  children: ReactNode;
  /** Called when the user clicks the sign-in CTA. Defaults to the global
   *  account dialog (`requestAuth`). */
  onOpenAuth?: () => void;
  /** Optional title shown in the locked-state prompt. */
  title?: string;
  /** Accepted for backwards compatibility — the locked copy is tailored to
   *  the visitor's actual account state instead. */
  description?: string;
  /** Render variant: 'full' (full section, default) or 'inline' (smaller, for cards). */
  variant?: 'full' | 'inline';
}

/**
 * Gate teacher-only content. Renders the children only when a VERIFIED
 * teacher (or the site admin) is signed in. Students, general users,
 * unverified/pending teachers, revoked teachers, and guests each get copy
 * that tells them exactly why it is locked and what to do next.
 *
 * The role is read from localStorage (`cmc-student-role` +
 * `cmc-teacher-verified`, resolved by firebaseAuth.resolveEffectiveAccess).
 * Gates re-hydrate on the `cmc-auth-changed` event so signing in updates
 * every open gate immediately.
 *
 * Soft-gating note: this is client-side gating. The authoritative checks live
 * in firestore.rules (`isVerifiedTeacher()`), which is where real data
 * protection happens; this component is the UX layer.
 */
export function RoleGate({
  children,
  onOpenAuth,
  title = 'Verified teacher access',
  variant = 'full',
}: RoleGateProps) {
  const [session, setSession] = useState<RestoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSession(restoreSession());
      setHydrated(true);
    };
    sync();
    window.addEventListener('cmc-auth-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cmc-auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!hydrated) {
    // Avoid a flash of the locked-state prompt while we hydrate.
    return null;
  }

  if (session?.role === 'teacher') {
    return <>{children}</>;
  }

  const copy = teacherGateCopy(session, title);
  const openAuth = onOpenAuth ?? (() => requestAuth({
    mode: session ? 'sign-in' : 'sign-up',
    contextPrompt: copy.title,
  }));

  // Locked state
  if (variant === 'inline') {
    return (
      <div className="cmc-role-gate rounded-xl border border-amber-200/15 bg-amber-100/[0.04] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-300/10 text-amber-200">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-50">{copy.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/70">{copy.description}</p>
            <button
              type="button"
              onClick={openAuth}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 text-[11px] font-semibold text-amber-50 transition hover:bg-amber-200/20"
            >
              <GraduationCap className="h-3 w-3" aria-hidden="true" /> {copy.cta}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cmc-role-gate relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-amber-100/[0.04] via-slate-900/80 to-slate-950/90 px-6 py-14 text-center shadow-2xl sm:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,.15),transparent_55%)]" />
      <div className="relative mx-auto max-w-lg">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/20 to-amber-500/10 text-amber-200 ring-1 ring-amber-200/30">
          <GraduationCap className="h-7 w-7" aria-hidden="true" />
        </span>
        {/* h1 — when a page is fully gated, this prompt IS the page's main
            heading (guest views had no h1 at all, e.g. #teacher-tools). */}
        <h1 className="mt-6 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">{copy.description}</p>

        <button
          type="button"
          onClick={openAuth}
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-200 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_35px_-12px_rgba(251,191,36,.7)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-12px_rgba(251,191,36,.8)]"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {copy.cta}
        </button>

        <p className="mt-6 text-[10px] leading-relaxed text-slate-500">
          Teachers verify with a school email containing &ldquo;edu&rdquo; — for example <code className="rounded bg-white/5 px-1.5 py-0.5">you@school.edu.kh</code> or <code className="rounded bg-white/5 px-1.5 py-0.5">you@university.edu</code>.
          Gmail teachers are approved by the site admin. Students and general users get every game, worksheet, test and student-copy download.
        </p>
      </div>
    </div>
  );
}

interface AccountGateProps {
  children: ReactNode;
  /** Called instead of the default global dialog when provided. */
  onOpenAuth?: () => void;
  title?: string;
  description?: string;
  /** Short reason shown inside the global dialog, e.g. "Sign up to play the full game." */
  contextPrompt?: string;
  variant?: 'full' | 'inline';
  /** Message for a signed-in user blocked by something else (e.g. downloads). */
  lockedNote?: string;
}

/**
 * Gate any surface that needs at least a signed-in CMC account (students and
 * general users included). Guests see a sign-up prompt; signed-in visitors
 * always pass through.
 */
export function AccountGate({
  children,
  onOpenAuth,
  title = 'Create a free account to continue',
  description = 'Games, worksheets, practice tests and your score history are free — all we need is a confirmed email address so your scores are saved.',
  contextPrompt,
  variant = 'full',
  lockedNote,
}: AccountGateProps) {
  const [session, setSession] = useState<RestoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSession(restoreSession());
      setHydrated(true);
    };
    sync();
    window.addEventListener('cmc-auth-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cmc-auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!hydrated) return null;
  if (session?.emailVerified) return <>{children}</>;

  const openAuth = onOpenAuth ?? (() => requestAuth({
    mode: 'sign-up',
    contextPrompt: contextPrompt ?? title,
  }));

  if (variant === 'inline') {
    return (
      <div className="cmc-account-gate rounded-xl border border-cyan-200/20 bg-cyan-100/[0.05] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-cyan-50">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-cyan-100/75">{lockedNote ?? description}</p>
            <button
              type="button"
              onClick={openAuth}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-cyan-200/30 bg-cyan-200/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-50 transition hover:bg-cyan-200/20"
            >
              <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Sign up free
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cmc-account-gate relative overflow-hidden rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-cyan-100/[0.05] via-slate-900/80 to-slate-950/90 px-6 py-14 text-center shadow-2xl sm:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,.16),transparent_55%)]" />
      <div className="relative mx-auto max-w-lg">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-teal-400/10 text-cyan-200 ring-1 ring-cyan-200/30">
          <UserPlus className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">{lockedNote ?? description}</p>
        <button
          type="button"
          onClick={openAuth}
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_35px_-12px_rgba(34,211,238,.7)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-12px_rgba(34,211,238,.8)]"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Sign up — it&apos;s free
        </button>
        <p className="mt-6 text-[10px] leading-relaxed text-slate-500">
          Already have an account? <button type="button" onClick={() => requestAuth({ mode: 'sign-in' })} className="font-semibold text-cyan-200 underline underline-offset-2 hover:text-white">Sign in</button>.
          Every account is free — students and general users get the same access.
        </p>
      </div>
    </div>
  );
}

/**
 * Dispatch a `cmc-auth-changed` event on `window` so any mounted gate
 * re-hydrates immediately. Call this after sign-in / sign-out / role
 * changes anywhere in the app.
 */
export function notifyAuthChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
  } catch {
    /* noop — older browsers */
  }
}
