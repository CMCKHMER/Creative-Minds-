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
//   3. Submissions land in Firestore invite_attempts (PRIVATE — Nov 2026):
//      each attempt is stamped with the code owner's uid, copied by the
//      student's browser from the public invite_codes registry doc, and the
//      database rules verify that stamp — so ONLY the owning teacher can
//      ever read their results. Scores are handed to students by their
//      teacher personally: no classmates, no other teachers, no public
//      feed, no homepage ticker.
//
// Reads on invite_attempts are AUTHENTICATED (the teacher's Firebase
// session) and filtered to their own uid — the rules engine rejects
// anything broader.
//
// GRADING (answer seal, Nov 2026): the public test pages no longer contain
// their answer keys — they are encrypted, and the key that opens them is a
// Firestore document only verified teachers can read. A student's browser
// therefore cannot grade; it sends the raw answer sheet and THIS panel
// grades it on the teacher's device (src/lib/answerSeal.ts). Attempts
// recorded before the change still carry their own score and show as-is.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Copy, Cpu, Download, ExternalLink, KeyRound, Lock, RefreshCw, ShieldCheck, Shuffle } from 'lucide-react';
import {
  ensureTeacherRegistration, getAnswerSealCode, getRestAuthUid, listInviteAttempts, putAnswerSealCode,
  registerInviteCode, RestError,
} from '../lib/testDb';
import type { InviteAttemptDoc } from '../lib/testDb';
import { formatSealCode, gradeSheet, openAnswerKey, parseSheet, sealCodeMatches } from '../lib/answerSeal';
import type { AnswerKeyMap } from '../lib/answerSeal';
import { isAdminUid } from '../lib/firebaseAuth';
import { csvSafeText } from '../lib/csvSafe';
import { loadSealFiles } from '../lib/sealFiles';
import { countLine, loadTestCounts, testSlug, versionNote } from '../lib/testCounts';
import type { TestCounts } from '../lib/testCounts';

/** Shareable test catalog — keep slugs in sync with the files under
 *  public/biweek-planner/tests/ (each has a student invite gate built in).
 *  Question counts are NOT typed here: the picker shows the real count from
 *  biweek-planner/test-counts.json, which is generated from the pages
 *  (`node scripts/test_counts.mjs --check` fails on a slug with no page). */
