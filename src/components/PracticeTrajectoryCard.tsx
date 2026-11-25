import { useCallback, useEffect, useState } from 'react';
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useSignedInSession } from '../hooks/useSignedInSession';
import {
  diagnosePracticeStore,
  loadMyTrajectory,
  type PracticeAttempt,
  type StoreDiagnosis,
  type Trajectory,
} from '../lib/practiceAttempts';
import {
  AI_COACH_DAILY_LIMIT,
  AI_COACH_MODEL,
  AI_SETUP_STEPS,
  appCheckConfigured,
  askCoach,
  probeAICoach,
  remainingCoachUses,
  type AiProbe,
} from '../lib/aiCoach';

/**
 * PracticeTrajectoryCard — the visible half of AI Phase 01 on the home page.
 *
 * Three things are shown and nothing more: the writing band trend, the speaking
 * band trend, and (when the AI Logic backend is enabled) one optional "ask the
 * coach" second opinion on the most recent essay. Signed-out visitors get an
 * explanation plus the two links, never a faked empty chart.
 */

const WRITING_HREF = 'toefl-ibt/toeflwriting-MIGRATED.html';
const SPEAKING_HREF = 'toefl-ibt/toeflspeaking-MIGRATED.html';

type CardState =
  | { phase: 'loading' }
  | { phase: 'signed-out' }
  | {
      phase: 'ready';
      writing: Trajectory;
      speaking: Trajectory;
      lastEssay: string;
      lastWriting: PracticeAttempt | null;
    };

type CoachState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'error'; note: string };

const TONE: Record<Trajectory['direction'], string> = {
  up: '#10b981',
  down: '#f59e0b',
  flat: '#94a3b8',
  first: '#38bdf8',
};

function deltaLabel(traj: Trajectory): string {
  if (traj.direction === 'first') return 'first attempt';
  if (traj.delta === 0) return 'no change';
  return `${traj.delta > 0 ? '+' : ''}${traj.delta.toFixed(1)} since last`;
}

function Sparkline({ traj }: { traj: Trajectory }) {
  return (
    <span className="cmc-pt-spark" aria-hidden="true">
      {traj.points.map((point, index) => (
        <span
          key={`${point.createdAt}-${index}`}
          className={index === traj.points.length - 1 ? 'is-latest' : undefined}
          style={{ height: `${Math.max(6, Math.round((point.band / 5) * 34))}px` }}
        />
      ))}
    </span>
  );
}

function TrendRow({
  label,
  traj,
  href,
  cta,
}: {
  label: string;
  traj: Trajectory;
  href: string;
  cta: string;
}) {
  const Icon = traj.direction === 'down' ? TrendingDown : TrendingUp;

  if (!traj.count) {
    return (
      <div className="cmc-pt-row is-empty">
        <div className="cmc-pt-row-head">
          <span className="cmc-pt-label">{label}</span>
          <span className="cmc-pt-note">No saved attempts yet</span>
        </div>
        <a className="cmc-pt-cta" href={href}>
          {cta}
        </a>
      </div>
    );
  }

  return (
    <div className="cmc-pt-row">
      <div className="cmc-pt-row-head">
        <span className="cmc-pt-label">{label}</span>
        <span className="cmc-pt-band">
          <strong>{traj.latest.toFixed(1)}</strong>
          <span className="cmc-pt-outof">/ 5</span>
          <span className="cmc-pt-delta" style={{ color: TONE[traj.direction] }}>
            <Icon size={12} aria-hidden="true" />
            {deltaLabel(traj)}
          </span>
        </span>
      </div>
      <div className="cmc-pt-row-body">
        <Sparkline traj={traj} />
        <span className="cmc-pt-note">
          best {traj.best.toFixed(1)} · {traj.count} saved
        </span>
        <a className="cmc-pt-cta" href={href}>
          {cta}
        </a>
      </div>
    </div>
  );
}

