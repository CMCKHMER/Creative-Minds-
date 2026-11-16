// Registration tab of the Daily Assessment workspace, and the "Kid 5–11
// classes" set-up dialog.
//
// The teacher keeps the class list (school ID + name) in the Roster tab or
// pastes it here, then opens registration. Each student on the list gets a
// seat that only somebody who knows both the ID and the name can find; a
// signed-in student who types them is linked to that seat. This tab shows
// who has registered, and lets the teacher release a seat that the wrong
// person took. The rules that make it safe are in firestore.rules
// (roster_seats / student_links); the logic is in src/lib/roster.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardPaste, Copy, DoorClosed, DoorOpen, Loader2, RefreshCw, School, UserCheck, UserX, X,
} from 'lucide-react';
import type { AssessmentClassDoc, AssessmentStudentDoc } from '../lib/assessmentDb';
import {
  kidClassPresets, missingKidClasses, normalizeSchoolId, normalizeStudentName, parseRosterPaste, planSize,
  registrationState, registrationUrl, type KidClassPreset, type PastedRow, type SeatProblem,
} from '../lib/roster';
import {
  closeRegistration, publishRegistration, readRegistration, releaseSeat, type RegistrationSnapshot,
} from '../lib/rosterDb';

const PROBLEM_TEXT: Record<SeatProblem, string> = {
  'no-id': 'Add a school ID',
  'no-name': 'Add a name',
  'duplicate': 'Same ID and name as another row',
};

const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40';
const btnGhost = `${btn} border border-white/10 bg-white/[0.04] text-slate-200`;
const btnMain = `${btn} bg-gradient-to-r from-cyan-300 to-teal-200 text-slate-950`;

