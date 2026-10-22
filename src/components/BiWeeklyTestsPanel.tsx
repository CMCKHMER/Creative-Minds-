// Bi-Weekly Private Tests — teacher panel (Option A: teacher-side grading).
//
// Everything a teacher needs to assign a private bi-weekly test and watch
// scores arrive live:
//   1. One-time teacher registration (teachers/{uid} allowlist, rules-gated).
//   2. Install an answer key (.key.json produced by scripts/make_private_test.mjs
//      — the key NEVER ships in the repo or the public pages).
//   3. Create an assignment: test + class + window + duration.
//   4. Live scoreboard: raw submissions are fetched every 6 seconds while the
//      tab is visible, graded locally against the installed key, and cached
//      into test_scores so reopening later is instant ("Grade now" re-runs).
//   5. Most-missed questions + CSV export.
// Students see NONE of this: their pages carry no answers and no scores.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock, ClipboardList, Download, FileWarning,
  KeyRound, Link2, RefreshCw, Trash2, Users,
} from 'lucide-react';
import {
  createAssignment, deleteAssignment, ensureTeacherRegistration, getRestAuthUid, getTestKey,
  listAssignments, listScores, listSubmissions, putScore, putTestKey, putTestMeta,
  RestError,
  type AssignmentDoc, type ScoreDoc, type SubmissionDoc,
} from '../lib/testDb';
import { gradeSubmission, mostMissedQuestions, type GradeResult, type TestKey } from '../lib/biweeklyGrading';

/** Private tests available for assignment — every entry has a generated
 *  answer-free page at biweek-planner/tests/private/<slug>.html plus a
 *  .key.json (scripts/make_private_test.mjs) the teacher installs once.
 *  Grouped for the dropdown; keep testId in sync with the generator
 *  ('biweek-' + slug). */
