// Mafia Noir story layer (public/mafia-story.js): case files, characters,
// last words, the case report, ranks and the case of the day.
//
// The file is plain browser JavaScript. Its first half has no page access and
// publishes itself as `MNStory`; that half is loaded here in a bare sandbox.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('public/mafia-story.js', 'utf8');
const page = readFileSync('public/mafia.html', 'utf8');

interface Career { xp: number; games: number; wins: number; streak: number; best: number; files: Record<string, boolean>; daily: Record<string, { won: boolean }> }
interface CaseFile { id: string; title: string; opening: string[]; found: string[]; clues: string[]; saved: string; town: string; mafia: string; lead: string }
interface Story {
  CASES: CaseFile[];
  PERSONAS: Record<string, { job: string; flavor: string[]; accuse: string }>;
  RANKS: Array<{ name: string; xp: number }>;
  LAST_WORDS: Record<string, string[]>;
  HUMAN_LAST_WORDS: string[];
  rng(seed: number): () => number;
  nextCase(career: Partial<Career> | null, rnd: () => number): CaseFile;
  foundLine(c: CaseFile, rnd: () => number, used?: string[]): string;
  lastWordsFor(role: string, rnd: () => number, alone?: boolean): string;
  sayLines(kind: string, name: string): string[];
  sayStarter(kind: string, name: string): string;
  mafiaSeats(n: number): number;
  todayKey(d?: Date): string;
  dailyDeal(key: string, names: string[]): { key: string; names: string[]; seeds: number[]; roles: string[]; caseId: string };
  buildReport(events: unknown[], players: Array<{ id: number; name: string; role: string }>): Array<{ kind: string; label: string; lines: string[] }>;
  rankFor(xp: number): { index: number; name: string; next: number | null; nextName: string | null; pct: number };
  emptyCareer(): Career;
  cleanCareer(raw: unknown): Career;
  applyResult(career: Career, detail: { winner: string; youRole: string; survived: boolean }, meta?: { caseId?: string; dailyKey?: string | null } | null):
    { career: Career; gained: number; parts: Array<{ label: string; xp: number }>; won: boolean; fileClosed: boolean; rankUp: boolean };
}

const sandbox: { MNStory?: Story } = {};
vm.runInNewContext(source, sandbox); // no `document`: only the plain half runs
const S = sandbox.MNStory as Story;

const AI_NAMES = JSON.parse(page.match(/const AI_NAMES=(\[[^\]]+\])/)![1]) as string[];
const PLAYERS = [
  { id: 0, name: 'You', role: 'detective' }, { id: 1, name: 'Vito', role: 'mafia' },
  { id: 2, name: 'Rosa', role: 'doctor' }, { id: 3, name: 'Sal', role: 'villager' },
];

describe('case files', () => {
  it('six cases, each complete and each with its own id', () => {
    expect(S.CASES).toHaveLength(6);
    expect(new Set(S.CASES.map((c) => c.id)).size).toBe(6);
    for (const c of S.CASES) {
      expect(c.title.length).toBeGreaterThan(8);
      expect(c.opening).toHaveLength(3);
      expect(c.found.length).toBeGreaterThanOrEqual(4);
      expect(c.clues.length).toBeGreaterThanOrEqual(3);
      for (const text of [c.saved, c.town, c.mafia, c.lead, ...c.opening, ...c.clues]) expect(text).toMatch(/[.!?”]$/);
      // a place is finished by the page: "<name> was <place>. <clue>. Their card reads …"
      for (const f of c.found) expect(f).not.toMatch(/[.!?]$/);
    }
  });

  it('are played in order: the first one not yet closed', () => {
    const rnd = S.rng(1);
    expect(S.nextCase(null, rnd).id).toBe('bluenote');
    expect(S.nextCase({ files: { bluenote: true } }, rnd).id).toBe('harbor');
    expect(S.nextCase({ files: { bluenote: true, harbor: true, grand: true, express: true, orpheum: true } }, rnd).id).toBe('ledger');
    const all = Object.fromEntries(S.CASES.map((c) => [c.id, true]));
    expect(S.CASES.map((c) => c.id)).toContain(S.nextCase({ files: all }, rnd).id);
  });

  it('the dawn line does not repeat a place or a clue until all are used', () => {
    const c = S.CASES[0];
    const used: string[] = [];
    const lines = [0, 1, 2].map(() => S.foundLine(c, S.rng(7), used));
    expect(new Set(lines.map((l) => l.split('. ')[0])).size).toBe(3);
    expect(new Set(lines.map((l) => l.split('. ')[1])).size).toBe(3);
    for (const l of lines) expect(l).not.toMatch(/\.$/);
  });
});

