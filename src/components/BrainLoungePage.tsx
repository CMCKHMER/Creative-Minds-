import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { ArrowLeft, CalendarClock, Cpu, ExternalLink, Gamepad2, Home, Lightbulb, LockKeyhole, Play, Sparkles, UserPlus, Zap } from 'lucide-react';
import { GlassFact, GlassPageBar, GlassPageHero } from './GlassPage';
import { BRAIN_GAMES, liveBrainGames, reservedBays, type BrainGameDef, type BrainGameProps } from '../games/registry';
import { LoungeLeaderboard } from './LoungeLeaderboard';
import { useSignedInSession } from '../hooks/useSignedInSession';
import { requestAuth } from '../lib/authPrompt';
import { GUEST_BRICKFORGE_MAX_LEVEL, hasActiveAccount, isSampleBrainGame } from '../lib/gameAccess';

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

function Cartridge({ game, bay, playable, sample, onPlay }: {
  game: BrainGameDef;
  /** Where the bay sits on the shelf — shown as the cartridge number. */
  bay: number;
  /** Signed-in accounts: every live cartridge. */
  playable: boolean;
  /** Guests: only the 1-level BrickForge trial is open. */
  sample: boolean;
  onPlay: (game: BrainGameDef) => void;
}) {
  const live = game.status === 'live';
  const badge = !live
    ? 'border-amber-200/25 bg-amber-200/[0.08] text-amber-200/90'
    : sample
      ? 'border-fuchsia-300/30 bg-fuchsia-300/15 text-fuchsia-100'
      : playable
        ? 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100'
        : 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100';

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 ${
        live
          ? 'border-white/12 bg-gradient-to-br from-slate-900/85 to-slate-950/95 shadow-xl shadow-slate-950/40 hover:-translate-y-1.5 hover:border-fuchsia-300/40 hover:shadow-2xl hover:shadow-fuchsia-900/25'
          : 'border-dashed border-white/12 bg-slate-950/40'
      }`}
    >
      {/* Cover art */}
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {game.art ? (
          <img
            src={game.art}
            alt={game.artAlt ?? ''}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition duration-700 ${live ? 'group-hover:scale-[1.06]' : 'opacity-40 grayscale'}`}
          />
        ) : (
          <div className={`grid h-full w-full place-items-center bg-gradient-to-br text-5xl ${game.gradient}`} aria-hidden="true">
            {game.emoji}
          </div>
        )}
        <div className={`absolute inset-0 ${live ? 'bg-gradient-to-t from-slate-950 via-slate-950/30 to-slate-950/5' : 'bg-slate-950/50'}`} />

        {/* Status + difficulty ride on the art */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className={`rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur-sm ${badge}`}>
            {!live ? 'Coming soon' : sample ? `Free ${GUEST_BRICKFORGE_MAX_LEVEL}-level trial` : playable ? 'Ready to play' : 'Account required'}
          </span>
          <span
            className="flex items-center gap-0.5 rounded-md border border-white/12 bg-slate-950/60 px-1.5 py-1 backdrop-blur-sm"
            title={`Difficulty ${game.difficulty} of 3`}
          >
            {difficultyBolts(game.difficulty)}
          </span>
        </div>

        {/* Genre + bay number sit on the cover's lower edge */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-2.5">
          <span className="flex items-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-gradient-to-br text-base shadow-lg ${game.gradient}`} aria-hidden="true">
              {game.emoji}
            </span>
            <span className="rounded-md border border-white/12 bg-slate-950/65 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-200 backdrop-blur-sm">
              {game.genre}
            </span>
          </span>
          <span className="font-[var(--font-display)] text-[10px] font-bold tracking-[0.2em] text-white/45">
            BAY {String(bay).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Copy + action */}
      <div className="flex flex-1 flex-col p-5 pt-3.5">
        <h3 className={`font-[var(--font-display)] text-lg font-bold tracking-tight ${live ? 'text-white' : 'text-slate-400'}`}>{game.title}</h3>
        <p className={`mt-1.5 flex-1 text-xs leading-relaxed ${live ? 'text-slate-400' : 'text-slate-500'}`}>{game.tagline}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/8 pt-3 text-[10px] text-slate-500">
          {live ? <span>{game.controls}</span> : <span>Reserved for the next CMC idea</span>}
          {live && game.scoreLabel && <span aria-hidden="true">·</span>}
          {live && game.scoreLabel && <span className="text-slate-400">{game.scoreLabel}</span>}
        </div>

        {live && game.mode === 'react' && playable && (
          <button type="button" onClick={() => onPlay(game)} className="mt-4 inline-flex items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300">
            <Play className="h-3.5 w-3.5" aria-hidden="true" /> {sample ? `Try ${GUEST_BRICKFORGE_MAX_LEVEL} free level` : 'Play now'}
          </button>
        )}
        {live && (game.mode === 'standalone' || game.mode === 'external') && game.launchUrl && playable && (
          <a href={game.launchUrl} className="mt-4 inline-flex items-center justify-center gap-2 self-start rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open game
          </a>
        )}
        {live && !playable && (
          <button
            type="button"
            onClick={() => requestAuth({ mode: 'sign-up', contextPrompt: `Sign up free to play ${game.title}.` })}
            className="mt-4 inline-flex items-center justify-center gap-2 self-start rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-2.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20 active:scale-95"
          >
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Sign up to play
          </button>
        )}
        {!live && (
          <span className="mt-4 inline-flex cursor-not-allowed items-center gap-2 self-start rounded-xl border border-white/10 px-5 py-2.5 text-xs font-semibold text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Insert cartridge soon
          </span>
        )}
      </div>
    </article>
  );
}