interface PrivateTestEntry { testId: string; title: string; slug: string; defaultMinutes: number; group: string; }
const PRIVATE_TEST_CATALOG: PrivateTestEntry[] = [
  // Orientation
  { testId: 'biweek-diagnostic', title: 'Orientation Diagnostic (Week 2 · All Sections)', slug: 'diagnostic', defaultMinutes: 20, group: 'Orientation' },
  // ISEC II bi-weekly series
  { testId: 'biweek-isec2-w2-listening', title: 'W2 · Business Listening (B2 + C1)', slug: 'isec2-w2-listening', defaultMinutes: 15, group: 'ISEC II weekly tests' },
  { testId: 'biweek-isec2-w3-grammar', title: 'W3 · C1 Grammar: Conciseness & Precision', slug: 'isec2-w3-grammar', defaultMinutes: 12, group: 'ISEC II weekly tests' },
  { testId: 'biweek-isec2-w4-reading', title: 'W4 · C2 Reading: Corporate Epistemology', slug: 'isec2-w4-reading', defaultMinutes: 10, group: 'ISEC II weekly tests' },
  { testId: 'biweek-isec2-w5-listening', title: 'W5 · C1 Listening: Innovation in Business', slug: 'isec2-w5-listening', defaultMinutes: 12, group: 'ISEC II weekly tests' },
  { testId: 'biweek-isec2-w6-grammar', title: 'W6 · C2 Grammar: Modals & Conditionals', slug: 'isec2-w6-grammar', defaultMinutes: 15, group: 'ISEC II weekly tests' },
  { testId: 'biweek-isec2-w7-reading', title: 'W7 · C2 Reading: The Algorithmic Enterprise', slug: 'isec2-w7-reading', defaultMinutes: 10, group: 'ISEC II weekly tests' },
  { testId: 'biweek-week8-mock', title: 'Level 10 TOEFL Mock Test (30 questions)', slug: 'week8-mock', defaultMinutes: 30, group: 'ISEC II weekly tests' },
  // Week 8 recaps
  { testId: 'biweek-week8-recap-grammar', title: 'Grammar Drill — Recap', slug: 'week8-recap-grammar', defaultMinutes: 12, group: 'Week 8 recaps' },
  { testId: 'biweek-week8-recap-listening', title: 'Listening Drill — Recap', slug: 'week8-recap-listening', defaultMinutes: 12, group: 'Week 8 recaps' },
  { testId: 'biweek-week8-recap-reading', title: 'Reading Drill — Recap', slug: 'week8-recap-reading', defaultMinutes: 8, group: 'Week 8 recaps' },
  // Earlier weekly drill series
  { testId: 'biweek-week2-grammar', title: 'Week 2 · Grammar: Conditionals & Agreement', slug: 'week2-grammar', defaultMinutes: 12, group: 'Weekly drills (earlier cohort)' },
  { testId: 'biweek-week3-listening', title: 'Week 3 · Listening: Chance Discoveries', slug: 'week3-listening', defaultMinutes: 15, group: 'Weekly drills (earlier cohort)' },
  { testId: 'biweek-week4-reading', title: 'Week 4 · Reading: Genes, Health & Longevity', slug: 'week4-reading', defaultMinutes: 12, group: 'Weekly drills (earlier cohort)' },
  { testId: 'biweek-week5-grammar', title: 'Week 5 · Grammar: Conditionals & Agreement', slug: 'week5-grammar', defaultMinutes: 12, group: 'Weekly drills (earlier cohort)' },
  { testId: 'biweek-week6-listening', title: 'Week 6 · Listening: Student Athletes', slug: 'week6-listening', defaultMinutes: 15, group: 'Weekly drills (earlier cohort)' },
  { testId: 'biweek-week7-reading', title: 'Week 7 · Reading: How We Name the Stars', slug: 'week7-reading', defaultMinutes: 10, group: 'Weekly drills (earlier cohort)' },
  // Skills drills
  { testId: 'biweek-grammar', title: 'Level 9b Grammar', slug: 'grammar', defaultMinutes: 10, group: 'Skills drills' },
  { testId: 'biweek-structure', title: 'Level 11b Written Expressions', slug: 'structure', defaultMinutes: 10, group: 'Skills drills' },
  { testId: 'biweek-business-listening', title: 'B2 Business Listening Drill', slug: 'business-listening', defaultMinutes: 10, group: 'Skills drills' },
  { testId: 'biweek-inference-listening', title: 'Listening · Inference', slug: 'inference-listening', defaultMinutes: 8, group: 'Skills drills' },
  { testId: 'biweek-prediction-listening', title: 'Listening · Prediction', slug: 'prediction-listening', defaultMinutes: 8, group: 'Skills drills' },
  { testId: 'biweek-short-conversations', title: 'Listening · Short Conversations', slug: 'short-conversations', defaultMinutes: 8, group: 'Skills drills' },
];

/** Catalog entries grouped for an <optgroup> dropdown. */
const CATALOG_GROUPS = PRIVATE_TEST_CATALOG.reduce<{ label: string; items: PrivateTestEntry[] }[]>((acc, t) => {
  const g = acc.find((x) => x.label === t.group);
  if (g) g.items.push(t); else acc.push({ label: t.group, items: [t] });
  return acc;
}, []);

interface FirebaseClass {
  id: string;
  name?: string;
  program?: string;
  code?: string;
}

interface Props {
  teacherUid: string;
  classes: FirebaseClass[];
}

interface RowState {
  submission: SubmissionDoc | null;
  score: ScoreDoc | null;
}

