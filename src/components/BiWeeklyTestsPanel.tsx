// Bi-Weekly Tests — teacher share panel (simple mode, Nov 2026).
//
// Replaces the old 3-step private-test machinery (install .key.json →
// create assignment with open/close window → live grading scoreboard),
// which teachers found complicated. The new flow:
//
//   1. Teacher picks a test, copies ONE student link that carries their
//      personal teacher ID code: biweek-planner/tests/<slug>.html?invite=CODE
//   2. Students open the link, enter name + student ID, press Start — the
//      enforced timer runs and every answer is recorded (public/biweek-planner/
//      student-invite.js does the gating + recording).
//   3. Submissions land in Firestore drill_attempts (inviteMode: true) and
//      stream into the results table below with the full answer sheet, plus
//      CSV export for grading in any spreadsheet.
//
// Reads are PUBLIC on drill_attempts (same source as the homepage ticker),
// so this panel needs no extra tokens or rules — it works from any teacher
// device straight away.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, Copy, Download, ExternalLink, RefreshCw, Shuffle } from 'lucide-react';

/** Shareable test catalog — keep slugs in sync with the files under
 *  public/biweek-planner/tests/ (each has a student invite gate built in). */
interface TestEntry { title: string; slug: string; group: string; }
const TEST_CATALOG: TestEntry[] = [
  // Orientation
  { title: 'Orientation Diagnostic (Week 2 · All Sections)', slug: 'diagnostic.html', group: 'Orientation' },
  // ISEC II bi-weekly series
  { title: 'W2 · Business Listening (B2 + C1)', slug: 'isec2-w2-listening.html', group: 'ISEC II weekly tests' },
  { title: 'W3 · C1 Grammar: Conciseness & Precision', slug: 'isec2-w3-grammar.html', group: 'ISEC II weekly tests' },
  { title: 'W4 · C2 Reading: Corporate Epistemology', slug: 'isec2-w4-reading.html', group: 'ISEC II weekly tests' },
  { title: 'W5 · C1 Listening: Innovation in Business', slug: 'isec2-w5-listening.html', group: 'ISEC II weekly tests' },
  { title: 'W6 · C2 Grammar: Modals & Conditionals', slug: 'isec2-w6-grammar.html', group: 'ISEC II weekly tests' },
  { title: 'W7 · C2 Reading: The Algorithmic Enterprise', slug: 'isec2-w7-reading.html', group: 'ISEC II weekly tests' },
  { title: 'Level 10 TOEFL Mock Test (40 questions)', slug: 'week8-mock.html', group: 'ISEC II weekly tests' },
  // Week 8 recaps
  { title: 'Grammar Drill — Recap', slug: 'week8-recap-grammar.html', group: 'Week 8 recaps' },
  { title: 'Listening Drill — Recap', slug: 'week8-recap-listening.html', group: 'Week 8 recaps' },
  { title: 'Reading Drill — Recap', slug: 'week8-recap-reading.html', group: 'Week 8 recaps' },
  // Weekly drills (earlier cohort)
  { title: 'Week 2 · Grammar: Conditionals & Agreement', slug: 'week2-grammar.html', group: 'Weekly drills (earlier cohort)' },
  { title: 'Week 3 · Listening: Chance Discoveries', slug: 'week3-listening.html', group: 'Weekly drills (earlier cohort)' },
  { title: 'Week 4 · Reading: Genes, Health & Longevity', slug: 'week4-reading.html', group: 'Weekly drills (earlier cohort)' },
  { title: 'Week 5 · Grammar: Conditionals & Agreement', slug: 'week5-grammar.html', group: 'Weekly drills (earlier cohort)' },
  { title: 'Week 6 · Listening: Student Athletes', slug: 'week6-listening.html', group: 'Weekly drills (earlier cohort)' },
  { title: 'Week 7 · Reading: How We Name the Stars', slug: 'week7-reading.html', group: 'Weekly drills (earlier cohort)' },
  // Level 9 weekly tests
  { title: 'W3 · L9a Listening: Short Conversation Quiz', slug: '9a-w3-listening.html', group: 'Level 9 weekly tests' },
  { title: 'W4 · L9a Grammar: Sentence Completion', slug: '9a-w4-grammar.html', group: 'Level 9 weekly tests' },
  { title: 'W5 · L9a Reading: Main Ideas & Details', slug: '9a-w5-reading.html', group: 'Level 9 weekly tests' },
  { title: 'W2 · L9b Grammar: Parallel Structure (B2)', slug: '9b-w2-grammar.html', group: 'Level 9 weekly tests' },
  { title: 'W3 · L9b Listening: Inference & Attitude', slug: '9b-w3-listening.html', group: 'Level 9 weekly tests' },
  { title: 'W4 · L9b Reading: Inference Questions', slug: '9b-w4-reading.html', group: 'Level 9 weekly tests' },
  { title: 'W5 · L9b Grammar: Modifiers & Connectors', slug: '9b-w5-grammar.html', group: 'Level 9 weekly tests' },
  // Skills drills
  { title: 'Level 9b Grammar', slug: 'grammar.html', group: 'Skills drills' },
  { title: 'Level 11b Written Expressions', slug: 'structure.html', group: 'Skills drills' },
  { title: 'B2 Business Listening Drill', slug: 'business-listening.html', group: 'Skills drills' },
  { title: 'Listening · Inference', slug: 'inference-listening.html', group: 'Skills drills' },
  { title: 'Listening · Prediction', slug: 'prediction-listening.html', group: 'Skills drills' },
  { title: 'Listening · Short Conversations', slug: 'short-conversations.html', group: 'Skills drills' },
];
const CATALOG_GROUPS = TEST_CATALOG.reduce<{ label: string; items: TestEntry[] }[]>((acc, t) => {
  const g = acc.find((x) => x.label === t.group);
  if (g) g.items.push(t); else acc.push({ label: t.group, items: [t] });
  return acc;
}, []);