export function BrainLoungePage({ onBackHome }: { onBackHome: () => void }) {
  // Hash routes share one HTML shell — set the page <title> on mount and
  // restore the landing title on unmount.
  useEffect(() => {
    const prev = document.title;
    document.title = 'The Brain Lounge · CMC Arcade';
    return () => { document.title = prev; };
  }, []);
  const [activeGame, setActiveGame] = useState<BrainGameDef | null>(null);
  // ACCOUNT RULE: signed-in accounts unlock every live cartridge; visitors may
  // sample exactly one level of BrickForge. Everything else asks for a sign-up.
  const session = useSignedInSession();
  const signedIn = hasActiveAccount(session);
  const live = liveBrainGames();
  const reserved = reservedBays();
  const ActiveGame = activeGame ? cartridgeComponent(activeGame) : null;

  const openGame = (game: BrainGameDef) => {
    const allowed = signedIn || isSampleBrainGame(game.id);
    if (!allowed) {
      requestAuth({
        mode: 'sign-up',
        contextPrompt: `Sign up free to play ${game.title}. Visitors can try ${GUEST_BRICKFORGE_MAX_LEVEL} level of BrickForge.`,
      });
      return;
    }
    if (game.mode === 'standalone' || game.mode === 'external') {
      // Standalone/external cartridges navigate in the same tab.
      if (game.launchUrl) window.location.assign(game.launchUrl);
      return;
    }
    setActiveGame(game);
    window.setTimeout(() => document.getElementById('brain-lounge-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  return (
    <main className="cmc-app cmc-subpage min-h-screen overflow-hidden text-slate-100">
      {/* Top bar */}
      <GlassPageBar href="#brain-lounge" label="The Brain Lounge home" icon={Gamepad2} name="The Brain" accent="Lounge" onBack={onBackHome} />

      {/* Arcade hero */}
      <GlassPageHero
        view="b"
        eyebrow="CMC Arcade · Insert coin"
        eyebrowIcon={Gamepad2}
        title={<>The Brain <em>Lounge</em></>}
        lead="Arcade games built for Creative Minds — sharpen memory, reflexes and logic between lessons. Pick a cartridge, beat your best, and watch new games drop into the empty bays."
      >
        <GlassFact>{live.length} playable {live.length === 1 ? 'game' : 'games'}</GlassFact>
        <GlassFact>{reserved.length} cartridge bays reserved</GlassFact>
        <GlassFact>Free account · 1-level guest trial</GlassFact>
      </GlassPageHero>

      {/* Cartridge shelf */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="border-b border-white/10 pb-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-fuchsia-300">Cartridge shelf</p>
          <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">Pick a cartridge</h2>
        </div>

        <div className="mt-8 grid gap-x-6 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
          {BRAIN_GAMES.map((game, index) => (
            <Cartridge
              key={game.id}
              game={game}
              bay={index + 1}
              playable={signedIn || isSampleBrainGame(game.id)}
              sample={!signedIn && isSampleBrainGame(game.id)}
              onPlay={openGame}
            />
          ))}
        </div>

        {!signedIn && (
          <div className="mt-8 flex flex-col items-start gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] p-5 sm:flex-row sm:items-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><UserPlus className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">One free level of BrickForge, then your account unlocks everything</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                Create a free account — student or general user, same access — to play every cartridge, save your best
                scores and join the Lounge leaderboard.
              </p>
            </div>
            <button type="button" onClick={() => requestAuth({ mode: 'sign-up', contextPrompt: 'Sign up free to unlock every Brain Lounge cartridge.' })} className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-300 to-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950">
              Sign up free
            </button>
          </div>
        )}

        {/* Game stage — lazy-mounted cartridge */}
        {activeGame && (
          <section id="brain-lounge-stage" className="mt-12 scroll-mt-6 overflow-hidden rounded-3xl border border-fuchsia-300/20 bg-slate-900/65 shadow-2xl shadow-fuchsia-950/20">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                {activeGame.art ? (
                  <img
                    src={activeGame.art}
                    alt=""
                    className="h-11 w-16 shrink-0 rounded-lg border border-white/15 object-cover shadow-lg"
                  />
                ) : (
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-gradient-to-br text-lg ${activeGame.gradient}`} aria-hidden="true">{activeGame.emoji}</span>
                )}
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Now playing · {activeGame.genre}</p>
                  <h3 className="truncate text-sm font-bold text-white sm:text-base">{activeGame.title}</h3>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => setActiveGame(null)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All cartridges
                </button>
                {/* One click out of any cartridge, back to the CMC home page. */}
                <button type="button" onClick={onBackHome} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-fuchsia-300/40 hover:bg-white/5 hover:text-white">
                  <Home className="h-3.5 w-3.5" aria-hidden="true" /> Back to CMC
                </button>
              </div>
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

        {/* Player stats — leaderboard for the cartridges above (accounts only;
            a guest's trial run is never submitted). */}
        {signedIn ? (
          <LoungeLeaderboard />
        ) : (
          <div className="mt-12 rounded-2xl border border-cyan-200/20 bg-cyan-100/[0.05] p-6 text-center">
            <LockKeyhole className="mx-auto h-6 w-6 text-cyan-200" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-white">Leaderboard needs a free account</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">Sign up to save your runs and see how the Lounge is doing.</p>
          </div>
        )}

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
