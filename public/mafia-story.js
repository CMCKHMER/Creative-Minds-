/*
 * Mafia Noir — case files, characters, last words, case report, ranks,
 * case of the day and "say it" sentence prompts.
 *
 * Loaded by public/mafia.html after its own scripts. Everything here is an
 * extra: when this file is missing or fails, the game plays exactly as before.
 * It works on the two modes that run on one device (Solo, Pass & Play); the
 * online table has its own engine and only receives the rank panel.
 *
 * Two parts:
 *   1. plain data and functions with no page access (also loaded by the unit
 *      tests in src/tests/mafiaStory.test.ts);
 *   2. the wiring, which wraps a handful of the game's own functions.
 */
(function (root) {
  'use strict';

  /* ══════════════════════════ 1. data and plain functions ═══════════════ */

  /** Six cases, played in this order. Each `lead` points at the next one. */
  var CASES = [
    {
      id: 'bluenote', title: 'The Blue Note Affair',
      opening: [
        'Friday night at the Blue Note Club. The band is still playing when the lights go out.',
        'When they come back on, the owner\u2019s safe is open and his ledger is gone.',
        'Nobody has left the room. Whoever took it is sitting at this table.'
      ],
      found: [
        'found behind the stage at the Blue Note, still holding a ticket stub',
        'left in the alley behind the Blue Note Club',
        'found at the piano, with the lid closed over the keys',
        'last seen walking to the coat room, and never came back'
      ],
      clues: ['A broken saxophone reed lay nearby.', 'Someone had wiped every glass on the bar clean.', 'The back door was locked from the inside.'],
      saved: 'A shot cracked over the music \u2014 but the Doctor was already between the tables.',
      town: 'By morning the ledger is back in the safe and the band plays on. The Blue Note keeps its doors open.',
      mafia: 'The ledger never turns up. On Monday the Blue Note has a new owner, and nobody asks his name.',
      lead: 'One thing is left on the table: a matchbook marked \u201cPier 9, Harbor Street\u201d.'
    },
    {
      id: 'harbor', title: 'The Harbor Street Affair',
      opening: [
        'Pier 9, Harbor Street. A ship with no name unloads its crates at three in the morning.',
        'The night watchman writes down what he sees. By sunrise his notebook has disappeared.',
        'Everyone at this table was on the pier last night. Some of them were working.'
      ],
      found: [
        'found between two crates on Pier 9',
        'left at the end of the pier, where the fog is thickest',
        'found in the watchman\u2019s hut with the lamp still burning',
        'last seen near the ferry, and never came home from the docks'
      ],
      clues: ['The rope beside them had been cut with a sharp knife.', 'Wet footprints led away toward the warehouse.', 'One crate nearby stood open and empty.'],
      saved: 'A shadow moved along the pier \u2014 but the Doctor reached the door first.',
      town: 'The crates are opened in front of the whole city. The ship with no name leaves the harbor empty.',
      mafia: 'The crates are gone before the fog lifts. Harbor Street learns to look the other way.',
      lead: 'In the last crate lies a brass key with a number on it: Room 12, Grand Hotel.'
    },
    {
      id: 'grand', title: 'The Grand Hotel Affair',
      opening: [
        'The Grand Hotel, the finest address in the city. The guest in Room 12 paid for a week in cash.',
        'On the third night his door is open, his bed is made, and his suitcase is missing.',
        'The staff and the guests are called to the dining room. One of them knows where he went.'
      ],
      found: [
        'found in the hotel corridor outside Room 12',
        'left in the service lift between two floors',
        'found in the dining room after the lights were turned down',
        'last seen on the grand staircase, and never reached the lobby'
      ],
      clues: ['The room key was still in their hand.', 'The night bell had been rung once and then stopped.', 'A second cup of coffee on the table was still warm.'],
      saved: 'Footsteps stopped outside a bedroom door \u2014 but the Doctor was waiting on the other side.',
      town: 'The suitcase is found in the cellar, full of papers. The Grand Hotel sends its bill to the Syndicate.',
      mafia: 'Room 12 is cleaned and rented again the next day. The hotel book shows that nobody ever stayed there.',
      lead: 'Inside the suitcase is a single train ticket: the Midnight Express, tonight.'
    },
    {
      id: 'express', title: 'The Midnight Express',
      opening: [
        'The Midnight Express leaves Central Station on time. One hour later it stops in the snow.',
        'A courier in the second carriage was carrying a locked briefcase. Now he is carrying nothing.',
        'The doors stay shut until morning. The thief is still on the train.'
      ],
      found: [
        'found in the last carriage of the Midnight Express',
        'left in the dark space between two carriages',
        'found in the dining car with the blinds pulled down',
        'last seen walking toward the engine, and never came back'
      ],
      clues: ['Their ticket had been punched twice.', 'Snow had blown in through an open window.', 'The conductor\u2019s lamp lay broken on the floor.'],
      saved: 'A door slid open in the night \u2014 but the Doctor had changed seats an hour before.',
      town: 'When the train reaches the next station, the police are on the platform and the briefcase is in good hands.',
      mafia: 'When the train reaches the next station, one passenger steps off early with a briefcase under his coat.',
      lead: 'Inside the briefcase is a theatre programme. Tomorrow night: the Orpheum.'
    },
    {
      id: 'orpheum', title: 'The Orpheum Job',
      opening: [
        'Opening night at the Orpheum Theatre. Every seat is sold and the box office is full of money.',
        'During the second act the money leaves the building. The audience does not notice.',
        'After the last bow, the doors are locked. The actors, the crew and the guests sit down together.'
      ],
      found: [
        'found under the stage of the Orpheum',
        'left in the empty balcony after the lights went up',
        'found in a dressing room with the mirror lights still on',
        'last seen behind the curtain, and never took a bow'
      ],
      clues: ['A page of the script was folded in their pocket.', 'The stage door was open to the rain.', 'Someone had moved the rope that lifts the curtain.'],
      saved: 'Someone waited in the wings with a steady hand \u2014 but the Doctor stood closer.',
      town: 'The money is found inside the piano. The Orpheum opens again on Saturday, to a full house.',
      mafia: 'The money is never found. The Orpheum closes within the month, and the Syndicate buys the building.',
      lead: 'Under the box-office drawer is a receipt with an official stamp: City Hall, Records Office.'
    },
    {
      id: 'ledger', title: 'The City Hall Ledger',
      opening: [
        'City Hall, the Records Office. One book lists every payment the Syndicate has ever made.',
        'Tonight a page has been torn out of it \u2014 the page with the name at the very top.',
        'The clerks, the guards and the visitors are kept in the building. This is the last case in the file.'
      ],
      found: [
        'found between the shelves of the Records Office',
        'left on the marble stairs of City Hall',
        'found in the council chamber, in the mayor\u2019s own chair',
        'last seen entering the archive, and never signed out'
      ],
      clues: ['Ink was still wet on the desk beside them.', 'The torn edge of a page was caught in the drawer.', 'The clock in the hall had been stopped at midnight.'],
      saved: 'A drawer closed quietly in the dark \u2014 but the Doctor had kept a light on.',
      town: 'The missing page is read aloud on the steps of City Hall. By evening the Syndicate has no secrets left.',
      mafia: 'The missing page burns in an ashtray. The ledger goes back on the shelf, and the city never learns the name.',
      lead: 'That was the last page of the file. Every case is closed \u2014 until the next rainy night.'
    }
  ];

  /** The AI seats. Keys are the game's AI names. `accuse` lines keep {T}. */
  var PERSONAS = {
    Vito: { job: 'dock foreman', flavor: ['Thirty men work for me on the pier. I know when one of them is hiding something.', 'On the docks we have a rule: you see nothing, you say nothing. I am tired of that rule.'], accuse: 'I count crates for a living, and the numbers on {T} do not add up.' },
    Rosa: { job: 'club singer', flavor: ['I sing to a hundred faces every night. I remember the ones who do not clap.', 'A song can lie beautifully. So can some people at this table.'], accuse: 'I watched {T} from the stage. They left before the last song, every night this week.' },
    Sal: { job: 'barber', flavor: ['Twenty years of cutting hair. People tell a barber everything \u2014 except the truth.', 'A steady hand with a razor proves nothing. Ask me something harder.'], accuse: '{T} sat in my chair on Tuesday and could not look in the mirror.' },
    Marlowe: { job: 'night reporter', flavor: ['I write down what people say, and then what they do. The two lists never match.', 'Tomorrow\u2019s headline is being decided at this table. I would like to survive to print it.'], accuse: 'I checked the story {T} told us. The times are wrong by a full hour.' },
    Vera: { job: 'hotel clerk', flavor: ['I see who comes in, who goes out, and who uses the back stairs.', 'A guest book is full of false names. I have learned to read faces instead.'], accuse: '{T} asked me for a second key last night. Nobody needs a second key.' },
    Dutch: { job: 'cab driver', flavor: ['People forget the driver can hear every word from the back seat.', 'I drove half of you home last night. Not all of you went home.'], accuse: 'I drove {T} across the river after midnight. They paid me double to forget it.' },
    Pearl: { job: 'coat-check girl', flavor: ['You can learn a lot from what a person keeps in their coat pockets.', 'Everybody hands me something they want to keep safe. Nobody hands me the truth.'], accuse: '{T} left a coat with me and never came back for it. Who walks out into the rain without a coat?' },
    Enzo: { job: 'baker', flavor: ['I start work at four in the morning. I see who is still awake in this city.', 'Bread is honest: flour, water, salt and time. People are more difficult.'], accuse: 'At four this morning I saw {T} cross the square. They were not buying bread.' },
    Ruby: { job: 'telephone operator', flavor: ['I connect every call in this city. Some lines went very quiet last night.', 'I am not supposed to listen. I am also not supposed to be in danger.'], accuse: '{T} made three calls last night and hung up each time I came on the line.' },
    Niko: { job: 'newsstand owner', flavor: ['I sell the news, so I read all of it. Today\u2019s paper is missing a story.', 'My stand is on the corner. From there you can see four streets and every mistake.'], accuse: '{T} bought every copy of the evening paper. Nobody reads that much.' },
    Lana: { job: 'seamstress', flavor: ['I know every coat in this city. One of them came back to my shop with a torn sleeve.', 'A good stitch hides the place where two pieces join. So does a good lie.'], accuse: 'I mended a sleeve for {T} this morning. They would not say how it was torn.' },
    Otto: { job: 'watchmaker', flavor: ['Every watch tells the time. Only a few people tell the truth about it.', 'I repair small, hidden things all day. I notice when something does not fit.'], accuse: '{T} told us it was ten o\u2019clock. Their own watch had stopped at nine.' },
    Celeste: { job: 'pianist', flavor: ['A wrong note is easy to hear when everyone else is playing in tune.', 'I play with my back to the room, so I have learned to listen very carefully.'], accuse: 'I heard {T} leave during my last song. The door closes with a sound I know well.' },
    Bruno: { job: 'boxing coach', flavor: ['In the ring a man looks where he plans to hit. Watch the eyes at this table.', 'I teach fighters to stay calm. Somebody here is a little too calm.'], accuse: '{T} keeps their hands under the table. In my gym that means something.' },
    Mae: { job: 'diner waitress', flavor: ['The night shift at the diner sees everything: who is hungry, who is nervous, who cannot eat.', 'I pour coffee until sunrise. People talk when they think you are only the waitress.'], accuse: '{T} ordered breakfast at two in the morning and left it on the plate.' },
    Ike: { job: 'tram conductor', flavor: ['Same route, same faces, every night. I notice when a regular changes seats.', 'I punch a hundred tickets a night, so I remember who was not on the last tram.'], accuse: '{T} got off the tram two stops early last night, and looked behind them the whole way.' }
  };

  /** What an AI player says before the card is turned, by their real role. */
  var LAST_WORDS = {
    mafia: ['You got lucky tonight. My friends are still sitting at this table.', 'Well played. It will not save the rest of you.', 'One of us is gone. Count how many are left \u2014 if you can.'],
    mafiaLast: ['So you found me. The city is yours \u2014 this time.', 'I was the last one. Enjoy the sunrise.', 'Well played, all of you. I have nothing left to hide.'],
    detective: ['I carried the badge. Remember what I told you, and trust your own eyes.', 'You have voted out the only person who was looking for the truth.', 'My notebook is in my coat. I hope one of you can read it in time.'],
    doctor: ['You have just voted out your own Doctor. Guard your doors tonight.', 'I am the Doctor. Tonight nobody will be standing at your door.', 'I carried a medical bag, not a gun. Remember that when night falls.'],
    villager: ['You have the wrong person. Keep looking \u2014 for me.', 'I was on your side from the first night. Find them.', 'I hope you remember this when the next door opens at night.']
  };

  /** Ready-made lines a human player can choose as last words. */
  var HUMAN_LAST_WORDS = [
    'I am innocent. You are making a mistake.',
    'Remember who voted for me. The answer is in that list.',
    'Do not trust the person who spoke first today.'
  ];

  /** Sentence starters for the two influence actions. {T} = the player named. */
  var SAY = {
    accuse: [
      'I suspect {T} because they have been too quiet today.',
      'I think {T} is lying. Their story keeps changing.',
      'In my opinion, {T} voted to protect the Syndicate.',
      'I do not trust {T}. They accuse other people without giving a reason.'
    ],
    defend: [
      'I trust {T} because their story has stayed the same.',
      'I believe {T} is innocent. They have helped the city every day.',
      'In my opinion, we should leave {T} alone and look somewhere else.'
    ],
    starter: { accuse: 'I suspect {T} because ', defend: 'I trust {T} because ' }
  };

  /** Ranks, lowest first. `xp` is the points needed to hold the rank. */
  var RANKS = [
    { name: 'Rookie', xp: 0 },
    { name: 'Beat Cop', xp: 200 },
    { name: 'Detective', xp: 500 },
    { name: 'Inspector', xp: 1000 },
    { name: 'Captain', xp: 1800 },
    { name: 'Chief Inspector', xp: 3000 }
  ];

  var ROLE_NAMES = { mafia: 'Mafia', detective: 'Detective', doctor: 'Doctor', villager: 'Citizen' };

  /** Small seeded generator (mulberry32): same seed, same sequence. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(text) {
    var h = 2166136261, s = String(text);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function shuffled(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickFrom(list, rnd) { return list[Math.floor(rnd() * list.length)]; }

  function caseById(id) {
    for (var i = 0; i < CASES.length; i++) if (CASES[i].id === id) return CASES[i];
    return null;
  }

  /** The first case this player has not closed yet; any case once all are. */
  function nextCase(career, rnd) {
    var files = (career && career.files) || {};
    for (var i = 0; i < CASES.length; i++) if (!files[CASES[i].id]) return CASES[i];
    return pickFrom(CASES, rnd);
  }

  function caseNumber(seed) { return 100 + (seed >>> 0) % 900; }

  /**
   * "found behind the stage …. A broken reed lay nearby" — no final full stop.
   * `used` (optional array) remembers what was said, so a place or a clue
   * comes back only after every other one has been used.
   */
  function foundLine(c, rnd, used) {
    var fresh = function (list) {
      var f = list.filter(function (x) { return !used || used.indexOf(x) < 0; });
      var one = pickFrom(f.length ? f : list, rnd);
      if (used) used.push(one);
      return one;
    };
    var place = fresh(c.found), clue = fresh(c.clues);
    return place + '. ' + clue.replace(/\.$/, '');
  }

  /** `alone` = no other Mafia player is still alive (only matters for Mafia). */
  function lastWordsFor(role, rnd, alone) {
    var key = role === 'mafia' && alone ? 'mafiaLast' : role;
    return pickFrom(LAST_WORDS[key] || LAST_WORDS.villager, rnd);
  }

  function sayLines(kind, name) {
    return (SAY[kind] || SAY.accuse).map(function (l) { return l.split('{T}').join(name); });
  }

  function sayStarter(kind, name) { return (SAY.starter[kind] || SAY.starter.accuse).split('{T}').join(name); }

  /** Mafia seats for a table of n — the game's own rule. */
  function mafiaSeats(n) { return n <= 6 ? 1 : n <= 9 ? 2 : 3; }

  function todayKey(date) {
    var d = date || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /**
   * The case of the day: a table of 8 that is the same for everyone who opens
   * it on the same date — the same seven strangers, the same card for every
   * seat (seat 0 is the player) and the same case.
   */
  function dailyDeal(key, aiNames) {
    var rnd = rng(hashStr('mafia-noir-daily:' + key));
    var names = shuffled(aiNames, rnd).slice(0, 7);
    var seeds = names.map(function () { return 2 + Math.floor(rnd() * 9997); });
    var m = mafiaSeats(8);
    var roles = [];
    for (var i = 0; i < m; i++) roles.push('mafia');
    roles.push('detective', 'doctor');
    while (roles.length < 8) roles.push('villager');
    roles = shuffled(roles, rnd);
    return { key: key, names: names, seeds: seeds, roles: roles, caseId: pickFrom(CASES, rnd).id };
  }

  /**
   * The case told night by night. `events` are the records the wiring keeps:
   *   { type:'night', n, kill, protect, saved, inv:{target,isMafia}|null }
   *   { type:'vote',  n, votes:{voterId: targetId|null}, elim }
   * `players` = [{ id, name, role }]. Returns [{ kind, label, lines:[text] }].
   */
  function buildReport(events, players) {
    var by = {};
    players.forEach(function (p) { by[String(p.id)] = p; });
    var name = function (id) { var p = by[String(id)]; return p ? p.name : 'Someone'; };
    // a solo player is seated as "You": "the Doctor guarded you", "You were saved"
    var obj = function (id) { var n = name(id); return n === 'You' ? 'you' : n; };
    var was = function (id) { return name(id) === 'You' ? ' were ' : ' was '; };
    var role = function (id) { var p = by[String(id)]; return p ? (ROLE_NAMES[p.role] || p.role) : ''; };
    var out = [];
    (events || []).forEach(function (e) {
      var lines = [];
      if (e.type === 'night') {
        if (e.kill != null) lines.push('The Syndicate chose ' + obj(e.kill) + '.');
        if (e.protect != null) lines.push('The Doctor guarded ' + obj(e.protect) + '.');
        if (e.inv) lines.push('The Detective checked ' + obj(e.inv.target) + ': ' + (e.inv.isMafia ? 'Mafia.' : 'innocent.'));
        if (e.kill != null) lines.push(e.saved ? name(e.kill) + was(e.kill) + 'saved. Nobody died.' : name(e.kill) + ' (' + role(e.kill) + ')' + was(e.kill) + 'silenced.');
        out.push({ kind: 'night', label: 'Night ' + e.n, lines: lines });
      } else if (e.type === 'vote') {
        var tally = {}, abstained = [];
        Object.keys(e.votes || {}).forEach(function (voter) {
          var t = e.votes[voter];
          if (t == null) abstained.push(name(voter));
          else (tally[t] = tally[t] || []).push(name(voter));
        });
        Object.keys(tally).sort(function (a, b) { return tally[b].length - tally[a].length; }).forEach(function (t) {
          var n = tally[t].length;
          lines.push(name(t) + ' \u2014 ' + n + (n === 1 ? ' vote' : ' votes') + ' (' + tally[t].join(', ') + ').');
        });
        if (abstained.length) lines.push('Did not vote: ' + abstained.join(', ') + '.');
        lines.push(e.elim == null ? 'No majority. Nobody was voted out.' : name(e.elim) + ' (' + role(e.elim) + ')' + was(e.elim) + 'voted out.');
        out.push({ kind: 'day', label: 'Day ' + e.n, lines: lines });
      }
    });
    return out;
  }

  function rankFor(xp) {
    var i = 0;
    for (var k = 0; k < RANKS.length; k++) if (xp >= RANKS[k].xp) i = k;
    var next = RANKS[i + 1] || null;
    var floor = RANKS[i].xp;
    return {
      index: i, name: RANKS[i].name, floor: floor,
      next: next ? next.xp : null, nextName: next ? next.name : null,
      pct: next ? Math.max(0, Math.min(100, Math.round((xp - floor) / (next.xp - floor) * 100))) : 100
    };
  }

  function teamWon(detail) { return (detail.youRole === 'mafia') === (detail.winner === 'mafia'); }

  function emptyCareer() { return { xp: 0, games: 0, wins: 0, streak: 0, best: 0, files: {}, daily: {} }; }

  function cleanCareer(raw) {
    var c = emptyCareer();
    if (!raw || typeof raw !== 'object') return c;
    ['xp', 'games', 'wins', 'streak', 'best'].forEach(function (k) {
      var v = Number(raw[k]);
      if (isFinite(v) && v >= 0) c[k] = Math.floor(v);
    });
    if (raw.files && typeof raw.files === 'object') Object.keys(raw.files).forEach(function (id) { if (caseById(id) && raw.files[id]) c.files[id] = true; });
    if (raw.daily && typeof raw.daily === 'object') Object.keys(raw.daily).slice(-40).forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(k)) c.daily[k] = { won: !!(raw.daily[k] && raw.daily[k].won) }; });
    return c;
  }

  /**
   * One finished game added to a career. `detail` is what the game announces
   * (winner, youRole, survived); `meta` = { caseId, dailyKey } when known.
   * Win 100, +25 if you also lived to see it, loss 20; the case of the day
   * gives +50 the first time it is won. Returns a new career, never edits.
   */
  function applyResult(career, detail, meta) {
    var c = cleanCareer(career), m = meta || {};
    var before = rankFor(c.xp);
    var won = teamWon(detail);
    var parts = [];
    if (won) { parts.push({ label: 'Your side won', xp: 100 }); if (detail.survived) parts.push({ label: 'You survived', xp: 25 }); }
    else parts.push({ label: 'Case played', xp: 20 });
    c.games++;
    if (won) { c.wins++; c.streak++; if (c.streak > c.best) c.best = c.streak; } else c.streak = 0;
    if (won && c.streak >= 2) parts.push({ label: c.streak + ' wins in a row', xp: 10 * Math.min(c.streak, 5) });
    var fileClosed = false;
    if (won && m.caseId && caseById(m.caseId) && !c.files[m.caseId]) { c.files[m.caseId] = true; fileClosed = true; }
    if (m.dailyKey) {
      var had = c.daily[m.dailyKey];
      if (won && !(had && had.won)) parts.push({ label: 'Case of the day', xp: 50 });
      c.daily[m.dailyKey] = { won: won || !!(had && had.won) };
    }
    var gained = parts.reduce(function (s, p) { return s + p.xp; }, 0);
    c.xp += gained;
    var after = rankFor(c.xp);
    return { career: c, gained: gained, parts: parts, won: won, fileClosed: fileClosed, rankUp: after.index > before.index, rank: after };
  }

  var api = {
    CASES: CASES, PERSONAS: PERSONAS, RANKS: RANKS, LAST_WORDS: LAST_WORDS, HUMAN_LAST_WORDS: HUMAN_LAST_WORDS, SAY: SAY,
    rng: rng, hashStr: hashStr, shuffled: shuffled, caseById: caseById, nextCase: nextCase, caseNumber: caseNumber,
    foundLine: foundLine, lastWordsFor: lastWordsFor, sayLines: sayLines, sayStarter: sayStarter, mafiaSeats: mafiaSeats,
    todayKey: todayKey, dailyDeal: dailyDeal, buildReport: buildReport, rankFor: rankFor, teamWon: teamWon,
    emptyCareer: emptyCareer, cleanCareer: cleanCareer, applyResult: applyResult
  };
  root.MNStory = api;

  /* ══════════════════════════ 2. wiring into the game ═══════════════════ */

  /* global L, app, $, esc, pick, AU, fSys, fDivider, fTalk:writable, showBanner, byId, alive, humansAlive, ok, wait,
     modalPromise, ROLE, AI_NAMES, D, applyAccuse, askLocalTarget, setLocalRender, initAI, toast, LINES, render,
     startLocal:writable, runNight:writable, runVote:writable, verdict:writable, discussion:writable, showEndModal:writable,
     aiStatement:writable, lineOnce:writable, localInfluence:writable */
  if (typeof document === 'undefined' || typeof L === 'undefined' || typeof startLocal !== 'function') return;

  var KEY = 'mnCareer';
  var S = { game: null, nextDaily: null, speaker: null, saying: null, counted: {} };
  try { (JSON.parse(localStorage.getItem('mnCounted') || '[]') || []).forEach(function (id) { S.counted[id] = true; }); } catch (e) { /* start clean */ }

  function loadCareer() { try { return cleanCareer(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return emptyCareer(); } }
  function saveCareer(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* private mode: the rank lasts for this visit */ } }
  var career = loadCareer();

  var style = document.createElement('style');
  style.textContent = [
    '.mns-desk{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px auto 0;max-width:980px}',
    '.mns-card{position:relative;border:1px solid var(--line);border-radius:14px;padding:16px 18px;background:rgba(20,26,51,.6);text-align:left;color:var(--cream)}',
    '.mns-card h2{font-family:var(--ui);font-size:10px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;margin:0 0 8px}',
    '.mns-rank{font-family:var(--disp);font-size:22px;color:var(--gold2);line-height:1.1}',
    '.mns-bar{height:6px;border-radius:99px;background:rgba(232,182,76,.14);overflow:hidden;margin:9px 0 7px}',
    '.mns-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:99px;transition:width .8s ease}',
    '.mns-note{font-family:var(--type);font-size:11px;color:var(--muted);line-height:1.6}',
    '.mns-files{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}',
    '.mns-files span{font-size:9px;font-weight:700;letter-spacing:1px;padding:3px 7px;border-radius:99px;border:1px dashed rgba(141,150,184,.4);color:var(--muted);text-transform:uppercase}',
    '.mns-files span.done{border:1px solid var(--gold);color:var(--gold2);background:rgba(232,182,76,.08)}',
    '.mns-files span.next{border-style:solid;color:var(--cream2)}',
    'button.mns-card{cursor:pointer;display:block;width:100%;transition:.2s}button.mns-card:hover{border-color:var(--gold);transform:translateY(-2px)}',
    '.mns-daily-title{font-family:var(--disp);font-size:19px;color:var(--cream);line-height:1.2}',
    '.mns-go{display:inline-block;margin-top:9px;font-size:10px;font-weight:700;letter-spacing:2px;color:var(--gold2)}',
    '.mns-job{font-family:var(--type);font-weight:400;letter-spacing:.3px;text-transform:none;color:var(--muted);margin-left:6px;font-size:10px}',
    '.msg.mns-story{font-family:var(--type);font-size:12.5px;color:var(--cream2);line-height:1.65;padding:3px 8px;text-align:left;border-left:2px solid rgba(232,182,76,.45);margin:2px 4px}',
    '.msg.mns-cast{font-family:var(--type);font-size:11px;color:var(--muted);line-height:1.7;padding:2px 8px;text-align:left}',
    '.msg.mns-cast b{color:var(--cream2);font-weight:400}',
    '.mns-epi{margin-top:8px!important;font-style:italic}',
    '.mns-lead{margin-top:6px!important;color:var(--gold2)!important}',
    '.mns-report{text-align:left;margin:4px 0 20px;border:1px solid rgba(232,182,76,.16);border-radius:12px;padding:14px 16px;background:rgba(10,13,24,.45)}',
    '.mns-report h3,.mns-career h3{font-family:var(--ui);font-size:10px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;margin:0 0 10px}',
    '.mns-row{display:grid;grid-template-columns:74px 1fr;gap:10px;padding:8px 0;border-top:1px solid rgba(232,182,76,.1)}.mns-row:first-of-type{border-top:0}',
    '.mns-row b{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--blue2);padding-top:2px}.mns-row.day b{color:var(--gold2)}',
    '.mns-row span{font-family:var(--type);font-size:12px;color:var(--cream2);line-height:1.65}',
    '.mns-career{margin:18px auto 0;max-width:460px;border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:rgba(232,182,76,.05);text-align:left}',
    '.mns-career .mns-gain{font-family:var(--disp);font-size:20px;color:var(--gold2)}',
    '.mns-career ul{list-style:none;margin:6px 0 0;padding:0;font-family:var(--type);font-size:11.5px;color:var(--cream2);line-height:1.7}',
    '.mns-career li b{color:var(--gold2);font-weight:400}',
    '.mns-up{display:inline-block;margin-left:8px;font-size:9px;font-weight:700;letter-spacing:1.6px;padding:3px 8px;border-radius:99px;background:var(--gold);color:#241a05;vertical-align:middle}',
    '.mns-say{display:flex;flex-direction:column;gap:8px;margin:14px 0 4px}',
    '.mns-say button{font-family:var(--type);font-size:13px;line-height:1.5;text-align:left;color:var(--cream);padding:11px 13px;border:1px solid var(--line);border-radius:10px;background:rgba(10,13,24,.5);cursor:pointer;transition:.15s}',
    '.mns-say button:hover,.mns-say button:focus-visible{border-color:var(--gold);background:rgba(232,182,76,.1)}',
    '.mns-own{display:flex;gap:8px;margin-top:10px}',
    '.mns-own input{flex:1;min-width:0;background:rgba(10,13,24,.65);border:1px solid var(--line);border-radius:9px;color:var(--cream);padding:11px;font-family:var(--type);font-size:13px}',
    '.mns-own input:focus{outline:none;border-color:var(--gold)}',
    '.mns-label{display:block;text-align:left;font-size:9px;font-weight:700;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-top:14px}',
    '@media(max-width:700px){.mns-desk{grid-template-columns:1fr}.mns-row{grid-template-columns:1fr;gap:2px}.mns-own{flex-direction:column}}'
  ].join('\n');
  document.head.appendChild(style);

  function story(text, cls) {
    var d = document.createElement('div');
    d.className = 'msg ' + (cls || 'mns-story');
    d.innerHTML = text;
    var f = $('#feed');
    f.appendChild(d);
    if (f.scrollHeight - f.scrollTop - f.clientHeight < 240) f.scrollTop = f.scrollHeight;
  }

  function persona(p) { return p && !p.human ? PERSONAS[p.name] || null : null; }

  /* ── the case desk on the hub: rank, files, case of the day ─────────── */
  function dailyLabel(key) {
    var d = new Date(key + 'T12:00:00');
    return d.getDate() + ' ' + ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  }

  function renderDesk() {
    var hub = $('#hub'), grid = hub && hub.querySelector('.mode-grid');
    if (!grid) return;
    var desk = $('#mnsDesk');
    if (!desk) {
      desk = document.createElement('div');
      desk.id = 'mnsDesk';
      desk.className = 'mns-desk';
      grid.insertAdjacentElement('afterend', desk);
    }
    var r = rankFor(career.xp), key = todayKey(), deal = dailyDeal(key, AI_NAMES), c = caseById(deal.caseId), done = career.daily[key];
    var nextId = nextCase(career, Math.random).id, closed = CASES.filter(function (x) { return career.files[x.id]; }).length;
    desk.innerHTML =
      '<div class="mns-card" id="mnsRank"><h2>Your badge</h2>' +
        '<div class="mns-rank">' + esc(r.name) + '</div>' +
        '<div class="mns-bar" role="img" aria-label="' + r.pct + '% of the way to the next rank"><i style="width:' + r.pct + '%"></i></div>' +
        '<div class="mns-note">' + career.xp + ' points' + (r.next ? ' \u00b7 ' + (r.next - career.xp) + ' more to ' + esc(r.nextName) : ' \u00b7 the highest rank') +
          '<br>' + career.games + (career.games === 1 ? ' case' : ' cases') + ' played \u00b7 ' + career.wins + ' won \u00b7 ' + career.streak + ' in a row</div>' +
        '<div class="mns-files" aria-label="Case files closed: ' + closed + ' of ' + CASES.length + '">' +
          CASES.map(function (x, i) { var cls = career.files[x.id] ? 'done' : (closed < CASES.length && x.id === nextId ? 'next' : ''); return '<span class="' + cls + '" title="' + esc(x.title) + '">' + (career.files[x.id] ? '\u2713 ' : '') + 'File ' + (i + 1) + '</span>'; }).join('') +
        '</div></div>' +
      '<button type="button" class="mns-card" id="mnsDaily"><h2>Case of the day \u00b7 ' + dailyLabel(key) + '</h2>' +
        '<div class="mns-daily-title">' + esc(c.title) + '</div>' +
        '<div class="mns-note" style="margin-top:6px">The same table, the same cards and the same case for everyone who plays today. Eight seats, solo.</div>' +
        '<span class="mns-go">' + (done ? (done.won ? '\u2713 SOLVED \u2014 PLAY AGAIN \u2192' : 'NOT SOLVED YET \u2014 TRY AGAIN \u2192') : 'OPEN TODAY\u2019S CASE \u2192') + '</span></button>';
    $('#mnsDaily').onclick = startDaily;
  }

  /** The first name from the identity card, when the player has given one. */
  function playerName() {
    var n = '';
    try { n = (JSON.parse(localStorage.getItem('cmc-player-name') || 'null') || {}).name || ''; } catch (e) { /* no saved name */ }
    n = String(n || ($('#cmcNameIn') || {}).value || '').trim().split(/\s+/)[0] || '';
    return n.slice(0, 14) || 'You';
  }

  function startDaily() {
    var deal = dailyDeal(todayKey(), AI_NAMES);
    AU.init(); AU.deal();
    app.localKind = 'solo';
    L.roster = [{ name: playerName(), human: true, seed: 11 }].concat(deal.names.map(function (n, i) { return { name: n, human: false, seed: deal.seeds[i] }; }));
    L.diff = 1;
    S.nextDaily = deal;
    startLocal();
  }

  /* ── a case begins ──────────────────────────────────────────────────── */
  var _startLocal = startLocal;
  startLocal = function () {
    var daily = S.nextDaily;
    S.nextDaily = null;
    S.game = null;
    _startLocal();
    try { beginCase(daily); } catch (e) { S.game = null; }
  };

  function beginCase(daily) {
    if (daily && L.players.length === daily.roles.length) {
      // the same card for every seat, for everyone who plays today
      L.players.forEach(function (p, i) { p.role = daily.roles[i]; });
      initAI();
      setLocalRender();
    } else daily = null;
    var c = daily ? caseById(daily.caseId) : nextCase(career, Math.random);
    var no = caseNumber(daily ? hashStr(daily.key) : Math.floor(Math.random() * 1e9));
    var fileNo = CASES.indexOf(c) + 1;
    S.game = { gameId: L.gameId, c: c, no: no, daily: daily ? daily.key : null, events: [], usedFound: [] };
    var feed = $('#feed'), had = feed.children.length;
    fDivider('CASE No. ' + no);
    fSys('<b style="color:var(--gold2)">' + esc(c.title) + '</b>' + (daily ? ' \u00b7 case of the day' : ' \u00b7 file ' + fileNo + ' of ' + CASES.length), true);
    c.opening.forEach(function (line) { story(esc(line)); });
    var cast = L.players.filter(function (p) { return persona(p); }).map(function (p) { return '<b>' + esc(p.name) + '</b>, ' + esc(persona(p).job); });
    if (cast.length) story('At the table: ' + cast.join(' \u00b7 ') + '.', 'mns-cast');
    // the case comes first, the game's own prologue after it
    var mine = Array.prototype.slice.call(feed.children, had);
    for (var i = mine.length - 1; i >= 0; i--) feed.insertBefore(mine[i], feed.firstChild);
    feed.scrollTop = 0;
    showBanner(c.title.toUpperCase(), 'Case No. ' + no + (daily ? ' \u00b7 case of the day' : ' \u00b7 file ' + fileNo + ' of ' + CASES.length));
  }

  function live() { return S.game && S.game.gameId === L.gameId ? S.game : null; }

  /* ── dawn: where the victim was found / how the Doctor got there first.
        Both are asked for by the page's own dawn line, which keeps its old
        wording whenever these return nothing. ─────────────────────────── */
  function found() {
    var g = live();
    return g ? foundLine(g.c, Math.random, g.usedFound) : null;
  }
  function saved() {
    var g = live();
    return g ? esc(g.c.saved) : null;
  }

  /* ── the night and the vote, written down for the case report ───────── */
  var _runNight = runNight;
  runNight = async function () {
    var tok = L.token, g = live();
    var det = L.players.find(function (p) { return p.role === 'detective' && p.alive; });
    var before = det ? Object.assign({}, det.known) : null;
    var res = await _runNight();
    if (!ok(tok) || !g) return res;
    var inv = null;
    if (det) Object.keys(det.known).forEach(function (id) { if (before[id] === undefined) inv = { target: +id, isMafia: !!det.known[id] }; });
    g.events.push({ type: 'night', n: L.night, kill: L.kill, protect: L.protect, saved: !!(res && res.saved), inv: inv });
    return res;
  };

  var _runVote = runVote;
  runVote = async function () {
    var tok = L.token, g = live();
    var out = await _runVote();
    if (ok(tok) && g && out) g.events.push({ type: 'vote', n: L.night, votes: Object.assign({}, L.votes), elim: out.elim });
    return out;
  };

  /* ── last words, before the card is turned ──────────────────────────── */
  var _verdict = verdict;
  verdict = async function (out) {
    var g = live();
    if (g && out && out.elim != null) {
      var tok = L.token, p = byId(out.elim);
      try { if (p) await lastWords(p); } catch (e) { /* the verdict goes ahead */ }
      if (!ok(tok)) return;
    }
    return _verdict(out);
  };

  async function lastWords(p) {
    var tok = L.token;
    await wait(500);
    if (!ok(tok)) return;
    fSys('The table has decided. <b>' + esc(p.name) + '</b> may speak one last time.');
    var line;
    if (p.human) {
      line = await modalPromise(function (box, done) {
        box.innerHTML = '<div class="m-kicker">' + esc(p.name) + ' \u2014 THE VOTE IS AGAINST YOU</div><div class="m-title">Your last words</div>' +
          '<p class="m-sub">Your card is turned over after you speak. Choose a sentence, or write your own.</p>' +
          '<div class="mns-say">' + HUMAN_LAST_WORDS.map(function (l, i) { return '<button type="button" data-i="' + i + '">\u201c' + esc(l) + '\u201d</button>'; }).join('') + '</div>' +
          '<label class="mns-label" for="mnsLast">Or in your own words</label>' +
          '<div class="mns-own"><input id="mnsLast" type="text" maxlength="90" placeholder="I want to say\u2026" autocomplete="off"><button type="button" class="btn line sm" id="mnsLastGo">SAY IT</button></div>' +
          '<div class="m-actions"><button type="button" class="btn dim" id="mnsLastSkip">SAY NOTHING</button></div>';
        box.querySelectorAll('.mns-say button').forEach(function (b) { b.onclick = function () { done(HUMAN_LAST_WORDS[+b.dataset.i]); }; });
        var own = function () { var v = box.querySelector('#mnsLast').value.trim(); if (v) done(v); };
        box.querySelector('#mnsLastGo').onclick = own;
        box.querySelector('#mnsLast').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); own(); } };
        box.querySelector('#mnsLastSkip').onclick = function () { done(''); };
      }, { critical: true });
      if (!ok(tok)) return;
    } else {
      line = lastWordsFor(p.role, Math.random, !L.players.some(function (q) { return q.alive && q.role === 'mafia' && q.id !== p.id; }));
    }
    if (line) {
      fTalk(p, '\u201c' + esc(line) + '\u201d', 'public');
      var b = $('#feed').lastElementChild;
      if (b) b.classList.add('mns-lastwords');
      await wait(p.human ? 900 : 1900);
    } else {
      fSys('<b>' + esc(p.name) + '</b> says nothing.');
      await wait(600);
    }
  }

  /* ── characters: a job beside the name, and lines of their own ──────── */
  var _fTalk = fTalk;
  fTalk = function (p, t, channel) {
    _fTalk(p, t, channel);
    try {
      var per = app.mode === 'local' && live() ? persona(byId(p.id)) : null;
      if (!per) return;
      var name = $('#feed').lastElementChild && $('#feed').lastElementChild.querySelector('.bname');
      if (name && !name.querySelector('.mns-job')) name.insertAdjacentHTML('beforeend', '<span class="mns-job">' + esc(per.job) + '</span>');
    } catch (e) { /* the line is already in the feed */ }
  };

  var _aiStatement = aiStatement;
  aiStatement = function (p) {
    S.speaker = p;
    try { return _aiStatement(p); } finally { S.speaker = null; }
  };

  var _lineOnce = lineOnce;
  lineOnce = function (pool) {
    var per = live() ? persona(S.speaker) : null;
    if (per) {
      var own = pool === LINES.flavor ? per.flavor : pool === LINES.accuse ? [per.accuse] : null;
      if (own) {
        var fresh = own.filter(function (l) { return !L.usedLines.has(l); });
        if (fresh.length && Math.random() < (pool === LINES.flavor ? 0.85 : 0.45)) {
          var l = pick(fresh);
          L.usedLines.add(l);
          return l;
        }
      }
    }
    return _lineOnce(pool);
  };

  /* ── "say it": the player's accusation as a full English sentence ───── */
  function sayIt(kind, speaker, target) {
    var lines = sayLines(kind, target.name), starter = sayStarter(kind, target.name);
    return modalPromise(function (box, done) {
      box.innerHTML = '<div class="m-kicker">' + (kind === 'accuse' ? 'ACCUSE' : 'DEFEND') + ' \u00b7 SAY IT OUT LOUD</div>' +
        '<div class="m-title">' + (kind === 'accuse' ? 'Why ' : 'Why trust ') + esc(target.name) + '?</div>' +
        '<p class="m-sub">Give the table a reason. Choose a sentence, or finish your own.</p>' +
        '<div class="mns-say">' + lines.map(function (l, i) { return '<button type="button" data-i="' + i + '">' + esc(l) + '</button>'; }).join('') + '</div>' +
        '<label class="mns-label" for="mnsOwn">Or finish the sentence yourself</label>' +
        '<div class="mns-own"><input id="mnsOwn" type="text" maxlength="120" autocomplete="off"><button type="button" class="btn line sm" id="mnsOwnGo">SAY IT</button></div>' +
        '<div class="m-actions"><button type="button" class="btn dim" id="mnsSayCancel">CANCEL</button></div>';
      var input = box.querySelector('#mnsOwn');
      input.value = starter;
      box.querySelectorAll('.mns-say button').forEach(function (b) { b.onclick = function () { done(lines[+b.dataset.i]); }; });
      var own = function () {
        var v = input.value.trim();
        if (v.length <= starter.trim().length) { toast('Finish the sentence first.'); input.focus(); return; }
        done(v);
      };
      box.querySelector('#mnsOwnGo').onclick = own;
      input.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); own(); } };
      box.querySelector('#mnsSayCancel').onclick = function () { done(null); };
    });
  }

  var _localInfluence = localInfluence;
  localInfluence = function (kind) {
    if (!live()) return _localInfluence(kind);
    var sp = humansAlive()[0];
    if (!sp) return;
    AU.accuse();
    askLocalTarget(kind, alive().filter(function (p) { return p.id !== sp.id; }).map(function (p) { return String(p.id); }), {
      prompt: kind === 'accuse' ? 'Point a finger \u2014 who do you accuse?' : 'Vouch for someone \u2014 who do you defend?',
      hint: 'Then tell the table why. Your words sway the AI players.', confirm: kind === 'accuse' ? 'ACCUSE' : 'DEFEND', cancel: true
    }).then(async function (t) {
      if (t == null || L.phase !== 'discuss') return;
      var tok = L.token, target = byId(t);
      var release;
      S.saying = new Promise(function (r) { release = r; });
      var said;
      try { said = await sayIt(kind, sp, target); } finally { S.saying = null; release(); }
      if (!ok(tok) || said == null) return;
      if (L.phase !== 'discuss' || L.influence <= 0) { toast('Too late \u2014 the vote has been called.'); return; }
      L.influence--;
      // the target's name in bold, wherever the sentence mentions it
      var html = esc(said).split(esc(target.name)).join('<b>' + esc(target.name) + '</b>');
      fTalk(sp, '\u201c' + html + '\u201d', 'public');
      applyAccuse(sp, target, kind === 'accuse' ? 1 : -0.7, D().human);
      setLocalRender();
    });
  };

  // the vote does not start while the player is still choosing their words
  var _discussion = discussion;
  discussion = async function () {
    await _discussion();
    if (S.saying) await S.saying;
  };

  /* ── CASE CLOSED: the epilogue and the case told night by night ─────── */
  var _showEndModal = showEndModal;
  showEndModal = function (V, isLocal) {
    _showEndModal(V, isLocal);
    try { if (isLocal) decorateEnd(V); } catch (e) { /* the plain screen stays */ }
  };

  function decorateEnd(V) {
    var g = live(), box = $('#modalBox');
    if (!g || !box) return;
    var kicker = box.querySelector('.m-kicker'), sub = box.querySelector('.m-sub'), stats = box.querySelector('.stats-row');
    if (kicker) kicker.textContent = g.c.title + ' \u00b7 ' + kicker.textContent;
    if (sub) {
      sub.insertAdjacentHTML('afterend', '<p class="m-sub mns-epi">' + esc(V.winner === 'town' ? g.c.town : g.c.mafia) + '</p><p class="m-sub mns-lead">' + esc(g.c.lead) + '</p>');
    }
    var rows = buildReport(g.events, L.players);
    if (rows.length && stats) {
      stats.insertAdjacentHTML('beforebegin', '<div class="mns-report"><h3>Case report \u00b7 what really happened</h3>' +
        rows.map(function (r) { return '<div class="mns-row ' + r.kind + '"><b>' + esc(r.label) + '</b><span>' + r.lines.map(esc).join(' ') + '</span></div>'; }).join('') + '</div>');
    }
  }

  /* ── ranks: every finished case, in any mode ────────────────────────── */
  document.addEventListener('cmcmafia:game', function (ev) {
    var d = ev.detail || {};
    var id = String(d.mode) + ':' + String(d.gameId);
    if (S.counted[id] || !d.winner || !d.youRole) return;
    S.counted[id] = true;
    if (d.mode === 'Online') { try { localStorage.setItem('mnCounted', JSON.stringify(Object.keys(S.counted).filter(function (k) { return k.indexOf('Online:') === 0; }).slice(-30))); } catch (e) { /* counted for this visit only */ } }
    var g = d.mode === 'Online' ? null : live();
    var res = applyResult(career, d, g ? { caseId: g.c.id, dailyKey: g.daily } : null);
    career = res.career;
    saveCareer(career);
    try { renderDesk(); } catch (e) { /* hub not on screen */ }
    var stats = $('#modalBox .stats-row');
    if (!stats || $('#modalBox .mns-career')) return;
    var r = res.rank;
    stats.insertAdjacentHTML('afterend', '<div class="mns-career"><h3>Your badge</h3>' +
      '<span class="mns-gain">+' + res.gained + ' points</span>' + (res.rankUp ? '<span class="mns-up">NEW RANK</span>' : '') +
      '<div class="mns-bar"><i style="width:' + r.pct + '%"></i></div>' +
      '<div class="mns-note"><b style="color:var(--gold2)">' + esc(r.name) + '</b> \u00b7 ' + career.xp + ' points' + (r.next ? ' \u00b7 ' + (r.next - career.xp) + ' more to ' + esc(r.nextName) : '') + '</div>' +
      '<ul>' + res.parts.map(function (p) { return '<li>' + esc(p.label) + ' <b>+' + p.xp + '</b></li>'; }).join('') +
        (res.fileClosed ? '<li>Case file closed: <b>' + esc(g.c.title) + '</b></li>' : '') + '</ul></div>');
  });

  root.MNS = { found: found, saved: saved, state: S, career: function () { return career; }, renderDesk: renderDesk, startDaily: startDaily };
  renderDesk();
})(typeof window !== 'undefined' ? window : globalThis);