export function PracticeTrajectoryCard() {
  const session = useSignedInSession();
  const [state, setState] = useState<CardState>({ phase: 'loading' });
  const [coach, setCoach] = useState<CoachState>({ status: 'idle' });
  const [remaining, setRemaining] = useState(AI_COACH_DAILY_LIMIT);
  const [probe, setProbe] = useState<AiProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [storeDiag, setStoreDiag] = useState<StoreDiagnosis | null>(null);
  const appCheckReady = appCheckConfigured();
  // The console checklist is for the owner, not for a 12-year-old: only a
  // verified teacher/admin sees the status line and the setup steps.
  const isTeacherView = Boolean(session && (session.teacherVerified || session.role === 'teacher'));
  const sessionKey = session?.email || null;

  useEffect(() => {
    let alive = true;
    setRemaining(remainingCoachUses());
    if (!sessionKey) {
      setState({ phase: 'signed-out' });
      return () => {
        alive = false;
      };
    }
    setState({ phase: 'loading' });
    loadMyTrajectory(8)
      .then((result) => {
        if (!alive) return;
        // A signed-in student who has never practised still gets the card — the
        // rows say "no saved attempts yet" and link straight to the practice.
        setState({
          phase: 'ready',
          writing: result.writing,
          speaking: result.speaking,
          lastEssay: result.lastEssay,
          lastWriting: result.lastWriting,
        });
      })
      .catch(() => {
        if (alive) setState({ phase: 'signed-out' });
      });
    return () => {
      alive = false;
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!isTeacherView || state.phase !== 'ready') return;
    if (state.writing.count || state.speaking.count) {
      setStoreDiag(null);
      return;
    }
    let alive = true;
    diagnosePracticeStore().then((diag) => {
      if (alive) setStoreDiag(diag);
    });
    return () => {
      alive = false;
    };
  }, [isTeacherView, state]);

  const onProbe = useCallback(async () => {
    setProbing(true);
    try {
      // The real check: one tiny generation through Firebase AI Logic, then a
      // plain answer — connected, or the exact console step that is missing.
      setProbe(await probeAICoach());
    } finally {
      setProbing(false);
    }
  }, []);

  const onAskCoach = useCallback(async () => {
    if (state.phase !== 'ready' || !state.lastEssay) return;
    setCoach({ status: 'loading' });
    const result = await askCoach({
      essay: state.lastEssay,
      band: state.writing.latest,
      traits: state.lastWriting?.traits,
    });
    if (result.ok) {
      setCoach({ status: 'done', text: result.text });
      setRemaining(remainingCoachUses());
      return;
    }
    const note =
      result.reason === 'quota'
        ? 'You have used today’s AI reviews. They reset tomorrow.'
        : result.reason === 'no-essay'
          ? 'Write a little more first — the coach needs a full response to read.'
          : 'The AI coach is not switched on yet. Ask the site owner to enable Firebase AI Logic.';
    setCoach({ status: 'error', note });
  }, [state]);

  return (
    <div className="cmc-ai-live" data-keep-dark="">
      <div className="cmc-ai-live-head">
        <span className="cmc-holo-soon" data-live="true">
          PHASE 01 · LIVE
        </span>
        <h3 className="cmc-ai-live-title">Your practice trend</h3>
        <p className="cmc-ai-live-sub">
          Every TOEFL response you submit is scored on the class rubric and saved here — so you can
          see the line move instead of guessing.
        </p>
      </div>

      {state.phase === 'loading' && (
        <p className="cmc-pt-note" aria-live="polite">
          Loading your saved attempts…
        </p>
      )}

      {state.phase === 'signed-out' && (
        <div className="cmc-pt-signedout" aria-live="polite">
          <p className="cmc-pt-note">
            Sign in to keep your band history. The feedback works without an account, but the
            trend needs one.
          </p>
          <div className="cmc-pt-links">
            <a className="cmc-pt-cta" href={WRITING_HREF}>
              Write an essay · get a band
            </a>
            <a className="cmc-pt-cta" href={SPEAKING_HREF}>
              Record speaking · get delivery feedback
            </a>
          </div>
        </div>
      )}

      {state.phase === 'ready' && (
        <>
          <div className="cmc-pt-grid">
            <TrendRow
              label="Writing band"
              traj={state.writing}
              href={WRITING_HREF}
              cta="Write another"
            />
            <TrendRow
              label="Speaking delivery"
              traj={state.speaking}
              href={SPEAKING_HREF}
              cta="Record again"
            />
          </div>

          {isTeacherView && !state.writing.count && !state.speaking.count && (
            <p
              className="cmc-pt-note"
              data-store-state={storeDiag?.state || 'checking'}
              style={{ marginTop: '0.6rem' }}
            >
              {storeDiag
                ? `Score storage: ${storeDiag.message}${
                    storeDiag.status ? ` (HTTP ${storeDiag.status})` : ''
                  }`
                : 'Nothing saved yet — checking whether the database is accepting attempts…'}
            </p>
          )}

          <div className="cmc-pt-coach" aria-live="polite">
            {isTeacherView && (
            <div className="cmc-ai-status" data-state={probe ? probe.status : appCheckReady ? 'untested' : 'app-check'}>
              <span className="cmc-ai-status-dot" aria-hidden="true" />
              <span className="cmc-ai-status-text">
                {probe
                  ? probe.message
                  : appCheckReady
                    ? `AI coach: not tested yet · ${AI_COACH_MODEL}`
                    : 'AI coach: App Check key not set — see the steps'}
              </span>
              <button type="button" className="cmc-ai-status-btn" onClick={onProbe} disabled={probing}>
                {probing ? 'Testing…' : probe ? 'Test again' : 'Test connection'}
              </button>
            </div>
            )}

            {isTeacherView && probe && probe.status !== 'connected' && (
              <div className="cmc-ai-steps">
                <p className="cmc-pt-note">
                  What is still missing (Firebase console for creative-minds-cambodia):
                </p>
                <ol>
                  {AI_SETUP_STEPS.map((step) => (
                    <li key={step.id}>{step.label}</li>
                  ))}
                </ol>
                {probe.detail && <p className="cmc-pt-note">Reported: {probe.detail}</p>}
              </div>
            )}

            {appCheckReady && (coach.status === 'done' ? (
              <div className="cmc-pt-coach-card">
                <span className="cmc-pt-label">
                  <Sparkles size={12} aria-hidden="true" /> AI coach on your last essay
                </span>
                <p className="cmc-pt-coach-text">{coach.text}</p>
                <p className="cmc-pt-note">
                  A second opinion in words — not a new score. {remaining} of {AI_COACH_DAILY_LIMIT}{' '}
                  reviews left today.
                </p>
              </div>
            ) : coach.status === 'error' ? (
              <p className="cmc-pt-note">{coach.note}</p>
            ) : state.lastEssay ? (
              <button
                type="button"
                className="cmc-pt-coach-btn"
                onClick={onAskCoach}
                disabled={coach.status === 'loading' || remaining === 0}
              >
                <Sparkles size={14} aria-hidden="true" />
                {coach.status === 'loading'
                  ? 'Reading your essay…'
                  : remaining === 0
                    ? 'AI reviews used for today'
                    : 'Ask the AI coach to read my last essay'}
              </button>
            ) : (
              <p className="cmc-pt-note">
                Submit a writing response and the AI coach can read it back to you here.
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PracticeTrajectoryCard;
