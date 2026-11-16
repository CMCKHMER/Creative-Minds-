import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { BRAIN_GAMES, liveBrainGames, reservedBays, type BrainGameDef } from '../games/registry';
import { MILESTONE_STAGES, milestonePct } from '../games/brickforge/scoring';
import { buildLevel, COLS, MAX_ROWS } from '../games/brickforge/levels';
import {
  addScore,
  bestScore,
  loadScores,
  loadLastName,
  qualifies,
  saveLastName,
  MAX_ENTRIES,
  type ScoreEntry,
} from '../games/brickforge/highscores';
import { aggregateMafia, aggregateWordCreator } from '../lib/brainLoungeStats';

/** Minimal localStorage stub — vitest runs in a node environment, but the
 * highscore module (and the game itself) touches localStorage everywhere. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

beforeEach(() => {
  const store = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
});

/** Registry invariants — the lounge page renders straight from this data,
 * so a malformed entry would show up as a broken cartridge card. */
describe('brain lounge registry', () => {
  it('has unique ids', () => {
    const ids = BRAIN_GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every game carries display fields', () => {
    for (const game of BRAIN_GAMES) {
      expect(game.title.length, game.id).toBeGreaterThan(0);
      expect(game.tagline.length, game.id).toBeGreaterThan(0);
      expect(game.genre.length, game.id).toBeGreaterThan(0);
      expect(game.emoji.length, game.id).toBeGreaterThan(0);
      expect(game.gradient.startsWith('from-'), game.id).toBe(true);
      expect([1, 2, 3]).toContain(game.difficulty);
      expect(['live', 'coming-soon']).toContain(game.status);
      expect(game.controls.length, game.id).toBeGreaterThan(0);
    }
  });

  it('live games always have a launch path; coming-soon bays never do', () => {
    for (const game of BRAIN_GAMES) {
      if (game.status === 'live') {
        expect(game.mode, game.id).toBeDefined();
        if (game.mode === 'react') {
          expect(typeof game.load, game.id).toBe('function');
        } else {
          expect(game.launchUrl, game.id).toBeTruthy();
        }
      } else {
        expect(game.load, `${game.id} should not ship a loader`).toBeUndefined();
        expect(game.launchUrl, `${game.id} should not ship a URL`).toBeUndefined();
      }
    }
  });

  it('splits into live games and reserved bays that add back up', () => {
    expect(liveBrainGames().length + reservedBays().length).toBe(BRAIN_GAMES.length);
    expect(liveBrainGames().every((g) => g.status === 'live')).toBe(true);
    expect(reservedBays().every((g) => g.status === 'coming-soon')).toBe(true);
  });

  it('keeps at least one playable cartridge and one open bay', () => {
    expect(liveBrainGames().length).toBeGreaterThanOrEqual(1);
    expect(reservedBays().length).toBeGreaterThanOrEqual(1);
  });

  it('leads the shelf with BrickForge, Galica in bay 2, Mafia Noir in bay 4, Word Creator in bay 5', () => {
    expect(BRAIN_GAMES[0]?.id).toBe('brickforge');
    expect(BRAIN_GAMES.some((g) => g.id === 'neon-sequence')).toBe(false);
    expect(liveBrainGames().map((g) => g.id)).toEqual(['brickforge', 'chess3d', 'galica', 'mafia', 'word-creator']);
    // Word Creator takes the bay-05 slot and the reserved bay moves down one,
    // so a new game still has somewhere to land.
    const ids = BRAIN_GAMES.map((g) => g.id);
    expect(ids.indexOf('word-creator')).toBe(ids.indexOf('mafia') + 1);
    expect(BRAIN_GAMES.find((g) => g.id === 'bay-05')).toBeUndefined();
    expect(BRAIN_GAMES.filter((g) => g.status === 'coming-soon').map((g) => g.id)).toEqual(['bay-06']);
  });

  it('react cartridges load a default component', async () => {
    const reactGames = BRAIN_GAMES.filter((g) => g.mode === 'react' && g.load) as Required<Pick<BrainGameDef, 'load'>>[] & BrainGameDef[];
    for (const game of reactGames) {
      const mod = await game.load();
      expect(typeof mod.default).toBe('function');
    }
  });
});

