import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Headphones,
  LockKeyhole,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { MINI_MOCK_SKILLS, MINI_MOCK_TIME_SECONDS, type MiniMockQuestion, type MiniMockSkill } from '../data/miniMockTest';
import type { MemberAccessStatus, MemberProfile } from '../types/member';
import { fetchMemberMiniMock } from '../lib/memberMock';
import { deleteMemberAccount } from '../lib/account';
import { countCorrect, formatTestTime, scoreBySkill } from '../utils/mockScoring';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';

interface MiniMockTestProps {
  accessStatus: MemberAccessStatus;
  member: MemberProfile | null;
  onOpenAuth: (mode: 'sign-up' | 'sign-in') => void;
  onSignOut: () => void;
}

type TestPhase = 'setup' | 'loading' | 'active' | 'results';

function skillIcon(skill: MiniMockSkill) {
  if (skill === 'Reading') return BookOpen;
  if (skill === 'Listening') return Headphones;
  return ClipboardCheck;
}

function skillColor(skill: MiniMockSkill) {
  if (skill === 'Reading') return 'text-cyan-300 bg-cyan-400/10 border-cyan-300/20';
  if (skill === 'Listening') return 'text-violet-300 bg-violet-400/10 border-violet-300/20';
  return 'text-amber-200 bg-amber-300/10 border-amber-200/20';
}

