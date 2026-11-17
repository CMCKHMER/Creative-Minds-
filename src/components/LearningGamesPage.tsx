import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, Copy, Crown, ExternalLink, Flame, Headphones, Heart, Lightbulb, Link2, LockKeyhole, Mail, MessageCircle, Mic, RotateCcw, School, Search, Send, Share2, Sparkles, Target, Timer, Trophy, UserPlus, Volume2, VolumeX, X, XCircle, Zap } from 'lucide-react';
import { GlassFact, GlassPageBar, GlassPageHero } from './GlassPage';
import { LEARNING_GAMES, gameXpTotal, type GameTier, type LearningGame, type LearningGameSkill } from '../data/learningGames';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';
import { GameLeaderboard, submitGameScore, useSignedInPlayerName } from './GameLeaderboard';
import { playCorrectSound, playWrongSound, playCompleteSound, toggleGameSound, isGameSoundMuted, fireConfetti, ensureConfettiCSS } from '../lib/gameSound';
import { useSignedInSession } from '../hooks/useSignedInSession';
import { requestAuth } from '../lib/authPrompt';
import {
  GUEST_SAMPLE_QUESTION_LIMIT,
  canPlayGameRound,
  hasActiveAccount,
  isSampleLearningGame,
} from '../lib/gameAccess';

const skillOptions: Array<'All games' | LearningGameSkill> = ['All games', 'Vocabulary', 'Reading', 'Grammar', 'Early literacy', 'Listening', 'Speaking'];

type GameMode = 'classic' | 'time-trial' | 'survival';

const MODE_META: Record<GameMode, { label: string; short: string; multiplier: number; blurb: string }> = {
  classic: { label: 'Classic Quest', short: 'Classic', multiplier: 1, blurb: 'No countdown. Think it through, use hints, learn from every clue.' },
  'time-trial': { label: 'Time Trial', short: 'Time Trial', multiplier: 1.5, blurb: 'A countdown on every round. Fast correct answers keep the run alive.' },
  survival: { label: 'Survival', short: 'Survival', multiplier: 2, blurb: '3 lives. Wrong answers and timeouts cost a heart. Double XP if you finish.' },
};

function gameIcon(skill: LearningGameSkill) {
  if (skill === 'Reading') return BookOpen;
  if (skill === 'Listening') return Headphones;
  if (skill === 'Vocabulary') return Lightbulb;
  if (skill === 'Speaking') return Mic;
  return Sparkles;
}

function tierMeta(tier: GameTier) {
  if (tier === 'warmup') return { label: 'Warm-up', chip: 'border-cyan-200/30 bg-cyan-300/10 text-cyan-100', dot: 'bg-cyan-300', text: 'text-cyan-200' };
  if (tier === 'build') return { label: 'Build', chip: 'border-violet-300/30 bg-violet-400/10 text-violet-100', dot: 'bg-violet-300', text: 'text-violet-200' };
  if (tier === 'mastery') return { label: 'Mastery', chip: 'border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-100', dot: 'bg-fuchsia-300', text: 'text-fuchsia-200' };
  return { label: 'BOSS', chip: 'border-amber-200/40 bg-amber-300/15 text-amber-100', dot: 'bg-amber-300', text: 'text-amber-200' };
}

function rankFor(percent: number, gameOver: boolean) {
  if (gameOver) return { rank: '—', label: 'Run stopped — retry the missed rounds' };
  if (percent >= 90) return { rank: 'S', label: 'Outstanding. Boss-round quality.' };
  if (percent >= 75) return { rank: 'A', label: 'Excellent work. You used the clues carefully.' };
  if (percent >= 60) return { rank: 'B', label: 'Strong practice. Review the explanations and push for A.' };
  if (percent >= 40) return { rank: 'C', label: 'Good effort. Retry just the missed rounds below.' };
  return { rank: 'D', label: 'Every try teaches you something. Review a clue, then retry missed rounds.' };
}

