import { useState, useEffect, useMemo } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useMemberAuth } from '../hooks/useMemberAuth';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { db } from '../lib/firebase';
import { listTeacherClasses, listTeacherAttempts, createClass } from '../lib/firebaseDb';
import { StudentAuthModal } from './StudentAuthModal';

export function FirebaseDashboard() {
  const memberAuth = useMemberAuth();
  const studentAuth = useStudentAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showStudentAuth, setShowStudentAuth] = useState(false);
  const [studentAuthMode, setStudentAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [newClassName, setNewClassName] = useState('');
  const [newClassProgram, setNewClassProgram] = useState('GEP');
  const [newClassGrade, setNewClassGrade] = useState('');

  const isTeacher = memberAuth.status === 'active';
  const isStudent = studentAuth.status === 'signed-in';
  const firebaseReady = db !== null;

  const loadData = async () => {
    if (!firebaseReady) { setLoading(false); return; }
    setLoading(true);
    try {
      if (isTeacher && memberAuth.member) {
        const cls = await listTeacherClasses(memberAuth.member.userId);
        setClasses(cls as any[]);
        const atts = await listTeacherAttempts(memberAuth.member.userId);
        setAttempts(atts as any[]);
      } else if (isStudent && studentAuth.student) {
        // Student view — loaded via the hook
      }
    } catch (e) {
      console.warn('[firebase-dashboard] loadData error:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [isTeacher, isStudent, selectedClass, firebaseReady]);

  const handleCreateClass = async () => {
    if (!memberAuth.member || !newClassName.trim()) return;
    const id = await createClass({
      teacherUid: memberAuth.member.userId,
      name: newClassName,
      program: newClassProgram,
      gradeLevel: newClassGrade,
    });
    if (id) {
      setNewClassName('');
      setShowCreateClass(false);
      await loadData();
    }
  };

  // Student's own attempts (real-time)
  const studentAttempts = useMemo(() => {
    if (!isStudent || !studentAuth.student) return [];
    return attempts.filter((a: any) => a.studentUid === studentAuth.student?.uid);
  }, [attempts, isStudent, studentAuth]);

  // Stats
  const stats = useMemo(() => {
    const total = attempts.length;
    const avgScore = total > 0 ? Math.round(attempts.reduce((s: number, a: any) => s + (a.scorePct || 0), 0) / total) : 0;
    const uniqueStudents = new Set(attempts.map((a: any) => a.studentUid || a.studentName)).size;
    const recentCount = attempts.filter((a: any) => {
      const ts = a.submittedAt?.toDate?.() || new Date(a.submittedAt);
      return Date.now() - ts.getTime() < 86400000; // last 24h
    }).length;
    return { total, avgScore, uniqueStudents, recentCount };
  }, [attempts]);

  if (!firebaseReady) {
    return (
      <section className="border-y border-white/10 bg-[#061018] py-16">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <p className="text-sm text-slate-500">Firebase backend is being configured…</p>
        </div>
      </section>
    );
  }

  return (
    <section id="firebase-dashboard" className="scroll-mt-24 border-y border-white/10 bg-[#061018] py-16 sm:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-10rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-cyan-500/[0.10] blur-[125px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-10rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-violet-500/[0.10] blur-[125px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="cmc-eyebrow"><Activity className="h-3.5 w-3.5" /> Real-time Dashboard</span>
            <h2 className="cmc-h2 mt-4">
              Live Class Results<br />
              <span className="cmc-gradient-text">Powered by Firebase.</span>
            </h2>
          </div>
          <div className="flex gap-2">
            {isTeacher && (
              <button onClick={() => setShowCreateClass(true)} className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5">
                + Create Class
              </button>
            )}
            {!isStudent && !isTeacher && (
              <button onClick={() => { setStudentAuthMode('sign-up'); setShowStudentAuth(true); }} className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-2.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/10">
                Student Sign Up
              </button>
            )}
            {isStudent && (
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-xs font-bold text-emerald-200">
                ✓ {studentAuth.student?.displayName || 'Student'}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        {isTeacher && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
              <p className="font-[var(--font-display)] text-2xl font-bold text-cyan-300">{stats.total}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Attempts</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
              <p className="font-[var(--font-display)] text-2xl font-bold text-violet-300">{stats.avgScore}%</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg Score</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
              <p className="font-[var(--font-display)] text-2xl font-bold text-emerald-300">{stats.uniqueStudents}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Students</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
              <p className="font-[var(--font-display)] text-2xl font-bold text-amber-300">{stats.recentCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Last 24h</p>
            </div>
          </div>
        )}

        {/* Teacher view: classes + attempts */}
        {isTeacher && (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            {/* Class list */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Classes</p>
              {classes.length === 0 && <p className="text-xs text-slate-600">No classes yet. Create one to get started.</p>}
              {classes.map((c: any) => (
                <button key={c.id} onClick={() => setSelectedClass(c.id)} className={`w-full rounded-lg border p-3 text-left transition ${selectedClass === c.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-slate-950/40 hover:border-white/20'}`}>
                  <p className="text-xs font-bold text-white">{c.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{c.program} · Code: {c.code}</p>
                </button>
              ))}
            </div>

            {/* Attempts table */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : attempts.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No drill attempts yet. Students' scores will appear here in real-time.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-white/10 bg-slate-900/50">
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 text-left">Student</th>
                      <th className="px-4 py-3 text-left">Drill</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(selectedClass ? attempts.filter((a: any) => a.classId === selectedClass) : attempts).slice(0, 50).map((a: any, i: number) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-xs font-medium text-slate-200">{a.studentName || 'Unknown'}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{a.drillTitle || a.drillSlug}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono font-bold text-xs ${(a.scorePct || 0) >= 80 ? 'text-emerald-300' : (a.scorePct || 0) >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
                            {a.scorePct || 0}%
                          </span>
                          <span className="ml-1 text-[10px] text-slate-600">({a.correctCount}/{a.totalCount})</span>
                        </td>
                        <td className="px-4 py-3 text-right text-[10px] text-slate-500">
                          {a.submittedAt?.toDate ? a.submittedAt.toDate().toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Student view: own attempts */}
        {isStudent && (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-bold text-white">Your Drill History</h3>
            </div>
            {studentAttempts.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No drill attempts yet. Complete a Bi-Weekly Planner test and your score will appear here.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 bg-slate-900/50">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left">Drill</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {studentAttempts.map((a: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-xs text-slate-300">{a.drillTitle || a.drillSlug}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-xs text-cyan-300">{a.scorePct}%</td>
                      <td className="px-4 py-3 text-right text-[10px] text-slate-500">{a.submittedAt?.toDate?.()?.toLocaleDateString() || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Not signed in */}
        {!isTeacher && !isStudent && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-8 text-center">
            <p className="text-sm font-semibold text-white">Sign in to see real-time results</p>
            <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto">
              Teachers can create classes and see live student scores. Students can track their drill history and scores.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button onClick={() => { setStudentAuthMode('sign-up'); setShowStudentAuth(true); }} className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5">
                Student Sign Up
              </button>
              <button onClick={() => { setStudentAuthMode('sign-in'); setShowStudentAuth(true); }} className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-2.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/10">
                Student Sign In
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create class modal */}
      {showCreateClass && isTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" onClick={() => setShowCreateClass(false)}>
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-8" onClick={e => e.stopPropagation()}>
            <h3 className="font-[var(--font-display)] text-lg font-bold text-white mb-4">Create New Class</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Class name (e.g. GEP 11A)" value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
              <select value={newClassProgram} onChange={e => setNewClassProgram(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none">
                <option value="GEP">GEP</option>
                <option value="ISEC">ISEC</option>
                <option value="Kid 5-12">Kid 5-12</option>
                <option value="TOEFL iBT">TOEFL iBT</option>
                <option value="TOEFL Junior">TOEFL Junior</option>
                <option value="General">General</option>
              </select>
              <input type="text" placeholder="Grade level (e.g. 11)" value={newClassGrade} onChange={e => setNewClassGrade(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowCreateClass(false)} className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-900">Cancel</button>
              <button onClick={handleCreateClass} className="flex-1 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 py-2.5 text-sm font-bold text-slate-950">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Student auth modal */}
      <StudentAuthModal isOpen={showStudentAuth} onClose={() => setShowStudentAuth(false)} initialMode={studentAuthMode} />
    </section>
  );
}