function AccessGate({
  status,
  onOpenAuth,
}: {
  status: MemberAccessStatus;
  onOpenAuth: (mode: 'sign-up' | 'sign-in') => void;
}) {
  const configured = status !== 'not-configured';
  const title = status === 'pending' ? 'Your email is verified; access is still pending.'
    : status === 'unverified' ? 'Verify your email to unlock your practice room.'
    : status === 'error' ? 'We could not verify member access.'
    : 'Your next practice round starts here.';
  const copy = status === 'not-configured'
    ? 'Secure membership is not configured for this deployment yet. No browser-only member ID can unlock these questions.'
    : status === 'pending'
      ? 'This account does not have an active server-side entitlement yet. Ask your site administrator to grant access; the browser cannot self-assign membership.'
      : status === 'unverified'
        ? 'Open the verification link sent to your member email, then sign in again. The question bank stays on the server until access is verified.'
        : status === 'error'
          ? 'Please sign in again in a moment. If the issue continues, contact the site administrator.'
          : 'A focused, eight-minute TOEFL-style practice set with reading, listening, language use, and answer-by-answer feedback.';

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-[#0b1928]/90 shadow-[0_35px_100px_-55px_rgba(34,211,238,.4)]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-indigo-500/15 blur-[95px]" />
      <div className="relative grid gap-9 p-6 sm:p-9 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:p-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-cyan-200 uppercase">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Verified member access
          </div>
          <h3 className="mt-5 max-w-xl font-[var(--font-display)] text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl">{title}</h3>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">{copy}</p>
          {configured && status !== 'pending' && status !== 'loading' && (
            <button
              type="button"
              onClick={() => onOpenAuth(status === 'signed-out' ? 'sign-up' : 'sign-in')}
              className="group mt-7 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_35px_-12px_rgba(45,212,191,.7)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-12px_rgba(45,212,191,.8)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
            >
              {status === 'signed-out' ? 'Create a member account' : 'Sign in to continue'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
          )}
          {!configured && (
            <div className="mt-6 rounded-xl border border-amber-200/15 bg-amber-100/[0.04] p-4 text-xs leading-relaxed text-amber-100/80">
              Configure the Supabase URL and publishable key, apply the migration, deploy the member function, and add the private question-bank secret. See the setup steps in <code>README.md</code>.
            </div>
          )}
          {status === 'pending' && <p className="mt-4 text-xs text-slate-500">Access is granted only by server-side membership records after email verification.</p>}
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-3 rounded-[1.5rem] bg-gradient-to-br from-cyan-400/15 via-indigo-400/10 to-transparent blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/75 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <div>
                <p className="text-[9px] font-bold tracking-[0.18em] text-slate-500 uppercase">CMC · Practice room</p>
                <p className="mt-1 text-sm font-bold text-white">Mini mock 01</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-200/5 px-2.5 py-1.5 font-mono text-xs font-bold text-amber-100">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> 08:00
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {[
                { name: 'Reading', count: '03', color: 'bg-cyan-300' },
                { name: 'Listening', count: '03', color: 'bg-violet-300' },
                { name: 'Language use', count: '02', color: 'bg-amber-200' },
              ].map((row) => (
                <div key={row.name} className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${row.color}`} aria-hidden="true" />
                  <span className="flex-1 text-xs text-slate-300">{row.name}</span>
                  <span className="font-mono text-[10px] text-slate-500">{row.count} questions</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[9px] font-bold tracking-[0.13em] text-cyan-200 uppercase">Member question bank</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">The assessment and answer key load only after the secure member check succeeds.</p>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-200"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> RLS + verified email</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsQuestion({ question, index, answer }: { question: MiniMockQuestion; index: number; answer: number | undefined }) {
  const wasCorrect = answer === question.correctIndex;
  return (
    <details className="group rounded-xl border border-white/8 bg-white/[0.025] open:bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 text-xs">
        {wasCorrect ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <XCircle className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />}
        <span className="flex-1 font-medium text-slate-200">Q{index + 1} · {question.skill}</span>
        <span className="text-[10px] text-slate-500">{answer === undefined ? 'Skipped' : wasCorrect ? 'Correct' : 'Review'}</span>
      </summary>
      <div className="border-t border-white/8 px-4 py-3.5 pl-11">
        <p className="text-xs leading-relaxed text-slate-300">{question.prompt}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400"><strong className="text-emerald-200">Best answer:</strong> {question.choices[question.correctIndex]}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{question.explanation}</p>
      </div>
    </details>
  );
}

export function MiniMockTest({ accessStatus, member, onOpenAuth, onSignOut }: MiniMockTestProps) {
  const [phase, setPhase] = useState<TestPhase>('setup');
  const [questions, setQuestions] = useState<MiniMockQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(MINI_MOCK_TIME_SECONDS);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (phase !== 'active' || deadline === null) return;
    const updateClock = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };
    updateClock();
    const timerId = window.setInterval(updateClock, 500);
    return () => window.clearInterval(timerId);
  }, [phase, deadline]);

  useEffect(() => {
    if (phase === 'active' && timeRemaining === 0) {
      setExpired(true);
      setPhase('results');
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  }, [phase, timeRemaining]);

  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  if (accessStatus !== 'active' || !member) {
    return (
      <section id="toefl-mini-test" className="cmc-section relative scroll-mt-24 overflow-hidden border-t border-slate-800/80 bg-[#08131f] py-20 sm:py-24 lg:py-28">
        <div aria-hidden="true" className="pointer-events-none absolute -top-48 left-[15%] h-[34rem] w-[34rem] rounded-full bg-cyan-500/[0.09] blur-[135px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
            <span className="cmc-eyebrow"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified member practice room</span>
            <h2 className="cmc-h2">A little practice. <span className="cmc-gradient-text">A lot more confidence.</span></h2>
            <p className="cmc-lead mx-auto text-center">An original, timed TOEFL-style mini mock with immediate explanations. It is for practice, not an official score or an ETS test.</p>
          </div>
          <AccessGate status={accessStatus} onOpenAuth={onOpenAuth} />
        </div>
      </section>
    );
  }

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const hasAnswered = selectedAnswer !== undefined;
  const answeredCount = Object.keys(answers).length;
  const correctCount = countCorrect(questions, answers);
  const percentage = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const CurrentSkillIcon = currentQuestion ? skillIcon(currentQuestion.skill) : BookOpen;
  const remainingQuestions = Math.max(questions.length - answeredCount, 0);
  const scoreLabel = correctCount >= 7 ? 'Strong snapshot' : correctCount >= 4 ? 'Developing snapshot' : 'Build your foundation';

  const startTest = async () => {
    setLoadError('');
    setPhase('loading');
    try {
      const bank = await fetchMemberMiniMock();
      if (bank.length !== 8) throw new Error('This mini mock is not available yet. Contact the site administrator.');
      setQuestions(bank);
      setCurrentIndex(0);
      setAnswers({});
      setExpired(false);
      setTimeRemaining(MINI_MOCK_TIME_SECONDS);
      setDeadline(Date.now() + MINI_MOCK_TIME_SECONDS * 1000);
      setPhase('active');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Member practice is unavailable right now.');
      setPhase('setup');
    }
  };

  const finishTest = () => {
    setDeadline(null);
    setExpired(false);
    setPhase('results');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  const restartTest = () => {
    setQuestions([]);
    setAnswers({});
    setTimeRemaining(MINI_MOCK_TIME_SECONDS);
    setDeadline(null);
    setCurrentIndex(0);
    setLoadError('');
    setExpired(false);
    setPhase('setup');
  };

  const removeAccount = async () => {
    if (!window.confirm('Permanently delete your member account and saved contact records? This cannot be undone. Your test answers are not stored.')) return;
    setDeletingAccount(true);
    setAccountError('');
    try {
      await deleteMemberAccount();
      onSignOut();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'We could not delete the account. Please try again.');
      setDeletingAccount(false);
    }
  };

  const moveToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  return (
    <section id="toefl-mini-test" className="relative overflow-hidden border-t border-slate-800/80 bg-[#08131f] py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -top-48 left-[15%] h-[34rem] w-[34rem] rounded-full bg-cyan-500/[0.09] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 right-[-8%] h-[34rem] w-[34rem] rounded-full bg-indigo-600/[0.12] blur-[135px]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-200/5 px-3.5 py-1.5 text-[10px] font-bold tracking-[0.17em] text-cyan-200 uppercase"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified member practice room</span>
          <h2 className="mt-5 font-[var(--font-display)] text-3xl font-bold tracking-tight text-balance text-white sm:text-5xl">A little practice. <span className="bg-gradient-to-r from-cyan-200 to-teal-300 bg-clip-text text-transparent">A lot more confidence.</span></h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">An original, timed TOEFL-style mini mock with immediate explanations. It is for practice, not an official score or an ETS test.</p>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/65 shadow-[0_35px_120px_-70px_rgba(34,211,238,.55)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300/20 to-indigo-400/20 text-cyan-200 ring-1 ring-white/10"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
              <div><p className="text-[9px] font-bold tracking-[0.17em] text-slate-500 uppercase">Creative Minds Network</p><h3 className="mt-0.5 text-sm font-bold text-white">Mini mock · Reading, listening & language</h3></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-teal-300/20 bg-teal-300/5 px-2.5 py-1.5 text-[10px] font-semibold text-teal-200">Verified member</span>
              <span className="hidden font-mono text-[10px] text-slate-500 sm:block">{member.memberId}</span>
              <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"><LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out</button>
              <button type="button" onClick={removeAccount} disabled={deletingAccount} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-rose-200/70 transition hover:bg-rose-300/5 hover:text-rose-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {deletingAccount ? 'Deleting…' : 'Delete account'}</button>
            </div>
          </div>
          {accountError && <p role="alert" className="border-b border-rose-300/15 bg-rose-300/[0.035] px-5 py-2.5 text-xs text-rose-100 sm:px-7">{accountError}</p>}

          {phase === 'setup' && (
            <div className="grid lg:grid-cols-[1fr_0.82fr]">
              <div className="p-5 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-md border border-cyan-300/20 bg-cyan-300/5 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-cyan-200 uppercase">Timed practice</span><span className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[9px] font-semibold text-slate-400">Original TOEFL-style items</span></div>
                <h4 className="mt-5 max-w-xl font-[var(--font-display)] text-2xl leading-tight font-bold text-white sm:text-3xl">Ready when you are, {member.name.split(' ')[0]}.</h4>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">This eight-minute set covers reading, listening, and language use. Your name and candidate ID come from your verified account; answers stay in this tab and are not saved to a student record.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><span className="text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase">Candidate</span><p className="mt-1 text-sm font-semibold text-white">{member.name}</p></div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><span className="text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase">Member ID</span><p className="mt-1 font-mono text-sm font-semibold text-cyan-200">{member.memberId}</p></div>
                </div>
                {loadError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-xs leading-relaxed text-rose-100">{loadError}</p>}
                <button type="button" onClick={startTest} className="group mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_10px_35px_-14px_rgba(45,212,191,.75)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">Start member mini mock <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></button>
              </div>
              <aside className="relative overflow-hidden border-t border-white/8 bg-slate-950/35 p-5 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
                <div aria-hidden="true" className="absolute -right-10 top-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="relative flex items-center justify-between"><span className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">Your test format</span><span className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-200"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />08:00</span></div>
                <div className="relative mt-5 space-y-3">{MINI_MOCK_SKILLS.map((skill, index) => { const Icon = skillIcon(skill); const count = [3, 3, 2][index]; return <div key={skill} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3.5"><span className={`grid h-9 w-9 place-items-center rounded-lg border ${skillColor(skill)}`}><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="flex-1 text-xs font-semibold text-slate-200">{skill}</span><span className="font-mono text-[10px] text-slate-500">{String(count).padStart(2, '0')} questions</span></div>; })}</div>
                <div className="relative mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4"><p className="text-xs font-semibold text-cyan-100">Protected practice content</p><p className="mt-2 text-[10px] leading-relaxed text-slate-400">Questions load from an authenticated Edge Function only after your server-side member entitlement is confirmed.</p></div>
                <p className="relative mt-4 text-[10px] leading-relaxed text-slate-500">Original practice material. Not affiliated with or endorsed by ETS.</p>
              </aside>
            </div>
          )}

          {phase === 'loading' && (
            <div role="status" aria-live="polite" className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></span><p className="mt-4 text-sm font-semibold text-white">Verifying member access and loading your questions…</p><p className="mt-2 text-xs text-slate-500">The timer starts after the private question bank is received.</p></div></div>
          )}

          {phase === 'active' && currentQuestion && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px]"><span className="font-semibold text-slate-200">{member.name}</span><span className="font-mono text-slate-500">ID · {member.memberId}</span><span className="text-slate-600">{currentQuestion.skill}</span></div>
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-bold tabular-nums ${timeRemaining <= 60 ? 'border-rose-300/30 bg-rose-400/10 text-rose-200' : 'border-white/10 bg-white/[0.035] text-white'}`} aria-label={`Time remaining ${formatTestTime(timeRemaining)}`}><Clock3 className="h-4 w-4" aria-hidden="true" />{formatTestTime(timeRemaining)}<span className="font-sans text-[9px] font-semibold text-slate-500">left</span></div>
              </div>
              <div className="h-px bg-white/8"><span className="block h-full bg-gradient-to-r from-cyan-300 to-teal-200 transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
              <div className="grid lg:grid-cols-[minmax(0,1fr)_245px]">
                <div className="min-w-0 p-5 sm:p-8">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl border ${skillColor(currentQuestion.skill)}`}><CurrentSkillIcon className="h-5 w-5" aria-hidden="true" /></span><div><span className="block text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">Question {currentIndex + 1} of {questions.length}</span><h5 className="mt-0.5 text-sm font-bold text-white">{currentQuestion.skill}</h5></div></div><span className="text-[10px] text-slate-500">{answeredCount} answered · {remainingQuestions} left</span></div>
                  {currentQuestion.passage && <div className="mb-5 rounded-xl border border-cyan-300/10 bg-[#071522] p-4 sm:p-5"><p className="text-[9px] font-bold tracking-[0.15em] text-cyan-200 uppercase">Reading passage</p><div className="mt-3 space-y-3 font-serif text-sm leading-[1.75] text-slate-300">{currentQuestion.passage.map((paragraph, index) => <p key={`${currentQuestion.id}-passage-${index}`}>{paragraph}</p>)}</div></div>}
                  {currentQuestion.audioScript && (
                    <div className="mb-5">
                      <ListeningAudioPlayer
                        key={currentQuestion.id}
                        script={currentQuestion.audioScript}
                        title={`Listening · Question ${currentIndex + 1}`}
                        maxPlays={2}
                        tone="violet"
                      />
                    </div>
                  )}

                  <p className="max-w-2xl text-base leading-relaxed font-semibold text-white sm:text-lg">{currentQuestion.prompt}</p>
                  <div className="mt-4 space-y-2.5">{currentQuestion.choices.map((choice, index) => { const isSelected = selectedAnswer === index; const isCorrectChoice = index === currentQuestion.correctIndex; const stateClass = !hasAnswered ? 'border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-200/35 hover:bg-cyan-200/[0.04]' : isCorrectChoice ? 'border-emerald-300/40 bg-emerald-300/[0.08] text-emerald-50' : isSelected ? 'border-rose-300/35 bg-rose-300/[0.07] text-rose-50' : 'border-white/6 bg-white/[0.015] text-slate-500'; return <button key={`${currentQuestion.id}-choice-${index}`} type="button" onClick={() => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: index }))} aria-pressed={isSelected} className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs leading-relaxed transition sm:p-4 ${stateClass}`}><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[9px] font-bold ${hasAnswered && isCorrectChoice ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100' : hasAnswered && isSelected ? 'border-rose-300/50 bg-rose-300/10 text-rose-100' : 'border-white/15 text-slate-500 group-hover:border-cyan-200/40 group-hover:text-cyan-100'}`}>{hasAnswered && isCorrectChoice ? <Check className="h-3 w-3" aria-hidden="true" /> : String.fromCharCode(65 + index)}</span><span className="flex-1">{choice}</span>{hasAnswered && isSelected && !isCorrectChoice && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />}</button>; })}</div>
                  {hasAnswered && <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-4 ${selectedAnswer === currentQuestion.correctIndex ? 'border-emerald-300/20 bg-emerald-300/[0.055]' : 'border-amber-200/20 bg-amber-200/[0.045]'}`}><p className={`text-xs font-bold ${selectedAnswer === currentQuestion.correctIndex ? 'text-emerald-200' : 'text-amber-100'}`}>{selectedAnswer === currentQuestion.correctIndex ? 'That’s right.' : `Not quite. The best answer is ${String.fromCharCode(65 + currentQuestion.correctIndex)}.`}</p><p className="mt-1.5 text-xs leading-relaxed text-slate-300">{currentQuestion.explanation}</p></div>}
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5"><button type="button" onClick={() => moveToQuestion(currentIndex - 1)} disabled={currentIndex === 0} className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous</button><span className="text-[10px] text-slate-500">Your answer is checked immediately.</span>{currentIndex < questions.length - 1 ? <button type="button" onClick={() => moveToQuestion(currentIndex + 1)} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.07] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10">Next question <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button> : <button type="button" onClick={finishTest} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5">Finish mock <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /></button>}</div>
                </div>

                <aside className="border-t border-white/8 bg-slate-950/35 p-5 sm:p-7 lg:border-t-0 lg:border-l"><div className="flex items-center justify-between"><p className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase">Question map</p><button type="button" onClick={finishTest} className="text-[10px] font-semibold text-cyan-200/80 transition hover:text-cyan-100">Finish early</button></div>
                  <div className="mt-4 grid grid-cols-4 gap-2">{questions.map((question, index) => { const answered = answers[question.id] !== undefined; const correct = answers[question.id] === question.correctIndex; const active = currentIndex === index; const indicator = active ? 'border-cyan-200 bg-cyan-200 text-slate-950 shadow-[0_0_20px_-5px_rgba(103,232,249,.7)]' : answered ? (correct ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/30 bg-rose-300/10 text-rose-200') : 'border-white/10 bg-white/[0.025] text-slate-500 hover:border-white/25 hover:text-white'; return <button key={question.id} type="button" onClick={() => moveToQuestion(index)} aria-current={active ? 'step' : undefined} aria-label={`Go to question ${index + 1}${answered ? correct ? ', correct' : ', incorrect' : ', unanswered'}`} className={`grid h-10 w-full place-items-center rounded-lg border font-mono text-xs font-bold transition ${indicator}`}>{String(index + 1).padStart(2, '0')}</button>; })}</div>
                  <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center justify-between"><span className="text-[10px] text-slate-400">Answered</span><span className="font-mono text-xs font-bold text-white">{answeredCount} / {questions.length}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full bg-gradient-to-r from-cyan-300 to-teal-200 transition-[width] duration-500" style={{ width: `${progress}%` }} /></div><div className="mt-4 flex items-center justify-between"><span className="text-[10px] text-slate-400">Practice score so far</span><span className="font-mono text-sm font-bold text-cyan-200">{correctCount}<span className="text-[10px] font-medium text-slate-500"> correct</span></span></div><p className="mt-1 text-[9px] leading-relaxed text-slate-600">Not an official TOEFL score.</p></div>
                  <div className="mt-5 space-y-2.5">{MINI_MOCK_SKILLS.map((skill) => { const Icon = skillIcon(skill); const skillScore = scoreBySkill(skill, questions, answers); return <div key={skill} className="flex items-center gap-2.5 text-[10px]"><Icon className={`h-3.5 w-3.5 ${skillColor(skill).split(' ')[0]}`} aria-hidden="true" /><span className="flex-1 text-slate-400">{skill}</span><span className="font-mono text-slate-300">{skillScore.correct}/{skillScore.total}</span></div>; })}</div>
                  <p className="mt-5 border-t border-white/8 pt-4 text-[9px] leading-relaxed text-slate-600">Move between questions. Unanswered items count as incorrect if you finish early.</p>
                </aside>
              </div>
            </div>
          )}

          {phase === 'results' && (
            <div className="p-5 sm:p-8 lg:p-10"><div className="mx-auto max-w-4xl">
              <div className="grid gap-7 sm:grid-cols-[auto_1fr] sm:items-center"><div className="relative grid h-32 w-32 place-items-center rounded-full p-[5px]" style={{ background: `conic-gradient(#67e8f9 ${percentage}%, rgba(255,255,255,.08) 0)` }} aria-label={`Practice result ${percentage} percent`}><div className="grid h-full w-full place-items-center rounded-full bg-[#111d2b]"><span className="text-center"><strong className="block font-[var(--font-display)] text-3xl font-bold text-white">{percentage}%</strong><span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">practice</span></span></div></div><div><span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/20 bg-teal-300/5 px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] text-teal-200 uppercase"><CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {expired ? 'Time is up' : 'Practice complete'}</span><h4 className="mt-3 font-[var(--font-display)] text-2xl font-bold text-white sm:text-3xl">{scoreLabel}</h4><p className="mt-2 text-sm leading-relaxed text-slate-400">{member.name} · Candidate ID <span className="font-mono text-slate-300">{member.memberId}</span></p><p className="mt-1 text-xs text-slate-500">{correctCount} of {questions.length} correct · Time used {formatTestTime(MINI_MOCK_TIME_SECONDS - timeRemaining)}</p></div></div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">{MINI_MOCK_SKILLS.map((skill) => { const result = scoreBySkill(skill, questions, answers); const Icon = skillIcon(skill); return <div key={skill} className="rounded-xl border border-white/8 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Icon className={`h-4 w-4 ${skillColor(skill).split(' ')[0]}`} aria-hidden="true" />{skill}</div><p className="mt-3 font-[var(--font-display)] text-2xl font-bold text-white">{result.correct}<span className="ml-1 text-sm font-medium text-slate-500">/ {result.total}</span></p><p className="mt-1 text-[10px] text-slate-500">{result.correct === result.total ? 'Strong work in this set' : result.correct === 0 ? 'Review this skill area' : 'Keep building consistency'}</p></div>; })}</div>
              <div className="mt-8"><p className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase">Review & learn</p><div className="mt-3 space-y-2">{questions.map((question, index) => <ResultsQuestion key={question.id} question={question} index={index} answer={answers[question.id]} />)}</div></div>
              <div className="mt-7 flex flex-col justify-between gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center"><p className="max-w-xl text-[10px] leading-relaxed text-slate-500">Practice-only result from original questions. It is not an official TOEFL score, a CEFR placement, or a saved student record. Your answers remain in this browser tab.</p><button type="button" onClick={restartTest} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again</button></div>
            </div></div>
          )}
        </div>

        <p className="mx-auto mt-5 flex max-w-3xl items-start justify-center gap-2 text-center text-[10px] leading-relaxed text-slate-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />Verified membership and question delivery use Supabase. Candidate answers and practice scores are not transmitted or stored.</p>
      </div>
    </section>
  );
}