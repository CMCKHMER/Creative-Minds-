import type { ComponentType } from 'react';

/**
 * THE BRAIN LOUNGE — arcade cartridge registry
 * ============================================
 * Every arcade game on the #brain-lounge page is one entry in BRAIN_GAMES.
 * The page renders the grid straight from this file, so adding a game
 * never touches page code.
 *
 * ── HOW TO ADD A NEW CARTRIDGE ──────────────────────────────────────────
 * Three launch modes are supported:
 *
 * 1) mode: 'react'      — the game is React code in this repo.
 *      • Create src/games/<id>/<Id>Game.tsx exporting a default component
 *        that accepts BrainGameProps ({ onExit }).
 *      • Add an entry with load: () => import('./<id>/<Id>Game').
 *        Vite code-splits it automatically — players only download a
 *        game's chunk when they press Play.
 *      • (Examples: ./brickforge/BrickForge, ./chess3d/Chess3D — copy
 *        their structure.)
 *
 * 2) mode: 'standalone' — the game is a self-contained HTML/JS file.
 *      • Drop it in public/arcade/<id>/index.html (it ships as-is).
 *      • Add an entry with launchUrl: './arcade/<id>/index.html'.
 *        The lounge opens it in a new tab so the game keeps its own
 *        canvas/fullscreen behaviour.
 *
 * 3) mode: 'external'   — the game lives somewhere else (itch.io,
 *      Scratch, Articulate, …). Add launchUrl: 'https://…' and the
 *      cartridge opens it in a new tab.
 *
 * Scores: React games that want the shared scoreboard call
 * submitScore({ drillSlug, drillTitle, drillSource: 'brain-lounge', … })
 * from src/lib/submitScore when a run ends. Standalone/external games
 * can POST to the same drill_attempts collection (see syntax-clash).
 * =======================================================================
 */

/** How a cartridge launches its game. */
export type BrainGameMode = 'react' | 'standalone' | 'external';

/** Props every in-lounge React game receives from the arcade stage. */
export interface BrainGameProps {
  /** Called by the game's "Back to the lounge" button. */
  onExit: () => void;
}

export interface BrainGameDef {
  /** URL-safe slug. Doubles as the drillSlug on the scoreboard. */
  id: string;
  title: string;
  /** One-liner shown on the cartridge. */
  tagline: string;
  /** Free-form genre chip: Memory, Reflex, Puzzle, Quiz, Logic, Word… */
  genre: string;
  /** 1–3 lightning bolts on the cartridge label. */
  difficulty: 1 | 2 | 3;
  /** Cartridge art (emoji until real artwork lands). */
  emoji: string;
  /** Tailwind gradient classes for the cartridge shell. */
  gradient: string;
  status: 'live' | 'coming-soon';
  mode?: BrainGameMode;
  /** mode 'react': dynamic import returning { default: GameComponent }. */
  load?: () => Promise<{ default: ComponentType<BrainGameProps> }>;
  /** mode 'standalone' | 'external': where the game opens. */
  launchUrl?: string;
  /** Input hint shown under Play: "Mouse, touch or keys 1–4". */
  controls: string;
  /** What one run is worth, e.g. "Levels cleared". Shown on the cartridge. */
  scoreLabel?: string;
}

/**
 * Cartridges on the shelf, top-left → bottom-right.
 * Coming-soon bays are real entries too — swap one for the real game
 * (flip status to 'live', fill in load/launchUrl) when it's ready.
 */
export const BRAIN_GAMES: BrainGameDef[] = [
  {
    id: 'brickforge',
    title: 'BrickForge',
    tagline: 'Smash the wall, chain combos, catch power-ups — don\u2019t let the ember drop.',
    genre: 'Reflex',
    difficulty: 2,
    emoji: '⚒️',
    gradient: 'from-orange-400/25 via-amber-500/10 to-red-400/15',
    status: 'live',
    mode: 'react',
    load: () => import('./brickforge/BrickForge'),
    controls: 'Mouse / drag · touch · ← → or A D · Space launches',
    scoreLabel: 'Combo score',
  },
  {
    id: 'chess3d',
    title: 'Arena Chess 3D',
    tagline: 'Hand-sculpted 3D pieces — duel five AI strengths, a friend on one screen, or a classmate online with a room code.',
    genre: 'Strategy',
    difficulty: 3,
    emoji: '♟️',
    gradient: 'from-amber-300/25 via-amber-500/10 to-emerald-400/15',
    status: 'live',
    mode: 'react',
    load: () => import('./chess3d/Chess3D'),
    controls: 'Mouse or touch · drag to orbit · online room codes',
    scoreLabel: 'Wins · draws · losses',
  },
  {
    id: 'bay-03',
    title: 'Cartridge Bay 03',
    tagline: 'Reserved — the next arcade game for CMC drops here.',
    genre: 'In the workshop',
    difficulty: 1,
    emoji: '👾',
    gradient: 'from-slate-400/10 via-slate-500/5 to-slate-400/10',
    status: 'coming-soon',
    controls: '—',
  },
  {
    id: 'bay-04',
    title: 'Cartridge Bay 04',
    tagline: 'Reserved — the next arcade game for CMC drops here.',
    genre: 'In the workshop',
    difficulty: 1,
    emoji: '💾',
    gradient: 'from-slate-400/10 via-slate-500/5 to-slate-400/10',
    status: 'coming-soon',
    controls: '—',
  },
  {
    id: 'bay-05',
    title: 'Cartridge Bay 05',
    tagline: 'Reserved — the next arcade game for CMC drops here.',
    genre: 'In the workshop',
    difficulty: 1,
    emoji: '🎲',
    gradient: 'from-slate-400/10 via-slate-500/5 to-slate-400/10',
    status: 'coming-soon',
    controls: '—',
  },
];

/** Live games only — used for the hero counter chip. */
export function liveBrainGames(): BrainGameDef[] {
  return BRAIN_GAMES.filter((game) => game.status === 'live');
}

/** Coming-soon bays — used for the hero counter chip. */
export function reservedBays(): BrainGameDef[] {
  return BRAIN_GAMES.filter((game) => game.status === 'coming-soon');
}