describe('brickforge scoreboard mapping', () => {
  it('maps each cleared level to 10 points up to the milestone cap', () => {
    expect(milestonePct(0)).toBe(0);
    expect(milestonePct(1)).toBe(10);
    expect(milestonePct(3)).toBe(30);
    expect(milestonePct(MILESTONE_STAGES)).toBe(100);
  });

  it('caps at 100 and floors at 0 for out-of-range input', () => {
    expect(milestonePct(25)).toBe(100);
    expect(milestonePct(-2)).toBe(0);
    expect(milestonePct(1.9)).toBe(10); // floored before clamping
  });

  it('stays consistent with the correct/total pair it submits', () => {
    for (let level = 0; level <= 15; level++) {
      const correct = Math.min(level, MILESTONE_STAGES);
      expect(Math.round((correct / MILESTONE_STAGES) * 100)).toBe(milestonePct(level));
    }
  });
});

describe('brickforge level builder', () => {
  it('keeps bricks inside the grid for many random level rolls', () => {
    for (let level = 1; level <= 30; level++) {
      const specs = buildLevel(level);
      expect(specs.length, `level ${level}`).toBeGreaterThan(0);
      for (const s of specs) {
        expect(s.col).toBeGreaterThanOrEqual(0);
        expect(s.col).toBeLessThan(COLS);
        expect(s.row).toBeGreaterThanOrEqual(0);
        expect(s.row).toBeLessThan(MAX_ROWS);
        expect([1, 2, 3, 999]).toContain(s.hp);
      }
    }
  });

  it('level 1 is the full wall — every cell of the top row is a brick', () => {
    const specs = buildLevel(1);
    for (let c = 0; c < COLS; c++) {
      expect(specs.some((s) => s.row === 0 && s.col === c), `col ${c}`).toBe(true);
    }
  });

  it('always leaves at least one gold brick to chase', () => {
    for (let level = 1; level <= 25; level++) {
      const specs = buildLevel(level);
      expect(specs.some((s) => s.kind === 'gold'), `level ${level}`).toBe(true);
    }
  });

  it('reserves anvils for level 5+ and keeps them break-proof but rare', () => {
    for (let i = 0; i < 20; i++) {
      expect(buildLevel(4).every((s) => s.kind !== 'anvil')).toBe(true);
    }
    for (let level = 5; level <= 25; level++) {
      const anvils = buildLevel(level).filter((s) => s.kind === 'anvil');
      for (const a of anvils) {
        expect(a.hp).toBe(999);
        expect(a.row, `level ${level} anvil in top row`).toBeGreaterThan(0);
      }
      expect(anvils.length).toBeLessThanOrEqual(2 + Math.floor(level / 3));
    }
  });

  it('normal bricks never exceed 3 hit points', () => {
    for (let level = 1; level <= 20; level++) {
      for (const s of buildLevel(level)) {
        if (s.kind === 'normal') expect(s.hp).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('brickforge hall of smiths', () => {
  it('starts empty with no qualifying score', () => {
    expect(loadScores()).toEqual([]);
    expect(bestScore()).toBe(0);
    expect(qualifies(0)).toBe(false);
    expect(qualifies(1500)).toBe(true); // any positive score makes the board
  });

  it('adds entries sorted best-first and reports the rank', () => {
    const a: ScoreEntry = { name: 'A', score: 100, level: 1, date: 1 };
    const b: ScoreEntry = { name: 'B', score: 900, level: 3, date: 2 };
    expect(addScore(a)).toBe(1);
    expect(addScore(b)).toBe(1); // 900 takes the crown
    expect(loadScores().map((s) => s.score)).toEqual([900, 100]);
    expect(bestScore()).toBe(900);
  });

  it('trims the board to MAX_ENTRIES and gates new qualifiers', () => {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      addScore({ name: `P${i}`, score: (i + 1) * 100, level: 1, date: i });
    }
    expect(loadScores().length).toBe(MAX_ENTRIES);
    const lastPlace = 100; // a full board is gated by its lowest score
    expect(qualifies(lastPlace - 1)).toBe(false); // worse than last place
    expect(qualifies(lastPlace + 1)).toBe(true); // beats last place
    addScore({ name: 'NEW', score: lastPlace + 1, level: 2, date: 999 });
    expect(loadScores().length).toBe(MAX_ENTRIES);
    expect(loadScores().some((s) => s.name === 'NEW')).toBe(true);
    expect(loadScores().some((s) => s.name === 'P0')).toBe(false); // 100 dropped off
  });

  it('remembers the last smith name for the next run', () => {
    expect(loadLastName()).toBe('');
    saveLastName('ember');
    expect(loadLastName()).toBe('ember');
  });
});

/** Galica cartridge — the lounge's first standalone shooter. The registry
 * points at a shipped file, so this pins the file, its score-sync wiring and
 * the entry shape together: editing or losing any one of them fails here
 * instead of showing a dead "Open game" link on the live shelf. */
describe('galica standalone cartridge', () => {
  const galica = BRAIN_GAMES.find((g) => g.id === 'galica');

  it('is registered as a live standalone cartridge', () => {
    expect(galica).toBeDefined();
    expect(galica!.status).toBe('live');
    expect(galica!.mode).toBe('standalone');
    expect(galica!.launchUrl).toBe('./arcade/galica/index.html');
  });

  it('ships the game file with its page-sync hook intact', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'public', 'arcade', 'galica', 'index.html'),
      'utf8',
    );
    expect(html).toContain('var CMC_GALICA_SUBMIT'); // sync block defined…
    expect(html.match(/CMC_GALICA_SUBMIT\(/g)?.length).toBeGreaterThanOrEqual(2); // …and fired from both game-over sites
    expect(html).toContain("drillSource:{stringValue:'brain-lounge'}");
    expect(html).toContain('</html>');
  });
});

/** Mafia Noir cartridge — the lounge's standalone social-deduction game.
 * Pins the shipped file together with its CMC integration (identity,
 * leaderboard POST, narrator audio, AI art) and the three bug fixes the
 * audit made, so none of them can silently regress. */
describe('mafia noir standalone cartridge', () => {
  const mafia = BRAIN_GAMES.find((g) => g.id === 'mafia');

  it('is registered as a live standalone cartridge in bay 04', () => {
    expect(mafia).toBeDefined();
    expect(mafia!.status).toBe('live');
    expect(mafia!.mode).toBe('standalone');
    expect(mafia!.launchUrl).toBe('./mafia.html');
    expect(mafia!.genre).toBe('Deduction');
  });

  it('ships the game file with the CMC integration block intact', () => {
    const html = readFileSync(resolve(process.cwd(), 'public', 'mafia.html'), 'utf8');
    expect(html).toContain('cmcmafia:game'); // engine result event…
    expect(html.match(/cmcmafia:phase/g)?.length).toBeGreaterThanOrEqual(4); // …+ phase narrator hooks
    expect(html).toContain("stringValue: 'brain-lounge'"); // lounge leaderboard source
    expect(html).toContain("stringValue: 'mafia.html'"); // lounge slug
    expect(html).toContain('cmcNameIn'); // identity inputs on the hub
    expect(html).toContain('cmc-student-name'); // email-guard/heal shared keys
    expect(html).toContain('mafia-audio/narr-night.mp3'); // narrator wired
    expect(html).toContain('mafia-art/mafia-city.jpg'); // AI hero art wired
    expect(html).toContain('mafia-art/mafia-${k}.jpg'); // AI fan portraits wired
    expect(html).toContain('</html>');
  });

  it("wires the owner's artwork: card back, a picture per role, city-wins sunrise", () => {
    const html = readFileSync(resolve(process.cwd(), 'public', 'mafia.html'), 'utf8');
    // back of every role card — the drawn back stays underneath as the fallback
    expect(html).toContain('<img class="cb-art" src="mafia-art/mafia-cardback.jpg"');
    expect(html).toContain('>MN</text></svg><img class="cb-art"');
    // front of the role card: one picture per role key, icon design if it fails
    expect(html).toContain('<div class="rf-art"><img src="mafia-art/mafia-${k}.jpg"');
    expect(html).toContain("classList.remove('has-art')");
    // CASE CLOSED: the sunrise only when the city wins
    expect(html).toContain('${winner==="town"?\'<div class="end-art"><img src="mafia-art/mafia-town-wins.jpg"');
    // every role the game deals has a picture on disk, none of them heavy
    const roles = [...html.matchAll(/^ (\w+):\{name:"/gm)].map((m) => m[1]);
    expect(roles).toEqual(['mafia', 'detective', 'doctor', 'villager']);
    for (const name of [...roles, 'cardback', 'town-wins', 'city', 'city-day']) {
      const size = statSync(resolve(process.cwd(), 'public', 'mafia-art', `mafia-${name}.jpg`)).size;
      expect(size, name).toBeGreaterThan(20_000);
      expect(size, name).toBeLessThan(260_000);
    }
  });

  it('paints the night city and the dawn city behind the page and the table', () => {
    const html = readFileSync(resolve(process.cwd(), 'public', 'mafia.html'), 'utf8');
    // two layers behind the page, two behind the seats
    expect(html).toContain('<div id="bg"><div class="bg-art" id="bgNight"></div><div class="bg-art" id="bgDay"></div><div id="bgScrim"></div>');
    expect(html).toContain('<div id="tableWrap" hidden><div class="tw-art" id="twNight"></div><div class="tw-art" id="twDay"></div><div id="twScrim"></div>');
    // a picture is shown only after it has loaded; the drawn scene is the fallback
    expect(html).toContain('get("mafia-art/mafia-city.jpg","has-art")');
    expect(html).toContain('get("mafia-art/mafia-city-day.jpg","has-day")');
    expect(html).toContain('#bg.has-art #moon,#bg.has-art #skyA,#bg.has-art #skyB,#bg.has-day #sun,#bg.has-day #dayWash{display:none}');
    // the day picture follows the phase the game already sets on <body>
    expect(html).toContain('body[data-phase=day] #bg.has-day #bgDay{opacity:.6}');
    expect(html).toContain('document.body.dataset.phase=');
  });

  it('shows the CASE CLOSED role tiles and opens tall modals at the top', () => {
    const html = readFileSync(resolve(process.cwd(), 'public', 'mafia.html'), 'utf8');
    // the tiles rest at opacity 0, so the animation must name where it ends
    expect(html).toContain('@keyframes revIn{from{opacity:0;transform:rotateY(90deg)}to{opacity:1;transform:none}}');
    // focusing the first button must not scroll the verdict off a phone screen
    expect(html.match(/b\.focus\(\{preventScroll:true\}\)/g)?.length).toBe(2);
    expect(html).not.toContain('b.focus(),50');
  });

  it('carries the three audit bug fixes', () => {
    const html = readFileSync(resolve(process.cwd(), 'public', 'mafia.html'), 'utf8');
    // F1: human influence statements are PUBLIC, not syndicate whispers
    expect(html).not.toContain('"mafia");applyAccuse');
    expect(html).not.toContain('"mafia");applyClaim');
    expect(html).toContain('"public");applyAccuse');
    expect(html).toContain('"public");applyClaim');
    // F11: typing a seat name no longer rebuilds the roster (focus loss)
    expect(html).toContain('renderSetupMeta()');
    // F3: the online mode explains itself when no game server exists
    expect(html).toContain('onlineUnavailable');
  });
});

/** Mafia lounge aggregation — decodes the case outcome the game posts. */
describe('mafia lounge aggregation', () => {
  const attempt = (over: Partial<import('../lib/brainLoungeStats').LoungeAttempt>) => ({
    studentName: 'Dara', drillSlug: 'mafia.html', drillSource: 'brain-lounge',
    scorePct: 100, correctCount: 1, totalCount: 1, submittedAt: 1000, ...over,
  });

  it('decodes team wins and losses from the correct/total pair', () => {
    const rows = aggregateMafia([
      attempt({}),                                   // team win
      attempt({ correctCount: 0, scorePct: 50 }),    // loss but survived
      attempt({ correctCount: 0, scorePct: 25, submittedAt: 2000 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Dara', cases: 3, wins: 1, losses: 2, lastPlayed: 2000 });
  });

  it('ignores other cartridges and sorts by wins, then losses, then cases', () => {
    const rows = aggregateMafia([
      attempt({ studentName: 'B', correctCount: 0 }),
      attempt({ studentName: 'A', correctCount: 0, submittedAt: 500 }),
      attempt({ studentName: 'A', submittedAt: 900 }),
      attempt({ studentName: 'C', drillSlug: 'galica', correctCount: 5, totalCount: 0 }),
      attempt({ studentName: 'C', drillSource: 'learning-games' }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
    expect(rows[0]).toMatchObject({ wins: 1, losses: 1, cases: 2 });
  });
});

/** Word Creator cartridge — the lounge's full 15×15 word duel, and the first
 * standalone cartridge with BOTH an online room transport and a match
 * leaderboard. Pins the shipped files together with the two bugs the audit
 * found (hints firing behind a modal; a swap counting as a pass) and the
 * deal/transport contract the online mode depends on. */
describe('word creator standalone cartridge', () => {
  const wc = BRAIN_GAMES.find((g) => g.id === 'word-creator');
  const html = readFileSync(resolve(process.cwd(), 'public', 'arcade', 'word-creator', 'index.html'), 'utf8');
  const online = readFileSync(resolve(process.cwd(), 'public', 'arcade', 'word-creator', 'online.js'), 'utf8');

  it('is live in the bay-05 slot that used to be reserved', () => {
    expect(wc).toBeDefined();
    expect(wc!.status).toBe('live');
    expect(wc!.mode).toBe('standalone');
    expect(wc!.launchUrl).toBe('./arcade/word-creator/index.html');
    expect(wc!.genre).toBe('Word');
    // bay-05 is gone: the cartridge that owned the slot is now the game
    expect(BRAIN_GAMES.some((g) => g.id === 'bay-05')).toBe(false);
  });

  it('ships a complete page, not a fragment', () => {
    expect(html).toContain('</html>');
    expect(html).toContain('<title>Word Creator');
    // the 15×15 board and the standard 100-tile bag
    expect(html).toContain('id="grid"');
  });

  it('gates on a CMC account like every other standalone page', () => {
    expect(html).toContain("CMC_GATE.guard('account', 'Sign up free to play Word Creator.')");
    expect(html).toContain('../../assets/js/cmc-auth-gate.js');
  });

  it('posts finished matches to the lounge leaderboard', () => {
    expect(html).toContain('var CMC_WORD_CREATOR_SUBMIT');
    expect(html).toContain("drillSlug:{stringValue:'word-creator'}");
    expect(html).toContain("drillSource:{stringValue:'brain-lounge'}");
    // fired from endGame — the single exit both finishing paths go through
    expect(html).toMatch(/reportMatch\(s\)/);
    // only ever reports the signed-in player's own seat
    expect(html).toContain('function cmcMySeat');
  });

  it('keeps the two audit fixes nailed down', () => {
    // 1. a swap must not count toward the pass-out limit (it used to end a
    //    healthy game after a few swaps)
    const swap = html.slice(html.indexOf('function doSwap'), html.indexOf('function doSwap') + 700);
    expect(swap).not.toContain('G.passes++');
    // …while a pass still does
    const pass = html.slice(html.indexOf('function doPass'), html.indexOf('function doPass') + 600);
    expect(pass).toContain('G.passes++');
    // 2. every action must respect an open modal (hints used to paint behind it)
    expect(html).toContain('function modalOpen()');
    expect(html).toMatch(/function canAct\(\)\{[^}]*!modalOpen\(\)/);
  });

  it('wires online play behind ?online without touching the offline path', () => {
    // the transport is a separate file, inert unless the query asks for it
    expect(html).toContain('<script src="./online.js" defer></script>');
    expect(online).toContain('function boot()');
    expect(online).toContain("params.has('online')");
    // the collection the rules file gates
    expect(online).toContain("word_creator_rooms");
    // create posts to the COLLECTION path, never the doc path
    expect(online).toContain("'/word_creator_rooms?documentId='");
    // and the room shape carries the fields firestore.rules requires
    for (const field of ['code', 'hostUid', 'hostName', 'seed', 'seats', 'seatsWanted', 'moves', 'turn', 'closed']) {
      expect(online, `room field ${field}`).toContain(`${field}:`);
    }
  });

  it('has exactly one deal implementation per codebase, and they agree', () => {
    // the page cannot import TypeScript, so the deal is duplicated — the
    // parity suite in wordCreatorOnline.test.ts is what keeps the two equal.
    expect(online).toContain('function buildBag(seed)');
    expect(online).toContain('function openDeal(seed, seats)');
    expect(online).toContain('900000 + ix'); // ids outside the engine's own range
  });
});

describe('word creator leaderboard decoding', () => {
  const attempt = (over: Partial<Parameters<typeof aggregateWordCreator>[0][number]> = {}) => ({
    studentName: 'Sok Dara', drillSlug: 'word-creator', drillSource: 'brain-lounge',
    scorePct: 2, correctCount: 240, totalCount: 1, submittedAt: 1000, ...over,
  });

  it('ranks by the raw match score carried in correctCount', () => {
    const rows = aggregateWordCreator([
      attempt({ studentName: 'A', correctCount: 240 }),
      attempt({ studentName: 'B', correctCount: 410, submittedAt: 1200 }),
      attempt({ studentName: 'A', correctCount: 180, submittedAt: 1400 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['B', 'A']);
    expect(rows[0]).toMatchObject({ bestScore: 410, matches: 1, wins: 1 });
    // A's best is kept, not their average — and both matches count
    expect(rows[1]).toMatchObject({ bestScore: 240, matches: 2, wins: 2, lastPlayed: 1400 });
  });

  it('reads a win from totalCount, never from the score', () => {
    // a 1-point match would decode as a "win" if this used the chess/mafia
    // correct/total pair — that is exactly why totalCount carries the flag
    const rows = aggregateWordCreator([attempt({ correctCount: 1, totalCount: 0 })]);
    expect(rows[0]).toMatchObject({ matches: 1, wins: 0, bestScore: 1 });
  });

  it('ignores every other cartridge and every other source', () => {
    const rows = aggregateWordCreator([
      attempt({ studentName: 'A' }),
      attempt({ studentName: 'B', drillSlug: 'galica' }),
      attempt({ studentName: 'C', drillSource: 'learning-games' }),
      attempt({ studentName: 'D', drillSlug: 'word-creator', drillSource: 'homework' }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['A']);
  });

  it('keeps the best percentage alongside the best score', () => {
    const rows = aggregateWordCreator([
      attempt({ scorePct: 2, correctCount: 240 }),
      attempt({ scorePct: 6, correctCount: 410, submittedAt: 2000 }),
    ]);
    expect(rows[0]).toMatchObject({ bestPct: 6, bestScore: 410 });
  });
});

/** Hub + lexicon upgrade (Nov 2026). The game gained a visual start screen and
 * a lazy tournament dictionary; both are load-bearing, so both are pinned. */
describe('word creator — hub screen and tournament lexicon', () => {
  const html = readFileSync(resolve(process.cwd(), 'public', 'arcade', 'word-creator', 'index.html'), 'utf8');

  it('opens on a hub with one card per way to play', () => {
    expect(html).toContain('<main id="hub"');
    expect(html).toContain('<body data-screen="hub">');
    for (const id of ['modeSolo', 'modePass', 'modeOnline']) {
      expect(html, `hub card ${id}`).toContain(`id="${id}"`);
    }
    // the setup card still exists — it is one step in, not replaced
    expect(html).toContain('<main id="setup" class="hide">');
  });

  it('sends each hub card to a table that fits it', () => {
    // solo pre-fills an AI seat, pass & play pre-fills two humans
    expect(html).toMatch(/\$\("#modeSolo"\)\.onclick=[^]*?G\.cfg\[1\]\.ai=true/);
    expect(html).toMatch(/\$\("#modePass"\)\.onclick=[^]*?ai:false[^]*?ai:false/);
    // online goes to the join field, not straight into a local match
    expect(html).toMatch(/\$\("#modeOnline"\)\.onclick=[^]*?wc-code/);
    // the logo is the way home
    expect(html).toMatch(/\$\("#logo"\)\.onclick=[^]*?showHub\(\)/);
  });

  it('keeps an ?online= deep link out of the hub', () => {
    expect(html).toMatch(/has\("online"\)\)\{\s*document\.body\.dataset\.screen="online"/);
  });

  it('upgrades to the tournament lexicon in the background', () => {
    expect(html).toContain('function lexHas(');   // the one lookup everything uses
    expect(html).toContain('function lexFetch('); // the background fetch
    expect(html).toContain('lexicon.txt.gz');
    expect(html).toContain('lexFetch();');        // kicked at boot, not awaited
    // scoring AND the AI both consult it (a word the AI cannot see is a word
    // the player can be beaten by unfairly)
    expect(html).toContain('if(!lexHas(w.word.toLowerCase()))');
    expect(html).toContain('if(lexHas(up+L+dn))s.add(L);');
    expect(html).toContain('if(pl.length&&lexHas(s)&&conn(pl,ext))rec(pl);');
  });

  it('handles a server that already decompressed the .gz', () => {
    // the dev server sends Content-Encoding: gzip, so the body arrives inflated
    // and a second DecompressionStream throws. Sniff the magic bytes instead.
    expect(html).toContain('bytes[0]===0x1f&&bytes[1]===0x8b');
  });

  it('ships the lexicon asset with its provenance', () => {
    const gz = resolve(process.cwd(), 'public', 'arcade', 'word-creator', 'lexicon.txt.gz');
    expect(statSync(gz).size).toBeGreaterThan(300_000); // a real list, not a stub
    const source = readFileSync(
      resolve(process.cwd(), 'public', 'arcade', 'word-creator', 'lexicon-SOURCE.txt'), 'utf8');
    expect(source).toContain('scrabble-dictionary');
    expect(source).toContain('MIT');
  });
});