describe('characters', () => {
  it('every AI name the game can seat has a job and lines of its own', () => {
    expect(AI_NAMES.length).toBeGreaterThanOrEqual(9);
    for (const name of AI_NAMES) {
      const p = S.PERSONAS[name];
      expect(p, name).toBeTruthy();
      expect(p.job.length).toBeGreaterThan(3);
      expect(p.flavor.length).toBeGreaterThanOrEqual(2);
      expect(p.accuse).toContain('{T}'); // the game puts the accused player's name here
    }
    expect(Object.keys(S.PERSONAS).sort()).toEqual([...AI_NAMES].sort());
  });

  it('last words fit the card: the last Mafia player does not talk about friends', () => {
    const rnd = S.rng(3);
    for (let i = 0; i < 20; i++) {
      expect(S.LAST_WORDS.mafiaLast).toContain(S.lastWordsFor('mafia', rnd, true));
      expect(S.LAST_WORDS.mafia).toContain(S.lastWordsFor('mafia', rnd, false));
      expect(S.LAST_WORDS.doctor).toContain(S.lastWordsFor('doctor', rnd));
    }
    expect(S.LAST_WORDS.villager).toContain(S.lastWordsFor('no-such-role', rnd));
    expect(S.HUMAN_LAST_WORDS.length).toBeGreaterThanOrEqual(3);
  });

  it('sentence prompts carry the name of the player being talked about', () => {
    const accuse = S.sayLines('accuse', 'Rosa');
    expect(accuse.length).toBeGreaterThanOrEqual(3);
    for (const l of [...accuse, ...S.sayLines('defend', 'Rosa')]) {
      expect(l).toContain('Rosa');
      expect(l).not.toContain('{T}');
      expect(l).toMatch(/\.$/);
    }
    expect(S.sayStarter('accuse', 'Rosa')).toBe('I suspect Rosa because ');
    expect(S.sayStarter('defend', 'Rosa')).toBe('I trust Rosa because ');
  });
});

