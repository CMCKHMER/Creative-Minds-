import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, School, Sparkles, User, X, GraduationCap, BookOpen } from 'lucide-react';
import {
  clearPersistedSession,
  detectRoleFromEmail,
  firebaseConfigured,
  isTeacherEmail,
  restoreSession,
  sendEmailVerification,
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  toRestoredSession,
  type FirebaseAuthError,
  type RestoredSession,
} from '../lib/firebaseAuth';

type AuthMode = 'sign-up' | 'sign-in' | 'reset' | 'check-email' | 'authenticated';

interface TeacherPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kept for backwards-compat with App.tsx — Firebase path doesn't need
   *  server-side entitlement checks, so this is informational only. */
  accessStatus?: string;
  member?: { name?: string } | null;
  initialMode?: 'sign-up' | 'sign-in';
}

function emailRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}#toefl-mini-test`;
}

export const TeacherPassModal = ({
  isOpen,
  onClose,
  initialMode = 'sign-up',
}: TeacherPassModalProps) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [role, setRole] = useState('ESL / TOEFL Teacher');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendAvailable, setResendAvailable] = useState(false);
  const [activeSession, setActiveSession] = useState<RestoredSession | null>(() => restoreSession());
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setMessage('');
    setError('');
    setActiveSession(restoreSession());
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstControlRef.current?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resetFeedback = () => {
    setMessage('');
    setError('');
    setErrorCode(null);
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    if (!firebaseConfigured) {
      setError('Account creation is not configured yet. Add VITE_FIREBASE_API_KEY to your .env.local (Firebase Console → Project Settings → Web API Key), then redeploy.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    // Email determines role automatically: domain containing "edu"
    // (e.g., .edu.kh, .edu) → teacher; anything else → student. The
    // form below shows a live indicator so the user knows before submit.
    const detectedRole = detectRoleFromEmail(email.trim().toLowerCase());

    setBusy(true);
    try {
      const session = await signUpWithEmail({
        email: email.trim().toLowerCase(),
        password,
        displayName: name.trim() || undefined,
        school: school.trim() || undefined,
        // Account role must be the 'teacher' | 'student' enum so the
        // persisted `cmc-student-role` gates teacher features correctly.
        role: detectedRole,
        // The free-text select value is profile metadata only.
        teachingRole: role,
        continueUrl: emailRedirectUrl(),
      });
      // SECURITY: no session is persisted until the email is verified.
      // The session object lives in React state only (powering "Resend").
      setResendAvailable(true);
      setActiveSession(toRestoredSession(session));
      setMode('check-email');
      setMessage(session.verificationSent === false
        ? `Your account was created, but the verification email could not be sent just now. Tap "Resend verification link" below in a moment, then click the link and sign in.`
        : `We sent a verification link to ${email.trim().toLowerCase()}. Open the email, click “Verify”, then come back and sign in. This proves the address is yours — accounts that never verify stay locked out.`);
    } catch (e) {
      const authErr = e as FirebaseAuthError;
      setError(authErr instanceof Error ? authErr.message : 'Sign-up failed. Please try again.');
      setErrorCode(authErr?.code ?? null);
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    if (!firebaseConfigured) {
      setError('Sign-in is not configured yet. Add VITE_FIREBASE_API_KEY to your .env.local (Firebase Console → Project Settings → Web API Key), then redeploy.');
      return;
    }

    setBusy(true);
    try {
      const session = await signInWithEmail({
        email: email.trim().toLowerCase(),
        password,
      });
      setActiveSession(toRestoredSession(session));
      setMode('authenticated');
      setMessage(session.role === 'teacher'
        ? 'You\'re signed in as a teacher. Answer keys, Teacher Tools, and the practice room are unlocked — explore them whenever you like.'
        : 'You\'re signed in as a student. Worksheets, drills, and your score history are unlocked — explore them whenever you like.');
      window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
    } catch (e) {
      const authErr = e as FirebaseAuthError;
      // Verification gate: send the user to the check-your-inbox state
      // with a working Resend button (the error carries the unpersisted
      // session token that powers it).
      if (authErr?.code === 'EMAIL_NOT_VERIFIED') {
        if (authErr.pendingSession) {
          setActiveSession(toRestoredSession(authErr.pendingSession));
          setResendAvailable(true);
        }
        setMode('check-email');
        setMessage(`We just sent a fresh verification link to ${email.trim().toLowerCase()}. Open the email, click “Verify”, then sign in again. Didn't get it? Use “Resend verification link” below.`);
        return;
      }
      setError(authErr instanceof Error ? authErr.message : 'Sign-in failed. Please check your email and password.');
      setErrorCode(authErr?.code ?? null);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    if (!firebaseConfigured) {
      setError('Password reset is not configured yet. Add VITE_FIREBASE_API_KEY to your .env.local.');
      return;
    }

    setBusy(true);
    try {
      await sendPasswordReset(email.trim().toLowerCase());
      setMessage('If an account exists for this address, a password-reset link has been sent.');
    } catch (e) {
      const authErr = e as FirebaseAuthError;
      setError(authErr instanceof Error ? authErr.message : 'Reset request failed.');
      setErrorCode(authErr?.code ?? null);
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!firebaseConfigured || !activeSession?.idToken) return;
    resetFeedback();
    setBusy(true);
    try {
      await sendEmailVerification(activeSession.idToken, emailRedirectUrl());
      setMessage('A new verification link has been sent to your email.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend verification email.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    clearPersistedSession();
    setActiveSession(null);
    setMode('sign-in');
    setMessage('Signed out.');
    setError('');
    window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
  };

  const switchMode = (nextMode: AuthMode) => {
    resetFeedback();
    setMode(nextMode);
    setPassword('');
  };

  const handleBackdropKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onClose();
  };

  const heading = mode === 'sign-up' ? 'Create your CMC account'
    : mode === 'sign-in' ? 'Welcome back'
    : mode === 'reset' ? 'Reset your password'
    : mode === 'authenticated' ? 'You\'re signed in'
    : 'Verify your email';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-5" onClick={(event) => event.target === event.currentTarget && onClose()} onKeyDown={handleBackdropKeyDown}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="member-auth-heading" className="relative max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <button ref={firstControlRef} type="button" onClick={onClose} aria-label="Close membership dialog" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5 pr-12">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
          <span className="text-[10px] font-bold tracking-[0.16em] text-cyan-200 uppercase">Creative Minds Network</span>
        </div>
        <h2 id="member-auth-heading" className="mt-5 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white">{heading}</h2>

        {!firebaseConfigured ? (
          <div className="cmc-role-gate mt-5 rounded-xl border border-amber-200/20 bg-amber-100/5 p-4 text-sm text-amber-50">
            <p className="font-semibold">Live sign-in is one env var away.</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-100/75">Email/Password + Google sign-in are already enabled in the Firebase console. To wire the React side, add <code className="rounded bg-amber-100/10 px-1.5 py-0.5">VITE_FIREBASE_API_KEY</code> to <code className="rounded bg-amber-100/10 px-1.5 py-0.5">.env.local</code> (Firebase → Project Settings → General → Web API Key), then redeploy. The static HTML pages already submit scores to this same Firebase project.</p>
          </div>
        ) : null}

        {mode === 'sign-up' && (
          <form onSubmit={handleSignUp} className="mt-5 space-y-3.5">
            {/* Live role indicator: email domain determines whether this is
                a teacher or student account. Visible to set expectations
                before the user submits. */}
            {email.includes('@') && (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${isTeacherEmail(email) ? 'border-emerald-200/25 bg-emerald-200/[0.06] text-emerald-100' : 'border-cyan-200/25 bg-cyan-200/[0.06] text-cyan-100'}`}>
                {isTeacherEmail(email)
                  ? <><GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span><strong className="font-semibold">Teacher account</strong> — answer keys, teacher tools, and Resource Library will be unlocked.</span></>
                  : <><BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span><strong className="font-semibold">Student account</strong> — take worksheets, track scores. Answer keys and teacher tools stay locked.</span></>}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-300">Full name
                <span className="relative mt-1.5 block"><User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pr-3 pl-9 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" placeholder="Your name" /></span>
              </label>
              {isTeacherEmail(email) && (
                <label className="block text-xs font-semibold text-slate-300">School / center <span className="font-normal text-slate-500">(teachers)</span>
                  <span className="relative mt-1.5 block"><School className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input value={school} onChange={(event) => setSchool(event.target.value)} maxLength={120} autoComplete="organization" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pr-3 pl-9 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" placeholder="School name" /></span>
                </label>
              )}
            </div>
            <label className="block text-xs font-semibold text-slate-300">Email address
              <span className="relative mt-1.5 block"><Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" maxLength={254} autoComplete="email" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pr-3 pl-9 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" placeholder={isTeacherEmail(email) ? 'you@school.edu.kh' : 'you@school.org or you@school.edu.kh'} /></span>
              <span className="mt-1 block text-[10px] text-slate-500">Teachers must use a work email containing "edu" (e.g., .edu.kh, .edu). Students can use any email.</span>
            </label>
            <label className="block text-xs font-semibold text-slate-300">Password
              <span className="relative mt-1.5 block"><KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input value={password} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} minLength={8} maxLength={128} autoComplete="new-password" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pr-12 pl-9 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
            </label>
            {isTeacherEmail(email) && (
              <label className="block text-xs font-semibold text-slate-300">Teaching role
                <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15">
                  <option>ESL / TOEFL Teacher</option>
                  <option>Kindergarten / Pre-K</option>
                  <option>Elementary Teacher</option>
                  <option>Curriculum Leader</option>
                  <option>Independent Tutor</option>
                </select>
              </label>
            )}
            <label className="flex items-start gap-2.5 text-[11px] leading-relaxed text-slate-400"><input required type="checkbox" className="mt-0.5 accent-cyan-300" /><span>I agree to the <a className="underline decoration-cyan-300/50 underline-offset-2 hover:text-white" href="#privacy-notice" onClick={onClose}>privacy notice</a> and to receive account verification and service messages. Newsletter opt-in is separate.</span></label>
            <button disabled={busy} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-200">
              {busy ? 'Creating account…' : 'Create account'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="text-center text-xs text-slate-500">Already a member? <button type="button" onClick={() => switchMode('sign-in')} className="font-semibold text-cyan-200 hover:text-white">Sign in</button></p>
          </form>
        )}

        {mode === 'sign-in' && (
          <form onSubmit={handleSignIn} className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-300">Email address
              <span className="relative mt-1.5 block"><Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" maxLength={254} autoComplete="email" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pr-3 pl-9 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" placeholder="you@school.org" /></span>
            </label>
            <label className="block text-xs font-semibold text-slate-300">Password
              <span className="relative mt-1.5 block"><LockKeyhole className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input value={password} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pr-12 pl-9 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15" placeholder="Your password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
            </label>
            <div className="flex justify-end"><button type="button" onClick={() => switchMode('reset')} className="text-xs text-cyan-200 hover:text-white">Forgot password?</button></div>
            <button disabled={busy} type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-5 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
            <p className="text-center text-xs text-slate-500">New to CMC? <button type="button" onClick={() => switchMode('sign-up')} className="font-semibold text-cyan-200 hover:text-white">Create an account</button></p>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handlePasswordReset} className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-slate-400">Enter your member email and, if an account exists, we’ll send a secure reset link.</p>
            <label className="block text-xs font-semibold text-slate-300">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" maxLength={254} autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-300/60" placeholder="you@school.org" /></label>
            <button disabled={busy} type="submit" className="min-h-12 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{busy ? 'Sending…' : 'Send reset link'}</button>
            <button type="button" onClick={() => switchMode('sign-in')} className="w-full text-center text-xs text-cyan-200 hover:text-white">Back to sign in</button>
          </form>
        )}

        {mode === 'check-email' && (
          <div className="mt-5 rounded-xl border border-cyan-200/20 bg-cyan-100/5 p-4">
            <CheckCircle2 className="h-5 w-5 text-cyan-200" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-white">Verify your email to activate member access.</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{message}</p>
            {activeSession?.email && (
              <p className="mt-2 text-[11px] font-semibold text-cyan-200">Verification sent to: {activeSession.email}</p>
            )}
            <button type="button" disabled={!resendAvailable || busy} onClick={resendVerification} className="mt-4 text-xs font-semibold text-cyan-200 hover:text-white disabled:opacity-50">{busy ? 'Sending…' : 'Resend verification link'}</button>
            <button type="button" onClick={() => switchMode('sign-in')} className="mt-4 block w-full rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5">I've verified — sign in</button>
          </div>
        )}

        {mode === 'authenticated' && (
          <div className="mt-5 rounded-xl border border-cyan-200/20 bg-cyan-100/5 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${activeSession?.role === 'teacher' ? 'bg-emerald-300/15 text-emerald-200' : 'bg-cyan-300/15 text-cyan-200'}`}>
                {activeSession?.role === 'teacher' ? 'Teacher account' : 'Student account'}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{activeSession?.email ? `Signed in as ${activeSession.email}.` : 'Account session established.'}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {message || (activeSession?.emailVerified
                ? (activeSession?.role === 'teacher'
                    ? 'You\'re signed in as a teacher. Answer keys, Teacher Tools, and the Resource Library are unlocked — explore them whenever you like.'
                    : 'You\'re signed in as a student. Worksheets, drills, and your score history are unlocked — explore them whenever you like. Answer keys and teacher tools stay locked.')
                : 'You can keep using the site while your email verifies. Member-only features unlock after email confirmation.')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onClose} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2.5 text-xs font-bold text-slate-950">Done — back to site <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
              <button type="button" onClick={handleSignOut} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5">Sign out</button>
            </div>
          </div>
        )}

        {(error || (message && mode === 'reset')) && (
          <div role={error ? 'alert' : 'status'} aria-live="polite" className={`mt-4 rounded-lg border p-3 text-xs leading-relaxed ${error ? 'border-rose-300/20 bg-rose-300/5 text-rose-100' : 'border-emerald-300/20 bg-emerald-300/5 text-emerald-100'}`}>
            <p>{error || message}</p>
            {/* Actionable next-step buttons based on the Firebase error code */}
            {errorCode === 'EMAIL_EXISTS' && mode === 'sign-up' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => switchMode('sign-in')} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200/30 bg-cyan-200/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-200/20">
                  Sign in instead <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => switchMode('reset')} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10">
                  Forgot password?
                </button>
              </div>
            )}
            {errorCode === 'EMAIL_NOT_FOUND' && mode === 'sign-in' && (
              <div className="mt-2">
                <button type="button" onClick={() => switchMode('sign-up')} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200/30 bg-cyan-200/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-200/20">
                  Create an account <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            )}
            {errorCode === 'INVALID_PASSWORD' && mode === 'sign-in' && (
              <div className="mt-2">
                <button type="button" onClick={() => switchMode('reset')} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200/30 bg-cyan-200/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-200/20">
                  Forgot password?
                </button>
              </div>
            )}
            {errorCode === 'WEAK_PASSWORD' && (
              <p className="mt-2 text-[10px] text-slate-400">Tip: try a mix of letters, numbers, and symbols at least 8 characters long.</p>
            )}
            {errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER' && (
              <p className="mt-2 text-[10px] text-slate-400">Firebase rate-limits after several failed attempts in a short window. Wait 1–2 minutes and try again.</p>
            )}
          </div>
        )}

        {mode === 'sign-up' && <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-600">Accounts are created with Firebase Authentication (Email/Password). Role is detected automatically from your email domain: any email containing "edu" (e.g., .edu.kh, .edu) becomes a teacher account; anything else becomes a student account. The session token + role are stored locally and recognized by every connected app on the site.</p>}
      </div>
    </div>
  );
}
