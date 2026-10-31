import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookOpen, CalendarDays, ClipboardCheck, ClipboardList, Copy, Download, FileText,
  Gamepad2, Headphones, Home, Loader2, Plus, Printer, RefreshCw, Search, Trash2,
  Users, Wand2, X,
} from 'lucide-react';
import {
  addAssessmentStudent,
  clearAssessmentWeek,
  createAssessmentClass,
  duplicateAssessmentStudent,
  formatWeekLabel,
  listAssessmentClasses,
  newStudentRow,
  patchAssessmentStudent,
  patchAssessmentStudentWeek,
  removeAssessmentStudent,
  STUDENT_IDENTITY_FIELDS,
  subscribeAssessmentStudents,
  updateAssessmentClass,
  weekKeyOf,
  type AssessmentClassDoc,
  type AssessmentStudentDoc,
} from '../lib/assessmentDb';
import {
  areaScores,
  emptyStudentScores,
  scoreTone,
  type AreaScores,
  type AssessmentStudentScores,
} from '../lib/assessmentScoring';
import { sanitizeScoreText } from '../lib/scoreInput';

// ── Tab + field definitions (drive the whole UI) ─────────────────────

type TabKey =
  | 'roster' | 'listening' | 'reading' | 'pbl' | 'quiz'
  | 'homework' | 'participation' | 'overall' | 'report';

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'roster', label: 'Roster', icon: ClipboardList },
  { key: 'listening', label: 'Listening & Speaking', icon: Headphones },
  { key: 'reading', label: 'Reading', icon: BookOpen },
  { key: 'pbl', label: 'PBL', icon: Gamepad2 },
  { key: 'quiz', label: 'Quizzes', icon: ClipboardCheck },
  { key: 'homework', label: 'Homework', icon: Home },
  { key: 'participation', label: 'Participation', icon: Users },
  { key: 'overall', label: 'Overall', icon: Wand2 },
  { key: 'report', label: 'Report', icon: FileText },
];

interface ScoreFieldDef {
  key: keyof AssessmentStudentScores;
  label: string;
  max: number;
}
interface FieldGroupDef {
  subtitle: string;
  fields: ScoreFieldDef[];
}
interface TabDef {
  title: string;
  blurb: string;
  groups: FieldGroupDef[];
  notesKey?: keyof AssessmentStudentScores;
  notesLabel?: string;
}

const TAB_DEFS: Record<Exclude<TabKey, 'roster' | 'overall' | 'report'>, TabDef> = {
  listening: {
    title: 'Listening & Speaking',
    blurb: 'Rate each skill 0–5. Unrated skills are skipped, not counted as zero.',
    groups: [{
      subtitle: 'Skills (0–5)',
      fields: [
        { key: 'listening', label: 'Listening', max: 5 },
        { key: 'speaking', label: 'Speaking', max: 5 },
        { key: 'pronunciation', label: 'Pronunciation', max: 5 },
        { key: 'fluency', label: 'Fluency', max: 5 },
      ],
    }],
    notesKey: 'listeningNotes',
    notesLabel: 'Listening & speaking notes',
  },
  reading: {
    title: 'Reading Assessment',
    blurb: 'Rate each skill 0–5. Unrated skills are skipped, not counted as zero.',
    groups: [{
      subtitle: 'Skills (0–5)',
      fields: [
        { key: 'comprehension', label: 'Comprehension', max: 5 },
        { key: 'vocabulary', label: 'Vocabulary', max: 5 },
        { key: 'readingSpeed', label: 'Reading speed', max: 5 },
        { key: 'accuracy', label: 'Accuracy', max: 5 },
      ],
    }],
    notesKey: 'readingNotes',
    notesLabel: 'Reading notes',
  },
  pbl: {
    title: 'PBL Terms',
    blurb: 'Project-based learning criteria, each scored 0–100.',
    groups: [{
      subtitle: 'Criteria (0–100)',
      fields: [
        { key: 'pblSubject', label: 'Subject knowledge', max: 100 },
        { key: 'pblPresentation', label: 'Presentation', max: 100 },
        { key: 'pblLanguage', label: 'Language use', max: 100 },
        { key: 'pblFocusPoints', label: 'Focus points', max: 100 },
      ],
    }],
    notesKey: 'pblNotes',
    notesLabel: 'PBL notes',
  },
  quiz: {
    title: 'Quizzes',
    blurb: 'Five quizzes per term, each 0–100. Term scores average the quizzes you entered.',
    groups: [
      {
        subtitle: 'Term 1 (0–100)',
        fields: [
          { key: 'quizT1Q1', label: 'Quiz 1', max: 100 },
          { key: 'quizT1Q2', label: 'Quiz 2', max: 100 },
          { key: 'quizT1Q3', label: 'Quiz 3', max: 100 },
          { key: 'quizT1Q4', label: 'Quiz 4', max: 100 },
          { key: 'quizT1Q5', label: 'Quiz 5', max: 100 },
        ],
      },
      {
        subtitle: 'Term 2 (0–100)',
        fields: [
          { key: 'quizT2Q1', label: 'Quiz 1', max: 100 },
          { key: 'quizT2Q2', label: 'Quiz 2', max: 100 },
          { key: 'quizT2Q3', label: 'Quiz 3', max: 100 },
          { key: 'quizT2Q4', label: 'Quiz 4', max: 100 },
          { key: 'quizT2Q5', label: 'Quiz 5', max: 100 },
        ],
      },
    ],
    notesKey: 'quizNotes',
    notesLabel: 'Quiz notes',
  },
  homework: {
    title: 'Homework',
    blurb: 'Daily homework completion, each day 0–100.',
    groups: [{
      subtitle: 'Days (0–100)',
      fields: [
        { key: 'hwDay1', label: 'Day 1', max: 100 },
        { key: 'hwDay2', label: 'Day 2', max: 100 },
        { key: 'hwDay3', label: 'Day 3', max: 100 },
        { key: 'hwDay4', label: 'Day 4', max: 100 },
        { key: 'hwDay5', label: 'Day 5', max: 100 },
      ],
    }],
    notesKey: 'hwNotes',
    notesLabel: 'Homework notes',
  },
  participation: {
    title: 'Class Participation',
    blurb: 'Daily participation, each day 0–100.',
    groups: [{
      subtitle: 'Days (0–100)',
      fields: [
        { key: 'partDay1', label: 'Day 1', max: 100 },
        { key: 'partDay2', label: 'Day 2', max: 100 },
        { key: 'partDay3', label: 'Day 3', max: 100 },
        { key: 'partDay4', label: 'Day 4', max: 100 },
        { key: 'partDay5', label: 'Day 5', max: 100 },
      ],
    }],
    notesKey: 'partNotes',
    notesLabel: 'Participation notes',
  },
};

