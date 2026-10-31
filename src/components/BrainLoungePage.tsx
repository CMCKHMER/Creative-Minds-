import { Suspense, lazy, useState, type ComponentType } from 'react';
import { ArrowLeft, CalendarClock, Cpu, ExternalLink, Gamepad2, Lightbulb, Play, Sparkles, Zap } from 'lucide-react';
import { BRAIN_GAMES, liveBrainGames, reservedBays, type BrainGameDef, type BrainGameProps } from '../games/registry';
import { LoungeLeaderboard } from './LoungeLeaderboard';

/**
 * THE BRAIN LOUNGE — dedicated arcade page (#brain-lounge).
 *
 * Renders its cartridge shelf straight from src/games/registry.ts.
 * React-mode cartridges are lazy-loaded per game, so each game is its
 * own chunk and the lounge shell stays tiny.
 */

// One lazy wrapper per game id, created exactly once (React.lazy must not
// be re-called during render or the game would remount every update).
const lazyCartridges = new Map<string, ComponentType<BrainGameProps>>();
function cartridgeComponent(def: BrainGameDef): ComponentType<BrainGameProps> | null {
  if (def.mode !== 'react' || !def.load) return null;
  let cached = lazyCartridges.get(def.id);
  if (!cached) {
    cached = lazy(def.load);
    lazyCartridges.set(def.id, cached);
  }
  return cached;
}

function difficultyBolts(level: 1 | 2 | 3) {
  return [1, 2, 3].map((bolt) => (
    <Zap key={bolt} className={`h-3 w-3 ${bolt <= level ? 'text-amber-300 fill-amber-300/40' : 'text-slate-600'}`} aria-hidden="true" />
  ));
}

function Cartridge({ game, onPlay }: { game: BrainGameDef; onPlay: (game: BrainGameDef) => void }) {
  const live = game.status === 'live';
  return (
    <article
      className={`group relative flex min-h-[290px] flex-col overflow-hidden rounded-3xl border p-5 transition-all duration-200 ${
        live
          ? 'border-white/12 bg-gradient-to-br from-slate-900/80 to-slate-950/90 shadow-xl hover:-translate-y-1 hover:border-fuchsia-300/40 hover:shadow-fuchsia-500/10'
          : 'border-dashed border-white/12 bg-slate-950/40'
      }`}
    >
      {/* Cartridge art */}
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br text-3xl ${game.gradient} ${live ? '' : 'opacity-60 grayscale'}`} aria-hidden="true">
          {game.emoji}
        </span>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${live ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-amber-200/25 bg-amber-200/5 text-amber-200/90'}`}>
            {live ? 'Ready to play' : 'Coming soon'}
          </span>
          <span className="flex items-center gap-0.5" title={`Difficulty ${game.difficulty} of 3`}>{difficultyBolts(game.difficulty)}</span>
        </div>
      </div>

      <h3 className={`mt-4 font-[var(--font-display)] text-lg font-bold tracking-tight ${live ? 'text-white' : 'text-slate-400'}`}>{game.title}</h3>
      <p className={`mt-1.5 flex-1 text-xs leading-relaxed ${live ? 'text-slate-400' : 'text-slate-500'}`}>{game.tagline}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3 text-[10px] text-slate-500">
        <span className="rounded-md border border-white/10 px-2 py-1 font-semibold text-slate-300">{game.genre}</span>
        {live && <span>{game.controls}</span>}
        {live && game.scoreLabel && <span aria-hidden="true">·</span>}
        {live && game.scoreLabel && <span>{game.scoreLabel}</span>}
      </div>

      {live && game.mode === 'react' && (
        <button type="button" onClick={() => onPlay(game)} className="mt-4 inline-flex items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300">
          <Play className="h-3.5 w-3.5" aria-hidden="true" /> Play now
        </button>
      )}
      {live && (game.mode === 'standalone' || game.mode === 'external') && game.launchUrl && (
        <a href={game.launchUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open game
        </a>
      )}
      {!live && (
        <span className="mt-4 inline-flex cursor-not-allowed items-center gap-2 self-start rounded-xl border border-white/10 px-5 py-2.5 text-xs font-semibold text-slate-500">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Insert cartridge soon
        </span>
      )}
    </article>
  );
}