export const BiWeeklyTestsPanel: React.FC<Props> = ({ teacherUid, classes }) => {
  const [registered, setRegistered] = useState<'checking' | 'yes' | 'no'>('checking');
  const [assignments, setAssignments] = useState<AssignmentDoc[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<string>('');
  const [loadError, setLoadError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // The uid the Firestore REST transport + rules actually see. The dashboard's
  // `teacherUid` prop can come from a different auth path (Supabase member
  // flow vs Firebase teacher pass) — create-assignment MUST carry the REST
  // uid or the rules reject it (teacherUid == request.auth.uid).
  const [testUid, setTestUid] = useState('');
  const [createStatus, setCreateStatus] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null);

  // Create-assignment form
  const [formTestId, setFormTestId] = useState(PRIVATE_TEST_CATALOG[0].testId);
  const [formClassId, setFormClassId] = useState('');
  const [formMinutes, setFormMinutes] = useState(20);
  const [formClosesAt, setFormClosesAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  // Live scoreboard state
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [liveKey, setLiveKey] = useState<TestKey | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [gradingNote, setGradingNote] = useState('');
  const keyCache = useRef<Record<string, TestKey>>({});

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selected) ?? null,
    [assignments, selected],
  );

  // 0) Register the signed-in teacher on the allowlist (idempotent).
  useEffect(() => {
    if (!teacherUid) return;
    ensureTeacherRegistration()
      .then((ok) => setRegistered(ok ? 'yes' : 'no'))
      .catch(() => setRegistered('no'));
  }, [teacherUid]);

  // 0b) Resolve the REST-session uid (the one the rules compare against).
  useEffect(() => {
    let alive = true;
    void getRestAuthUid().then((uid) => { if (alive) setTestUid(uid ?? ''); });
    return () => { alive = false; };
  }, []);

  // 1) Load assignments — by the REST uid (the one writes use and the rules
  // check). Falls back to empty when no Firebase session exists.
  const refreshAssignments = useCallback(async () => {
    if (!testUid) { setAssignments([]); return; }
    try {
      const list = await listAssignments(testUid);
      setAssignments(list);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof RestError ? err.message : 'Could not load assignments.');
    }
  }, [testUid]);

  useEffect(() => { void refreshAssignments(); }, [refreshAssignments]);

  // 2) Live scoreboard poll (6s, visibility-aware) for the selected assignment.
  useEffect(() => {
    if (!selected) { setRows({}); setLiveKey(null); return; }
    let alive = true;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const [subs, scores] = await Promise.all([listSubmissions(selected), listScores(selected)]);
        if (!alive) return;
        const scoreById = new Map(scores.map((s) => [s.id, s]));
        setRows(Object.fromEntries(subs.map((s) => [s.id, { submission: s, score: scoreById.get(s.id) ?? null }])));
        setLastSync(new Date());

        // Grade anything not cached yet — needs the key.
        const assignment = assignments.find((a) => a.id === selected);
        if (!assignment) return;
        let key: TestKey | null = keyCache.current[assignment.testId] ?? null;
        if (!key) {
          key = (await getTestKey(assignment.testId)) ?? null;
          if (!key) { setGradingNote('No answer key installed for this test yet — install the .key.json to see scores.'); return; }
          keyCache.current[assignment.testId] = key;
        }
        setLiveKey(key);
        setGradingNote('');
        const pending = subs.filter((s) => !scoreById.has(s.id));
        for (const sub of pending) {
          const grade: GradeResult = gradeSubmission(key, sub.answers ?? {});
          try { await putScore(sub, grade, testUid || teacherUid); } catch { /* cache write is best-effort */ }
        }
        if (pending.length) {
          const refreshed = await listScores(selected);
          const byId = new Map(refreshed.map((s) => [s.id, s]));
          if (!alive) return;
          setRows((prev) => {
            const next = { ...prev };
            for (const [id, row] of Object.entries(next)) {
              next[id] = { ...row, score: byId.get(id) ?? row.score };
            }
            return next;
          });
        }
      } catch (err) {
        if (alive) setLoadError(err instanceof RestError ? err.message : 'Live sync hiccup — retrying.');
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), 6000);
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [selected, assignments, teacherUid, testUid]);

  // 3) Answer-key install (accepts one file or many — select all keys at once).
  const handleKeyFiles = async (files: FileList) => {
    setKeyStatus('Installing…');
    let ok = 0;
    const errs: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed = JSON.parse(await file.text()) as TestKey;
        if (!parsed?.testId || !Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
          errs.push(`${file.name}: not a .key.json`);
          continue;
        }
        await putTestKey(parsed);
        await putTestMeta({
          testId: parsed.testId,
          title: parsed.title,
          questionCount: parsed.questions.length,
          groups: parsed.groups,
        });
        delete keyCache.current[parsed.testId];
        ok += 1;
      } catch (err) {
        if (err instanceof RestError && err.status === 403) { errs.push('denied — register your teacher account first, then retry'); break; }
        errs.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setKeyStatus(ok && errs.length === 0
      ? `Installed ${ok} answer key${ok === 1 ? '' : 's'}. Those tests can now be assigned.`
      : `Installed ${ok}${errs.length ? ` · ${errs.length} failed: ${errs.join(' · ')}` : ''}`);
  };

  // 4) Create assignment. EVERY outcome is reported in createStatus — a
  // silent no-op here once read as "nothing happens" to the teacher.
  const handleCreate = async () => {
    const test = PRIVATE_TEST_CATALOG.find((t) => t.testId === formTestId);
    const cls = classes.find((c) => c.id === formClassId);
    if (!test || !cls || !formClosesAt) {
      setCreateStatus({ tone: 'err', text: 'Pick a test and a class first (Step 2), then try again.' });
      return;
    }
    if (!testUid) {
      setCreateStatus({ tone: 'err', text: 'No teacher session found — sign in again with your teacher pass (homepage button), then reopen this panel.' });
      return;
    }
    setBusy(true);
    setCreateStatus({ tone: 'info', text: 'Creating the assignment…' });
    try {
      const created = await createAssignment({
        testId: test.testId,
        title: test.title,
        classId: cls.id,
        className: cls.name || cls.id,
        teacherUid: testUid, // rules compare against the REST token uid
        opensAt: new Date().toISOString(),
        closesAt: new Date(formClosesAt).toISOString(),
        durationMinutes: formMinutes,
      });
      await refreshAssignments();
      setSelected(created.id);
      setCreateStatus({ tone: 'ok', text: `Assignment created ✓ — share it with ${cls.name} via "Copy student link" at the top of the scoreboard.` });
    } catch (err) {
      const msg = err instanceof RestError ? err.message : 'Could not create the assignment.';
      setCreateStatus({
        tone: 'err',
        text: err instanceof RestError && err.status === 403
          ? `Create denied by permissions (${msg}). Make sure you are signed in with your teacher (edu) account, then reload.`
          : msg,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this assignment? Students can no longer open it.')) return;
    try { await deleteAssignment(id); } catch { /* keep UI responsive */ }
    if (selected === id) setSelected(null);
    await refreshAssignments();
  };

  // 5) Manual re-grade ("Grade now").
  const handleGradeNow = async () => {
    if (!selectedAssignment || !liveKey) return;
    setBusy(true);
    try {
      const subs = await listSubmissions(selectedAssignment.id);
      for (const sub of subs) {
        const grade = gradeSubmission(liveKey, sub.answers ?? {});
        try { await putScore(sub, grade, testUid || teacherUid); } catch { /* best-effort */ }
      }
      const refreshed = await listScores(selectedAssignment.id);
      const byId = new Map(refreshed.map((s) => [s.id, s]));
      setRows((prev) => {
        const next = { ...prev };
        for (const [id, row] of Object.entries(next)) next[id] = { ...row, score: byId.get(id) ?? row.score };
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  // Derived scoreboard values.
  const rowList = useMemo(() => Object.values(rows), [rows]);
  const gradedList = useMemo(
    () => rowList.filter((r) => r.score) as Array<RowState & { score: ScoreDoc }>,
    [rowList],
  );
  const classAverage = gradedList.length
    ? Math.round(gradeListAverage(gradedList))
    : null;
  const missed = useMemo(() => {
    if (!liveKey || gradedList.length === 0) return [];
    const graded = Object.fromEntries(gradedList.map((r) => [r.score.id, gradeFromScore(liveKey, r.score)]));
    return mostMissedQuestions(graded, 0.5);
  }, [liveKey, gradedList]);

  const csvExport = () => {
    if (!selectedAssignment) return;
    const lines = [
      ['Student', 'Class', 'Score %', 'Correct', 'Total', 'Blank', 'Fullscreen exits', 'Tab blurs', 'Submitted at'].join(','),
      ...rowList.map((r) => [
        r.submission?.studentName ?? r.score?.studentName ?? '?',
        selectedAssignment.className,
        r.score ? String(r.score.scorePct) : 'pending',
        r.score ? String(r.score.correctCount) : '',
        r.score ? String(r.score.totalCount) : '',
        r.score ? String(r.score.missed.length) : '',
        String(r.submission?.integrity?.fsExits ?? 0),
        String(r.submission?.integrity?.blurs ?? 0),
        r.submission?.submittedAt ?? '',
      ].map(csvCell).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAssignment.testId}-${selectedAssignment.className}.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-keep-dark className="mt-8 rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-950/25 via-slate-950/60 to-slate-950/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-violet-200"><ClipboardList className="h-5 w-5" /></span>
          <div>
            <h3 className="font-[var(--font-display)] text-lg font-bold text-white">Bi-Weekly Private Tests</h3>
            <p className="text-[11px] text-slate-400">Assign answer-free test pages; scores stream here only — students never see them.</p>
          </div>
        </div>
        {registered === 'no' && (
          <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
            <FileWarning className="h-3.5 w-3.5" /> Teacher registration pending — publish the new rules, then reload.
          </p>
        )}
      </div>

      {/* Step 1 — key install */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-white"><KeyRound className="h-3.5 w-3.5 text-amber-300" /> Step 1 · Install answer keys</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Pick the <code className="text-slate-300">.key.json</code> file for each test you want to assign — or select all of them at once (kept off the website; teachers-only in Firestore).
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20">
            Choose .key.json file(s)
            <input
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) void handleKeyFiles(e.target.files); e.target.value = ''; }}
            />
          </label>
          {keyStatus && <p className="mt-2 text-[11px] text-slate-300">{keyStatus}</p>}
        </div>

        {/* Step 2 — create assignment */}
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-white"><CalendarClock className="h-3.5 w-3.5 text-cyan-300" /> Step 2 · Assign a test</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select value={formTestId} onChange={(e) => { setFormTestId(e.target.value); const t = PRIVATE_TEST_CATALOG.find((x) => x.testId === e.target.value); if (t) setFormMinutes(t.defaultMinutes); }} className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none">
              {CATALOG_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((t) => <option key={t.testId} value={t.testId}>{t.title}</option>)}
                </optgroup>
              ))}
            </select>
            <select value={formClassId} onChange={(e) => setFormClassId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none">
              <option value="">Pick a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.program ? ` · ${c.program}` : ''}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300">
              Minutes
              <input type="number" min={5} max={180} value={formMinutes} onChange={(e) => setFormMinutes(Math.max(5, Math.min(180, Number(e.target.value) || 20)))} className="w-full bg-transparent text-white focus:outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300">
              Closes
              <input type="datetime-local" value={formClosesAt} onChange={(e) => setFormClosesAt(e.target.value)} className="w-full bg-transparent text-white focus:outline-none" />
            </label>
          </div>
          <button
            onClick={() => void handleCreate()}
            disabled={busy || !formClassId || registered !== 'yes'}
            className="mt-3 w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {busy ? 'Creating…' : 'Create assignment'}
          </button>
          {createStatus && (
            <p
              role="status"
              className={`mt-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                createStatus.tone === 'ok'
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                  : createStatus.tone === 'err'
                    ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                    : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {createStatus.text}
            </p>
          )}
        </div>
      </div>

      {loadError && <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{loadError}</p>}

      {/* Step 3 — assignments + scoreboard */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assignments</p>
          {assignments.length === 0 && <p className="text-[11px] text-slate-600">None yet — create one above.</p>}
          {assignments.map((a) => (
            <div key={a.id} className="relative">
              <button
                onClick={() => setSelected(a.id)}
                className={`w-full rounded-lg border p-3 pr-9 text-left transition ${selected === a.id ? 'border-violet-400/50 bg-violet-400/10' : 'border-white/10 bg-slate-950/40 hover:border-white/20'}`}
              >
                <p className="text-xs font-bold text-white">{a.title}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{a.className} · closes {fmtDate(a.closesAt)}</p>
              </button>
              <button
                aria-label={`Delete assignment ${a.title}`}
                onClick={(e) => { e.stopPropagation(); void handleDelete(a.id); }}
                className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-slate-600 transition hover:text-rose-300"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="min-w-0">
          {!selectedAssignment ? (
            <div className="grid place-items-center rounded-xl border border-white/10 bg-slate-950/40 py-14 text-center text-xs text-slate-500">
              <div>
                <Users className="mx-auto mb-2 h-6 w-6 text-slate-700" />
                Select an assignment to open its live scoreboard.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-950/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                <div>
                  <h4 className="text-sm font-bold text-white">{selectedAssignment.title}</h4>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {selectedAssignment.className} · {rowList.length} submitted · class average {classAverage == null ? '—' : `${classAverage}%`}
                    {lastSync && <span className="ml-2 text-slate-600">synced {lastSync.toLocaleTimeString()}</span>}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => void handleGradeNow()} disabled={busy || !liveKey} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-40">
                    <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} /> Grade now
                  </button>
                  <button onClick={csvExport} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10">
                    <Download className="h-3 w-3" /> CSV
                  </button>
                  <button
                    onClick={() => {
                      const test = PRIVATE_TEST_CATALOG.find((t) => t.testId === selectedAssignment.testId);
                      const url = `${window.location.origin}/biweek-planner/tests/private/${test?.slug ?? 'diagnostic'}.html?assignment=${selectedAssignment.id}`;
                      void navigator.clipboard.writeText(url).then(() => {
                        setGradingNote('Student link copied — share it with the class (Google Classroom, Messenger, …).');
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-bold text-cyan-200 transition hover:bg-cyan-400/20"
                  >
                    <Link2 className="h-3 w-3" /> Copy student link
                  </button>
                </div>
              </div>

              {gradingNote && <p className="border-b border-white/10 bg-cyan-500/5 px-4 py-2 text-[11px] text-cyan-200">{gradingNote}</p>}

              {missed.length > 0 && (
                <p className="border-b border-white/10 px-4 py-2 text-[11px] text-amber-200/90">
                  <span className="font-bold">Re-teach:</span>{' '}
                  {missed.map((m) => `Q${m.qnum} (${Math.round(m.rate * 100)}% missed)`).join(' · ')}
                </p>
              )}

              {rowList.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">No submissions yet. Students' answers appear here the moment they submit.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/50">
                      <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5 text-left">Student</th>
                        <th className="px-4 py-2.5 text-center">Score</th>
                        <th className="hidden px-4 py-2.5 text-left sm:table-cell">Sections</th>
                        <th className="px-4 py-2.5 text-center">Flags</th>
                        <th className="px-4 py-2.5 text-right">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rowList.map((r) => (
                        <tr key={r.submission?.id ?? r.score?.id} className="hover:bg-white/5">
                          <td className="px-4 py-2.5 text-xs font-medium text-slate-200">{r.submission?.studentName ?? r.score?.studentName ?? '?'}</td>
                          <td className="px-4 py-2.5 text-center">
                            {r.score ? (
                              <span className={`font-mono text-xs font-bold ${(r.score.scorePct) >= 80 ? 'text-emerald-300' : (r.score.scorePct) >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
                                {r.score.scorePct}% <span className="text-[10px] text-slate-600">({r.score.correctCount}/{r.score.totalCount})</span>
                              </span>
                            ) : <span className="text-[10px] text-slate-500">grading…</span>}
                          </td>
                          <td className="hidden px-4 py-2.5 sm:table-cell">
                            {r.score && (
                              <div className="flex flex-wrap gap-1">
                                {r.score.perSkill.map((s) => (
                                  <span key={s.id} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                                    {s.title.split('·')[0].trim().slice(0, 10)} {s.correct}/{s.total}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center text-[10px]">
                            {flagBadges(r.submission)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[10px] text-slate-500">{fmtDate(r.submission?.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── small helpers ────────────────────────────────────────────────────

function gradeListAverage(list: Array<RowState & { score: ScoreDoc }>): number {
  return list.reduce((sum, r) => sum + r.score.scorePct, 0) / list.length;
}

/** Rebuild a GradeResult shape from a cached ScoreDoc for most-missed math. */
function gradeFromScore(key: TestKey, score: ScoreDoc): GradeResult {
  return {
    correctCount: score.correctCount,
    totalCount: score.totalCount,
    scorePct: score.scorePct,
    perSkill: score.perSkill,
    missed: score.missed,
    blank: score.missed.filter((q) => !key.questions.some((k) => k.qnum === q)),
  };
}

function flagBadges(sub: SubmissionDoc | null): React.ReactNode {
  if (!sub) return '—';
  const flags: string[] = [];
  if ((sub.integrity?.fsExits ?? 0) > 0) flags.push(`FS×${sub.integrity.fsExits}`);
  if ((sub.integrity?.blurs ?? 0) > 2) flags.push(`blur×${sub.integrity.blurs}`);
  return flags.length ? flags.join(' ') : <span className="text-emerald-300">✓</span>;
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
