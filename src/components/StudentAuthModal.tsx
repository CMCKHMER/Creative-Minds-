import { useState, useEffect } from 'react';
import { GraduationCap, LockKeyhole, Mail, User, ArrowRight } from 'lucide-react';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { studentSignUp, studentSignIn, studentGoogleSignIn } from '../lib/studentAuth';
import { createStudentProfile } from '../lib/firebaseDb';

export function StudentAuthModal({
  isOpen,
  onClose,
  initialMode = 'sign-in',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'sign-in' | 'sign-up';
}) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const studentAuth = useStudentAuth();

  useEffect(() => {
    if (isOpen) { setError(''); setMode(initialMode); }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    if (mode === 'sign-up') {
      if (!name.trim()) { setError('Please enter your name.'); setBusy(false); return; }
      if (!email.trim()) { setError('Please enter your email.'); setBusy(false); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); setBusy(false); return; }
      const res = await studentSignUp(email, password, name);
      if (!res.ok) { setError(res.error || 'Sign up failed.'); setBusy(false); return; }
      // Create student profile in Firestore
      const student = studentAuth.student;
      if (student) {
        await createStudentProfile(student.uid, {
          displayName: name,
          email,
          grade: grade ? parseInt(grade) : undefined,
          school: school || undefined,
        });
      }
    } else {
      if (!email.trim() || !password) { setError('Please enter your email and password.'); setBusy(false); return; }
      const res = await studentSignIn(email, password);
      if (!res.ok) { setError(res.error || 'Sign in failed.'); setBusy(false); return; }
    }
    setBusy(false);
    onClose();
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError('');
    const res = await studentGoogleSignIn();
    if (!res.ok) { setError(res.error || 'Google sign in failed.'); }
    setBusy(false);
    if (res.ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition" aria-label="Close">
          ✕
        </button>

        <div className="text-center mb-6">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 mb-4">
            <GraduationCap className="h-7 w-7" />
          </span>
          <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
            {mode === 'sign-up' ? 'Student Sign Up' : 'Student Sign In'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {mode === 'sign-up' ? 'Create a free student account to track your drill scores' : 'Sign in to see your drill history and scores'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'sign-up' && (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Grade</label>
                  <input type="number" value={grade} onChange={e => setGrade(e.target.value)} placeholder="11" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">School</label>
                  <input type="text" value={school} onChange={e => setSchool(e.target.value)} placeholder="School name" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.edu" className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Password</label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
            {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create Account' : 'Sign In'}
            {!busy && <ArrowRight className="inline ml-1 h-4 w-4" />}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button onClick={handleGoogle} disabled={busy} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-500/50 hover:bg-slate-800 disabled:opacity-60">
          Continue with Google
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          {mode === 'sign-up' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')} className="font-semibold text-cyan-400 hover:text-cyan-300">
            {mode === 'sign-up' ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