function shareToast(message: string) {
  const existing = document.querySelector<HTMLElement>('[data-cmc-share-toast]');
  const el = existing ?? document.createElement('div');
  if (!existing) {
    el.setAttribute('data-cmc-share-toast', '');
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(10px);z-index:99995;background:#0d1930;color:#e2e8f0;border:1px solid rgba(34,211,238,.4);border-radius:999px;padding:9px 18px;font:600 13px Inter,sans-serif;opacity:0;pointer-events:none;transition:.25s;max-width:92vw';
    document.body.appendChild(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
  window.clearTimeout((el as any)._cmcShareToastT);
  (el as any)._cmcShareToastT = window.setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2600);
}

interface ShareTarget {
  title: string;
  text: string;
  url: string;
}

function shareTargetForGame(game: LearningGame): ShareTarget {
  const url = game.externalUrl
    ? new URL(game.externalUrl, window.location.href).toString()
    : `${window.location.href.split('#')[0]}#games`;
  return { title: game.title, text: `${game.title} — play on CMC: ${game.description.slice(0, 180)}`, url };
}

/** Copy with a legacy fallback — clipboard permission is often denied inside
 *  iframes / preview frames, where the old code appeared to do nothing. */
async function copyShareText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch { /* fall through to the textarea path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.cssText = 'position:fixed;top:-999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * "Share to class" sheet. The previous implementation called
 * navigator.share() first and silently swallowed its rejection — inside
 * iframes, in-app webviews and several desktop browsers the share sheet is
 * blocked, the promise rejects, and the button looked completely dead.
 * Now EVERY press opens this sheet; the native share sheet is just one
 * option inside it, beside Copy / Classroom / WhatsApp / Telegram / Email.
 */
function ShareDialog({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const encodedUrl = encodeURIComponent(target.url);
  const encodedText = encodeURIComponent(target.text);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    const ok = await copyShareText(`${target.text} ${target.url}`);
    shareToast(ok ? 'Game link copied — paste it into your class chat ✓' : 'Copy blocked — long-press the link in the box to copy it');
    if (ok) onClose();
  };

  const handleNative = async () => {
    try {
      await navigator.share({ title: target.title, text: target.text, url: target.url });
      onClose();
    } catch (err) {
      // Dismissing the OS sheet keeps this dialog open; a blocked sheet
      // (iframe / permissions policy) gets a visible explanation instead
      // of the old silent no-response.
      if (!err || (err as { name?: string }).name !== 'AbortError') {
        shareToast('Share sheet unavailable here — use Copy, Classroom, WhatsApp or Email below');
      }
    }
  };

  const optionClass = 'flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-3 text-xs font-semibold text-slate-100 transition hover:border-cyan-200/40 hover:bg-cyan-200/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

  return (
    <div className="fixed inset-0 z-[99990] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={`Share ${target.title} with your class`} onClick={onClose}>
      <div className="cmc-card w-full max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.17em] text-cyan-200 uppercase">Share to class</p>
            <h3 className="mt-1.5 font-[var(--font-display)] text-lg font-bold leading-snug text-white">{target.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close share options" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{target.text}</p>
        <label className="mt-4 block">
          <span className="sr-only">Game link</span>
          <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-cyan-200" aria-hidden="true" />
            <input readOnly value={target.url} onFocus={(e) => e.currentTarget.select()} className="w-full bg-transparent font-mono text-[10px] text-slate-300 outline-none" aria-label="Game link — long-press or select to copy" />
          </span>
        </label>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => void handleCopy()} className={optionClass}><Copy className="h-4 w-4 text-cyan-200" aria-hidden="true" /> Copy link</button>
          <a href={`https://classroom.google.com/share?url=${encodedUrl}&title=${encodeURIComponent(target.title)}`} target="_blank" rel="noopener noreferrer" className={optionClass} onClick={onClose}><School className="h-4 w-4 text-emerald-200" aria-hidden="true" /> Google Classroom</a>
          <a href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" className={optionClass} onClick={onClose}><MessageCircle className="h-4 w-4 text-green-200" aria-hidden="true" /> WhatsApp</a>
          <a href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noopener noreferrer" className={optionClass} onClick={onClose}><Send className="h-4 w-4 text-sky-200" aria-hidden="true" /> Telegram</a>
          <a href={`mailto:?subject=${encodeURIComponent(target.title)}&body=${encodedText}%0A${encodedUrl}`} className={optionClass} onClick={onClose}><Mail className="h-4 w-4 text-amber-200" aria-hidden="true" /> Email</a>
          {canNativeShare && <button type="button" onClick={() => void handleNative()} className={optionClass}><Share2 className="h-4 w-4 text-fuchsia-200" aria-hidden="true" /> Share… (this device)</button>}
        </div>
        <p className="mt-4 text-[10px] leading-relaxed text-slate-500">Google Classroom opens its own dialog — pick the class, then post the game as an announcement or assignment. Copy works everywhere, including inside previews.</p>
      </div>
    </div>
  );
}

function GamePlay({ game, onExit }: { game: LearningGame; onExit: () => void }) {
  const session = useSignedInSession();
  const signedIn = hasActiveAccount(session);
  const guestLocked = !signedIn && !isSampleLearningGame(game.id);
  const fullIds = useMemo(() => game.questions.map((_, i) => i), [game]);
  const defaultIds = signedIn ? fullIds : fullIds.slice(0, GUEST_SAMPLE_QUESTION_LIMIT);
  const [phase, setPhase] = useState<'brief' | 'playing' | 'finished'>('brief');
  const [mode, setMode] = useState<GameMode>('classic');
  const [retryIds, setRetryIds] = useState<number[] | null>(null);
  const activeIds = retryIds ?? defaultIds;
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [soundMuted, setSoundMuted] = useState(isGameSoundMuted());
  const [lives, setLives] = useState(game.lives ?? 3);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [eliminated, setEliminated] = useState<Record<number, number[]>>({});
  const [hintShown, setHintShown] = useState<Record<number, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(game.secondsPerQuestion ?? 35);
  const [elapsed, setElapsed] = useState(0);

  const qIndex = activeIds[Math.min(pos, Math.max(0, activeIds.length - 1))] ?? 0;
  const question = game.questions[qIndex];
  const gamePassage = question?.passage ?? game.passage;
  const audioScript = question?.audioScript ?? game.audioScript;
  const selectedIndex = answers[qIndex];
  const answered = selectedIndex !== undefined;
  const isTimeout = selectedIndex === -1;
  const meta = question ? tierMeta(question.tier) : tierMeta('warmup');
  const Icon = gameIcon(game.skill);
  const perQuestion = game.secondsPerQuestion ?? 35;
  const gameOver = mode === 'survival' && lives <= 0 && answered;

  const stats = useMemo(() => {
    let score = 0; let xp = 0; let streak = 0; let best = 0; let answeredCount = 0;
    for (const idx of activeIds) {
      const a = answers[idx];
      if (a === undefined) continue;
      answeredCount += 1;
      if (a === game.questions[idx].correctIndex) {
        score += 1; streak += 1; best = Math.max(best, streak);
        xp += game.questions[idx].points + (streak >= 3 ? 5 : 0);
      } else streak = 0;
    }
    // live streak = trailing streak
    let live = 0;
    for (let i = activeIds.length - 1; i >= 0; i -= 1) {
      const a = answers[activeIds[i]];
      if (a === undefined) continue;
      if (a === game.questions[activeIds[i]].correctIndex) live += 1; else break;
    }
    return { score, xp: Math.round(xp * MODE_META[mode].multiplier), streak: live, best, answeredCount };
  }, [activeIds, answers, game, mode]);

  const resetRun = (ids: number[] | null, nextMode: GameMode = mode) => {
    setRetryIds(ids);
    setPos(0);
    setAnswers({});
    setEliminated({});
    setHintShown({});
    setLives(game.lives ?? 3);
    setHintsLeft(3);
    setElapsed(0);
    setSecondsLeft(perQuestion);
    setMode(nextMode);
    setPhase('playing');
  };

  // countdown (Time Trial / Survival)
  useEffect(() => {
    if (phase !== 'playing' || mode === 'classic' || answered) return;
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [phase, mode, answered, secondsLeft, pos]);

  // timeout → mark wrong
  useEffect(() => {
    if (phase !== 'playing' || mode === 'classic' || answered || secondsLeft > 0) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: -1 }));
    playWrongSound();
    if (mode === 'survival') setLives((l) => Math.max(0, l - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase, mode, answered]);

  // per-question timer reset + elapsed clock
  useEffect(() => { setSecondsLeft(perQuestion); }, [pos, phase, perQuestion]);
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const handleAnswer = (choiceIndex: number) => {
    if (answered) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: choiceIndex }));
    if (choiceIndex === question.correctIndex) playCorrectSound();
    else {
      playWrongSound();
      if (mode === 'survival') setLives((l) => Math.max(0, l - 1));
    }
  };

  const finishGame = () => {
    if (!signedIn) {
      requestAuth({ mode: 'sign-up', contextPrompt: `Sign up free to finish ${game.title}, save your score and climb the class leaderboard.` });
      return;
    }
    setPhase('finished');
    playCompleteSound();
    ensureConfettiCSS();
    if (stats.score / Math.max(1, activeIds.length) >= 0.5) fireConfetti(90);
    // Only full runs post to the leaderboard — retry-missed runs are practice.
    if (!retryIds) {
      void submitGameScore({ gameSlug: game.id, gameTitle: game.title, correctCount: stats.score, totalCount: game.questions.length });
    }
  };

  // keyboard play: 1–4 / A–D to answer, Enter to advance
  useEffect(() => {
    if (phase !== 'playing' || !question) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
      const idx = map[e.key.toLowerCase()];
      if (idx !== undefined && !answered && !(eliminated[pos] ?? []).includes(idx) && idx < question.choices.length) { handleAnswer(idx); return; }
      if (e.key === 'Enter' && answered) {
        e.preventDefault();
        if (gameOver || pos >= activeIds.length - 1) finishGame();
        else if (canPlayGameRound(session, game.id, pos + 1)) setPos((p) => p + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, question, answered, pos, activeIds, eliminated, gameOver, session]);

  const useHint = () => {
    if (answered || hintsLeft <= 0) return;
    const wrong = question.choices.map((_, i) => i).filter((i) => i !== question.correctIndex && !(eliminated[pos] ?? []).includes(i));
    if (wrong.length === 0) return;
    const toRemove = wrong.slice(0, Math.min(2, wrong.length - 0)).slice(0, 2);
    // keep at least the correct answer + one distractor on 4-choice rounds
    const limited = wrong.length > 1 ? toRemove.slice(0, wrong.length - 1 > 0 ? 2 : 1) : toRemove;
    setEliminated((prev) => ({ ...prev, [pos]: [...(prev[pos] ?? []), ...limited] }));
    setHintShown((prev) => ({ ...prev, [pos]: true }));
    setHintsLeft((h) => h - 1);
  };

  const handleToggleSound = () => setSoundMuted(toggleGameSound());

  if (guestLocked) {
    return (
      <section id="game-playground" className="cmc-card scroll-mt-6 mt-10 overflow-hidden p-6 sm:p-9">
        <div className="mx-auto max-w-xl text-center">
          <span className="iri-ring mx-auto grid h-14 w-14 place-items-center text-cyan-100"><LockKeyhole className="h-6 w-6" aria-hidden="true" /></span>
          <p className="mt-5 text-[10px] font-bold tracking-[0.17em] text-cyan-200 uppercase">Free account required</p>
          <h3 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">{game.title} unlocks with a free account</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Visitors can sample {GUEST_SAMPLE_QUESTION_LIMIT} rounds of a few games. Create a free account — student or general user, same access — to play {game.title} in full and save your score.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button type="button" onClick={() => requestAuth({ mode: 'sign-up', contextPrompt: `Sign up free to play ${game.title} in full.` })} className="iri-btn min-h-11"><UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Create a free account</button>
            <button type="button" onClick={onExit} className="cmc-btn-ghost min-h-11 rounded-full px-4 py-2.5 text-xs font-semibold">Back to the sample games</button>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'brief') {
    return (
      <section id="game-playground" className="cmc-card scroll-mt-6 mt-10 overflow-hidden">
        {game.coverImage && (
          <div className="relative h-48 overflow-hidden sm:h-56">
            <img src={game.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] via-[#0b1020]/35 to-transparent" aria-hidden="true" />
            <span className={`absolute left-4 top-4 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] backdrop-blur ${tierMeta('boss').chip}`}>{game.difficultyLabel ?? 'Challenge'}</span>
            <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 text-white"><span className="iri-ring grid h-10 w-10 place-items-center"><Icon className="h-5 w-5" aria-hidden="true" /></span><span><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-200">{game.skill} · {game.level}</span><span className="font-[var(--font-display)] text-lg font-bold">{game.title}</span></span></span>
          </div>
        )}
        <div className="p-5 sm:p-8">
          {!game.coverImage && <p className="text-[9px] font-bold tracking-[0.16em] text-cyan-200 uppercase">{game.skill} · {game.level}</p>}
          <p className="mt-1 font-[var(--font-display)] text-xl font-bold text-white">{game.tagline ?? game.title}</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{game.description}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{game.instructions}</p>

          <div className="cmc-stat-row mt-5" role="list" aria-label="Game facts">
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{activeIds.length}</span><span className="cmc-stat-label">Rounds</span></span>
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{gameXpTotal(game)} XP</span><span className="cmc-stat-label">Perfect run</span></span>
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{game.lives ?? 3} ♥</span><span className="cmc-stat-label">Survival lives</span></span>
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{perQuestion}s</span><span className="cmc-stat-label">Per round · timed</span></span>
          </div>

          <p className="mt-6 text-[9px] font-bold tracking-[0.16em] text-slate-400 uppercase">Choose your challenge mode</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Challenge mode">
            {(Object.keys(MODE_META) as GameMode[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-2xl border p-4 text-left transition ${mode === m ? 'border-transparent bg-[linear-gradient(160deg,rgba(255,94,210,.14),rgba(34,211,238,.10))] shadow-[0_0_0_1px_rgba(167,139,250,.45)]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}>
                <span className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-white">{MODE_META[m].label}</span><span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] text-cyan-100">×{MODE_META[m].multiplier} XP</span></span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-slate-400">{MODE_META[m].blurb}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Journey and extra challenges">
            {['Warm-up', 'Build', 'Mastery', 'BOSS'].map((t, i) => <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-300">{i === 3 ? <Crown className="h-3 w-3 text-amber-200" aria-hidden="true" /> : <span className={`h-1.5 w-1.5 rounded-full ${tierMeta((['warmup', 'build', 'mastery', 'boss'] as GameTier[])[i]).dot}`} aria-hidden="true" />}{t}</span>)}
            {(game.challengeModes ?? []).map((c) => <span key={c} className="rounded-full border border-white/8 px-2.5 py-1 text-[9px] font-semibold text-slate-500">{c}</span>)}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => resetRun(null, mode)} className="iri-btn min-h-11">Start {MODE_META[mode].short} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
            <button type="button" onClick={onExit} className="cmc-btn-ghost min-h-11 rounded-full px-4 py-2.5 text-xs font-semibold">All games</button>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><Zap className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" /> Keys 1–4 / A–D answer · Enter advances{!signedIn ? ` · Free sample: first ${GUEST_SAMPLE_QUESTION_LIMIT} rounds` : ''}</span>
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'finished') {
    const percent = Math.round((stats.score / Math.max(1, activeIds.length)) * 100);
    const rank = rankFor(percent, gameOver);
    const missed = activeIds.filter((idx) => answers[idx] !== game.questions[idx].correctIndex);
    return (
      <section id="game-playground" className="cmc-card scroll-mt-6 mt-10 overflow-hidden p-6 sm:p-9">
        <div className="mx-auto max-w-2xl text-center">
          <span className="iri-ring mx-auto grid h-16 w-16 place-items-center text-amber-100">{gameOver ? <Heart className="h-7 w-7" aria-hidden="true" /> : <Trophy className="h-7 w-7" aria-hidden="true" />}</span>
          <p className="mt-5 text-[10px] font-bold tracking-[0.17em] text-teal-200 uppercase">{gameOver ? 'Survival run ended' : retryIds ? 'Retry complete' : 'Game complete'} · {MODE_META[mode].label}</p>
          <h3 className="mt-2 font-[var(--font-display)] text-3xl font-bold text-white">Rank {rank.rank} · {stats.score} of {activeIds.length} correct</h3>
          <p className="mt-2 text-sm text-slate-400">{rank.label}</p>
          <div className="cmc-stat-row mx-auto mt-6 max-w-lg" role="list" aria-label="Run results">
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{stats.xp} XP</span><span className="cmc-stat-label">Earned ×{MODE_META[mode].multiplier}</span></span>
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{percent}%</span><span className="cmc-stat-label">Accuracy</span></span>
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{stats.best} 🔥</span><span className="cmc-stat-label">Best streak</span></span>
            <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span><span className="cmc-stat-label">Time</span></span>
          </div>
        </div>
        <div className="mx-auto mt-7 max-w-3xl space-y-2">
          {activeIds.map((idx, n) => {
            const item = game.questions[idx];
            const isCorrect = answers[idx] === item.correctIndex;
            const tm = tierMeta(item.tier);
            return <details key={`${game.id}-result-${idx}`} className="rounded-xl border border-white/8 bg-slate-950/35 p-4"><summary className="flex cursor-pointer list-none items-center gap-3 text-xs"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${isCorrect ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-200/10 text-amber-100'}`}>{isCorrect ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}</span><span className="flex-1 text-slate-200">Round {n + 1} · {item.challengeTag}</span><span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold ${tm.chip}`}>{tm.label} · {item.points} XP</span><span className="text-slate-500">{answers[idx] === -1 ? 'Timed out' : isCorrect ? 'Correct' : 'Review'}</span></summary><div className="mt-3 border-t border-white/8 pt-3 text-xs leading-relaxed text-slate-400"><p>{item.prompt}</p><p className="mt-2 text-slate-300">Correct: <strong className="text-emerald-100">{item.choices[item.correctIndex]}</strong></p><p className="mt-1.5 text-emerald-100/80">{item.feedback}</p></div></details>;
          })}
        </div>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => resetRun(null)} className="iri-btn min-h-11"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Play again</button>
          {missed.length > 0 && <button type="button" onClick={() => resetRun(missed)} className="cmc-btn-ghost inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold"><Target className="h-3.5 w-3.5" aria-hidden="true" /> Retry {missed.length} missed</button>}
          <button type="button" onClick={onExit} className="cmc-btn-ghost min-h-11 rounded-full px-4 py-2.5 text-xs font-semibold">Choose another game</button>
        </div>
      </section>
    );
  }

  if (!question) return null;
  const timerPct = mode === 'classic' ? 100 : Math.max(0, (secondsLeft / perQuestion) * 100);
  const timerDanger = mode !== 'classic' && secondsLeft <= 8 && !answered;

  return (
    <section id="game-playground" className="cmc-card scroll-mt-6 mt-10 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          {game.coverImage ? <img src={game.coverImage} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" loading="lazy" /> : <span className="iri-ring grid h-10 w-10 shrink-0 place-items-center text-cyan-100"><Icon className="h-5 w-5" aria-hidden="true" /></span>}
          <div className="min-w-0"><p className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase">{game.skill} · {game.level} · {MODE_META[mode].label}</p><h3 className="truncate text-sm font-bold text-white sm:text-base">{game.title}{retryIds ? ' · Retry missed' : ''}</h3></div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleToggleSound} title={soundMuted ? 'Unmute game sounds' : 'Mute game sounds'} aria-label={soundMuted ? 'Unmute game sounds' : 'Mute game sounds'} className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">{soundMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}</button>
          <button type="button" onClick={() => setPhase('brief')} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Briefing</button>
          <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">All games</button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_270px]">
        <div className="p-5 sm:p-8">
          <div className="mb-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">Round {pos + 1} of {activeIds.length}{!signedIn ? ' · free sample' : ''}</p><p className="mt-1 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${meta.chip}`}>{question.tier === 'boss' ? <Crown className="mr-1 inline h-3 w-3" aria-hidden="true" /> : null}{meta.label} · {question.points} XP</span><span className="text-[10px] font-semibold text-slate-400">{question.challengeTag}</span></p></div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg border border-orange-200/20 bg-orange-300/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-orange-100" aria-label={`${stats.streak} answer streak`}><Flame className="h-3.5 w-3.5" aria-hidden="true" /> {stats.streak}</span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200/20 bg-amber-300/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-amber-100"><Zap className="h-3.5 w-3.5" aria-hidden="true" /> {stats.xp} XP</span>
                {mode === 'survival' && <span className="inline-flex items-center gap-0.5 rounded-lg border border-rose-200/20 bg-rose-300/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-rose-100" aria-label={`${lives} lives left`}>{Array.from({ length: game.lives ?? 3 }).map((_, i) => <Heart key={i} className={`h-3.5 w-3.5 ${i < lives ? 'fill-current' : 'opacity-25'}`} aria-hidden="true" />)}</span>}
                {mode !== 'classic' && <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-bold ${timerDanger ? 'border-rose-300/40 bg-rose-400/10 text-rose-100 animate-pulse' : 'border-white/10 text-slate-300'}`}><Timer className="h-3.5 w-3.5" aria-hidden="true" />{answered ? '—' : `${secondsLeft}s`}</span>}
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-label="Game progress" aria-valuemin={0} aria-valuemax={activeIds.length} aria-valuenow={pos + (answered ? 1 : 0)}><div className="h-full rounded-full bg-[linear-gradient(90deg,#ff5ed2,#a78bfa,#22d3ee,#5eead4)] transition-all duration-500" style={{ width: `${((pos + (answered ? 1 : 0)) / activeIds.length) * 100}%` }} /></div>
            {mode !== 'classic' && <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/6" aria-hidden="true"><div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${timerDanger ? 'bg-rose-400' : 'bg-cyan-300'}`} style={{ width: `${timerPct}%` }} /></div>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-400">{game.instructions}</p><button type="button" onClick={useHint} disabled={answered || hintsLeft <= 0} className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/25 bg-cyan-300/[0.07] px-3 py-1.5 text-[10px] font-bold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-35"><Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> Hint · {hintsLeft} left</button></div>
            {hintShown[pos] && <p role="status" className="mt-2 rounded-lg border border-cyan-200/20 bg-cyan-300/[0.05] px-3 py-2 text-[11px] leading-relaxed text-cyan-50"><strong>Hint:</strong> {question.hint} Two wrong answers have been crossed out.</p>}
            {gameOver && <p role="alert" className="mt-2 rounded-lg border border-rose-300/30 bg-rose-400/[0.07] px-3 py-2 text-[11px] font-semibold text-rose-100">Out of lives — this run ends here. See your results, then retry the missed rounds.</p>}
          </div>

          {gamePassage && <div className="mb-5 rounded-xl border border-cyan-300/10 bg-[#071522] p-4"><p className="text-[9px] font-bold tracking-[0.14em] text-cyan-200 uppercase">{question.passage ? 'Boss passage' : 'Reading clue'}</p><div className="mt-2 space-y-2 font-serif text-sm leading-relaxed text-slate-300">{gamePassage.map((part, index) => <p key={`${game.id}-passage-${qIndex}-${index}`}>{part}</p>)}</div></div>}

          {audioScript && (
            <div className="mb-5">
              <ListeningAudioPlayer key={`${game.id}-audio-${qIndex}`} script={audioScript} title={qIndex >= 7 && game.id === 'listening-scout' ? 'Boss recording · Seedling project' : 'Listening clue'} tone="violet" />
            </div>
          )}

          <h4 className={`text-base font-semibold leading-relaxed sm:text-lg ${question.tier === 'boss' ? 'text-amber-50' : 'text-white'}`}>{question.prompt}</h4>
          <div className="mt-4 space-y-2" role="group" aria-label="Answer choices">{question.choices.map((choice, index) => {
            const chosen = selectedIndex === index;
            const correct = index === question.correctIndex;
            const elim = (eliminated[pos] ?? []).includes(index);
            const style = elim ? 'border-white/6 bg-white/[0.01] text-slate-600 line-through opacity-50' : !answered ? 'border-white/10 bg-white/[0.025] text-slate-300 hover:border-fuchsia-300/35 hover:bg-fuchsia-300/[0.04]' : correct ? 'border-emerald-300/30 bg-emerald-300/[0.07] text-emerald-50' : chosen ? 'border-rose-300/30 bg-rose-300/[0.06] text-rose-50' : 'border-white/6 bg-white/[0.015] text-slate-500';
            return <button key={`${game.id}-${qIndex}-${index}`} type="button" aria-pressed={chosen} disabled={elim || answered} onClick={() => handleAnswer(index)} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs leading-relaxed transition disabled:cursor-not-allowed ${style}`}><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current/25 font-mono text-[9px] font-bold">{answered && correct ? <Check className="h-3 w-3" aria-hidden="true" /> : String.fromCharCode(65 + index)}</span><span className="flex-1">{choice}</span><span className="hidden font-mono text-[9px] text-slate-600 sm:inline" aria-hidden="true">{index + 1}</span></button>;
          })}</div>
          {answered && <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-4 ${selectedIndex === question.correctIndex ? 'border-emerald-300/20 bg-emerald-300/[0.05]' : 'border-amber-200/20 bg-amber-200/[0.04]'}`}><p className="text-xs font-bold text-white">{isTimeout ? 'Time’s up. Study the clue, then move on.' : selectedIndex === question.correctIndex ? 'Correct. Nice reasoning.' : 'Not quite. Look at the clue again.'}</p><p className="mt-1.5 text-xs leading-relaxed text-slate-300">{question.feedback}</p></div>}
          <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4"><button type="button" disabled={pos === 0} onClick={() => setPos((p) => Math.max(0, p - 1))} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous</button><span className="font-mono text-[10px] text-slate-500">{stats.score} correct · {stats.xp} XP</span>{!gameOver && pos < activeIds.length - 1 && canPlayGameRound(session, game.id, pos + 1) ? <button type="button" disabled={!answered} onClick={() => setPos((p) => p + 1)} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.07] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Next clue <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button> : <button type="button" disabled={!answered} onClick={finishGame} className="iri-btn min-h-11 !px-4 !py-2.5 text-[11px]">{signedIn ? 'See results' : 'Sign up to finish'} <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /></button>}</div>
        </div>

        <aside className="border-t border-white/8 bg-slate-950/35 p-5 lg:border-t-0 lg:border-l lg:p-6">
          <p className="text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">Challenge map</p>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">{activeIds.map((idx, index) => { const tm = tierMeta(game.questions[idx].tier); const a = answers[idx]; return <button key={`${game.id}-step-${idx}`} type="button" onClick={() => setPos(index)} aria-label={`Go to round ${index + 1}, ${tm.label}${a !== undefined ? ', answered' : ', unanswered'}`} title={`${tm.label} · ${game.questions[idx].challengeTag}`} className={`relative grid h-9 place-items-center rounded-lg border font-mono text-[10px] font-bold ${pos === index ? 'border-transparent bg-[linear-gradient(135deg,#ff5ed2,#22d3ee)] text-slate-950' : a !== undefined ? (a === game.questions[idx].correctIndex ? 'border-teal-200/25 bg-teal-200/5 text-teal-100' : 'border-rose-300/25 bg-rose-300/5 text-rose-100') : 'border-white/10 text-slate-500'}`}>{game.questions[idx].tier === 'boss' ? <Crown className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}<span className={`absolute bottom-1 h-1 w-1 rounded-full ${tm.dot}`} aria-hidden="true" /></button>; })}</div>
          <div className="mt-5 space-y-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-[11px]">
            <div className="flex items-center justify-between"><span className="text-slate-500">Checkpoint</span><span className={`font-bold ${meta.text}`}>{meta.label}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">Correct so far</span><span className="font-mono font-bold text-white">{stats.score} / {stats.answeredCount}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">Best streak</span><span className="font-mono font-bold text-white">{stats.best}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">XP (×{MODE_META[mode].multiplier})</span><span className="font-mono font-bold text-amber-100">{stats.xp}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">Hints left</span><span className="font-mono font-bold text-white">{hintsLeft}</span></div>
            {mode === 'survival' && <div className="flex items-center justify-between"><span className="text-slate-400">Lives</span><span className="font-mono font-bold text-rose-100">{lives} / {game.lives ?? 3}</span></div>}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">{game.instructions}</p>
          <p className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[10px] leading-relaxed text-slate-500">Journey: cyan Warm-up → violet Build → magenta Mastery → gold Boss. Streaks of 3+ earn +5 XP per correct answer.</p>
          <div className="mt-4 border-t border-white/8 pt-4 text-[10px] leading-relaxed text-slate-500">{signedIn ? 'Your full-run score is saved to your account and the class leaderboard.' : `Free sample: ${GUEST_SAMPLE_QUESTION_LIMIT} rounds. Sign up to play every round and save your score.`}</div>
        </aside>
      </div>
    </section>
  );
}

export function LearningGamesPage({ onBackHome }: { onBackHome: () => void }) {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Learning Games · Creative Minds';
    return () => { document.title = prev; };
  }, []);
  const [activeSkill, setActiveSkill] = useState<'All games' | LearningGameSkill>('All games');
  const [query, setQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<LearningGame | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const filteredGames = LEARNING_GAMES.filter((game) => (activeSkill === 'All games' || game.skill === activeSkill) && (`${game.title} ${game.skill} ${game.tagline ?? ''} ${game.difficultyLabel ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())));
  const signedInPlayer = useSignedInPlayerName();
  const session = useSignedInSession();
  const inPage = LEARNING_GAMES.filter((g) => !g.externalUrl);
  const totalRounds = inPage.reduce((s, g) => s + g.questions.length, 0);
  const totalXp = inPage.reduce((s, g) => s + gameXpTotal(g), 0);

  const chooseGame = (game: LearningGame) => {
    setSelectedGame(game);
    window.setTimeout(() => document.getElementById('game-playground')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  return (
    <main className="cmc-app cmc-subpage min-h-screen overflow-hidden text-slate-100">
      <GlassPageBar href="#games" label="Creative Minds Learning Games home" icon={Sparkles} name="Creative Minds" accent="Play Lab" onBack={onBackHome} />

      <GlassPageHero
        view="a"
        eyebrow="The CMC Learning Games room"
        eyebrowIcon={Sparkles}
        title={<>Pick a game.<br /><em>Beat the Boss round.</em></>}
        lead="Harder, richer learning games for vocabulary, reading, grammar, listening and early literacy — Warm-up, Build and Mastery rounds, a gold Boss round in every game, three challenge modes, hint tokens, streak XP and AI artwork on every card."
      >
        <GlassFact>{LEARNING_GAMES.length} live learning games</GlassFact>
        <GlassFact>{totalRounds} in-page rounds · {totalXp} XP to earn</GlassFact>
        <GlassFact>3 modes · Classic, Time Trial, Survival</GlassFact>
        <GlassFact>Free account · 2-round sample for guests</GlassFact>
      </GlassPageHero>

      <section data-keep-dark className="mx-auto max-w-7xl px-5 pb-2 sm:px-8" aria-labelledby="devpicks-title">
        <div className="cmc-card overflow-hidden p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-md border border-amber-200/30 bg-amber-200/10 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-amber-200 uppercase">Developer&apos;s Pick</span><span className="rounded-md border border-white/8 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">Reading · Quiz</span></div>
          <h2 id="devpicks-title" className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">Ghost Mountain · A Reading on Memory, History &amp; Human Courage</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">The developer&apos;s own pick, rebuilt 1:1 from the Creativeminds Canva worksheet: a respectful, evidence-first reading on Ghost Mountain (Phnom Khmaoch) near Preah Vihear — displacement, the June 1979 forced return, and why the name is remembered. Eight short reading sections, a 1975–1979 timeline, a schematic border map, a labelled-visuals guide and an eight-term vocabulary box lead into the eight-question quiz with instant feedback and a class-leaderboard score. Think-and-write prompts (Parts B and C) save on your device for teacher review; the sources section links the UNHCR and DC-Cam evidence. A content note is shown up front: the topic involves displacement, violence, landmines, death and grief, handled without graphic descriptions — suited to older students.</p>
          <div className="mt-4 flex items-center gap-3 border-t border-white/8 pt-3 text-[10px] text-slate-500"><span>Grades 8–12</span><span aria-hidden="true">·</span><span>Reading + 8-question quiz · 15–20 min</span></div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasActiveAccount(session) ? (
              <a href="./dev-pick-ghost-mountain.html" className="group/button inline-flex items-center gap-2 self-start rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-amber-200/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">Open the reading &amp; quiz <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" aria-hidden="true" /></a>
            ) : (
              <button type="button" onClick={() => requestAuth({ mode: 'sign-up', contextPrompt: 'Sign up free to open the Ghost Mountain reading & quiz.' })} className="group/button inline-flex items-center gap-2 self-start rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-amber-200/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Sign up to open the reading &amp; quiz</button>
            )}
            <button type="button" onClick={() => { const panels = document.querySelectorAll('.cmc-game-leaderboard'); const target = Array.prototype.find.call(panels, (n) => n.offsetParent !== null) || panels[0]; if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-amber-200/25 bg-amber-200/[0.07] px-3 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-200/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300" aria-label="Scroll to the class leaderboard">🏆 Class leaderboard</button>
            <button type="button" onClick={() => setShareTarget({ title: 'Ghost Mountain · Reading & Quiz', text: 'Ghost Mountain · A Reading on Memory, History & Human Courage — the Developer\'s Pick reading & quiz on CMC', url: new URL('./dev-pick-ghost-mountain.html', window.location.href).toString() })} aria-haspopup="dialog" className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/12 bg-transparent px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-amber-200/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300" aria-label="Share the Ghost Mountain reading & quiz with your class"><Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share to class</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-col justify-between gap-5 border-b border-white/10 pb-5 xl:flex-row xl:items-end"><div><p className="text-[9px] font-bold tracking-[0.17em] text-cyan-300 uppercase">Game library</p><h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">What would you like to practice?</h2><p className="mt-1 text-xs text-slate-400">Every in-page game: Warm-up → Build → Mastery → <span className="font-bold text-amber-200">Boss round</span>. Pick Classic, Time Trial or Survival on the briefing screen.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" /><span className="sr-only">Search games</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games…" className="w-full rounded-xl border border-white/10 bg-slate-900/60 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-fuchsia-300/50 sm:w-52" /></label><div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 p-1" role="tablist" aria-label="Filter learning games">{skillOptions.map((skill) => <button key={skill} type="button" role="tab" aria-selected={activeSkill === skill} onClick={() => setActiveSkill(skill)} className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition ${activeSkill === skill ? 'bg-[linear-gradient(120deg,rgba(255,94,210,.35),rgba(34,211,238,.25))] text-white' : 'text-slate-400 hover:text-white'}`}>{skill}</button>)}</div></div></div>

        <div className="mt-7 grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {filteredGames.length === 0 && <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-slate-400">No games match “{query}”. Try another skill or clear the search.</p>}
            <div className="grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredGames.map((game) => {
                const Icon = gameIcon(game.skill);
                const xp = gameXpTotal(game);
                return (
                  <article key={game.id} className="cmc-card group flex min-h-[380px] flex-col overflow-hidden">
                    <div className="relative h-40 shrink-0 overflow-hidden">
                      {game.coverImage ? <img src={game.coverImage} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(255,94,210,.35),rgba(167,139,250,.25),rgba(34,211,238,.35))]" aria-hidden="true"><Icon className="h-16 w-16 text-white/80" strokeWidth={1.1} /></div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] via-transparent to-[#0b1020]/20" aria-hidden="true" />
                      <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-slate-950/45 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">{game.badge || 'Play now'}</span>
                      {game.difficultyLabel && <span className="absolute right-3 top-3 max-w-[55%] truncate rounded-full border border-amber-200/30 bg-slate-950/45 px-2 py-1 text-[8px] font-bold text-amber-100 backdrop-blur">{game.difficultyLabel}</span>}
                      <span className="iri-ring absolute -bottom-5 left-4 grid h-11 w-11 place-items-center text-white"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-slate-950/55 px-2 py-1 font-mono text-[9px] font-bold text-amber-100 backdrop-blur"><Zap className="h-3 w-3" aria-hidden="true" />{xp} XP</span>
                    </div>
                    <div className="flex flex-1 flex-col p-5 pt-7">
                      <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold tracking-[0.14em] text-cyan-200 uppercase">{game.skill}</span><span className="rounded-full border border-white/8 px-2 py-1 text-[9px] font-medium text-slate-400">{game.level}</span></div>
                      <h3 className="mt-2 font-[var(--font-display)] text-base font-bold leading-snug text-white group-hover:text-cyan-50">{game.title}</h3>
                      {game.tagline && <p className="mt-1 text-[11px] font-semibold text-fuchsia-200/90">{game.tagline}</p>}
                      <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-400">{game.description}</p>
                      <div className="cmc-stat-row mt-4" role="list" aria-label={`${game.title} facts`}>
                        <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{game.questions.length ? game.questions.length : 'Live'}</span><span className="cmc-stat-label">Rounds</span></span>
                        <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{xp}</span><span className="cmc-stat-label">XP</span></span>
                        <span className="cmc-stat" role="listitem"><span className="cmc-stat-num">{game.lives ?? 3} ♥</span><span className="cmc-stat-label">Lives</span></span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">{(game.questions.length ? ['Warm-up → Boss', MODE_META.survival.short, MODE_META['time-trial'].short] : (game.challengeModes ?? []).slice(0, 3)).map((c) => <span key={c} className="rounded-full border border-white/8 px-2 py-0.5 text-[8px] font-semibold text-slate-500">{c}</span>)}</div>
                      <div className="mt-3 flex items-center gap-3 border-t border-white/8 pt-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden="true" />{game.duration}</span></div>
                      {game.externalUrl ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {hasActiveAccount(session) ? (
                            <a href={game.externalUrl} target={game.externalUrl.startsWith('http') ? '_blank' : undefined} rel={game.externalUrl.startsWith('http') ? 'noreferrer' : undefined} className="iri-btn min-h-11 !px-4 !py-2.5 text-[10px]">{game.externalUrl.startsWith('http') ? 'Open external game' : 'Open game'} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                          ) : (
                            <button type="button" onClick={() => requestAuth({ mode: 'sign-up', contextPrompt: `Sign up free to open ${game.title}.` })} className="iri-btn min-h-11 !px-4 !py-2.5 text-[10px]"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Sign up to open</button>
                          )}
                          {game.leaderboardLink && <button type="button" onClick={() => { const panels = document.querySelectorAll('.cmc-game-leaderboard'); const target = Array.prototype.find.call(panels, (n) => n.offsetParent !== null) || panels[0]; if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="cmc-btn-ghost inline-flex items-center gap-1.5 self-start rounded-full px-3 py-2.5 text-xs font-semibold" aria-label="Scroll to the class leaderboard">🏆 Leaderboard</button>}
                          <button type="button" onClick={() => setShareTarget(shareTargetForGame(game))} aria-haspopup="dialog" className="cmc-btn-ghost inline-flex items-center gap-1.5 self-start rounded-full px-3 py-2.5 text-xs font-semibold" aria-label={`Share ${game.title} with your class`}><Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share to class</button>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => chooseGame(game)} className="iri-btn min-h-11 !px-4 !py-2.5 text-[10px]">{hasActiveAccount(session) ? 'Read briefing & play' : isSampleLearningGame(game.id) ? 'Try 2 free rounds' : 'Sign up to play'} {hasActiveAccount(session) || isSampleLearningGame(game.id) ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />}</button>
                          <button type="button" onClick={() => setShareTarget(shareTargetForGame(game))} aria-haspopup="dialog" className="cmc-btn-ghost inline-flex items-center gap-1.5 self-start rounded-full px-3 py-2.5 text-xs font-semibold" aria-label={`Share ${game.title} with your class`}><Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share to class</button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {selectedGame && <GamePlay key={selectedGame.id} game={selectedGame} onExit={() => setSelectedGame(null)} />}

            <p className="mt-8 text-center text-[10px] leading-relaxed text-slate-600">Original classroom practice activities. Full-run scores save to signed-in accounts; retry-missed runs are practice only.</p>
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-20 cmc-game-leaderboard">
              {hasActiveAccount(session) ? (
                <GameLeaderboard highlightPlayer={signedInPlayer} />
              ) : (
                <div className="cmc-card p-5 text-center">
                  <span className="iri-ring mx-auto grid h-11 w-11 place-items-center text-cyan-100"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></span>
                  <p className="mt-3 text-sm font-bold text-white">Leaderboard needs an account</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">Sign up free to save your scores, join your class and see how everyone is doing.</p>
                  <button type="button" onClick={() => requestAuth({ mode: 'sign-up', contextPrompt: 'Sign up free to save your game scores and join the leaderboard.' })} className="iri-btn mt-4 w-full min-h-11 text-[10px]">Sign up free</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 lg:hidden cmc-game-leaderboard">
          {hasActiveAccount(session) ? (
            <GameLeaderboard highlightPlayer={signedInPlayer} />
          ) : (
            <div className="cmc-card p-5 text-center">
              <LockKeyhole className="mx-auto h-6 w-6 text-cyan-200" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-white">Leaderboard needs an account</p>
              <button type="button" onClick={() => requestAuth({ mode: 'sign-up', contextPrompt: 'Sign up free to save your game scores and join the leaderboard.' })} className="iri-btn mt-3 w-full min-h-11 text-[10px]">Sign up free</button>
            </div>
          )}
        </div>
      </section>
      {shareTarget && <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} />}
    </main>
  );
}
