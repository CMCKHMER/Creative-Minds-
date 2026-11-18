// KidHomeworkScores — the teacher's score sheet for ONE kid-section homework.
//
// Opened from the "Scores" button on a homework row of the Kid Program cards
// (KidGradeHub, teachers only). Lists every student who pressed "Submit to
// Teacher" on that homework with their first-try score, their best score,
// how often they handed it in and when. Data and rules: src/lib/kidHomework.ts.
//
// Rendered through a portal on <body>: the cards sit inside animated
// (transformed) wrappers, and a transformed ancestor would turn
// `position: fixed` into "fixed to the card".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Download, RefreshCw, X } from 'lucide-react';
import { downloadBlob } from '../lib/biweeklyScores';
import {
  attemptsForHomework, countHomeworkPageAttempts, fetchHomeworkPageAttempts, homeworkRefFromHref,
  scoresByStudent, scoresToCsv, scoreWhen, sortScores, summarizeScores, wholePageRefFromHref,
} from '../lib/kidHomework';
import type { HomeworkAttempt, ScoreSort } from '../lib/kidHomework';

export interface KidHomeworkScoresProps {
  /** Homework title as on the card, e.g. 'Unit 13 · Homework 2 — Relocation Mission'. */
  title: string;
  /** Homework link as on the card, e.g. './rfc3/unit13hw.html#hw-b'. */
  href: string;
  /** 'Kid 11' — shown above the title. */
  gradeLabel: string;
  /** The href names a whole page that is ONE assignment (the Units 12–13
   *  secure quiz: no #hw- anchor), so every submission of the page counts. */
  wholePage?: boolean;
  /** Optional explicit Firestore `drillSlug` for in-app reader workbooks
   *  whose address is a hash route (`#library/<id>/workbook`) instead of `.html`. */
  drillSlug?: string;
  /** Eyebrow noun for the sheet, e.g. 'Secure quiz scores & violations'. */
  kindLabel?: string;
  /** Empty-sheet hint naming how a submission arrives on this assignment. */
  submitHint?: string;
  onClose: () => void;
}

type Period = 'all' | '7' | '30';

/** How often to ask "is there something new?" — one cheap count read. */
const POLL_MS = 20_000;

const band = (pct: number): string =>
  pct >= 80 ? 'text-emerald-300' : pct >= 50 ? 'text-amber-300' : 'text-rose-300';