interface AttemptDoc {
  id: string;
  studentName: string;
  studentCode: string;
  inviteCode: string;
  scorePct: number | null;
  correctCount: number | null;
  totalCount: number | null;
  durationSeconds: number | null;
  submittedAt: string;
  answers: string;
  inviteMode: boolean;
  integrity: { blurs?: number; fsExits?: number };
}

const CODE_KEY = 'cmc-teacher-invite-code';

const sanitizeCode = (v: string): string =>
  v.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);

/** GitHub Pages serves under /Creative-Minds-/ — reuse location.pathname
 *  (hash-routed app) so copied links never drop the repo sub-path. */
function plannerBase(): string {
  return window.location.pathname.replace(/index\.html$/, '') + 'biweek-planner/tests/';
}

function dec(v: any): any {
  if (!v) return '';
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    const f = v.mapValue?.fields ?? {};
    for (const k of Object.keys(f)) out[k] = dec(f[k]);
    return out;
  }
  return '';
}

async function fetchAttempts(file: string): Promise<AttemptDoc[]> {
  const res = await fetch(
    'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents:runQuery',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'drill_attempts', allDescendants: false }],
          where: { fieldFilter: { field: { fieldPath: 'drillSlug' }, op: 'EQUAL', value: { stringValue: file } } },
          limit: 200,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Firestore query failed (HTTP ${res.status})`);
  const json: any = await res.json().catch(() => []);
  const rows: any[] = Array.isArray(json) ? json : [];
  return (rows || [])
    .filter((r) => r?.document)
    .map((r) => {
      const f = r.document.fields ?? {};
      const d: Partial<AttemptDoc> & Record<string, any> = { id: String(r.document.name || '').split('/').pop() };
      for (const k of ['studentName', 'studentCode', 'inviteCode', 'answers', 'submittedAt']) d[k] = dec(f[k]);
      for (const k of ['scorePct', 'correctCount', 'totalCount', 'durationSeconds']) d[k] = dec(f[k]);
      d.inviteMode = dec(f.inviteMode) === true;
      d.integrity = dec(f.integrity) ?? {};
      return d as AttemptDoc;
    })
    .filter((d) => d.inviteMode) // invite attempts only — practice attempts live on the student dashboard
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
}

/** Props kept optional-and-ignored so the dashboard call site stays valid.
 *  The new flow needs no teacher uid (results are a public read). */
export const BiWeeklyTestsPanel: React.FC<{
  teacherUid?: string;
  classes?: { id: string; name?: string; program?: string; code?: string }[];
}> = () => {
  const [teacherCode, setTeacherCode] = useState('');
  const [formSlug, setFormSlug] = useState(TEST_CATALOG[0].slug);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  const [resultsState, setResultsState] = useState<{ tone: 'ok' | 'err' | 'info'; text: string }>({ tone: 'info', text: '' });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const alive = useRef(true);

  // Restore/generate the personal teacher ID code once.
  useEffect(() => {
    let code = '';
    try { code = sanitizeCode(localStorage.getItem(CODE_KEY) || ''); } catch { /* stays '' */ }
    if (!code) {
      code = 'TEACHER-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      try { localStorage.setItem(CODE_KEY, code); } catch { /* private mode — code stays in memory */ }
    }
    setTeacherCode(code);
    return () => { alive.current = false; };
  }, []);

  const inviteUrl = `${window.location.origin}${plannerBase()}${formSlug}?invite=${encodeURIComponent(teacherCode)}`;

  const loadAttempts = useCallback(async (file: string) => {
    setLoading(true);
    try {
      const docs = await fetchAttempts(file);
      if (!alive.current) return;
      setAttempts(docs);
      setResultsState(docs.length
        ? { tone: 'ok', text: `${docs.length} submitted attempt${docs.length === 1 ? '' : 's'} · refreshes automatically` }
        : { tone: 'info', text: 'No invite submissions yet — share the link above; answers land here automatically.' });
    } catch (err) {
      if (alive.current) setResultsState({ tone: 'err', text: err instanceof Error ? err.message : 'Could not load results.' });
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  // Auto-refresh while the results view is open (8s, visibility-aware).
  useEffect(() => {
    if (!resultsOpen) return;
    void loadAttempts(formSlug);
    const iv = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAttempts(formSlug);
    }, 8000);
    return () => window.clearInterval(iv);
  }, [resultsOpen, formSlug, loadAttempts]);

  const copyLink = () => {
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  const regenerateCode = () => {
    const code = 'TEACHER-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    setTeacherCode(code);
    try { localStorage.setItem(CODE_KEY, code); } catch { /* in-memory only */ }
  };

  const exportCsv = () => {
    const cell = (v: unknown): string => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      ['Student', 'Student ID', 'Teacher code', 'Score %', 'Correct', 'Total', 'Duration s', 'Flags', 'Submitted', 'Answers'].join(','),
      ...attempts.map((d) => {
        const flags = (d.integrity?.blurs ?? 0) + (d.integrity?.fsExits ?? 0);
        return [d.studentName, d.studentCode, d.inviteCode, d.scorePct, d.correctCount, d.totalCount, d.durationSeconds, flags, d.submittedAt, d.answers]
          .map(cell).join(',');
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${formSlug.replace(/\.html$/, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const picker = (
    <select
      value={formSlug}
      onChange={(e) => setFormSlug(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
      aria-label="Pick a bi-weekly test"
    >
      {CATALOG_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
        </optgroup>
      ))}
    </select>
  );

  return (
    <div data-keep-dark className="mt-8 rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-950/25 via-slate-950/60 to-slate-950/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-violet-200"><ClipboardList className="h-5 w-5" /></span>
          <div>
            <h3 className="font-[var(--font-display)] text-lg font-bold text-white">Bi-Weekly Tests</h3>
            <p className="text-[11px] text-slate-400">Share a test in one tap — students enter name + ID, the timer runs, answers come back to you.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="bw-teacher-code">Your teacher ID code</label>
          <input
            id="bw-teacher-code"
            value={teacherCode}
            onChange={(e) => {
              const clean = sanitizeCode(e.target.value);
              setTeacherCode(clean);
              try { localStorage.setItem(CODE_KEY, clean); } catch { /* in-memory only */ }
            }}
            maxLength={24}
            className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold tracking-wider text-white focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={regenerateCode}
            title="Generate a new code"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
          >
            <Shuffle className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/50 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          {picker}
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5"
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy student link'}
          </button>
        </div>
        <p className="mt-2 break-all rounded-lg border border-white/5 bg-white/5 px-3 py-2 font-mono text-[10.5px] text-slate-400">{inviteUrl}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={inviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10"
          >
            <ExternalLink className="h-3 w-3" /> Preview as student
          </a>
          <button
            onClick={() => setResultsOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-bold text-cyan-200 transition hover:bg-cyan-400/20"
          >
            <ClipboardList className="h-3 w-3" /> {resultsOpen ? 'Hide results' : 'View results'}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Students open the link, type their <b className="text-slate-300">name + student ID</b>, and press Start — answers are recorded the whole
          time. On Submit they see a thank-you page, and the attempt appears below with the full answer sheet. The planner hub
          (<span className="text-slate-400">biweek-planner</span>) has the same share buttons next to every test.
        </p>
      </div>

      {resultsOpen && (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div>
              <h4 className="text-sm font-bold text-white">{TEST_CATALOG.find((t) => t.slug === formSlug)?.title ?? formSlug}</h4>
              <p role="status" className={`mt-0.5 text-[10px] ${resultsState.tone === 'err' ? 'text-rose-300' : resultsState.tone === 'ok' ? 'text-emerald-300' : 'text-slate-500'}`}>
                {loading ? 'Loading…' : resultsState.text}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => void loadAttempts(formSlug)}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button
                onClick={exportCsv}
                disabled={attempts.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>
          {attempts.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No submissions yet. Students' answers appear here the moment they submit through your link.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 text-left">Student</th>
                    <th className="px-4 py-2.5 text-left">ID</th>
                    <th className="px-4 py-2.5 text-center">Score</th>
                    <th className="px-4 py-2.5 text-center">Flags</th>
                    <th className="hidden px-4 py-2.5 text-left md:table-cell">Answers</th>
                    <th className="px-4 py-2.5 text-right">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {attempts.map((d) => {
                    const flags = (d.integrity?.blurs ?? 0) + (d.integrity?.fsExits ?? 0);
                    return (
                      <tr key={d.id} className="hover:bg-white/5">
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-200">{d.studentName || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{d.studentCode || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`font-mono text-xs font-bold ${(d.scorePct ?? 0) >= 80 ? 'text-emerald-300' : (d.scorePct ?? 0) >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
                            {d.scorePct ?? '—'}% <span className="text-[10px] text-slate-600">({d.correctCount ?? '?'}/{d.totalCount ?? '?'})</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-[10px]">
                          {flags > 0 ? <span className="text-rose-300">⚠ {flags}</span> : <span className="text-emerald-300">✓</span>}
                        </td>
                        <td className="hidden max-w-[260px] truncate px-4 py-2.5 text-[10.5px] text-slate-400 md:table-cell" title={d.answers}>
                          {d.answers || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[10px] text-slate-500">
                          {d.submittedAt ? new Date(d.submittedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
