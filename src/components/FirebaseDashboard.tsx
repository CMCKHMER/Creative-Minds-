import { useCallback, useState, useEffect, useMemo } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useMemberAuth } from '../hooks/useMemberAuth';
import { useStudentAuth } from '../hooks/useStudentAuth';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import { getFirebaseDb } from '../lib/firebase';
import { listTeacherClasses, listTeacherAttempts, createClass, getClassByCode, enrollStudent, deleteClassTeacher } from '../lib/firebaseDb';
import { useStudentAttempts } from '../hooks/useDrillAttempts';
import { FIREBASE_PROJECT_ID } from '../lib/firebaseAuth';
import { StudentAuthModal } from './StudentAuthModal';

export function FirebaseDashboard() {
  const memberAuth = useMemberAuth();
  const studentAuth = useStudentAuth();
  // REST-based session (used by TeacherPassModal — the hero "Create a
  // teacher account" button). This writes to localStorage, not to the
  // Firebase SDK's session state, so without this hook the dashboard
  // would not recognize a user who signed in via the hero button.
  const firebaseAuth = useFirebaseAuth();
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

  // Class deletion (teacher). Two-step inline confirm on the class card:
  // first tap shows "Delete?", second tap on Delete fires the Firestore
  // removal. deletingId tracks which card is confirming; deleteBusy gates
  // the button while the (enrollments + class doc) cleanup is in flight.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // A user is recognized as a teacher if EITHER the Supabase member-auth
  // flow (old TeacherPassModal path) OR the Firebase REST flow (new
  // TeacherPassModal path) sees them as a teacher. Same for student —
  // either the Firebase SDK onAuthStateChanged OR the REST localStorage
  // session counts.
  const isTeacher = memberAuth.status === 'active' || (firebaseAuth.isTeacher && !!firebaseAuth.session);
  const isStudent = studentAuth.status === 'signed-in' || (firebaseAuth.isStudent && !!firebaseAuth.session);

  // ── Identity resolution ──
  // A teacher may be signed in through EITHER auth path: the Supabase
  // member flow (memberAuth) or the Firebase REST flow (TeacherPassModal
  // hero button — uid is `localId`). Without this fallback, hero-button
  // teachers saw the teacher UI but every data load and the Create Class
  // button silently no-op'd, because memberAuth.member is null on that
  // path. Same dual-path resolution for students (SDK profile uid or
  // REST localId).
  const teacherUid = memberAuth.member?.userId
    || (firebaseAuth.isTeacher && firebaseAuth.session ? firebaseAuth.session.localId : null);
  const studentUid = studentAuth.student?.uid
    || (firebaseAuth.isStudent && firebaseAuth.session ? firebaseAuth.session.localId : null);

  // Class-join state (student side). The joined class id is persisted so
  // submitScore/cmc-shared.js can stamp it on every future attempt.
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinedClass, setJoinedClass] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    try {
      const id = localStorage.getItem('cmc-student-classId');
      if (id) setJoinedClass({ id, name: localStorage.getItem('cmc-student-className') || 'Class' });
    } catch { /* ignore */ }
  }, []);

  // Firebase SDK readiness — the SDK is lazy-loaded, so this component is
  // what triggers the download. Flips true once Firestore resolves (or stays
  // false when Firebase is not configured / init failed).
  const [firebaseReady, setFirebaseReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void getFirebaseDb().then((d) => {
      if (alive) setFirebaseReady(d !== null);
    });
    return () => { alive = false; };
  }, []);

  // Display name + email for the badge — prefer whichever auth source has data.
  const signedInDisplayName = studentAuth.student?.displayName
    || firebaseAuth.session?.displayName
    || firebaseAuth.session?.email
    || 'Student';
  const signedInEmail = firebaseAuth.session?.email || studentAuth.student?.email;

  const loadData = useCallback(async () => {
    if (!firebaseReady) { setLoading(false); return; }
    setLoading(true);
    try {
      if (isTeacher && teacherUid) {
        const cls = await listTeacherClasses(teacherUid);
        setClasses(cls as any[]);
        const atts = await listTeacherAttempts(teacherUid);
        setAttempts(atts as any[]);
      }
    } catch (e) {
      console.warn('[firebase-dashboard] loadData error:', e);
    }
    setLoading(false);
    // teacherUid flips exactly when the identity changes between null and
    // present (either auth path), which is when a refetch is wanted.
  }, [firebaseReady, isTeacher, teacherUid]);

  useEffect(() => {
    loadData();
  }, [loadData, selectedClass]);

  const handleCreateClass = async () => {
    if (!teacherUid || !newClassName.trim()) return;
    const id = await createClass({
      teacherUid,
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

  const handleDeleteClass = async (classId: string) => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    const ok = await deleteClassTeacher(classId);
    setDeleteBusy(false);
    setDeletingId(null);
    if (ok) {
      if (selectedClass === classId) setSelectedClass(null);
      await loadData();
    }
  };

  // Student's own attempts (real-time via the SDK listener). The hook
  // no-ops until the student is signed in; its query already scopes rows
  // to the signed-in student and sorts them newest-first.
  const { attempts: studentAttempts } = useStudentAttempts(isStudent ? studentUid : null);

  // Join a class by its CMC-XXXXXX code: writes the enrollment doc, stamps
  // the student profile, and persists the code for the submit paths
  // (submitScore.ts + cmc-shared.js) so future attempts carry classId.
  const handleJoinClass = async () => {
    if (!studentUid || !joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    const cls = await getClassByCode(joinCode.trim());
    if (!cls) {
      setJoinError('No class found with that code — check with your teacher.');
      setJoining(false);
      return;
    }
    const ok = await enrollStudent(cls.id, studentUid, signedInDisplayName, cls.teacherUid);
    if (!ok) {
      setJoinError('Could not join this class. Try again in a moment.');
      setJoining(false);
      return;
    }
    try {
      localStorage.setItem('cmc-student-classId', cls.id);
      localStorage.setItem('cmc-student-className', String(cls.name || 'Class'));
    } catch { /* ignore */ }
    setJoinedClass({ id: cls.id, name: String(cls.name || 'Class') });
    setJoinCode('');
    setJoining(false);
  };

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
      <section className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-[#061018] py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <p className="text-sm text-slate-500">Firebase backend is being configured…</p>
        </div>
      </section>
    );
  }

  return (
    <section id="firebase-dashboard" className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-[#061018] py-20 sm:py-24 lg:py-28">
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
          <div className="flex gap-2 items-center">
            {isTeacher && (
              <button onClick={() => setShowCreateClass(true)} className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5">
                + Create Class
              </button>
            )}
            {/* Signed-in badge — shown for both teacher and student
                sessions, regardless of which auth path was used (Supabase
                member-auth, Firebase SDK onAuthStateChanged, or my REST
                localStorage session). The badge displays the display name
                + role + a Sign out button so users can clearly see
                they're logged in and end the session if needed. */}
            {(isTeacher || isStudent) && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                <span className="font-bold text-emerald-200">
                  ✓ {signedInDisplayName}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  {isTeacher ? 'Teacher' : 'Student'}
                </span>
                {signedInEmail && (
                  <span className="hidden text-[10px] text-slate-500 sm:inline">
                    {signedInEmail}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    // Sign out of BOTH auth systems to ensure a clean state
                    // regardless of which path the user used to sign in.
                    firebaseAuth.signOut();
                    if (studentAuth.status === 'signed-in') {
                      import('../lib/studentAuth').then(({ studentSignOut }) => studentSignOut()).catch(() => {});
                    }
                  }}
                  className="ml-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  Sign out
                </button>
              </div>
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
                <div key={c.id} className="relative">
                  <button onClick={() => setSelectedClass(c.id)} className={`w-full rounded-lg border p-3 pr-9 text-left transition ${selectedClass === c.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-slate-950/40 hover:border-white/20'}`}>
                    <p className="text-xs font-bold text-white">{c.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{c.program} · Code: {c.code}</p>
                  </button>
                  {deletingId === c.id ? (
                    <div className="absolute inset-0 rounded-lg border border-rose-500/50 bg-slate-950/95 p-2.5">
                      <p className="text-[11px] font-bold text-rose-200">Delete “{c.name}”?</p>
                      <p className="mt-0.5 text-[9px] leading-snug text-slate-500">Students can no longer join or see it. This cannot be undone.</p>
                      <div className="mt-2 flex gap-1.5">
                        <button disabled={deleteBusy} onClick={() => void handleDeleteClass(c.id)} className="rounded-md bg-rose-500/90 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-rose-500 disabled:opacity-50">
                          {deleteBusy ? 'Deleting…' : 'Delete'}
                        </button>
                        <button onClick={() => setDeletingId(null)} disabled={deleteBusy} className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-400 transition hover:text-white disabled:opacity-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      aria-label={`Delete class ${c.name}`}
                      title="Delete this class"
                      onClick={(e) => { e.stopPropagation(); setDeletingId(c.id); }}
                      className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {classes.length > 0 && (
                <p className="pt-1 text-[10px] leading-relaxed text-slate-600">
                  Students join with the code: they sign in, then use "Join a class" below.
                </p>
              )}
            </div>

            {/* Attempts table */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : attempts.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No drill attempts yet. Share your class code — when enrolled students complete drills, their scores appear here in real-time.
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

        {/* Student view: class join + own attempts */}
        {isStudent && (
          <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            {joinedClass ? (
              <p className="text-xs text-slate-300">
                ✓ Joined <span className="font-bold text-white">{joinedClass.name}</span> — your drill scores now appear in your teacher's Live Class Results.
              </p>
            ) : (
              <>
                <p className="text-xs font-semibold text-white">Join a class</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Enter the class code your teacher gave you so your scores appear in their dashboard.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CMC-XXXXXX"
                    className="w-44 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    onClick={handleJoinClass}
                    disabled={joining || !studentUid}
                    className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {joining ? 'Joining…' : 'Join class'}
                  </button>
                </div>
                {joinError && <p className="mt-1.5 text-[11px] text-rose-300">{joinError}</p>}
              </>
            )}
          </div>
        )}
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

        {/* Not signed in — the public drill feed keeps the section genuinely
            live for every visitor; the CTA below explains how to get a
            personal teacher/student view. */}
        {!isTeacher && !isStudent && (
          <div className="space-y-4">
            <CommunityLive />
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-8 text-center">
            <p className="text-sm font-semibold text-white">Sign in to see real-time results</p>
            <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto">
              Teachers can create classes and see live student scores. Students can track their drill history and scores.
            </p>
            {/* Single sign-in CTA — the modal has its own "Sign in / Create
                account" toggle inside, so we don't need two separate buttons
                here. Defaults to sign-in (most common intent); users who need
                to create an account can click the toggle inside the modal. */}
            <div className="mt-4">
              <button onClick={() => { setStudentAuthMode('sign-in'); setShowStudentAuth(true); }} className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5">
                Sign in as student
              </button>
            </div>
            <p className="mt-3 text-[10px] text-slate-500">
              New here? Click the button, then choose "Create an account" inside. Teachers: use the "Create a teacher account" button in the hero above with a work email ending in .edu or .edu.kh.
            </p>
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

// ---------------------------------------------------------------------------
// CommunityLive — signed-out visitors still get a genuinely live section.
// Reads the PUBLIC drill_attempts feed via the Firestore REST API (same
// source and quota shape as TickerBanner: one 100-doc page per mount, no
// polling). Security rules allow public read on drill_attempts, so this
// works without any sign-in.
// ---------------------------------------------------------------------------

interface CommunityField { stringValue?: string; integerValue?: string; timestampValue?: string }
interface CommunityDoc { fields?: Record<string, CommunityField> }

interface CommunityAttempt {
  name: string;
  drill: string;
  scorePct: number;
  at: number;
}

function parseCommunityDoc(doc: CommunityDoc): CommunityAttempt | null {
  const f = doc.fields;
  if (!f) return null;
  const tsRaw = f.submittedAt?.timestampValue;
  return {
    name: f.studentName?.stringValue || 'Anonymous',
    drill: f.drillTitle?.stringValue || f.drillSlug?.stringValue || 'Drill',
    scorePct: Number(f.scorePct?.integerValue || '0'),
    at: tsRaw ? Date.parse(tsRaw) : 0,
  };
}

function timeAgo(ms: number): string {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function CommunityLive() {
  const [recent, setRecent] = useState<CommunityAttempt[]>([]);

  useEffect(() => {
    let cancelled = false;
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/drill_attempts?pageSize=100&orderBy=submittedAt%20desc`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.documents) return;
        const rows = (data.documents as CommunityDoc[])
          .map(parseCommunityDoc)
          .filter((a: CommunityAttempt | null): a is CommunityAttempt => a !== null && a.at > 0);
        setRecent(rows);
      })
      .catch(() => { /* keep the panel empty rather than erroring the page */ });
    return () => { cancelled = true; };
  }, []);

  const last24h = recent.filter((a) => Date.now() - a.at < 86_400_000).length;
  const avg = recent.length ? Math.round(recent.reduce((s, a) => s + a.scorePct, 0) / recent.length) : 0;
  const students = new Set(recent.map((a) => a.name)).size;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
          <p className="text-2xl font-bold text-cyan-300">{last24h}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Drills · last 24h</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-300">{students}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Students drilling</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center">
          <p className="text-2xl font-bold text-violet-300">{avg}%</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg score</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
          <h3 className="text-sm font-bold text-white">Live from the drill floor — recent submissions</h3>
        </div>
        {recent.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            The public feed is quiet right now. Sign in and complete a drill to be the first on the board.
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
              {recent.slice(0, 6).map((a, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-xs font-medium text-slate-200">{a.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{a.drill}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs font-bold text-cyan-300">{a.scorePct}%</td>
                  <td className="px-4 py-3 text-right text-[10px] text-slate-500">{timeAgo(a.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
