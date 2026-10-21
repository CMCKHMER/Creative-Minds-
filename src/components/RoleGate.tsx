import { useEffect, useState, type ReactNode } from 'react';
import { GraduationCap, LockKeyhole, Sparkles } from 'lucide-react';
import { restoreSession } from '../lib/firebaseAuth';

interface RoleGateProps {
  /** Children only render if the current user is a teacher. */
  children: ReactNode;
  /** Called when the user clicks the "Sign in as teacher" CTA. */
  onOpenAuth?: () => void;
  /** Optional title shown in the locked-state prompt. */
  title?: string;
  /** Optional body copy shown in the locked-state prompt. */
  description?: string;
  /** Render variant: 'full' (full section, default) or 'inline' (smaller, for cards). */
  variant?: 'full' | 'inline';
}

/**
 * Gate teacher-only content. Renders the children only when a teacher is
 * signed in. Otherwise shows a sign-in prompt that calls `onOpenAuth`.
 *
 * The role is read from `localStorage.cmc-student-role` (set by
 * `firebaseAuth.ts` on sign-up / sign-in). We hydrate on mount and also
 * listen for the `cmc-auth-changed` custom event so the gate updates
 * immediately when the user signs in or out elsewhere in the app.
 *
 * Soft-gating note: this is client-side gating. The role value lives in
 * localStorage, so a determined student could override it via devtools.
 * For real security (e.g., protecting the answer key itself), the key
 * would need to live behind a server-side check. This is fine for MVP —
 * the casual viewer is blocked, which is the goal here.
 */
export function RoleGate({
  children,
  onOpenAuth,
  title = 'Teacher access required',
  description = 'This section is reserved for teachers. Sign in with a work email containing "edu" (e.g., you@school.edu.kh) to unlock it.',
  variant = 'full',
}: RoleGateProps) {
  const [isTeacher, setIsTeacher] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      const s = restoreSession();
      setIsTeacher(s?.role === 'teacher');
      setHydrated(true);
    };
    sync();
    window.addEventListener('cmc-auth-changed', sync);
    return () => window.removeEventListener('cmc-auth-changed', sync);
  }, []);

  if (!hydrated) {
    // Avoid a flash of the locked-state prompt while we hydrate.
    return null;
  }

  if (isTeacher) {
    return <>{children}</>;
  }

  // Locked state
  if (variant === 'inline') {
    return (
      <div className="rounded-xl border border-amber-200/15 bg-amber-100/[0.04] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-300/10 text-amber-200">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-50">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/70">{description}</p>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 text-[11px] font-semibold text-amber-50 transition hover:bg-amber-200/20"
              >
                <GraduationCap className="h-3 w-3" aria-hidden="true" /> Sign in as teacher
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-keep-dark className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-amber-100/[0.04] via-slate-900/80 to-slate-950/90 px-6 py-14 text-center shadow-2xl sm:px-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,.15),transparent_55%)]" />
      <div className="relative mx-auto max-w-lg">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300/20 to-amber-500/10 text-amber-200 ring-1 ring-amber-200/30">
          <GraduationCap className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-6 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">{description}</p>

        {onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-200 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_35px_-12px_rgba(251,191,36,.7)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-12px_rgba(251,191,36,.8)]"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Sign in as teacher
          </button>
        )}

        <p className="mt-6 text-[10px] leading-relaxed text-slate-500">
          Teacher accounts must use a work email containing "edu" — for example <code className="rounded bg-white/5 px-1.5 py-0.5">you@school.edu.kh</code> or <code className="rounded bg-white/5 px-1.5 py-0.5">you@university.edu</code>. Students can sign up with any email and still take worksheets; the teacher-only sections stay locked.
        </p>
      </div>
    </div>
  );
}

/**
 * Dispatch a `cmc-auth-changed` event on `window` so any mounted RoleGate
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
