// KidMyHomeworkScore — a student's OWN score on one kid-section homework.
//
// Owner request (16 Nov 2026): "STUDENTS SHOULD BE ABLE TO SEE THEIR SCORE ON
// THE HOME WORK KID SECTION". Until now the only score screen was
// KidHomeworkScores, which is the teacher's sheet listing the WHOLE class.
// A student needs their own line — and nothing else.
//
// PRIVACY IS THE DESIGN. The reader (fetchMyHomeworkScore) filters the public
// drill_attempts rows down to this one student before anything reaches the
// component, so the sheet never holds, renders, or counts another student's
// row. There is no class average here, no ranking, no "top score" — a child
// sees one number and what it means.
//
// Rendered through a portal on <body>, like the teacher's sheet: the kid
// cards sit inside animated (transformed) wrappers, and a transformed
// ancestor would turn `position: fixed` into "fixed to the card".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, RefreshCw, Target, Trophy, X } from 'lucide-react';
import { fetchMyHomeworkScore, homeworkRefFromHref, scoreBandLabel, scoreWhen, wholePageRefFromHref } from '../lib/kidHomework';
import type { StudentScore } from '../lib/kidHomework';

export interface KidMyHomeworkScoreProps {
  /** Homework title as on the card, e.g. 'Unit 13 · Homework 2 — Relocation Mission'. */
  title: string;
  /** Homework link as on the card, e.g. './rfc13hw.html#hw-b'. */
  href: string;
  /** 'Kid 11' — shown above the title. */
  gradeLabel: string;
  /** The signed-in student: the account uid (strongest match) and the name
   *  they are known by on this device (fallback for rows sent without an
   *  account). Both empty means nobody is signed in. */
  uid: string;
  name: string;
  /** Optional explicit Firestore `drillSlug` for single-assignment in-app workbooks. */
  drillSlug?: string;
  /** True when the assignment stores every attempt under one page slug (`number: null`). */
  wholePage?: boolean;
  /** Opens the sign-in modal from the "sign in to see your score" state. */
  onOpenAuth?: () => void;
  onClose: () => void;
}

/** Same colour rule as the teacher's sheet, so a score reads the same way
 *  to the student and to the teacher looking at the class list. */
const band = (pct: number): string =>
  pct >= 80 ? 'text-emerald-300' : pct >= 50 ? 'text-amber-300' : 'text-rose-300';

