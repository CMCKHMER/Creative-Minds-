// "Register with your school ID" — the student's half of roster registration.
//
// A signed-in student types their school ID and full name. If the teacher has
// opened registration for their class and the two match a student on the
// list, this account becomes that student: one account per student, and the
// class is set by the list, not chosen by the student. See src/lib/roster.ts.
import { useEffect, useState } from 'react';
import { claimSeat, getMyRegistration, type MyRegistration } from '../lib/rosterDb';

export function StudentRegistrationCard({ uid, email, displayName }: { uid: string; email: string; displayName: string }) {
  const [mine, setMine] = useState<MyRegistration | null>(null);
  const [state, setState] = useState<'loading' | 'form' | 'registered'>('loading');
  const [schoolId, setSchoolId] = useState('');
  const [name, setName] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getMyRegistration(uid)
      .then((r) => {
        if (!live) return;
        setMine(r);
        setState(r ? 'registered' : 'form');
      })
      // not readable (signed out mid-way, rules not published yet): offer the form anyway
      .catch(() => { if (live) setState('form'); });
    return () => { live = false; };
  }, [uid]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working) return;
    setWorking(true); setMessage(null);
    const result = await claimSeat({ uid, email, displayName, schoolId, name });
    setWorking(false);
    if (result.ok) { setMine(result.registration); setState('registered'); return; }
    setMessage(result.message);
  };

  if (state === 'loading') {
    return <div className="cmcdc-panel mb-4 rounded-xl p-4 text-xs text-slate-400" data-testid="student-registration">Checking your registration…</div>;
  }

  if (state === 'registered' && mine) {
    return (
      <div className="cmcdc-panel mb-4 rounded-xl p-4" data-testid="student-registration" data-state="registered">
        <p className="text-xs text-slate-300">
          ✓ Registered as <span className="font-bold text-white">{mine.studentName || 'a student'}</span>
          {mine.schoolId && <> · ID <span className="font-bold text-white">{mine.schoolId}</span></>}
          {mine.className && <> · <span className="font-bold text-white">{mine.className}</span></>}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          This account is now your place on the class list. If the name or the class is wrong, tell your teacher.
        </p>
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none';
  return (
    <form onSubmit={submit} className="cmcdc-panel mb-4 rounded-xl p-4" data-testid="student-registration" data-state="form">
      <p className="text-xs font-semibold text-white">Register with your school ID</p>
      <p className="mt-1 text-[11px] text-slate-500">
        Type your school ID and your full name as they are on your class list. You will be placed in your own class.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[11rem_1fr_auto]">
        <label className="sr-only" htmlFor="reg-school-id">School ID</label>
        <input id="reg-school-id" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} placeholder="School ID" autoComplete="off" className={inputCls} />
        <label className="sr-only" htmlFor="reg-full-name">Full name</label>
        <input id="reg-full-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" className={inputCls} />
        <button
          type="submit"
          disabled={working || !schoolId.trim() || !name.trim()}
          className="cmcdc-cta rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {working ? 'Checking…' : 'Find my class'}
        </button>
      </div>
      {message && <p role="alert" className="mt-1.5 text-[11px] leading-relaxed text-rose-300" data-testid="student-registration-error">{message}</p>}
    </form>
  );
}