interface TestEntry {
  title: string;
  slug: string;
  group: string;
  /** Set on a test that is no longer handed out: the title of the test that
   *  replaces it. The page and its answer key stay (links already sent keep
   *  working, earlier results stay readable), but no new link is offered. */
  retiredFor?: string;
}
const RETIRED_GROUP = 'Retired — earlier results only';
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
  { title: 'W8 · Recap: Listening · Grammar · Reading', slug: 'isec2-w8-recap.html', group: 'ISEC II weekly tests' },
  { title: 'Level 10 TOEFL Mock Test', slug: 'week8-mock.html', group: 'ISEC II weekly tests' },
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
  { title: 'W6 · L9a Listening: Dialogue Analysis', slug: '9a-w6-listening.html', group: 'Level 9 weekly tests' },
  { title: 'W7 · L9a Grammar: Verb Tenses', slug: '9a-w7-grammar.html', group: 'Level 9 weekly tests' },
  { title: 'W8 · L9a Reading: Vocabulary in Context', slug: '9a-w8-reading.html', group: 'Level 9 weekly tests' },
  { title: 'W6 · L9b Listening: Note-Taking Techniques', slug: '9b-w6-listening.html', group: 'Level 9 weekly tests' },
  { title: 'W7 · L9b Reading: Reference & Cohesion', slug: '9b-w7-reading.html', group: 'Level 9 weekly tests' },
  { title: 'W8 · L9b Grammar: Parallel Structure & Connectors', slug: '9b-w8-grammar.html', group: 'Level 9 weekly tests' },
  // Level 11b weekly tests
  { title: 'W2 · L11b Structure: Matching Practice', slug: 'isec2-w2-matching.html', group: 'Level 11b weekly tests' },
  { title: 'W3 · L11b Listening: Paraphrasing', slug: 'isec2-w3-paraphrase.html', group: 'Level 11b weekly tests' },
  { title: 'W4 · L11b Reading: Recognizing Inference', slug: 'isec2-w4-inference.html', group: 'Level 11b weekly tests' },
  { title: 'W5 · L11b Grammar: Mysteries & the Unexplained', slug: 'isec2-w5-grammar.html', group: 'Level 11b weekly tests' },
  { title: 'W6 · L11b Listening: Tone & Attitude', slug: 'isec2-w6-tone.html', group: 'Level 11b weekly tests' },
  { title: 'W7 · L11b Reading: Human Bionics', slug: 'isec2-w7-bionics.html', group: 'Level 11b weekly tests' },
  { title: 'W8 · L11b Peer-Led: AI Practice', slug: 'isec2-w8-ai.html', group: 'Level 11b weekly tests' },
  // Skills drills
  { title: 'Level 11b Written Expressions', slug: 'structure.html', group: 'Skills drills' },
  { title: 'Level 11b Rhetorical Purpose', slug: 'rhetorical.html', group: 'Skills drills' },
  { title: 'B2 Business Listening Drill', slug: 'business-listening.html', group: 'Skills drills' },
  { title: 'Listening · Inference', slug: 'inference-listening.html', group: 'Skills drills' },
  { title: 'Listening · Prediction', slug: 'prediction-listening.html', group: 'Skills drills' },
  { title: 'Listening · Short Conversations', slug: 'short-conversations.html', group: 'Skills drills' },
  // Retired. "Level 9b Parallel Structure" had the same 20 questions and the
  // same answers as "W2 · L9b Grammar: Parallel Structure (B2)" and sat next
  // to it on the planner's Week 2 card.
  { title: 'Level 9b Parallel Structure (duplicate)', slug: 'grammar.html', group: RETIRED_GROUP, retiredFor: 'W2 · L9b Grammar: Parallel Structure (B2)' },
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
  /** Sealed attempt: the stored score is a placeholder; grade `sheet`. */
  sealed: boolean;
  sheet: string;
  /** True when a sealed attempt could not be graded yet (key not open). */
  ungraded?: boolean;
}

/** Where the answer seal stands for this teacher. */
type SealStatus =
  | 'checking'   // still loading
  | 'ready'      // key open — sealed attempts are graded here
  | 'missing'    // the owner has not installed the key code yet
  | 'denied'     // this account is not allowed to read the key
  | 'mismatch'   // an installed code that does not fit this site's tests
  | 'error';     // network / unexpected

const CODE_KEY = 'cmc-teacher-invite-code';

const sanitizeCode = (v: string): string =>
  v.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);

/** GitHub Pages serves under /Creative-Minds-/ — reuse location.pathname
 *  (hash-routed app) so copied links never drop the repo sub-path. */
function plannerBase(): string {
  return window.location.pathname.replace(/index\.html$/, '') + 'biweek-planner/tests/';
}

async function fetchAttempts(file: string, teacherUid: string): Promise<AttemptDoc[]> {
  // Authenticated owner-scoped query — the rules REQUIRE the teacherUid
  // equality filter (an unconstrained query is rejected with 403 rather
  // than leaking another teacher's rows).
  const docs = await listInviteAttempts(file, teacherUid);
  return docs.map((d: Partial<InviteAttemptDoc> & { id: string }) => ({
    id: d.id,
    studentName: d.studentName ?? '',
    studentCode: d.studentCode ?? '',
    inviteCode: d.inviteCode ?? '',
    scorePct: d.scorePct ?? null,
    correctCount: d.correctCount ?? null,
    totalCount: d.totalCount ?? null,
    durationSeconds: d.durationSeconds ?? null,
    submittedAt: d.submittedAt ?? '',
    answers: d.answers ?? '',
    inviteMode: true,
    integrity: (d.integrity as AttemptDoc['integrity']) ?? {},
    sealed: d.sealed === true,
    sheet: d.sheet ?? '',
  } as AttemptDoc));
}