const SPONSORSHIP_OPTIONS = ['Pending', 'Full', 'Partial', 'None'] as const;

// ── Small building blocks ────────────────────────────────────────────

const toneClass = (tone: ReturnType<typeof scoreTone>): string => ({
  good: 'text-emerald-300',
  mid: 'text-amber-300',
  low: 'text-rose-300',
  none: 'text-slate-600',
}[tone]);

function ScoreCell(props: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const { value, max, disabled, onChange } = props;
  const [text, setText] = useState(value > 0 ? String(value) : '');
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    // adopt the incoming (remote) value during render — React docs pattern —
    // unless the local text already represents the same number
    setPrevValue(value);
    setText((current) => {
      const parsed = parseInt(current, 10);
      const local = Number.isFinite(parsed) ? parsed : 0;
      return local === value ? current : value > 0 ? String(value) : '';
    });
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      disabled={disabled}
      value={text}
      placeholder="—"
      // Spreadsheet-cell entry model: focusing selects the whole value, so
      // typing REPLACES the saved score instead of appending after it (the
      // appended "5" + new digit then clamped straight back to the cap —
      // "every score I type starts with 5", Oct 2026).
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const capped = sanitizeScoreText(e.target.value, max);
        // Refused keystrokes (extra digits, garbage) must leave the DOM now:
        // assigning back resyncs the field even when the text state is
        // unchanged and React bails out of the re-render.
        if (e.target.value !== capped) e.target.value = capped;
        setText(capped);
        const n = parseInt(capped, 10);
        onChange(Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0);
      }}
      className="w-16 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-300/50 focus:bg-cyan-300/[0.06] disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function TextCell(props: {
  value: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const { value, placeholder, rows, className, disabled, onChange } = props;
  const [text, setText] = useState(value);
  const [prevSrc, setPrevSrc] = useState(value);
  if (prevSrc !== value) {
    // adopt the incoming (remote) value during render — React docs pattern —
    // unless the user has already typed a replacement that differs
    setPrevSrc(value);
    if (text !== prevSrc && text !== value) { /* keep local edit */ } else { setText(value); }
  }
  return (
    <textarea
      rows={rows ?? 1}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
      className={`w-full resize-y rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:bg-cyan-300/[0.06] disabled:opacity-40 ${className ?? ''}`}
    />
  );
}

// ── Error humanizer ──────────────────────────────────────────────────

function humanizeError(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const msg = String((e as Error)?.message ?? e);
  if (status === 401 || /session has expired/i.test(msg)) {
    return 'Your session has expired. Close the workspace, click "Sign in as teacher" above, and reopen it — your records are safe.';
  }
  if (status === 403 || /permission|denied/i.test(msg)) {
    return 'Firestore denied this request for your account. Sign out and sign in again to reconnect; if it keeps failing, the assessment-records security rules need republishing (Firebase console → Firestore → Rules — copy firestore.rules from the repo).';
  }
  return msg;
}

// ── Main component ───────────────────────────────────────────────────

export interface WorkspaceSession {
  localId: string;
  email: string;
  displayName?: string | null;
}

