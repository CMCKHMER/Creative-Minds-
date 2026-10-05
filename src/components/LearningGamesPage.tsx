import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, ExternalLink, Headphones, Lightbulb, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { LEARNING_GAMES, type LearningGame, type LearningGameSkill } from '../data/learningGames';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';

const skillOptions: Array<'All games' | LearningGameSkill> = ['All games', 'Vocabulary', 'Reading', 'Grammar', 'Early literacy', 'Listening'];

function gameIcon(skill: LearningGameSkill) {
  if (skill === 'Reading') return BookOpen;
  if (skill === 'Listening') return Headphones;
  if (skill === 'Vocabulary') return Lightbulb;
  return Sparkles;
}

function accent(index: number) {
  return [
    'from-cyan-300/15 to-sky-400/5 border-cyan-200/15 text-cyan-200',
    'from-violet-300/15 to-indigo-400/5 border-violet-200/15 text-violet-200',
    'from-amber-200/15 to-orange-400/5 border-amber-100/15 text-amber-100',
    'from-emerald-300/15 to-teal-400/5 border-emerald-200/15 text-emerald-200',
    'from-pink-300/15 to-rose-400/5 border-pink-200/15 text-pink-200',
    'from-blue-300/15 to-indigo-400/5 border-blue-200/15 text-blue-200',
  ][index % 6];
}

function gameScore(game: LearningGame, answers: Record<number, number>) {
  return game.questions.reduce((sum, question, index) => sum + (answers[index] === question.correctIndex ? 1 : 0), 0);
}