/** Where the teacher's invite code stands. Students' answers are accepted
 *  by the database only for a code that is REGISTERED to a teacher, so the
 *  link may be copied only in the 'ok' state. */
type CodeState = 'checking' | 'ok' | 'taken' | 'short' | 'signin' | 'denied' | 'error';
const MIN_CODE = 8; // firestore.rules: invite_codes ids are 8–32 characters
const CODE_NOTE: Record<CodeState, string> = {
  checking: 'Checking your teacher code…',
  ok: 'Your teacher code is registered to your account — results from this link come back to you.',
  taken: 'Another teacher already uses this code. Choose a different one — with this code your students’ results would not reach you.',
  short: 'The teacher code needs 8 to 24 letters or numbers (A–Z, 0–9, dash, underscore).',
  signin: 'Sign in with your teacher account (top-right) before sharing — the link needs a code registered to you.',
  denied: 'This account cannot register a teacher code (verified teacher accounts only). Answers sent through this link would be refused.',
  error: 'Could not reach the server to register your teacher code. Check the connection — do not share the link yet.',
};

const SEAL_NOTE: Record<Exclude<SealStatus, 'checking' | 'ready'>, string> = {
  missing: 'The answer key is not installed yet, so new attempts cannot be scored. They are saved and will be scored as soon as the site owner installs the key.',
  denied: 'This account cannot open the answer key (verified teacher accounts only), so new attempts cannot be scored here.',
  mismatch: 'The installed answer key does not match the tests on this site. Ask the site owner to install the current key.',
  error: 'Could not load the answer key just now. Attempts are saved; press Refresh to try again.',
};