export function AssessmentWorkspace({ session }: { session: WorkspaceSession }) {
  const uid = session.localId;
  const email = session.email;

  // Classes
  const [classes, setClasses] = useState<AssessmentClassDoc[] | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Realtime roster
  const [students, setStudents] = useState<AssessmentStudentDoc[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  // Clear the roster during render when switching class (React docs pattern)
  const [rosterClassId, setRosterClassId] = useState<string | null>(classId);
  if (rosterClassId !== classId) {
    setRosterClassId(classId);
    setStudents([]);
  }

  // Local-until-saved overlay (keeps typing responsive between debounced
  // writes). Each entry remembers its DESTINATION ('flat' = the original
  // top-level fields, or a week key) so a pending edit can never land in
  // the wrong week if the teacher switches weeks mid-save. Kept in STATE
  // (re-renders pick it up immediately); a mirror ref updated in an effect
  // lets the debounced save timers read the latest values without
  // re-scheduling.
  const [overlay, setOverlay] = useState<Map<string, { patch: Record<string, string | number>; dest: string }>>(new Map());
  const overlayMirror = useRef<Map<string, { patch: Record<string, string | number>; dest: string }>>(overlay);
  useEffect(() => { overlayMirror.current = overlay; }, [overlay]);
  const timersRef = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; dest: string }>>(new Map());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

  // UI state
  const [tab, setTab] = useState<TabKey>('roster');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Weekly entries: null = the original (pre-weekly) top-level record;
  // otherwise the ISO Monday key ("YYYY-MM-DD") of the selected week.
  // Weeks live in a `weeks` map on each student doc — the flat fields keep
  // the original data so nothing already recorded is lost or moved.
  const [weekKey, setWeekKey] = useState<string | null>(null);
  const [weekForClassId, setWeekForClassId] = useState<string | null>(classId);
  if (weekForClassId !== classId) {
    setWeekForClassId(classId);
    setWeekKey(null);
  }
  const todayWeekKey = useMemo(() => weekKeyOf(), []);
  const weekOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const s of students) {
      for (const [k, entry] of Object.entries(s.weeks ?? {})) {
        if (Object.keys(entry ?? {}).length) keys.add(k);
      }
    }
    return [...keys].sort().reverse();
  }, [students]);

  const activeClass = useMemo(
    () => classes?.find((c) => c.id === classId) ?? null,
    [classes, classId],
  );

  // Load my classes once
  useEffect(() => {
    let alive = true;
    listAssessmentClasses(uid, email)
      .then((rows) => {
        if (!alive) return;
        setClasses(rows);
        setClassId((cur) => cur ?? rows[0]?.id ?? null);
      })
      .catch((e) => {
        if (!alive) return;
        setClasses([]);
        setLoadError(humanizeError(e));
      });
    return () => { alive = false; };
  }, [uid]);

  // Subscribe to the selected class roster in realtime
  useEffect(() => {
    if (!classId) return;
    const unsub = subscribeAssessmentStudents(
      classId,
      // onSnapshot may fire synchronously on cached data — that's exactly
      // when we want to paint the roster.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      (rows) => { setStudents(rows); setRosterError(null); },
      (e) => setRosterError(humanizeError(e)),
    );
    return unsub;
  }, [classId]);

  // Debounced per-row save: collect overlay keys → patch (flat or week
  // leaf paths, per the captured destination) → drop overlay on success.
  // The destination is captured at schedule time: switching weeks while a
  // save is pending never redirects those edits into the new week.
  const scheduleSave = useCallback((studentId: string, dest: string) => {
    if (!classId) return;
    const timers = timersRef.current;
    const existing = timers.get(studentId);
    if (existing) clearTimeout(existing.timer);
    setSaveState('saving');
    timers.set(studentId, { timer: setTimeout(async () => {
      timers.delete(studentId);
      const entry = overlayMirror.current.get(studentId);
      if (!entry || entry.dest !== dest || !classId) return;
      try {
        if (dest === 'flat') {
          await patchAssessmentStudent(classId, studentId, entry.patch, email);
        } else {
          await patchAssessmentStudentWeek(classId, studentId, dest, entry.patch, email);
        }
        setOverlay((prev) => {
          if (!prev.has(studentId)) return prev;
          const next = new Map(prev);
          next.delete(studentId);
          return next;
        });
        setSaveState((s) => (s === 'error' ? s : timers.size === 0 ? 'idle' : 'saving'));
      } catch (e) {
        setSaveState('error');
        setRosterError(humanizeError(e));
      }
    }, 700), dest });
  }, [classId, email]);

  const changeField = useCallback((studentId: string, key: string, value: string | number) => {
    if (!classId) return;
    // Identity fields (name, schoolId, sponsorship, …) always live on the
    // student doc itself; score fields go to the selected week when one is
    // active, otherwise to the original top-level record.
    const dest = STUDENT_IDENTITY_FIELDS.has(key) ? 'flat' : (weekKey ?? 'flat');
    setOverlay((prev) => {
      const prevEntry = prev.get(studentId);
      const sameDest = prevEntry && prevEntry.dest === dest;
      const patch = { ...(sameDest ? prevEntry.patch : {}), [key]: value };
      const next = new Map(prev);
      next.set(studentId, { patch, dest });
      return next;
    });
    scheduleSave(studentId, dest);
  }, [classId, weekKey, scheduleSave]);

  // Row actions
  const addRow = useCallback(async (count = 1) => {
    if (!classId || busy) return;
    setBusy(true);
    try {
      for (let i = 0; i < count; i++) await addAssessmentStudent(classId, newStudentRow(), email);
    } catch (e) { setRosterError(humanizeError(e)); }
    setBusy(false);
  }, [classId, email, busy]);

  const duplicateRow = useCallback(async (s: AssessmentStudentDoc) => {
    if (!classId || busy) return;
    setBusy(true);
    try {
      await duplicateAssessmentStudent(classId, { ...s, name: s.name ? `${s.name} (copy)` : '' }, email);
    } catch (e) { setRosterError(humanizeError(e)); }
    setBusy(false);
  }, [classId, email, busy]);

  const deleteRow = useCallback(async (s: AssessmentStudentDoc) => {
    if (!classId || busy) return;
    if (!window.confirm(`Delete ${s.name || 'this student'} and all of their assessment scores? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await removeAssessmentStudent(classId, s.id);
      setOverlay((prev) => {
        if (!prev.has(s.id)) return prev;
        const next = new Map(prev);
        next.delete(s.id);
        return next;
      });
    } catch (e) { setRosterError(humanizeError(e)); }
    setBusy(false);
  }, [classId, busy]);

  // Delete the selected week's entry from every student that has one. The
  // original top-level record and all other weeks are untouched.
  const deleteWeek = useCallback(async () => {
    if (!classId || !weekKey || busy) return;
    const withData = students.filter((s) => Object.keys(s.weeks?.[weekKey] ?? {}).length > 0);
    if (withData.length === 0) { setWeekKey(null); return; }
    if (!window.confirm(`Delete ${formatWeekLabel(weekKey)} for ${withData.length} student${withData.length === 1 ? '' : 's'}? That week's scores cannot be recovered. Other weeks and the original record stay.`)) return;
    setBusy(true);
    try {
      for (const s of withData) await clearAssessmentWeek(classId, s.id, weekKey);
      setWeekKey(null);
    } catch (e) { setRosterError(humanizeError(e)); }
    setBusy(false);
  }, [classId, weekKey, busy, students]);

  // Effective record = what the tabs display for the SELECTED view:
  //  - identity fields always come from the flat doc (plus any pending edits)
  //  - score fields come from the selected week's entry when one is active
  //    (blank = not assessed that week), otherwise from the flat fields
  //  - pending overlay edits apply only when their destination matches the
  //    view, so typing into week A never bleeds into week B mid-save
  const effectiveStudents = useMemo(
    () => students.map((s) => {
      const entry = overlay.get(s.id);
      let base: AssessmentStudentDoc = s;
      if (weekKey) {
        const weekData = s.weeks?.[weekKey] ?? {};
        base = { ...s, ...emptyStudentScores(), ...weekData } as AssessmentStudentDoc;
      }
      if (entry) {
        const sameView = entry.dest === 'flat' ? weekKey === null : entry.dest === weekKey;
        if (sameView) {
          base = { ...base, ...entry.patch } as AssessmentStudentDoc;
        } else {
          const idPatch = Object.fromEntries(
            Object.entries(entry.patch).filter(([k]) => STUDENT_IDENTITY_FIELDS.has(k)),
          );
          if (Object.keys(idPatch).length) base = { ...base, ...idPatch } as AssessmentStudentDoc;
        }
      }
      return base;
    }),
    [students, overlay, weekKey],
  );
  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return effectiveStudents;
    return effectiveStudents.filter((s) =>
      s.name.toLowerCase().includes(q) || s.schoolId.toLowerCase().includes(q));
  }, [effectiveStudents, search]);

  // Class-details draft (school / teacher name) — editable in the class bar.
  // Draft state wins while the user types; the debounced save mirrors into a
  // ref so the timer always reads the latest values.
  const [metaDraft, setMetaDraft] = useState<{ schoolName: string; teacherName: string } | null>(null);
  const [metaForClassId, setMetaForClassId] = useState(classId);
  if (metaForClassId !== classId) {
    // switching class — reset the local draft during render (React docs pattern)
    setMetaForClassId(classId);
    setMetaDraft(null);
  }
  const metaMirror = useRef<{ schoolName: string; teacherName: string } | null>(null);
  useEffect(() => { metaMirror.current = metaDraft; }, [metaDraft]);
  const classMeta = metaDraft ?? {
    schoolName: activeClass?.schoolName ?? '',
    teacherName: activeClass?.teacherName ?? '',
  };
  const metaTimers = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeClassMeta = useCallback((key: 'schoolName' | 'teacherName', value: string) => {
    if (!classId) return;
    setMetaDraft((prev) => ({
      schoolName: key === 'schoolName' ? value : (prev?.schoolName ?? activeClass?.schoolName ?? ''),
      teacherName: key === 'teacherName' ? value : (prev?.teacherName ?? activeClass?.teacherName ?? ''),
    }));
    if (metaTimers.current) clearTimeout(metaTimers.current);
    metaTimers.current = setTimeout(() => {
      updateAssessmentClass(classId, metaMirror.current ?? {}).catch((e) => setRosterError(humanizeError(e)));
    }, 800);
  }, [classId, activeClass]);

  const saveStatusChip = saveState === 'saving'
    ? { icon: Loader2, text: 'Saving…', cls: 'text-cyan-200 border-cyan-300/30 bg-cyan-300/10', spin: true }
    : saveState === 'error'
      ? { icon: AlertTriangle, text: 'Save failed', cls: 'text-rose-200 border-rose-300/30 bg-rose-300/10', spin: false }
      : { icon: ClipboardCheck, text: 'Live · all changes saved', cls: 'text-emerald-200 border-emerald-300/25 bg-emerald-300/10', spin: false };
  const StatusIcon = saveStatusChip.icon;

  return (
    <div className="relative mx-auto mt-12 max-w-7xl px-5 sm:px-8" data-testid="assessment-workspace">
      <div className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#0b1724]/95 shadow-[0_30px_90px_-40px_rgba(0,0,0,.95)] backdrop-blur-xl">
        {/* Class bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/8 bg-white/[0.02] px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/5 text-cyan-200"><ClipboardList className="h-4.5 w-4.5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.16em] text-slate-500 uppercase">Assessment workspace</p>
            <p className="text-sm font-bold text-white">{activeClass ? `${activeClass.schoolName || 'My school'} · ${activeClass.name}` : 'Daily Student Assessment Records'}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={classId ?? ''}
              onChange={(e) => setClassId(e.target.value || null)}
              className="max-w-52 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-300/50"
              aria-label="Select assessment class"
            >
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name || 'Untitled class'}</option>)}
              {(classes ?? []).length === 0 && <option value="">No classes yet</option>}
            </select>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-3 py-2 text-[11px] font-bold text-slate-950 transition hover:-translate-y-0.5">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New class
            </button>
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${saveStatusChip.cls}`}>
              <StatusIcon className={`h-3 w-3 ${saveStatusChip.spin ? 'animate-spin' : ''}`} aria-hidden="true" /> {saveStatusChip.text}
            </span>
          </div>
        </div>

        {/* Class details — school + teacher name (persisted to the class doc) */}
        {activeClass && (
          <div className="grid gap-3 border-b border-white/8 bg-white/[0.015] px-5 py-3 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">School</span>
              <input
                value={classMeta.schoolName}
                onChange={(e) => changeClassMeta('schoolName', e.target.value)}
                placeholder="School / institution name"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Teacher</span>
              <input
                value={classMeta.teacherName}
                onChange={(e) => changeClassMeta('teacherName', e.target.value)}
                placeholder="Class teacher's name"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
              />
            </label>
          </div>
        )}

        {/* Assessment week selector — weekly entries keyed by the week's
            Monday date. 'Initial record' shows/edits the original flat
            fields (everything recorded before weekly tracking existed). */}
        {activeClass && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-white/[0.015] px-5 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/5 text-cyan-200"><CalendarDays className="h-3 w-3" aria-hidden="true" /></span>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Assessment week</span>
            <select
              value={weekKey ?? '__base__'}
              onChange={(e) => setWeekKey(e.target.value === '__base__' ? null : e.target.value)}
              className="max-w-56 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-300/50"
              aria-label="Assessment week"
            >
              <option value="__base__">Initial record (no date)</option>
              {weekOptions.map((k) => <option key={k} value={k}>{formatWeekLabel(k)}</option>)}
            </select>
            <input
              type="date"
              value={weekKey ?? todayWeekKey}
              onChange={(e) => { if (e.target.value) setWeekKey(weekKeyOf(new Date(`${e.target.value}T00:00:00`))); }}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-300/50"
              aria-label="Pick a week by date"
            />
            <button
              type="button"
              onClick={() => setWeekKey(todayWeekKey)}
              disabled={weekKey === todayWeekKey}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[11px] font-bold text-cyan-100 transition hover:-translate-y-0.5 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> This week
            </button>
            {weekKey && (
              <button
                type="button"
                onClick={() => void deleteWeek()}
                disabled={busy}
                title="Delete this week's scores for every student"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-[11px] font-bold text-rose-100 transition hover:-translate-y-0.5 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete week
              </button>
            )}
            <span className="ml-auto text-[10px] font-semibold text-slate-500">
              {weekKey
                ? `Recording into ${formatWeekLabel(weekKey)} — other weeks stay as history`
                : 'Recording into the original record — pick a date above to start a new week'}
            </span>
          </div>
        )}

        {(loadError || rosterError) && (
          <div className="flex items-start gap-2.5 border-b border-rose-300/20 bg-rose-400/[0.07] px-5 py-3 text-xs leading-relaxed text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <span>{loadError ?? rosterError}</span>
            <button type="button" onClick={() => { setLoadError(null); setRosterError(null); }} className="ml-auto shrink-0 rounded p-0.5 text-rose-200/70 hover:text-rose-100" aria-label="Dismiss error"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/8 px-4 py-2.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                tab === key ? 'bg-cyan-300/15 text-cyan-100' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        {tab !== 'report' && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-white/[0.015] px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student…"
                className="w-48 rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
              />
            </div>
            <button type="button" onClick={() => void addRow(1)} disabled={busy || !classId} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[11px] font-bold text-cyan-100 transition hover:-translate-y-0.5 disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add student
            </button>
            <button type="button" onClick={() => void addRow(5)} disabled={busy || !classId} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-300 transition hover:-translate-y-0.5 disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add 5
            </button>
            <span className="ml-auto text-[10px] font-semibold text-slate-500">
              {visibleStudents.length} of {students.length} students · {activeClass?.teacherEmail ? `owner ${activeClass.teacherEmail}` : ''}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="px-2 pb-6 pt-4 sm:px-4">
          {!classId && classes !== null && (
            <EmptyState
              title="No assessment class yet"
              body="Create your first class to start recording daily assessments. Each class keeps its own roster, scores, remarks, and report — stored in this site's Firebase and visible only to signed-in teacher accounts."
            />
          )}
          {classId && rosterError === null && students.length === 0 && classes !== null && (
            <EmptyState
              title="Empty roster"
              body="Add your first student, then record scores across listening, reading, PBL, quizzes, homework, and participation. Everything saves automatically and syncs to your other devices in real time."
            />
          )}

          {tab === 'roster' && classId && visibleStudents.length > 0 && (
            <RosterTab
              students={visibleStudents}
              disabled={busy}
              onChange={changeField}
              onDuplicate={(s) => void duplicateRow(s)}
              onDelete={(s) => void deleteRow(s)}
            />
          )}

          {classId && visibleStudents.length > 0 && TAB_DEFS[tab as keyof typeof TAB_DEFS] && (
            <ScoresTab
              def={TAB_DEFS[tab as keyof typeof TAB_DEFS]}
              students={visibleStudents}
              disabled={busy}
              onChange={changeField}
            />
          )}

          {tab === 'overall' && classId && visibleStudents.length > 0 && (
            <OverallTab students={visibleStudents} remarks={activeClass?.remarks ?? ''} onRemarks={(v) => {
              if (!classId) return;
              if (metaTimers.current) clearTimeout(metaTimers.current);
              metaTimers.current = setTimeout(() => {
                updateAssessmentClass(classId, { remarks: v }).catch((e) => setRosterError(humanizeError(e)));
              }, 800);
            }} />
          )}

          {tab === 'report' && classId && (
            <ReportTab
              students={effectiveStudents}
              schoolName={classMeta.schoolName || activeClass?.schoolName || ''}
              className={activeClass?.name ?? ''}
              teacherName={classMeta.teacherName || activeClass?.teacherName || ''}
              remarks={activeClass?.remarks ?? ''}
              weekKey={weekKey}
              onError={(m) => setRosterError(m)}
            />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateClassModal
          defaultTeacher={session.displayName || ''}
          creating={creating}
          onCreate={async (schoolName, name, teacherName) => {
            setCreating(true); setCreateError(null);
            try {
              const id = await createAssessmentClass({ teacherUid: uid, teacherEmail: email, schoolName, name, teacherName });
              const rows = await listAssessmentClasses(uid);
              setClasses(rows);
              setClassId(id ?? rows[0]?.id ?? null);
              setShowCreate(false);
            } catch (e) { setCreateError(humanizeError(e)); }
            setCreating(false);
          }}
          onClose={() => { setShowCreate(false); setCreateError(null); }}
          error={createError}
        />
      )}
    </div>
  );
}

// ── Sub components ───────────────────────────────────────────────────

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200"><ClipboardList className="h-6 w-6" aria-hidden="true" /></span>
      <p className="mt-4 text-sm font-bold text-white">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

function TableShell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03] text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{head}</tr>
        </thead>
        <tbody className="divide-y divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}