export function BrainLoungePage({ onBackHome }: { onBackHome: () => void }) {
  const [activeGame, setActiveGame] = useState<BrainGameDef | null>(null);
  const live = liveBrainGames();
  const reserved = reservedBays();
  const ActiveGame = activeGame ? cartridgeComponent(activeGame) : null;

  const openGame = (game: BrainGameDef) => {
    if (game.mode === 'standalone' || game.mode === 'external') {
      // Standalone/external cartridges open in their own tab.
      if (game.launchUrl) window.open(game.launchUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setActiveGame(game);
    window.setTimeout(() => document.getElementById('brain-lounge-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#070d17] text-slate-100">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-white/8 bg-[#070d17]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="#brain-lounge" className="flex items-center gap-3" aria-label="The Brain Lounge home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-slate-950"><Gamepad2 className="h-4 w-4" aria-hidden="true" /></span>
            <span className="text-sm font-bold tracking-tight text-white">The Brain <span className="text-fuchsia-300">Lounge</span></span>
          </a>
          <button type="button" onClick={onBackHome} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to CMC
          </button>
        </div>
      </div>

      {/* Arcade hero */}
      <section data-keep-dark className="relative isolate overflow-hidden border-b border-white/8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_20%,rgba(232,121,249,0.16),transparent_42%),radial-gradient(ellipse_at_85%_75%,rgba(34,211,238,0.15),transparent_42%),linear-gradient(125deg,#0a0f1f,#0c1122_55%,#120e24)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(90deg,black,transparent_92%)]" />
        {/* scanlines */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:repeating-linear-gradient(0deg,transparent_0_3px,rgba(255,255,255,0.5)_3px_4px)]" />
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-fuchsia-200">
              <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" /> CMC Arcade · Insert coin
            </span>
            <h1 className="mt-6 font-[var(--font-display)] text-4xl font-bold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
              The Brain <span className="bg-gradient-to-r from-fuchsia-300 via-violet-200 to-cyan-300 bg-clip-text text-transparent">Lounge</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Arcade games built for Creative Minds — sharpen memory, reflexes and logic between lessons.
              Pick a cartridge, beat your best, and watch new games drop into the empty bays.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">{live.length} playable {live.length === 1 ? 'game' : 'games'}</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">{reserved.length} cartridge bays reserved</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">Free to play · no account needed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Cartridge shelf */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="border-b border-white/10 pb-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-fuchsia-300">Cartridge shelf</p>
          <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">Pick a cartridge</h2>
        </div>

        <div className="mt-8 grid gap-x-6 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
          {BRAIN_GAMES.map((game) => (
            <Cartridge key={game.id} game={game} onPlay={openGame} />
          ))}
        </div>

        {/* Game stage — lazy-mounted cartridge */}
        {activeGame && (
          <section id="brain-lounge-stage" className="mt-12 scroll-mt-6 overflow-hidden rounded-3xl border border-fuchsia-300/20 bg-slate-900/65 shadow-2xl shadow-fuchsia-950/20">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-gradient-to-br text-lg ${activeGame.gradient}`} aria-hidden="true">{activeGame.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Now playing · {activeGame.genre}</p>
                  <h3 className="truncate text-sm font-bold text-white sm:text-base">{activeGame.title}</h3>
                </div>
              </div>
              <button type="button" onClick={() => setActiveGame(null)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All cartridges
              </button>
            </header>
            <div className="p-5 sm:p-8">
              <Suspense fallback={
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-slate-500" role="status" aria-live="polite">
                  <Cpu className="h-7 w-7 animate-pulse text-fuchsia-300" aria-hidden="true" />
                  <p className="text-xs font-semibold uppercase tracking-[0.15em]">Loading cartridge…</p>
                </div>
              }>
                {ActiveGame ? <ActiveGame onExit={() => setActiveGame(null)} /> : null}
              </Suspense>
            </div>
          </section>
        )}

        {/* Player stats — leaderboard for the cartridges above */}
        <LoungeLeaderboard />

        {/* Creator note */}
        <aside className="mt-12 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-white/12 bg-slate-950/40 p-6 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200"><Lightbulb className="h-4.5 w-4.5" aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-bold text-white">Have an idea for the next cartridge?</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Game ideas from CMC students and teachers become the games in the reserved bays. Tell your teacher — new cartridges drop here first.
            </p>
          </div>
          <Sparkles className="ml-auto hidden h-4 w-4 shrink-0 text-fuchsia-300/60 sm:block" aria-hidden="true" />
        </aside>
      </section>
    </main>
  );
}