/** Props kept optional-and-ignored so the dashboard call site stays valid. */
export const BiWeeklyTestsPanel: React.FC<{
  teacherUid?: string;
  classes?: { id: string; name?: string; program?: string; code?: string }[];
}> = () => {
  const [teacherCode, setTeacherCode] = useState('');
  const [restUid, setRestUid] = useState('');
  const [formSlug, setFormSlug] = useState(TEST_CATALOG[0].slug);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  const [resultsState, setResultsState] = useState<{ tone: 'ok' | 'err' | 'info'; text: string }>({ tone: 'info', text: '' });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeState, setCodeState] = useState<CodeState>('checking');
  const [sessionKnown, setSessionKnown] = useState(false);
  const [counts, setCounts] = useState<TestCounts | null>(null);
  const [sealStatus, setSealStatus] = useState<SealStatus>('checking');
  const [sealCode, setSealCode] = useState('');
  const [answerKey, setAnswerKey] = useState<{ slug: string; map: AnswerKeyMap } | null>(null);
  const [installText, setInstallText] = useState('');
  const [installState, setInstallState] = useState<{ tone: 'ok' | 'err' | 'info'; text: string }>({ tone: 'info', text: '' });
  const alive = useRef(true);

  // ── Answer seal: fetch the key code once the teacher session is known ──
  const loadSeal = useCallback(async () => {
    try {
      const { pub } = await loadSealFiles();
      let found: { code: string; kid: string } | null;
      try {
        found = await getAnswerSealCode();
      } catch (err) {
        if (!(err instanceof RestError) || err.status !== 403) throw err;
        // A teacher who never opened a private test has no allowlist entry
        // yet — register once, then read again.
        const registered = await ensureTeacherRegistration().catch(() => false);
        if (!registered) { if (alive.current) setSealStatus('denied'); return; }
        found = await getAnswerSealCode();
      }
      if (!alive.current) return;
      if (!found) { setSealStatus('missing'); return; }
      if (!(await sealCodeMatches(pub, found.code))) { if (alive.current) setSealStatus('mismatch'); return; }
      if (!alive.current) return;
      setSealCode(found.code);
      setSealStatus('ready');
    } catch (err) {
      if (!alive.current) return;
      setSealStatus(err instanceof RestError && err.status === 403 ? 'denied' : 'error');
    }
  }, []);

  // Restore/generate the personal teacher ID code once and resolve the REST
  // session uid (the id the security rules see).
  useEffect(() => {
    let code = '';
    try { code = sanitizeCode(localStorage.getItem(CODE_KEY) || ''); } catch { /* stays '' */ }
    if (!code) {
      code = 'TEACHER-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      try { localStorage.setItem(CODE_KEY, code); } catch { /* private mode — code stays in memory */ }
    }
    setTeacherCode(code);
    void loadTestCounts().then((c) => { if (alive.current) setCounts(c); });
    void getRestAuthUid().then((uid) => {
      if (!alive.current) return;
      setRestUid(uid ?? '');
      setSessionKnown(true);
      if (uid) void loadSeal(); // answer key for grading (verified teachers only)
    });
    return () => { alive.current = false; };
  }, [loadSeal]);

  // REGISTER the code in the invite_codes registry — the create-once
  // code→owner binding students copy onto their submissions. Without it the
  // database refuses every answer sent through the link. This runs for the
  // stored code AND for every code the teacher types or generates here (a
  // typed code used to be registered only on the next page load, so a link
  // copied right after typing collected nothing).
  useEffect(() => {
    if (!sessionKnown || !teacherCode) return;
    let cancelled = false;
    const settle = (state: CodeState) => { if (!cancelled && alive.current) setCodeState(state); };
    const timer = window.setTimeout(() => {
      if (!restUid) { settle('signin'); return; }
      if (teacherCode.length < MIN_CODE) { settle('short'); return; }
      settle('checking');
      void (async () => {
        try {
          // The rules know a teacher by the teachers list; a first visit adds it.
          await ensureTeacherRegistration().catch(() => false);
          settle((await registerInviteCode(teacherCode, restUid)) === 'ok' ? 'ok' : 'taken');
        } catch (err) {
          settle(err instanceof RestError && (err.status === 403 || err.status === 401) ? 'denied' : 'error');
        }
      })();
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [teacherCode, restUid, sessionKnown]);

  // Open the key of the selected test (in memory only — never stored).
  useEffect(() => {
    if (!sealCode) return;
    const slug = formSlug.replace(/\.html$/, '');
    let cancelled = false;
    void loadSealFiles()
      .then(({ pub, bundle }) => openAnswerKey(pub, bundle, sealCode, slug))
      .then((map) => { if (!cancelled && alive.current) setAnswerKey(map ? { slug, map } : null); })
      .catch(() => { if (!cancelled && alive.current) setAnswerKey(null); });
    return () => { cancelled = true; };
  }, [sealCode, formSlug]);

  // Sealed attempts are graded here; older attempts keep their own score.
  const graded = useMemo<AttemptDoc[]>(() => {
    const slug = formSlug.replace(/\.html$/, '');
    const key = answerKey && answerKey.slug === slug ? answerKey.map : null;
    return attempts.map((d) => {
      if (!d.sealed) return d;
      const sheet = parseSheet(d.sheet);
      if (!key || !sheet) return { ...d, scorePct: null, correctCount: null, ungraded: true };
      const g = gradeSheet(sheet, key);
      return { ...d, scorePct: g.pct, correctCount: g.correct, totalCount: g.total };
    });
  }, [attempts, answerKey, formSlug]);
  const ungradedCount = graded.filter((d) => d.ungraded).length;
  const testCount = counts?.[testSlug(formSlug)];
  /** '' or "Earlier version of this test (9 questions; it now has 23)". */
  const noteOf = (d: AttemptDoc): string => versionNote(d.totalCount, testCount?.total);
  const earlierCount = graded.filter((d) => noteOf(d)).length;
  const retiredFor = TEST_CATALOG.find((t) => t.slug === formSlug)?.retiredFor;
  // A link is offered only for a test that is still handed out, and only
  // once the invite code is registered to this teacher.
  const codeReady = codeState === 'ok' && !retiredFor;

  const isOwner = isAdminUid(restUid);

  const installSealCode = async () => {
    const typed = installText.trim();
    if (!typed) return;
    setInstallState({ tone: 'info', text: 'Checking the key…' });
    try {
      const { pub } = await loadSealFiles();
      if (!(await sealCodeMatches(pub, typed))) {
        if (alive.current) setInstallState({ tone: 'err', text: 'That code does not match this site’s tests. Paste the whole code that starts with “cmcseal1.”' });
        return;
      }
      const code = formatSealCode(typed);
      await putAnswerSealCode(code, pub.kid);
      if (!alive.current) return;
      setInstallText('');
      setSealCode(code);
      setSealStatus('ready');
      setInstallState({ tone: 'ok', text: 'Installed. Every verified teacher can now preview and score the tests.' });
    } catch (err) {
      if (!alive.current) return;
      const denied = err instanceof RestError && err.status === 403;
      setInstallState({
        tone: 'err',
        text: denied
          ? 'The database refused the save. Publish the updated firestore.rules in the Firebase console first, then try again.'
          : err instanceof RestError ? err.message : 'Could not save the key.',
      });
    }
  };

  const inviteUrl = `${window.location.origin}${plannerBase()}${formSlug}?invite=${encodeURIComponent(teacherCode)}`;

  const loadAttempts = useCallback(async (file: string, uid: string) => {
    setLoading(true);
    try {
      if (!uid) {
        if (alive.current) setResultsState({ tone: 'info', text: 'Sign in with your teacher account (top-right) to collect results — they are private to you.' });
        return;
      }
      const docs = await fetchAttempts(file, uid);
      if (!alive.current) return;
      setAttempts(docs);
      setResultsState(docs.length
        ? { tone: 'ok', text: `${docs.length} submitted attempt${docs.length === 1 ? '' : 's'} · refreshes automatically · private to you` }
        : { tone: 'info', text: 'No invite submissions yet — share the link above; answers land here automatically.' });
    } catch (err) {
      if (alive.current) setResultsState({ tone: 'err', text: err instanceof RestError ? err.message : 'Could not load results.' });
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  // Auto-refresh while the results view is open (8s, visibility-aware).
  useEffect(() => {
    if (!resultsOpen) return;
    void loadAttempts(formSlug, restUid);
    const iv = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAttempts(formSlug, restUid);
    }, 8000);
    return () => window.clearInterval(iv);
  }, [resultsOpen, formSlug, loadAttempts, restUid]);

  const copyLink = () => {
    if (!codeReady) return;
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
      // Student-typed text: neutralise spreadsheet formulas (csvSafe.ts).
      const s = csvSafeText(typeof v === 'number' ? v : String(v ?? ''));
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      ['Student', 'Student ID', 'Teacher code', 'Score %', 'Correct', 'Total', 'Duration s', 'Flags', 'Submitted', 'Note', 'Answers'].join(','),
      ...graded.map((d) => {
        const flags = (d.integrity?.blurs ?? 0) + (d.integrity?.fsExits ?? 0);
        return [d.studentName, d.studentCode, d.inviteCode, d.ungraded ? 'not scored' : d.scorePct, d.correctCount, d.totalCount, d.durationSeconds, flags, d.submittedAt, noteOf(d), d.answers]
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
      className="rounded-lg border border-cyan-200/25 bg-slate-950/60 px-2.5 py-2 text-xs text-cyan-50 focus:border-cyan-200 focus:outline-none"
      aria-label="Pick a bi-weekly test"
    >
      {CATALOG_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((t) => {
            const n = counts?.[testSlug(t.slug)]?.total;
            return <option key={t.slug} value={t.slug}>{n ? `${t.title} — ${n} question${n === 1 ? '' : 's'}` : t.title}</option>;
          })}
        </optgroup>
      ))}
    </select>
  );

  return (
    // data-hud-panel pulls this panel into the bi-weekly HUD skin (glass +
    // circuit texture + corner brackets, see command-center.css) while keeping
    // it FREE of cmcdc classes — the command-center verifier requires the
    // data-keep-dark sub-panels to carry zero command-center classes.
    <div data-keep-dark data-hud-panel="bw-tests" className="mt-8 rounded-2xl border p-5 sm:p-6">
      {/* HUD tech strip — module code + dotted leader + ONLINE readout */}
      <div className="hudp-strip" aria-hidden="true">
        <Cpu className="hudp-ic" aria-hidden="true" />
        <span>MDL-T03</span>
        <i className="hudp-lead" />
        <b>ONLINE</b>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-100"><ClipboardList className="h-5 w-5" /></span>
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
            className="w-32 rounded-lg border border-cyan-200/25 bg-slate-950/60 px-2.5 py-1.5 font-mono text-xs font-bold tracking-wider text-cyan-100 focus:border-cyan-200 focus:outline-none"
          />
          <button
            onClick={regenerateCode}
            title="Generate a new code"
            className="rounded-lg border border-cyan-200/25 bg-cyan-200/[0.06] p-2 text-cyan-100 transition hover:bg-cyan-200/[0.12]"
          >
            <Shuffle className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-cyan-200/12 bg-slate-950/40 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          {picker}
          <button
            onClick={copyLink}
            disabled={!codeReady}
            title={codeReady ? undefined : retiredFor ? 'This test is retired — no new links' : CODE_NOTE[codeState]}
            className="hudp-cta flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy student link'}
          </button>
        </div>
        {testCount && (
          <p data-test-count={testCount.total} className="mt-2 text-[11px] font-semibold text-cyan-100">
            This test has {countLine(testCount)}.
          </p>
        )}
        {retiredFor ? (
          <p role="status" data-retired className="mt-1.5 text-[11px] leading-relaxed text-amber-200">
            This test is retired: it has the same questions as <b className="text-white">{retiredFor}</b> — share that one instead.
            Links you already sent still work, and earlier results stay under “View results”.
          </p>
        ) : (
          <p
            role="status"
            data-code-state={codeState}
            className={`mt-1.5 text-[11px] leading-relaxed ${codeReady ? 'text-emerald-300' : codeState === 'checking' || codeState === 'short' ? 'text-slate-400' : 'text-rose-300'}`}
          >
            {CODE_NOTE[codeState]}
          </p>
        )}
        {/* The link is shown only once the code is registered to this teacher:
            a link with an unregistered code lets the student finish the whole
            test and then the database refuses the result. */}
        {codeReady && (
          <p data-invite-link className="mt-2 break-all rounded-lg border border-cyan-200/10 bg-cyan-200/[0.04] px-3 py-2 font-mono text-[10.5px] text-cyan-100/70">{inviteUrl}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {codeReady && (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-cyan-200/25 bg-cyan-200/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 transition hover:bg-cyan-200/[0.12]"
            >
              <ExternalLink className="h-3 w-3" /> Preview as student
            </a>
          )}
          <button
            onClick={() => setResultsOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-cyan-200/30 bg-cyan-200/10 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 transition hover:bg-cyan-200/20"
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

      {/* Answer protection — where the seal stands for this teacher */}
      {restUid && (
        <div className="mt-4 rounded-xl border border-cyan-200/12 bg-slate-950/40 p-4" data-seal-status={sealStatus}>
          <div className="flex items-start gap-2.5">
            {sealStatus === 'ready'
              ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              : <Lock className={`mt-0.5 h-4 w-4 shrink-0 ${sealStatus === 'checking' ? 'text-slate-500' : 'text-amber-300'}`} aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white">Answer protection</h4>
              <p role="status" className={`mt-0.5 text-[11px] leading-relaxed ${sealStatus === 'ready' ? 'text-slate-400' : sealStatus === 'checking' ? 'text-slate-500' : 'text-amber-200'}`}>
                {sealStatus === 'checking' && 'Checking the answer key…'}
                {sealStatus === 'ready' && 'On. The test pages no longer contain their answers, so students cannot look them up. Scores are worked out here, on your device, and students do not see a score when they submit.'}
                {sealStatus !== 'checking' && sealStatus !== 'ready' && SEAL_NOTE[sealStatus]}
              </p>
              {isOwner && sealStatus !== 'ready' && sealStatus !== 'checking' && (
                <div className="mt-3">
                  <label htmlFor="bw-seal-code" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Site owner: paste the answer key code (starts with cmcseal1.)
                  </label>
                  <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      id="bw-seal-code"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={installText}
                      onChange={(e) => setInstallText(e.target.value)}
                      placeholder="cmcseal1.…"
                      className="rounded-lg border border-cyan-200/25 bg-slate-950/60 px-2.5 py-2 font-mono text-xs text-cyan-50 focus:border-cyan-200 focus:outline-none"
                    />
                    <button
                      onClick={() => void installSealCode()}
                      disabled={!installText.trim()}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-200/30 bg-cyan-200/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-200/20 disabled:opacity-40"
                    >
                      <KeyRound className="h-3 w-3" /> Install key
                    </button>
                  </div>
                  {installState.text && (
                    <p role="status" className={`mt-1.5 text-[11px] ${installState.tone === 'err' ? 'text-rose-300' : installState.tone === 'ok' ? 'text-emerald-300' : 'text-slate-400'}`}>
                      {installState.text}
                    </p>
                  )}
                </div>
              )}
              {sealStatus === 'ready' && installState.tone === 'ok' && installState.text && (
                <p role="status" className="mt-1.5 text-[11px] text-emerald-300">{installState.text}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {resultsOpen && (
        <div className="mt-4 rounded-xl border border-cyan-200/12 bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200/12 px-4 py-3">
            <div>
              <h4 className="text-sm font-bold text-white">{TEST_CATALOG.find((t) => t.slug === formSlug)?.title ?? formSlug}</h4>
              <p role="status" className={`mt-0.5 text-[10px] ${resultsState.tone === 'err' ? 'text-rose-300' : resultsState.tone === 'ok' ? 'text-emerald-300' : 'text-slate-500'}`}>
                {loading ? 'Loading…' : resultsState.text}
              </p>
              {earlierCount > 0 && (
                <p role="status" className="mt-0.5 text-[10px] text-slate-300">
                  {earlierCount} result{earlierCount === 1 ? ' was' : 's were'} recorded for an earlier version of this test (it now has {testCount?.total} questions) — marked below.
                </p>
              )}
              {ungradedCount > 0 && (
                <p role="status" className="mt-0.5 text-[10px] text-amber-200">
                  {ungradedCount} attempt{ungradedCount === 1 ? ' is' : 's are'} saved but not scored yet — see “Answer protection” above.
                </p>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  void loadAttempts(formSlug, restUid);
                  if (sealStatus !== 'ready' && restUid) void loadSeal();
                }}
                className="flex items-center gap-1.5 rounded-md border border-cyan-200/25 bg-cyan-200/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 transition hover:bg-cyan-200/[0.12]"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button
                onClick={exportCsv}
                disabled={attempts.length === 0}
                className="flex items-center gap-1.5 rounded-md border border-cyan-200/25 bg-cyan-200/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-cyan-100 transition hover:bg-cyan-200/[0.12] disabled:opacity-40"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
            </div>
          </div>
          {attempts.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No submissions yet. Students' answers appear here the moment they submit through your link — visible only to you.
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
                  {graded.map((d) => {
                    const flags = (d.integrity?.blurs ?? 0) + (d.integrity?.fsExits ?? 0);
                    return (
                      <tr key={d.id} className="hover:bg-white/5">
                        <td className="px-4 py-2.5 text-xs font-medium text-slate-200">{d.studentName || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">{d.studentCode || '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {d.ungraded ? (
                            <span className="text-[10px] font-bold text-amber-200" title="Saved. It will be scored once the answer key is available.">Not scored</span>
                          ) : (
                            <span className={`font-mono text-xs font-bold ${(d.scorePct ?? 0) >= 80 ? 'text-emerald-300' : (d.scorePct ?? 0) >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
                              {d.scorePct ?? '—'}% <span className="text-[10px] text-slate-600">({d.correctCount ?? '?'}/{d.totalCount ?? '?'})</span>
                            </span>
                          )}
                          {noteOf(d) && (
                            <span className="mt-0.5 block text-[9.5px] font-semibold leading-snug text-slate-400" title={noteOf(d)}>
                              earlier version · {d.totalCount} questions
                            </span>
                          )}
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