function StudentCell({ s, disabled, onChange }: { s: AssessmentStudentDoc; disabled: boolean; onChange: (k: string, v: string | number) => void }) {
  return (
    <div className="sticky left-0 z-10 min-w-44 bg-[#0b1724] px-3 py-2.5">
      <input
        value={s.name}
        placeholder="Student name"
        disabled={disabled}
        onChange={(e) => onChange('name', e.target.value)}
        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-bold text-white outline-none transition placeholder:font-normal placeholder:text-slate-600 hover:border-white/10 focus:border-cyan-300/50 focus:bg-white/[0.05]"
      />
      <input
        value={s.schoolId}
        placeholder="School ID"
        disabled={disabled}
        onChange={(e) => onChange('schoolId', e.target.value)}
        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[10px] text-slate-400 outline-none transition placeholder:text-slate-700 hover:border-white/10 focus:border-cyan-300/50 focus:bg-white/[0.05]"
      />
    </div>
  );
}

function RosterTab(props: {
  students: AssessmentStudentDoc[];
  disabled: boolean;
  onChange: (id: string, key: string, value: string | number) => void;
  onDuplicate: (s: AssessmentStudentDoc) => void;
  onDelete: (s: AssessmentStudentDoc) => void;
}) {
  const { students, disabled, onChange, onDuplicate, onDelete } = props;
  return (
    <TableShell
      head={(
        <>
          <th className="px-3 py-2.5">Student</th>
          <th className="px-3 py-2.5">Sponsorship</th>
          <th className="px-3 py-2.5">Amount</th>
          <th className="px-3 py-2.5">Comments</th>
          <th className="px-3 py-2.5">Teacher feedback</th>
          <th className="px-3 py-2.5 text-center">Overall</th>
          <th className="px-3 py-2.5 text-right">Actions</th>
        </>
      )}
    >
      {students.map((s) => {
        const scores = areaScores(s);
        return (
          <tr key={s.id} className="align-top transition-colors hover:bg-white/[0.02]">
            <td className="p-0"><StudentCell s={s} disabled={disabled} onChange={(k, v) => onChange(s.id, k, v)} /></td>
            <td className="px-3 py-2.5">
              <select
                value={s.sponsorship || 'Pending'}
                disabled={disabled}
                onChange={(e) => onChange(s.id, 'sponsorship', e.target.value)}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-300/50"
              >
                {SPONSORSHIP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </td>
            <td className="px-3 py-2.5">
              <input value={s.amount} placeholder="$" disabled={disabled} onChange={(e) => onChange(s.id, 'amount', e.target.value)} className="w-20 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50" />
            </td>
            <td className="px-3 py-2.5 min-w-40"><TextCell value={s.comments} placeholder="Student comments…" disabled={disabled} onChange={(v) => onChange(s.id, 'comments', v)} /></td>
            <td className="px-3 py-2.5 min-w-40"><TextCell value={s.teacherComment} placeholder="Personalized feedback…" disabled={disabled} onChange={(v) => onChange(s.id, 'teacherComment', v)} /></td>
            <td className="px-3 py-2.5 text-center"><span className={`cmc-stat-num text-base ${toneClass(scoreTone(scores.overall))}`}>{scores.overall > 0 ? `${scores.overall}%` : '—'}</span></td>
            <td className="px-3 py-2.5">
              <div className="flex items-center justify-end gap-1">
                <button type="button" title="Duplicate" disabled={disabled} onClick={() => onDuplicate(s)} className="rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-slate-400 transition hover:text-cyan-200 disabled:opacity-40"><Copy className="h-3.5 w-3.5" /></button>
                <button type="button" title="Delete" disabled={disabled} onClick={() => onDelete(s)} className="rounded-md border border-white/10 bg-white/[0.04] p-1.5 text-slate-400 transition hover:text-rose-300 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function ScoresTab(props: {
  def: { title: string; blurb: string; groups: FieldGroupDef[]; notesKey?: keyof AssessmentStudentScores; notesLabel?: string };
  students: AssessmentStudentDoc[];
  disabled: boolean;
  onChange: (id: string, key: string, value: string | number) => void;
}) {
  const { def, students, disabled, onChange } = props;
  const areaKey = def.notesKey === 'listeningNotes' ? 'listening'
    : def.notesKey === 'readingNotes' ? 'reading'
    : def.notesKey === 'pblNotes' ? 'pbl'
    : def.notesKey === 'quizNotes' ? 'quiz'
    : def.notesKey === 'hwNotes' ? 'homework' : 'participation';
  return (
    <div className="space-y-4">
      <p className="px-2 text-[11px] leading-relaxed text-slate-500"><span className="font-bold text-slate-300">{def.title}.</span> {def.blurb}</p>
      <TableShell
        head={(
          <>
            <th className="px-3 py-2.5">Student</th>
            {def.groups.map((g) => (
              g.fields.map((f) => <th key={f.key} className="px-2 py-2.5 text-center" title={g.subtitle}>{f.label}</th>)
            ))}
            <th className="px-3 py-2.5 text-center">Area %</th>
            {def.notesKey && <th className="px-3 py-2.5">{def.notesLabel}</th>}
          </>
        )}
      >
        {students.map((s) => {
          const scores = areaScores(s);
          return (
            <tr key={s.id} className="align-top transition-colors hover:bg-white/[0.02]">
              <td className="p-0"><StudentCell s={s} disabled={disabled} onChange={(k, v) => onChange(s.id, k, v)} /></td>
              {def.groups.map((g) => (
                g.fields.map((f) => (
                  <td key={String(f.key)} className="px-2 py-2.5 text-center">
                    <ScoreCell value={Number(s[f.key]) || 0} max={f.max} disabled={disabled} onChange={(v) => onChange(s.id, String(f.key), v)} />
                  </td>
                ))
              ))}
              <td className="px-3 py-2.5 text-center">
                <span className={`cmc-stat-num text-base ${toneClass(scoreTone(scores[areaKey as keyof AreaScores]))}`}>
                  {scores[areaKey as keyof AreaScores] > 0 ? `${scores[areaKey as keyof AreaScores]}%` : '—'}
                </span>
              </td>
              {def.notesKey && (
                <td className="px-3 py-2.5 min-w-44">
                  <TextCell value={String(s[def.notesKey] ?? '')} placeholder="Notes…" disabled={disabled} onChange={(v) => onChange(s.id, String(def.notesKey), v)} />
                </td>
              )}
            </tr>
          );
        })}
      </TableShell>
    </div>
  );
}

function OverallTab(props: {
  students: AssessmentStudentDoc[];
  remarks: string;
  onRemarks: (v: string) => void;
}) {
  const { students, remarks, onRemarks } = props;
  const areas: Array<{ key: keyof AreaScores; label: string }> = [
    { key: 'listening', label: 'Listening' },
    { key: 'reading', label: 'Reading' },
    { key: 'pbl', label: 'PBL' },
    { key: 'quiz', label: 'Quizzes' },
    { key: 'homework', label: 'Homework' },
    { key: 'participation', label: 'Participation' },
  ];
  const classAvg = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of [...areas.map((x) => x.key), 'overall' as const]) {
      const vals = students.map((s) => areaScores(s)[a]).filter((v) => v > 0);
      out[a] = vals.length === 0 ? 0 : Math.round(vals.reduce((x, y) => x + y, 0) / vals.length);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 px-2">
        {[...areas.map((a) => ({ ...a, v: classAvg[a.key] })), { key: 'overall' as const, label: 'Overall', v: classAvg.overall }].map(({ key, label, v }) => (
          <div key={String(key)} className="flex min-w-28 flex-1 flex-col items-center gap-1 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
            <span className={`cmc-stat-num text-xl ${toneClass(scoreTone(v))}`}>{v > 0 ? `${v}%` : '—'}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Class {label}</span>
          </div>
        ))}
      </div>
      <TableShell
        head={(
          <>
            <th className="px-3 py-2.5">Student</th>
            {areas.map((a) => <th key={String(a.key)} className="px-2 py-2.5 text-center">{a.label}</th>)}
            <th className="px-2 py-2.5 text-center">Overall</th>
          </>
        )}
      >
        {students.map((s) => {
          const scores = areaScores(s);
          return (
            <tr key={s.id} className="transition-colors hover:bg-white/[0.02]">
              <td className="px-3 py-2.5 text-xs font-bold text-white">{s.name || <span className="font-normal text-slate-600">Unnamed student</span>}<span className="ml-2 text-[10px] font-normal text-slate-500">{s.schoolId}</span></td>
              {areas.map((a) => (
                <td key={String(a.key)} className="px-2 py-2.5 text-center text-xs font-semibold">
                  <span className={toneClass(scoreTone(scores[a.key]))}>{scores[a.key] > 0 ? scores[a.key] : '—'}</span>
                </td>
              ))}
              <td className="px-2 py-2.5 text-center"><span className={`cmc-stat-num text-base ${toneClass(scoreTone(scores.overall))}`}>{scores.overall > 0 ? `${scores.overall}%` : '—'}</span></td>
            </tr>
          );
        })}
      </TableShell>
      <div className="px-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Overall class assessment remarks</label>
        <TextCell className="mt-2" rows={3} value={remarks} placeholder="General observations and recommendations for this class…" onChange={onRemarks} />
      </div>
    </div>
  );
}

// ── Report: CSV export + printable summary ───────────────────────────

function buildCsv(students: AssessmentStudentDoc[]): string {
  const head = ['Name', 'School ID', 'Sponsorship', 'Amount', 'Listening %', 'Reading %', 'PBL %', 'Quiz %', 'Homework %', 'Participation %', 'Overall %', 'Comments', 'Teacher feedback'];
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = students.map((s) => {
    const a = areaScores(s);
    return [s.name, s.schoolId, s.sponsorship, s.amount, a.listening, a.reading, a.pbl, a.quiz, a.homework, a.participation, a.overall, s.comments, s.teacherComment].map(esc).join(',');
  });
  return '\uFEFF' + [head.map(esc).join(','), ...rows].join('\r\n');
}

function buildReportHtml(o: { students: AssessmentStudentDoc[]; schoolName: string; className: string; teacherName: string; remarks: string; weekLabel?: string }): string {
  const rows = o.students.map((s, i) => {
    const a = areaScores(s);
    const cell = (v: number) => `<td style="padding:7px 10px;text-align:center;color:${v <= 0 ? '#94a3b8' : v >= 70 ? '#059669' : v >= 50 ? '#b45309' : '#dc2626'};font-weight:600">${v > 0 ? v + '%' : '—'}</td>`;
    return `<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:7px 10px">${i + 1}</td>
      <td style="padding:7px 10px;font-weight:700">${escapeHtml(s.name || 'Unnamed student')}</td>
      <td style="padding:7px 10px">${escapeHtml(s.schoolId)}</td>
      <td style="padding:7px 10px">${escapeHtml(s.sponsorship)}</td>
      ${cell(a.listening)}${cell(a.reading)}${cell(a.pbl)}${cell(a.quiz)}${cell(a.homework)}${cell(a.participation)}
      ${cell(a.overall)}
    </tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Assessment Report — ${escapeHtml(o.className)}</title>
  <style>body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;margin:28px}h1{font-size:20px;margin:0}h2{font-size:12px;color:#475569;font-weight:600;margin:4px 0 18px}
  table{border-collapse:collapse;width:100%;font-size:12px}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#475569;border-bottom:2px solid #cbd5e1}
  .meta{display:flex;gap:26px;margin:0 0 14px;font-size:12px;color:#334155}.remarks{margin-top:18px;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
  @media print{body{margin:10mm}}</style></head><body>
  <h1>Daily Student Assessment Report</h1>
  <h2>Creative Minds Network · generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${o.weekLabel ? ` · ${escapeHtml(o.weekLabel)}` : ''}</h2>
  <div class="meta"><span><strong>School:</strong> ${escapeHtml(o.schoolName || '—')}</span><span><strong>Class:</strong> ${escapeHtml(o.className || '—')}</span><span><strong>Teacher:</strong> ${escapeHtml(o.teacherName || '—')}</span><span><strong>Students:</strong> ${o.students.length}</span></div>
  <table><thead><tr><th>#</th><th>Student</th><th>School ID</th><th>Sponsorship</th><th>Listening</th><th>Reading</th><th>PBL</th><th>Quizzes</th><th>Homework</th><th>Participation</th><th>Overall</th></tr></thead><tbody>${rows}</tbody></table>
  ${o.remarks ? `<div class="remarks"><strong>Overall remarks:</strong> ${escapeHtml(o.remarks)}</div>` : ''}
  <script>window.onload = () => window.print()</script></body></html>`;
}

function escapeHtml(v: string): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function ReportTab(props: {
  students: AssessmentStudentDoc[];
  schoolName: string;
  className: string;
  teacherName: string;
  remarks: string;
  weekKey: string | null;
  onError: (m: string) => void;
}) {
  const { students, schoolName, className, teacherName, remarks, weekKey, onError } = props;
  const weekLabel = weekKey ? formatWeekLabel(weekKey) : '';
  const print = () => {
    try {
      const w = window.open('', '_blank', 'width=980,height=760');
      if (!w) throw new Error('Pop-up blocked — allow pop-ups for this site to print the report.');
      w.document.write(buildReportHtml({ students, schoolName, className, teacherName, remarks, weekLabel }));
      w.document.close();
    } catch (e) { onError(String((e as Error).message ?? e)); }
  };
  const csv = () => {
    try {
      const blob = new Blob([buildCsv(students)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cmc-assessment-${(className || 'class').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${weekKey ?? 'initial'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { onError(String((e as Error).message ?? e)); }
  };
  return (
    <div className="space-y-4 px-2">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
        <FileText className="h-5 w-5 text-cyan-200" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">Class report — {students.length} students{weekLabel ? ` · ${weekLabel}` : ''}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Print a formal summary or export the full score sheet as CSV for Excel / Google Sheets. The report covers the week selected above.</p>
        </div>
        <button type="button" onClick={csv} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3.5 py-2 text-[11px] font-bold text-cyan-100 transition hover:-translate-y-0.5"><Download className="h-3.5 w-3.5" /> Download CSV</button>
        <button type="button" onClick={print} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-3.5 py-2 text-[11px] font-bold text-slate-950 transition hover:-translate-y-0.5"><Printer className="h-3.5 w-3.5" /> Print report</button>
      </div>
      <p className="px-1 text-[10px] leading-relaxed text-slate-600"><RefreshCw className="mr-1 inline h-3 w-3" aria-hidden="true" />The report always reflects the latest saved Firestore data — every signed-in teacher sees the same numbers.</p>
    </div>
  );
}

function CreateClassModal(props: {
  defaultTeacher: string;
  creating: boolean;
  error: string | null;
  onCreate: (schoolName: string, name: string, teacherName: string) => void;
  onClose: () => void;
}) {
  const { defaultTeacher, creating, error, onCreate, onClose } = props;
  const [schoolName, setSchoolName] = useState('');
  const [name, setName] = useState('');
  const [teacherName, setTeacherName] = useState(defaultTeacher);
  const inputCls = 'w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50';
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create assessment class">
      <div className="w-full max-w-md rounded-2xl border border-cyan-300/20 bg-[#0b1724] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-cyan-300 uppercase">Assessment workspace</p>
            <h3 className="mt-1 text-base font-bold text-white">Create assessment class</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 space-y-3.5">
          <div><label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">School / institution</label><input className={`${inputCls} mt-1.5`} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Creative Minds Academy" /></div>
          <div><label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Class name</label><input className={`${inputCls} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 7 — Morning" /></div>
          <div><label className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Class teacher</label><input className={`${inputCls} mt-1.5`} value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Teacher's name" /></div>
          {error && <p className="rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100">{error}</p>}
          <button
            type="button"
            disabled={creating || !name.trim()}
            onClick={() => onCreate(schoolName, name, teacherName)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-3 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? 'Creating…' : 'Create class'}
          </button>
          <p className="text-center text-[10px] leading-relaxed text-slate-600">Visible only to signed-in teacher accounts ("edu" emails). You can rename or extend it later.</p>
        </div>
      </div>
    </div>
  );
}