function GamePlay({ game, onExit }: { game: LearningGame; onExit: () => void }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const question = game.questions[questionIndex];
  const gamePassage = game.passage ?? question.passage;
  const selectedIndex = answers[questionIndex];
  const answered = selectedIndex !== undefined;
  const score = gameScore(game, answers);
  const Icon = gameIcon(game.skill);

  const resetGame = () => {
    setQuestionIndex(0);
    setAnswers({});
    setFinished(false);
  };

  if (finished) {
    const percent = Math.round((score / game.questions.length) * 100);
    return (
      <section id="game-playground" className="scroll-mt-6 mt-10 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/65 p-6 shadow-2xl sm:p-9">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-teal-200/20 bg-teal-200/5 text-teal-100"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /></span>
          <p className="mt-5 text-[10px] font-bold tracking-[0.17em] text-teal-200 uppercase">Game complete</p>
          <h3 className="mt-2 font-[var(--font-display)] text-3xl font-bold text-white">{score} of {game.questions.length} correct</h3>
          <p className="mt-2 text-sm text-slate-400">{percent >= 80 ? 'Excellent work. You used the clues carefully.' : percent >= 50 ? 'Good practice. Review the explanations and play again.' : 'Every try teaches you something. Review a clue, then give it another go.'}</p>
        </div>
        <div className="mx-auto mt-7 max-w-3xl space-y-2">
          {game.questions.map((item, index) => {
            const isCorrect = answers[index] === item.correctIndex;
            return <details key={`${game.id}-result-${index}`} className="rounded-xl border border-white/8 bg-slate-950/35 p-4"><summary className="flex cursor-pointer list-none items-center gap-3 text-xs"><span className={`grid h-6 w-6 place-items-center rounded-full ${isCorrect ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-200/10 text-amber-100'}`}>{isCorrect ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}</span><span className="flex-1 text-slate-200">Question {index + 1}</span><span className="text-slate-500">{isCorrect ? 'Correct' : 'Review'}</span></summary><div className="mt-3 border-t border-white/8 pt-3 text-xs leading-relaxed text-slate-400"><p>{item.prompt}</p><p className="mt-2 text-emerald-100/80">{item.feedback}</p></div></details>;
          })}
        </div>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={resetGame} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2.5 text-xs font-bold text-slate-950"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Play again</button>
          <button type="button" onClick={onExit} className="min-h-11 rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5">Choose another game</button>
        </div>
      </section>
    );
  }

  return (
    <section id="game-playground" className="scroll-mt-6 mt-10 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/65 shadow-2xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-300/10 to-violet-400/10 text-cyan-200"><Icon className="h-5 w-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase">{game.skill} · {game.level}</p><h3 className="truncate text-sm font-bold text-white sm:text-base">{game.title}</h3></div></div>
        <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All games</button>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-5 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">Round {questionIndex + 1} of {game.questions.length}</p><p className="mt-1 text-xs text-slate-400">{game.instructions}</p></div><span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[10px] text-slate-300"><Clock3 className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />{game.duration.split('·')[0].trim()}</span></div>

          {gamePassage && <div className="mb-5 rounded-xl border border-cyan-300/10 bg-[#071522] p-4"><p className="text-[9px] font-bold tracking-[0.14em] text-cyan-200 uppercase">Reading clue</p><div className="mt-2 space-y-2 font-serif text-sm leading-relaxed text-slate-300">{gamePassage.map((part, index) => <p key={`${game.id}-passage-${questionIndex}-${index}`}>{part}</p>)}</div></div>}

          {game.audioScript && (
            <div className="mb-5">
              <ListeningAudioPlayer
                key={`${game.id}-audio`}
                script={game.audioScript}
                title="Listening clue"
                tone="violet"
              />
            </div>
          )}

          <h4 className="text-base font-semibold leading-relaxed text-white sm:text-lg">{question.prompt}</h4>
          <div className="mt-4 space-y-2">{question.choices.map((choice, index) => {
            const chosen = selectedIndex === index;
            const correct = index === question.correctIndex;
            const style = !answered ? 'border-white/10 bg-white/[0.025] text-slate-300 hover:border-cyan-200/30 hover:bg-cyan-200/[0.04]' : correct ? 'border-emerald-300/30 bg-emerald-300/[0.07] text-emerald-50' : chosen ? 'border-rose-300/30 bg-rose-300/[0.06] text-rose-50' : 'border-white/6 bg-white/[0.015] text-slate-500';
            return <button key={`${game.id}-${questionIndex}-${index}`} type="button" aria-pressed={chosen} onClick={() => setAnswers((previous) => ({ ...previous, [questionIndex]: index }))} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs leading-relaxed transition ${style}`}><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current/25 font-mono text-[9px] font-bold">{answered && correct ? <Check className="h-3 w-3" aria-hidden="true" /> : String.fromCharCode(65 + index)}</span><span>{choice}</span></button>;
          })}</div>
          {answered && <div role="status" aria-live="polite" className={`mt-4 rounded-xl border p-4 ${selectedIndex === question.correctIndex ? 'border-emerald-300/20 bg-emerald-300/[0.05]' : 'border-amber-200/20 bg-amber-200/[0.04]'}`}><p className="text-xs font-bold text-white">{selectedIndex === question.correctIndex ? 'Correct. Nice reasoning.' : 'Not quite. Look at the clue again.'}</p><p className="mt-1.5 text-xs leading-relaxed text-slate-300">{question.feedback}</p></div>}
          <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4"><button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous</button><span className="font-mono text-[10px] text-slate-500">{score} points</span>{questionIndex < game.questions.length - 1 ? <button type="button" disabled={!answered} onClick={() => setQuestionIndex((index) => index + 1)} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.07] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Next clue <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button> : <button type="button" disabled={!answered} onClick={() => setFinished(true)} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">See results <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /></button>}</div>
        </div>

        <aside className="border-t border-white/8 bg-slate-950/35 p-5 lg:border-t-0 lg:border-l lg:p-6"><p className="text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">Progress</p><div className="mt-4 grid grid-cols-5 gap-2">{game.questions.map((_, index) => <button key={`${game.id}-step-${index}`} type="button" onClick={() => setQuestionIndex(index)} aria-label={`Go to round ${index + 1}${answers[index] !== undefined ? ', answered' : ', unanswered'}`} className={`grid h-9 place-items-center rounded-lg border font-mono text-[10px] font-bold ${questionIndex === index ? 'border-cyan-200 bg-cyan-200 text-slate-950' : answers[index] !== undefined ? 'border-teal-200/20 bg-teal-200/5 text-teal-100' : 'border-white/10 text-slate-500'}`}>{index + 1}</button>)}</div><p className="mt-5 text-xs leading-relaxed text-slate-400">{game.description}</p><div className="mt-5 border-t border-white/8 pt-4 text-[10px] leading-relaxed text-slate-500">Practice-only activity. Your answers stay in this browser tab.</div></aside>
      </div>
    </section>
  );
}

export function LearningGamesPage({ onBackHome }: { onBackHome: () => void }) {
  const [activeSkill, setActiveSkill] = useState<'All games' | LearningGameSkill>('All games');
  const [selectedGame, setSelectedGame] = useState<LearningGame | null>(null);
  const filteredGames = LEARNING_GAMES.filter((game) => activeSkill === 'All games' || game.skill === activeSkill);

  const chooseGame = (game: LearningGame) => {
    setSelectedGame(game);
    window.setTimeout(() => document.getElementById('game-playground')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#070d17] text-slate-100">
      <div className="sticky top-0 z-40 border-b border-white/8 bg-[#070d17]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="#games" className="flex items-center gap-3" aria-label="Creative Minds Learning Games home"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-400 text-slate-950"><Sparkles className="h-4 w-4" aria-hidden="true" /></span><span className="text-sm font-bold tracking-tight text-white">Creative Minds <span className="text-cyan-200">Play Lab</span></span></a>
          <button type="button" onClick={onBackHome} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to CMC</button>
        </div>
      </div>

      <section className="relative isolate overflow-hidden border-b border-white/8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_72%_34%,rgba(34,211,238,.16),transparent_38%),radial-gradient(ellipse_at_16%_88%,rgba(139,92,246,.18),transparent_38%),linear-gradient(125deg,#091421,#0c1122_60%,#101326)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(90deg,black,transparent_90%)]" />
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-200/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.17em] text-teal-100 uppercase"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> The CMC Learning Games room</span>
            <h1 className="mt-6 font-[var(--font-display)] text-4xl leading-[1.04] font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">Pick a game.<br /><span className="bg-gradient-to-r from-cyan-200 via-teal-200 to-violet-200 bg-clip-text text-transparent">Follow the clues.</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">Short, original learning games for vocabulary, reading, grammar, listening, and early literacy. Read the game brief, choose a challenge, and get feedback as you play.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[10px] text-slate-400"><span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">6 playable games</span><span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">3–5 minutes each</span><span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">No student account required</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-col justify-between gap-5 border-b border-white/10 pb-5 sm:flex-row sm:items-end"><div><p className="text-[9px] font-bold tracking-[0.17em] text-cyan-300 uppercase">Game library</p><h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">What would you like to practice?</h2></div><div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 p-1" role="tablist" aria-label="Filter learning games">{skillOptions.map((skill) => <button key={skill} type="button" role="tab" aria-selected={activeSkill === skill} onClick={() => setActiveSkill(skill)} className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-semibold transition ${activeSkill === skill ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{skill}</button>)}</div></div>

        <div className="mt-7 grid gap-x-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map((game) => {
            const index = LEARNING_GAMES.findIndex((entry) => entry.id === game.id);
            const Icon = gameIcon(game.skill);
            return (
              <article key={game.id} className="group flex min-h-[280px] flex-col border-b border-white/10 py-6 transition-colors hover:border-cyan-200/25">
                <div className="flex items-center justify-between gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl border bg-gradient-to-br ${accent(index)}`}><Icon className="h-4.5 w-4.5" aria-hidden="true" /></span><span className="flex items-center gap-2">{game.badge && <span className="rounded-md border border-cyan-200/30 bg-cyan-200/10 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-cyan-200 uppercase">{game.badge}</span>}<span className="rounded-md border border-white/8 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">{game.skill}</span></span></div>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">{game.description}</p>
                <div className="mt-4 flex items-center gap-3 border-t border-white/8 pt-3 text-[10px] text-slate-500"><span>{game.level}</span><span aria-hidden="true">·</span><span>{game.duration}</span></div>
                               {game.externalUrl ? (
                  <a href={game.externalUrl} target="_blank" rel="noopener noreferrer" className="group/button mt-4 inline-flex items-center gap-2 self-start rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-cyan-200/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                    Open game
                    <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" aria-hidden="true" />
                  </a>
                ) : (
                  <button type="button" onClick={() => chooseGame(game)} className="group/button mt-4 inline-flex items-center gap-2 self-start rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-cyan-200/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">Read &amp; play <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-1" aria-hidden="true" /></button>
                )}
                            </article>
            );
          })}
        </div>

        {selectedGame && <GamePlay key={selectedGame.id} game={selectedGame} onExit={() => setSelectedGame(null)} />}
        {selectedGame && <GamePlay key={selectedGame.id} game={selectedGame} onExit={() => setSelectedGame(null)} />}

        <p className="mt-8 text-center text-[10px] leading-relaxed text-slate-600">Original classroom practice activities. These games do not collect or store student answers.</p>
      </section>
    </main>
  );
}