describe('case of the day', () => {
  it('is the same for everyone on the same date and changes with the date', () => {
    const a = S.dailyDeal('2026-11-14', AI_NAMES);
    expect(S.dailyDeal('2026-11-14', AI_NAMES)).toEqual(a);
    const days = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'].map((k) => JSON.stringify(S.dailyDeal(k, AI_NAMES).roles));
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('deals a legal table of eight: the game\'s own number of Mafia, one Detective, one Doctor', () => {
    for (let d = 1; d <= 28; d++) {
      const deal = S.dailyDeal(`2026-02-${String(d).padStart(2, '0')}`, AI_NAMES);
      expect(deal.roles).toHaveLength(8);
      expect(deal.names).toHaveLength(7);
      expect(new Set(deal.names).size).toBe(7);
      for (const n of deal.names) expect(AI_NAMES).toContain(n);
      expect(deal.roles.filter((r) => r === 'mafia')).toHaveLength(2);
      expect(deal.roles.filter((r) => r === 'detective')).toHaveLength(1);
      expect(deal.roles.filter((r) => r === 'doctor')).toHaveLength(1);
      expect(deal.roles.filter((r) => r === 'villager')).toHaveLength(4);
      expect(S.CASES.map((c) => c.id)).toContain(deal.caseId);
    }
  });

  it('counts Mafia seats the way the game does', () => {
    const own = page.match(/function mafiaCount\(n\)\{return ([^}]+)\}/)![1];
    expect(own).toBe('n<=6?1:n<=9?2:3');
    expect([5, 6, 7, 9, 10].map(S.mafiaSeats)).toEqual([1, 1, 2, 2, 3]);
  });

  it('the date key is the local calendar day', () => {
    expect(S.todayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(S.todayKey(new Date(2026, 10, 14, 0, 1))).toBe('2026-11-14');
  });
});

describe('case report', () => {
  it('tells each night and each vote with names and cards', () => {
    const rows = S.buildReport([
      { type: 'night', n: 1, kill: 3, protect: 2, saved: false, inv: { target: 1, isMafia: true } },
      { type: 'vote', n: 1, votes: { 0: 1, 1: 0, 2: 1 }, elim: 1 },
    ], PLAYERS);
    expect(rows.map((r) => r.label)).toEqual(['Night 1', 'Day 1']);
    expect(rows[0].kind).toBe('night');
    expect(rows[0].lines).toEqual(['The Syndicate chose Sal.', 'The Doctor guarded Rosa.', 'The Detective checked Vito: Mafia.', 'Sal (Citizen) was silenced.']);
    expect(rows[1].kind).toBe('day');
    expect(rows[1].lines).toEqual(['Vito — 2 votes (You, Rosa).', 'You — 1 vote (Vito).', 'Vito (Mafia) was voted out.']);
  });

  it('a save, a tie, an abstention — and "you" in plain English', () => {
    const rows = S.buildReport([
      { type: 'night', n: 2, kill: 0, protect: 0, saved: true, inv: null },
      { type: 'vote', n: 2, votes: { 0: null, 1: 2, 2: 1 }, elim: null },
      { type: 'night', n: 3, kill: 0, protect: 2, saved: false, inv: null },
    ], PLAYERS);
    expect(rows[0].lines).toEqual(['The Syndicate chose you.', 'The Doctor guarded you.', 'You were saved. Nobody died.']);
    expect(rows[1].lines).toContain('Did not vote: You.');
    expect(rows[1].lines.at(-1)).toBe('No majority. Nobody was voted out.');
    expect(rows[2].lines.at(-1)).toBe('You (Detective) were silenced.');
    expect(S.buildReport([], PLAYERS)).toEqual([]);
  });
});

describe('ranks and streaks', () => {
  it('rank thresholds rise and the progress bar stays between 0 and 100', () => {
    expect(S.RANKS[0]).toEqual({ name: 'Rookie', xp: 0 });
    for (let i = 1; i < S.RANKS.length; i++) expect(S.RANKS[i].xp).toBeGreaterThan(S.RANKS[i - 1].xp);
    expect(S.rankFor(0)).toMatchObject({ name: 'Rookie', pct: 0, next: 200, nextName: 'Beat Cop' });
    expect(S.rankFor(199).name).toBe('Rookie');
    expect(S.rankFor(200).name).toBe('Beat Cop');
    expect(S.rankFor(350)).toMatchObject({ name: 'Beat Cop', pct: 50 });
    expect(S.rankFor(999999)).toMatchObject({ name: 'Chief Inspector', pct: 100, next: null });
  });

  it('a win, a win while alive, a loss', () => {
    const lost = S.applyResult(S.emptyCareer(), { winner: 'mafia', youRole: 'villager', survived: false });
    expect(lost).toMatchObject({ gained: 20, won: false });
    expect(lost.career).toMatchObject({ xp: 20, games: 1, wins: 0, streak: 0 });
    const dead = S.applyResult(S.emptyCareer(), { winner: 'town', youRole: 'doctor', survived: false });
    expect(dead.gained).toBe(100);
    const alive = S.applyResult(S.emptyCareer(), { winner: 'mafia', youRole: 'mafia', survived: true });
    expect(alive).toMatchObject({ gained: 125, won: true });
  });

  it('a streak pays more each time, up to five, and a loss ends it', () => {
    let c = S.emptyCareer();
    const gains: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = S.applyResult(c, { winner: 'town', youRole: 'villager', survived: false });
      gains.push(r.gained);
      c = r.career;
    }
    expect(gains).toEqual([100, 120, 130, 140, 150, 150, 150]);
    expect(c).toMatchObject({ streak: 7, best: 7, wins: 7 });
    c = S.applyResult(c, { winner: 'mafia', youRole: 'villager', survived: true }).career;
    expect(c).toMatchObject({ streak: 0, best: 7, games: 8 });
  });

  it('a case file closes on a win only, and only once', () => {
    const lost = S.applyResult(S.emptyCareer(), { winner: 'mafia', youRole: 'villager', survived: true }, { caseId: 'bluenote' });
    expect(lost.fileClosed).toBe(false);
    const won = S.applyResult(lost.career, { winner: 'town', youRole: 'villager', survived: true }, { caseId: 'bluenote' });
    expect(won.fileClosed).toBe(true);
    expect(won.career.files).toEqual({ bluenote: true });
    expect(S.applyResult(won.career, { winner: 'town', youRole: 'villager', survived: true }, { caseId: 'bluenote' }).fileClosed).toBe(false);
    expect(S.applyResult(won.career, { winner: 'town', youRole: 'villager', survived: true }, { caseId: 'nope' }).career.files).toEqual({ bluenote: true });
  });

  it('the case of the day pays its bonus once per day', () => {
    const win = { winner: 'town', youRole: 'villager', survived: false };
    const first = S.applyResult(S.emptyCareer(), win, { dailyKey: '2026-11-14' });
    expect(first.parts.map((p) => p.label)).toContain('Case of the day');
    expect(first.gained).toBe(150);
    const again = S.applyResult(first.career, win, { dailyKey: '2026-11-14' });
    expect(again.parts.map((p) => p.label)).not.toContain('Case of the day');
    expect(again.career.daily['2026-11-14']).toEqual({ won: true });
    const lostLater = S.applyResult(again.career, { winner: 'mafia', youRole: 'villager', survived: false }, { dailyKey: '2026-11-14' });
    expect(lostLater.career.daily['2026-11-14']).toEqual({ won: true });
  });

  it('never edits the career it was given, and survives a damaged save', () => {
    const before = S.emptyCareer();
    S.applyResult(before, { winner: 'town', youRole: 'villager', survived: true }, { caseId: 'harbor', dailyKey: '2026-11-14' });
    expect(before).toEqual(S.emptyCareer());
    expect(S.cleanCareer('nonsense')).toEqual(S.emptyCareer());
    expect(S.cleanCareer({ xp: -5, games: 'x', wins: 2.9, files: { bluenote: 1, invented: 1 }, daily: { '2026-11-14': { won: 1 }, bad: {} } }))
      .toEqual({ ...S.emptyCareer(), wins: 2, files: { bluenote: true }, daily: { '2026-11-14': { won: true } } });
  });
});

describe('how the story is wired into the game page', () => {
  it('the page loads the script last and asks it for the two dawn lines', () => {
    expect(page).toContain('<!-- story: case files (patch_mafia_art.py) -->\n<script src="mafia-story.js"></script>\n</body>');
    expect(page.match(/<script src="mafia-story\.js">/g)).toHaveLength(1);
    expect(page).toContain('(window.MNS&&MNS.found())||pick(["found in the alley behind the Blue Note Club"');
    expect(page).toContain('((window.MNS&&MNS.saved())||"A shot rang out — but the Doctor\'s hands were quicker.")');
  });

  it('every game function the script wraps still exists under that name', () => {
    for (const fn of ['startLocal', 'runNight', 'runVote', 'verdict', 'discussion', 'showEndModal', 'aiStatement', 'lineOnce', 'localInfluence', 'fTalk']) {
      expect(page, fn).toMatch(new RegExp(`(?:async )?function ${fn}\\(`));
      expect(source, fn).toMatch(new RegExp(`var _${fn} = ${fn};`));
    }
    // …and the pieces of the page it reads
    for (const needle of ['const L={token:0', 'gameId:0', 'usedLines:new Set()', 'function modalPromise(builder,opts)', 'class="stats-row"', 'class="m-kicker">CASE CLOSED', 'class="mode-grid"', 'const LINES={']) {
      expect(page).toContain(needle);
    }
    expect(page).toContain("new CustomEvent(\"cmcmafia:game\"");
  });

  it('player text is escaped before it reaches the page', () => {
    // what the player types as last words or as their own sentence
    expect(source).toContain("fTalk(p, '\\u201c' + esc(line) + '\\u201d', 'public')");
    expect(source).toContain("var html = esc(said).split(esc(target.name)).join('<b>' + esc(target.name) + '</b>');");
    expect(source).not.toMatch(/innerHTML\s*=\s*said|\+ said \+|\+ line \+/);
  });

  it('does nothing outside the game page', () => {
    expect(source).toContain("if (typeof document === 'undefined' || typeof L === 'undefined' || typeof startLocal !== 'function') return;");
  });
});