export function KidHomeworkScores({ title, href, gradeLabel, wholePage, drillSlug, kindLabel, submitHint, onClose }: KidHomeworkScoresProps) {
  const ref = useMemo(
    () => (
      drillSlug
        ? { slug: drillSlug, number: null }
        : wholePage
          ? wholePageRefFromHref(href) ?? homeworkRefFromHref(href)
          : homeworkRefFromHref(href)
    ),
    [drillSlug, href, wholePage],
  );
  const [attempts, setAttempts] = useState<HomeworkAttempt[] | null>(null);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // true from the start: the first load begins as soon as the sheet opens.
  const [busy, setBusy] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [period, setPeriod] = useState<Period>('all');
  const [sort, setSort] = useState<ScoreSort>('name');
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const knownCount = useRef(-1);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!ref || inFlight.current) return;
    inFlight.current = true;
    try {
      const page = await fetchHomeworkPageAttempts(ref.slug);
      setAttempts(page.attempts);
      setCapped(page.capped);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the scores');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [ref]);

  // First load, then a light poll: count the rows (one read) and download
  // the list again only when the number changed. Paused while the tab is
  // hidden — nobody is looking and every poll is a billed read.
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    // The first download. load() only sets state after its request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const tick = async () => {
      if (!alive || document.visibilityState === 'hidden') return;
      try {
        const n = await countHomeworkPageAttempts(ref.slug);
        if (!alive) return;
        if (knownCount.current !== -1 && n !== knownCount.current) void load();
        knownCount.current = n;
      } catch { /* the Refresh button still works; the next tick tries again */ }
    };
    void tick();
    const timer = window.setInterval(tick, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ref, load]);

  // Dialog manners: focus the close button, Esc closes, focus goes back to
  // the button that opened the sheet.
  // onClose is read through a ref so the effect runs once — the cards behind
  // re-render every 20 s (share-state poll) and must not steal the focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  const sinceMs = useMemo(
    () => (period === 'all' ? 0 : updatedAt - Number(period) * 86_400_000),
    [period, updatedAt],
  );
  const mine = useMemo(
    () => (attempts && ref ? attemptsForHomework(attempts, ref.number, sinceMs) : []),
    [attempts, ref, sinceMs],
  );
  const everCount = useMemo(
    () => (attempts && ref ? attemptsForHomework(attempts, ref.number).length : 0),
    [attempts, ref],
  );
  const unnumbered = useMemo(
    () => (attempts && ref?.number !== null ? attempts.filter((a) => a.homework === null).length : 0),
    [attempts, ref],
  );
  const rows = useMemo(() => sortScores(scoresByStudent(mine), sort), [mine, sort]);
  const summary = useMemo(() => summarizeScores(rows), [rows]);
  // The secure quiz reports integrity violations with each submission —
  // show the worst count per student so "Scores & violations" is literal.
  const showViol = Boolean(wholePage && rows.some((r) => r.violations != null));
  const anyUnmeasured = rows.some((r) => !r.firstTryMeasured);

  const download = () => {
    const safe = title.replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'homework';
    // BOM so Excel reads the "·" and "—" in the title as UTF-8.
    downloadBlob('\uFEFF' + scoresToCsv(`${gradeLabel} — ${title}`, rows), `scores-${safe}.csv`, 'text/csv;charset=utf-8');
  };

  const selectClass = 'rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';
  const buttonClass = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-default disabled:opacity-50';

  return createPortal(
    <div
      data-kid-hw-scores
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-5"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="kid-hw-scores-title" className="relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 shadow-2xl">
        <header className="flex items-start gap-3 border-b border-slate-700/80 p-5 pr-16 sm:p-6 sm:pr-16">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950"><BarChart3 className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-cyan-200 uppercase">{gradeLabel} · {kindLabel ?? 'Homework scores'}</p>
            <h2 id="kid-hw-scores-title" className="mt-1 text-lg font-bold leading-snug tracking-tight text-white">{title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close the score sheet" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {!ref ? (
            <p className="text-sm text-slate-300">This homework has no score sheet — its link does not name a homework page.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2" data-score-summary>
                <div className="rounded-xl border border-slate-700/80 bg-slate-800 p-3">
                  <p className="text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">Handed in</p>
                  <p className="mt-1 text-xl font-bold text-white" data-summary-students>{summary.students}<span className="ml-1 text-[11px] font-semibold text-slate-400">{summary.students === 1 ? 'student' : 'students'}</span></p>
                </div>
                <div className="rounded-xl border border-slate-700/80 bg-slate-800 p-3">
                  <p className="text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">Average first try</p>
                  <p className={`mt-1 text-xl font-bold ${summary.students ? band(summary.avgFirstTry) : 'text-slate-400'}`} data-summary-first>{summary.students ? `${summary.avgFirstTry}%` : '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-700/80 bg-slate-800 p-3">
                  <p className="text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">Average best</p>
                  <p className={`mt-1 text-xl font-bold ${summary.students ? band(summary.avgBest) : 'text-slate-400'}`} data-summary-best>{summary.students ? `${summary.avgBest}%` : '—'}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  Show
                  <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={selectClass} aria-label="Which submissions to show">
                    <option value="all">All submissions</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  Order
                  <select value={sort} onChange={(e) => setSort(e.target.value as ScoreSort)} className={selectClass} aria-label="Order of the students">
                    <option value="name">Name A–Z</option>
                    <option value="lowest">Lowest first try first</option>
                    <option value="newest">Newest first</option>
                  </select>
                </label>
                <span className="flex-1" />
                <button type="button" onClick={() => { setBusy(true); void load(); }} disabled={busy} className={buttonClass}>
                  <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
                </button>
                <button type="button" onClick={download} disabled={rows.length === 0} className={buttonClass}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download
                </button>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/[0.06] p-3 text-xs leading-relaxed text-rose-300">
                  Could not load the scores — check the connection, then press Refresh. <span className="text-rose-300/80">({error.length > 90 ? `${error.slice(0, 87)}…` : error})</span>
                </p>
              )}

              {attempts === null && !error && (
                <p className="mt-6 text-center text-sm text-slate-400" role="status">Loading the scores…</p>
              )}

              {attempts !== null && rows.length === 0 && (
                <div className="mt-6 rounded-xl border border-slate-700/80 bg-slate-800 p-5 text-center" data-score-empty>
                  <p className="text-sm font-semibold text-slate-200">
                    {everCount > 0 ? `No one handed this homework in during the last ${period} days.` : 'No one has handed in this homework yet.'}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {everCount > 0
                      ? <>There {everCount === 1 ? 'is 1 older submission' : `are ${everCount} older submissions`} — choose “All submissions” to see {everCount === 1 ? 'it' : 'them'}.</>
                      : <>{submitHint ?? 'A score arrives when a student presses “Submit to Teacher” at the bottom of the homework.'} This sheet updates by itself.</>}
                  </p>
                </div>
              )}

              {rows.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700/80">
                  <table className="w-full min-w-[560px] border-collapse text-left text-xs" data-score-table>
                    <thead>
                      <tr className="bg-slate-800 text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                        <th scope="col" className="px-3 py-2.5">#</th>
                        <th scope="col" className="px-3 py-2.5">Student</th>
                        <th scope="col" className="px-3 py-2.5">First try</th>
                        <th scope="col" className="px-3 py-2.5">Best score</th>
                        <th scope="col" className="px-3 py-2.5">Handed in</th>
                        {showViol && <th scope="col" className="px-3 py-2.5">Violations</th>}
                        <th scope="col" className="px-3 py-2.5">Last time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const partly = r.firstAnswered !== null && r.firstAnswered < r.firstTry.total;
                        return (
                          <tr key={r.key} className="border-t border-slate-700/80 align-top" data-score-row>
                            <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                            <th scope="row" className="px-3 py-2.5 font-semibold text-slate-100">{r.name}</th>
                            <td className="px-3 py-2.5" data-first-try>
                              <span className={`font-bold ${band(r.firstTry.pct)}`}>{r.firstTry.pct}%</span>{' '}
                              <span className="text-slate-300">{r.firstTry.correct}/{r.firstTry.total}</span>
                              {!r.firstTryMeasured && <span className="ml-0.5 text-slate-400" title="First submission — handed in before the homework pages recorded the first check">*</span>}
                              {partly && <span className="mt-0.5 block text-[10px] text-slate-400"> only {r.firstAnswered} of {r.firstTry.total} answered when first checked</span>}
                              {r.checks !== null && r.checks > 1 && <span className="mt-0.5 block text-[10px] text-slate-400"> checked {r.checks} times</span>}
                            </td>
                            <td className="px-3 py-2.5" data-best>
                              <span className={`font-bold ${band(r.best.pct)}`}>{r.best.pct}%</span>{' '}
                              <span className="text-slate-300">{r.best.correct}/{r.best.total}</span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-300">{r.submissions === 1 ? 'once' : `${r.submissions} times`}</td>
                            {showViol && (
                              <td className="px-3 py-2.5" data-violations>
                                {r.violations == null
                                  ? <span className="text-slate-500">—</span>
                                  : r.violations === 0
                                    ? <span className="font-bold text-emerald-300">0 · clean</span>
                                    : <span className={`font-bold ${r.violations >= 3 ? 'text-rose-300' : 'text-amber-300'}`}>{r.violations} ⚠{r.violations >= 3 ? ' flagged' : ''}</span>}
                              </td>
                            )}
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">{scoreWhen(r.lastAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {attempts !== null && (
                <div className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                  <p><strong className="font-semibold text-slate-200">First try</strong> is the score at the student’s first “Check”, before the page showed the right answers. <strong className="font-semibold text-slate-200">Best score</strong> is the highest score they handed in — after a check, students can correct their answers and submit again.</p>
                  {anyUnmeasured && <p>* Handed in before the homework pages started recording the first check — the score of the first submission is shown instead.</p>}
                  <p>Students are listed by the name they typed on the homework, so two spellings of one name appear as two lines.</p>
                  <p>A submission counts only when the student’s page said “✓ Submitted to teacher”. If a send fails (Wi-Fi, expired sign-in), the homework page now keeps it on the student’s device, shows “saved on this device — NOT sent yet”, and sends it automatically when the page is open and back online — if someone is missing, ask them to reopen the homework page while online and wait for the ✓.</p>
                  {unnumbered > 0 && <p>{unnumbered} older {unnumbered === 1 ? 'submission' : 'submissions'} from this page {unnumbered === 1 ? 'does' : 'do'} not say which homework {unnumbered === 1 ? 'it belongs' : 'they belong'} to and {unnumbered === 1 ? 'is' : 'are'} not listed.</p>}
                  {capped && <p className="text-amber-300">This page has a very large number of submissions — the list may be incomplete.</p>}
                  {updatedAt > 0 && <p className="text-slate-500" data-score-updated>Updated {scoreWhen(updatedAt)} · checks for new submissions every {POLL_MS / 1000} seconds while this sheet is open.</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