export function RegistrationTab(props: {
  classDoc: AssessmentClassDoc;
  students: AssessmentStudentDoc[];
  teacherUid: string;
  /** Adds rows to the class list; resolves to how many were added. */
  onAddStudents: (rows: PastedRow[]) => Promise<number>;
  describeError: (e: unknown) => string;
}) {
  const { classDoc, students, teacherUid, onAddStudents, describeError } = props;
  const [snap, setSnap] = useState<RegistrationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);

  // The part of the class list registration depends on. Re-read the seats
  // when it changes (debounced: the teacher may be typing a name), and every
  // 20 seconds so new registrations show up by themselves.
  const signature = useMemo(
    () => students.map((s) => `${s.id}|${s.name}|${s.schoolId}`).join('\n'),
    [students],
  );
  const latest = useRef({ students, classDoc });
  useEffect(() => { latest.current = { students, classDoc }; }, [students, classDoc]);
  const run = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++run.current;
    const { students: list, classDoc: cls } = latest.current;
    try {
      const next = await readRegistration({
        classId: cls.id, className: cls.name,
        students: list.map((s) => ({ id: s.id, name: s.name, schoolId: s.schoolId })),
      });
      if (mine !== run.current) return;
      setSnap(next); setError(null);
    } catch (e) {
      if (mine !== run.current) return;
      setError(describeError(e));
    }
    setLoading(false);
  }, [describeError]);

  useEffect(() => {
    const first = setTimeout(() => void reload(), 500);
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void reload();
    }, 20000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [signature, classDoc.id, classDoc.name, reload]);

  const seatByKey = useMemo(() => new Map((snap?.seats ?? []).map((s) => [s.key, s])), [snap]);
  const problemByStudent = useMemo(
    () => new Map((snap?.plan.problems ?? []).map((p) => [p.row.studentId, p.reason])),
    [snap],
  );
  const lines = useMemo(() => (snap?.rows ?? [])
    .filter((r) => normalizeSchoolId(r.schoolId) || normalizeStudentName(r.name))
    .map((row) => {
      const seat = row.key ? seatByKey.get(row.key) : undefined;
      // a seat filed under this class but for another row is not this student's
      const own = seat && seat.studentId === row.studentId ? seat : undefined;
      const problem = problemByStudent.get(row.studentId);
      return { row, seat: own, problem, state: registrationState(row, own, problem) };
    }), [snap, seatByKey, problemByStudent]);

  const counts = useMemo(() => ({
    registered: lines.filter((l) => l.state === 'registered').length,
    open: lines.filter((l) => l.state === 'open').length,
    unpublished: lines.filter((l) => l.state === 'not-published').length,
    problems: lines.filter((l) => l.state === 'problem').length,
  }), [lines]);
  const changes = snap ? planSize(snap.plan) : 0;
  const published = (snap?.seats.length ?? 0) > 0;
  const dropsAccounts = snap?.plan.remove.filter((s) => s.claimedBy).length ?? 0;

  const act = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try { setNotice(await work()); } catch (e) { setError(describeError(e)); }
    await reload();
    setBusy(false);
  };

  const publish = () => act(async () => {
    if (!snap) return '';
    if (dropsAccounts && !window.confirm(
      `${dropsAccounts} registered student${dropsAccounts === 1 ? ' is' : 's are'} no longer on this class list. Updating will remove their registration. Continue?`,
    )) return 'Nothing was changed.';
    // read again right before writing, so the plan is not stale
    const fresh = await readRegistration({
      classId: classDoc.id, className: classDoc.name,
      students: latest.current.students.map((s) => ({ id: s.id, name: s.name, schoolId: s.schoolId })),
    });
    await publishRegistration({ classId: classDoc.id, className: classDoc.name, teacherUid, plan: fresh.plan });
    const n = fresh.plan.create.length + fresh.plan.adopt.length;
    return published
      ? `Registration updated${n ? ` — ${n} student${n === 1 ? '' : 's'} added` : ''}.`
      : `Registration is open for ${classDoc.name}. ${n} student${n === 1 ? '' : 's'} can register now.`;
  });

  const close = () => act(async () => {
    if (!snap) return '';
    if (!window.confirm('Close registration for this class? Students who have not registered yet will not be able to. Registered students stay registered.')) return 'Nothing was changed.';
    const n = await closeRegistration(classDoc.id);
    return `Registration closed. ${n} unused place${n === 1 ? '' : 's'} withdrawn.`;
  });

  const release = (studentId: string) => act(async () => {
    const line = lines.find((l) => l.row.studentId === studentId);
    if (!line?.seat) return '';
    if (!window.confirm(`Remove the account ${line.seat.claimedEmail || 'registered'} from ${line.row.name}? The student can then register again.`)) return 'Nothing was changed.';
    await releaseSeat(line.seat);
    return `${line.row.name} can register again.`;
  });

  const parsed = useMemo(() => parseRosterPaste(paste), [paste]);
  const existing = useMemo(
    () => new Set(students.map((s) => `${normalizeSchoolId(s.schoolId)}|${normalizeStudentName(s.name)}`)),
    [students],
  );
  const fresh = useMemo(
    () => parsed.rows.filter((r) => !existing.has(`${normalizeSchoolId(r.schoolId)}|${normalizeStudentName(r.name)}`)),
    [parsed, existing],
  );
  const addPasted = () => act(async () => {
    const n = await onAddStudents(fresh);
    setPaste('');
    return `${n} student${n === 1 ? '' : 's'} added to the class list. Press “${published ? 'Update registration' : 'Open registration'}” so they can register.`;
  });

  const url = registrationUrl();
  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the address is on screen */ }
  };

  return (
    <div className="space-y-4" data-testid="registration-tab">
      {/* Status + actions */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${published ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/[0.04] text-slate-400'}`}>
            {published ? <DoorOpen className="h-4 w-4" aria-hidden="true" /> : <DoorClosed className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white" data-testid="registration-headline">
              {loading ? 'Checking registration…' : published ? `Registration is open — ${classDoc.name}` : `Registration is not open — ${classDoc.name}`}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400" data-testid="registration-counts">
              {counts.registered} registered · {counts.open} waiting
              {counts.unpublished > 0 && ` · ${counts.unpublished} not on the registration list yet`}
              {counts.problems > 0 && ` · ${counts.problems} need an ID or a name`}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className={btnMain} disabled={busy || loading || !snap || changes === 0} onClick={() => void publish()} data-testid="registration-publish">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />}
              {published ? (changes ? `Update registration (${changes})` : 'Registration is up to date') : 'Open registration'}
            </button>
            {published && (
              <button type="button" className={btnGhost} disabled={busy || counts.open === 0} onClick={() => void close()}>
                <DoorClosed className="h-3.5 w-3.5" aria-hidden="true" /> Close registration
              </button>
            )}
            <button type="button" className={btnGhost} disabled={busy} onClick={() => void reload()} aria-label="Refresh registration">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
            </button>
          </div>
        </div>
        {notice && (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/[0.07] px-3 py-2 text-[11px] leading-relaxed text-emerald-100" data-testid="registration-notice">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span>{notice}</span>
            <button type="button" className="ml-auto shrink-0 rounded p-0.5 text-emerald-200/70 hover:text-emerald-100" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-3 w-3" /></button>
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span>{error}</span>
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* What the student does */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">What your students do</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">
            <li>Open the address below and sign in (or sign up) with their own email.</li>
            <li>Type their school ID and full name, exactly as on this class list. Name order and capital letters do not matter.</li>
            <li>They are placed in <span className="font-bold text-white">{classDoc.name}</span>. One account per student; you can release a wrong one here.</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-cyan-100" data-testid="registration-url">{url}</code>
            <button type="button" className={btnGhost} onClick={() => void copyUrl()}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Paste a class list */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <label htmlFor="roster-paste" className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Paste a class list</label>
          <textarea
            id="roster-paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={'One student per line: school ID, name\nS0123, Sok Dara\nS0124, Chan Sophea'}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
            data-testid="roster-paste"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={btnMain} disabled={busy || fresh.length === 0} onClick={() => void addPasted()} data-testid="roster-paste-add">
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" /> Add {fresh.length || ''} to the class list
            </button>
            {paste.trim() !== '' && (
              <span className="text-[10px] text-slate-400" data-testid="roster-paste-summary">
                {parsed.rows.length} read
                {parsed.rows.length - fresh.length > 0 && ` · ${parsed.rows.length - fresh.length} already on the list`}
                {parsed.skipped.length > 0 && ` · ${parsed.skipped.length} skipped`}
              </span>
            )}
          </div>
          {parsed.skipped.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[10px] leading-relaxed text-amber-200/90">
              {parsed.skipped.slice(0, 5).map((s) => <li key={s.line}>Line {s.line}: {s.reason} — “{s.text.slice(0, 40)}”</li>)}
              {parsed.skipped.length > 5 && <li>…and {parsed.skipped.length - 5} more</li>}
            </ul>
          )}
        </div>
      </div>

      {/* Who has registered */}
      {lines.length === 0 ? (
        <p className="rounded-xl border border-white/8 px-4 py-10 text-center text-xs text-slate-400">
          {loading ? 'Loading…' : 'This class list is empty. Paste the list above, or add students in the Roster tab.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-3 py-2.5">Student</th>
                <th className="px-3 py-2.5">School ID</th>
                <th className="px-3 py-2.5">Registration</th>
                <th className="px-3 py-2.5">Account</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lines.map(({ row, seat, problem, state }) => (
                <tr key={row.studentId} data-state={state} data-testid="registration-row">
                  <td className="px-3 py-2.5 text-xs font-bold text-white">{row.name || <span className="font-normal text-slate-600">No name</span>}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-300">{row.schoolId || <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-2.5">
                    {state === 'registered' && <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold text-emerald-200"><UserCheck className="h-3 w-3" aria-hidden="true" /> Registered</span>}
                    {state === 'open' && <span className="inline-flex items-center gap-1 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-100">Waiting</span>}
                    {state === 'not-published' && <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-slate-400">Not open yet</span>}
                    {state === 'problem' && <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] font-bold text-amber-200"><AlertTriangle className="h-3 w-3" aria-hidden="true" /> {problem ? PROBLEM_TEXT[problem] : 'Incomplete'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-300">
                    {seat?.claimedBy ? (
                      <>
                        <span className="text-slate-100">{seat.claimedEmail || 'Account linked'}</span>
                        {seat.claimedAt && <span className="block text-[10px] text-slate-500">{new Date(seat.claimedAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                      </>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {seat?.claimedBy && (
                      <button type="button" className={btnGhost} disabled={busy} onClick={() => void release(row.studentId)} title="Remove this account so the student can register again">
                        <UserX className="h-3.5 w-3.5" aria-hidden="true" /> Release
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Set up Kid 5 to Kid 11, morning and afternoon: creates the ones that do not exist yet. */
export function KidClassesModal(props: {
  existingNames: string[];
  defaultSchool: string;
  defaultTeacher: string;
  onCreate: (classes: KidClassPreset[], schoolName: string, teacherName: string, onProgress: (done: number) => void) => Promise<void>;
  onClose: () => void;
}) {
  const { existingNames, defaultSchool, defaultTeacher, onCreate, onClose } = props;
  const [schoolName, setSchoolName] = useState(defaultSchool);
  const [teacherName, setTeacherName] = useState(defaultTeacher);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const missing = useMemo(() => missingKidClasses(existingNames), [existingNames]);
  const missingNames = useMemo(() => new Set(missing.map((m) => m.name)), [missing]);
  const inputCls = 'mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !working) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, working]);

  const create = async () => {
    setWorking(true); setError(null); setDone(0);
    try { await onCreate(missing, schoolName, teacherName, setDone); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'The classes could not be created.'); }
    setWorking(false);
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="kid-classes-title">
      <div className="w-full max-w-lg rounded-2xl border border-cyan-300/20 bg-[#0b1724] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">Assessment workspace</p>
            <h3 id="kid-classes-title" className="mt-1 text-base font-bold text-white">Kid 5 to Kid 11 — morning and afternoon</h3>
          </div>
          <button type="button" onClick={onClose} disabled={working} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Fourteen classes, one per level and shift. Classes you already have are left alone.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-1.5" data-testid="kid-classes-list">
          {kidClassPresets().map((p) => {
            const isNew = missingNames.has(p.name);
            return (
              <li key={p.name} data-new={isNew} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${isNew ? 'border-cyan-300/25 bg-cyan-300/[0.06] text-cyan-50' : 'border-white/8 bg-white/[0.02] text-slate-500'}`}>
                {isNew ? <School className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300/70" aria-hidden="true" />}
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.1em]">{isNew ? 'New' : 'Exists'}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">School
            <input className={inputCls} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="School name" />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Teacher
            <input className={inputCls} value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Teacher's name" />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100">{error}</p>}
        <button
          type="button"
          disabled={working || missing.length === 0}
          onClick={() => void create()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-3 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
          data-testid="kid-classes-create"
        >
          {working ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <School className="h-4 w-4" aria-hidden="true" />}
          {working
            ? `Creating ${Math.min(done + 1, missing.length)} of ${missing.length}…`
            : missing.length === 0
              ? 'All fourteen classes exist'
              : `Create ${missing.length} class${missing.length === 1 ? '' : 'es'}`}
        </button>
      </div>
    </div>
  );
}