export function KidMyHomeworkScore({
  title, href, gradeLabel, uid, name, drillSlug, wholePage, onOpenAuth, onClose,
}: KidMyHomeworkScoreProps) {
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
  const [score, setScore] = useState<StudentScore | null>(null);
  // true from the start: the first read begins as soon as the sheet opens.
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const inFlight = useRef(false);

  const signedIn = !!uid;
  const knownName = name.trim();
  // The name on the homework when no account sent it. A signed-in student
  // needs none (the account matches); anyone else may type the name they
  // wrote on the page, exactly the identity the homework itself stored.
  const [claimed, setClaimed] = useState('');
  const [draft, setDraft] = useState('');
  const lookupName = signedIn ? '' : (knownName || claimed.trim());
  const canLook = signedIn || lookupName !== '';

  const load = useCallback(async () => {
    const singleAssignment = Boolean(drillSlug || wholePage);
    if (!ref || (!singleAssignment && ref.number === null) || inFlight.current) return;
    inFlight.current = true;
    try {
      setScore(await fetchMyHomeworkScore(ref.slug, { uid, name: lookupName }, ref.number));
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your score');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [drillSlug, ref, uid, lookupName, wholePage]);

  useEffect(() => {
    if (!ref || !canLook) return;
    // The first read. load() only sets state after its request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [ref, canLook, load]);

  // Dialog manners: focus the close button, Esc closes, focus returns to the
  // button that opened the sheet. onClose is read through a ref so the kid
  // cards re-rendering behind the sheet cannot steal the focus.
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

  const pct = score ? score.firstTry.pct : 0;
  const headLine = score
    ? score.firstTryMeasured
      ? 'Your first try'
      : 'Your first submission'
    : 'Your score';

  return createPortal(
    <div
      data-kid-my-score
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-5"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kid-my-score-title"
        className="cmc-score-sheet relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-700/80 p-5 pr-16 sm:p-6 sm:pr-16">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400 to-cyan-400 text-slate-950">
            <Trophy className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-cyan-200 uppercase">{gradeLabel} · My score</p>
            <h2 id="kid-my-score-title" className="mt-1 text-lg font-bold leading-snug tracking-tight text-white">{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close my score"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {!ref ? (
            <p className="text-sm text-slate-300">This homework has no score yet — its link does not name a homework page.</p>
          ) : !signedIn && knownName === '' ? (
            /* Nobody signed in and no name on this device: a score can only be
               found once we know who is asking — never guess somebody else's. */
            <div className="cmc-score-face rounded-xl p-5 text-center" data-score-needs-signin>
              <p className="text-sm font-semibold text-slate-200">Sign in to see your score</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Your score is kept with the name you type on the homework, so we need to know who you are before we show it.
                {' '}Sign in with your free CMC account, or write the name you wrote on the homework.
              </p>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="cmc-score-cta mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--iri-c)]"
                >
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in
                </button>
              )}
              <form
                className="mt-3 flex flex-wrap items-center justify-center gap-2"
                onSubmit={(event) => { event.preventDefault(); setClaimed(draft.trim()); }}
              >
                <label htmlFor="kid-my-score-name" className="text-[11px] font-semibold text-slate-400">or the name on the homework</label>
                <input
                  id="kid-my-score-name"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={40}
                  autoComplete="off"
                  placeholder="Sok Dara"
                  className="cmc-score-input min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--iri-c)] sm:flex-none"
                />
                <button
                  type="submit"
                  disabled={draft.trim() === ''}
                  className="cmc-score-cta inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--iri-c)] disabled:opacity-50"
                >
                  Find my score
                </button>
              </form>
            </div>
          ) : error ? (
            <div role="alert" className="cmc-score-alert rounded-xl p-4 text-xs leading-relaxed">
              <p className="font-semibold">Could not load your score.</p>
              <p className="mt-1 text-rose-300/85">{error.length > 90 ? `${error.slice(0, 87)}…` : error}</p>
              <button
                type="button"
                onClick={() => { setBusy(true); void load(); }}
                disabled={busy}
                className="cmc-score-cta mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--iri-c)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" /> Try again
              </button>
            </div>
          ) : score === null ? (
            <div className="cmc-score-face rounded-xl p-5 text-center" data-score-empty>
              {busy ? (
                <p className="text-sm text-slate-400" role="status">Looking for your score…</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-200">Nothing handed in yet</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {signedIn
                      ? 'No score has arrived for this homework on your account yet. Open the homework, then press “Submit to Teacher” at the bottom.'
                      : `No score has arrived for this homework under “${lookupName}” yet. Open the homework, then press “Submit to Teacher” at the bottom — your score appears here by itself.`}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    Typed a different name on the homework? Sign in first — scores submitted from your account are found whatever name you type.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* The one number this student came for. */}
              <div className="cmc-score-face rounded-2xl p-5 text-center" data-score-mine>
                <p className="text-[9px] font-bold tracking-[0.14em] text-slate-400 uppercase">{headLine}</p>
                <p className={`mt-1 text-5xl font-bold leading-none tracking-tight ${band(pct)}`} data-score-pct>{pct}%</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-200">
                  {score!.firstTry.correct} of {score!.firstTry.total} correct
                </p>
                <p className={`mt-2 text-[11px] font-bold tracking-[0.1em] uppercase ${band(pct)}`}>{scoreBandLabel(pct)}</p>
                {!score!.firstTryMeasured && (
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                    This homework was handed in before the pages started recording the first check, so the score of your first submission is shown.
                  </p>
                )}
                {score!.firstAnswered !== null && score!.firstAnswered < score!.firstTry.total && (
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    You had answered {score!.firstAnswered} of {score!.firstTry.total} questions when you first checked.
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="cmc-score-face rounded-xl p-3" data-score-best>
                  <p className="inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                    <Target className="h-3 w-3" aria-hidden="true" /> Best score
                  </p>
                  <p className={`mt-1 text-xl font-bold ${band(score!.best.pct)}`}>{score!.best.pct}%</p>
                  <p className="text-[10px] font-semibold text-slate-400">{score!.best.correct} of {score!.best.total}</p>
                </div>
                <div className="cmc-score-face rounded-xl p-3" data-score-when>
                  <p className="text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">Handed in</p>
                  <p className="mt-1 text-xl font-bold text-white">{score!.submissions === 1 ? 'Once' : `${score!.submissions}×`}</p>
                  <p className="text-[10px] font-semibold text-slate-400">{scoreWhen(score!.lastAt)}</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                <p>
                  <strong className="font-semibold text-slate-200">First try</strong> is your score at the first “Check answers”, before the page showed you the right answers.
                  {' '}<strong className="font-semibold text-slate-200">Best score</strong> is the highest score you handed in — after a check you can fix your answers and submit again.
                </p>
                {score!.checks !== null && score!.checks > 1 && (
                  <p>You checked this homework {score!.checks} times before handing it in.</p>
                )}
                <p className="text-slate-500">
                  Only your own score is shown here. {updatedAt > 0 ? `Checked ${scoreWhen(updatedAt)}.` : ''}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
