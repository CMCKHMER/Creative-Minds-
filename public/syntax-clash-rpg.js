/* ==========================================================================
   SYNTAX CLASH: CYBERNETIC BREACH RPG — Interactive Hacking Command Center
   Replaces static grammar cards with a living Cyberpunk 2077 / Tron / Hacknet
   command deck, multi-objective Operations, 4-phase THE MAINFRAME Quantum AI
   boss raid, 6 Rogue AI Enemies, 8 Hacking Ranks, Skill Tree, and 4 Hacker
   Academies with Seasonal Leaderboards — synced with CMC auth, cmc-theme,
   and Firestore drill_attempts.
   ========================================================================== */
(() => {
  'use strict';

  const RPG_KEY = 'cmc_syntax_clash_rpg_v1';
  const FIRESTORE_URL =
    'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';

  /* ── 8 Cyberpunk Hacking Ranks (exact progression ladder) ── */
  const HACK_RANKS = [
    { name: 'Script Kiddie', xp: 0 },
    { name: 'Network Scout', xp: 300 },
    { name: 'Security Analyst', xp: 750 },
    { name: 'Cyber Operator', xp: 1400 },
    { name: 'Penetration Specialist', xp: 2300 },
    { name: 'Digital Assassin', xp: 3500 },
    { name: 'Ghost Hacker', xp: 5200 },
    { name: 'Network Overlord', xp: 7500 },
  ];

  /* ── 4 Hacker Academies (Factions) ── */
  const ACADEMIES = [
    {
      id: 'syndicate',
      name: 'Syntax Syndicate',
      domain: 'Grammar Mastery',
      color: '#10b981',
      icon: 'fa-code-branch',
      perk: '+15% XP on Firewall Verification & Code Repair',
      reward: 'Emerald Kernel Crest',
      motto: 'Every clause is an exploit. Every rule is a weapon.',
      seasonBase: 4820,
    },
    {
      id: 'vanguard',
      name: 'Vocabulary Vanguard',
      domain: 'Words & Lexicon',
      color: '#fbbf24',
      icon: 'fa-book-skull',
      perk: '+20% Credits from Vault Breaches & Operations',
      reward: 'Golden Lexicon Key',
      motto: 'Precision words cut deeper than zero-day exploits.',
      seasonBase: 4510,
    },
    {
      id: 'protocol',
      name: 'Pronunciation Protocol',
      domain: 'Speaking & Voice Ops',
      color: '#c084fc',
      icon: 'fa-waveform-lines',
      perk: 'Audio TTS briefings + +15% Reputation per breach',
      reward: 'Sonic Cipher Badge',
      motto: 'Command the frequency. Override every voice lock.',
      seasonBase: 4390,
    },
    {
      id: 'agency',
      name: 'Reading Intelligence Agency',
      domain: 'Reading & Recon',
      color: '#3b82f6',
      icon: 'fa-eye',
      perk: '+1 free Syntax Scanner charge on every Operation',
      reward: 'Obsidian Intel Visor',
      motto: 'Spot the hidden flaw before the firewall even wakes.',
      seasonBase: 4650,
    },
  ];

  const FACTION_RANKS = [
    { name: 'Initiate', xp: 0 },
    { name: 'Field Operative', xp: 300 },
    { name: 'Cyber Specialist', xp: 800 },
    { name: 'Division Commander', xp: 1600 },
    { name: 'Shadow Director', xp: 3000 },
  ];

  /* ── 9 Hacking Protocols (All classic modes transformed into cyber ops) ── */
  const PROTOCOLS = [
    {
      id: 'judge',
      name: 'Firewall Verification',
      classic: 'Syntax Judge',
      tag: 'CLASSIC',
      color: '#10b981',
      icon: 'fa-shield-halved',
      enemy: 'Grammar Bot',
      desc: 'Inspect incoming network packets and verify whether each sentence payload is clean or corrupted.',
      code: 'PACKET: "She don\'t like pizza."\nEXPLOIT: don\'t → doesn\'t',
      reward: '+15 XP / breach',
    },
    {
      id: 'fix',
      name: 'Code Repair Protocol',
      classic: 'Error Fix',
      tag: 'PRECISION',
      color: '#fbbf24',
      icon: 'fa-wrench',
      enemy: 'Spelling Drone',
      desc: 'Patch corrupted grammar nodes by injecting the exact replacement token before firewall lock.',
      code: 'PATCH: "Their going to the beach."\nINJECT: They\'re',
      reward: '+20 XP / patch',
    },
    {
      id: 'spot',
      name: 'Malware Detection',
      classic: 'Spot the Error',
      tag: 'RECON',
      color: '#f43f5e',
      icon: 'fa-crosshairs',
      enemy: 'Punctuation Sentinel',
      desc: 'Scan encrypted transmissions and isolate the single malformed word hiding malware.',
      code: 'SCAN: "Between you and I, run."\nISOLATE: [I]',
      reward: '+20 XP / isolate',
    },
    {
      id: 'survival',
      name: 'Last Firewall Standing',
      classic: 'Survival',
      tag: 'ENDLESS',
      color: '#c084fc',
      icon: 'fa-skull',
      enemy: 'Syntax Guardian',
      desc: 'Zero margin for error. One grammar slip triggers total trace lockout and ends the run.',
      code: 'ALERT_LIMIT: 0\nTRACE_MODE: INSTANT_LOCK',
      reward: '+35 XP / streak',
    },
    {
      id: 'time',
      name: 'Emergency System Breach',
      classic: 'Time Attack',
      tag: '60s BLITZ',
      color: '#22d3ee',
      icon: 'fa-stopwatch',
      enemy: 'Logic Firewall',
      desc: '60-second emergency override! Extract as many encrypted grammar packets as possible as timers shrink.',
      code: 'WINDOW: 60.0s\nACCELERATION: +12%/NODE',
      reward: '+25 XP / breach',
    },
    {
      id: 'speed',
      name: 'Rapid Infiltration',
      classic: 'Speed Run',
      tag: '20 NODES',
      color: '#a855f7',
      icon: 'fa-flag-checkered',
      enemy: 'Spelling Drone',
      desc: 'Clear 20 consecutive security checkpoints in record time to claim Ghost speed clearance.',
      code: 'NODES: 20\nTARGET: BEAT THE CLOCK',
      reward: '+180 XP clear',
    },
    {
      id: 'daily',
      name: 'Daily Zero-Day Breach',
      classic: 'Daily Challenge',
      tag: 'GLOBAL SEED',
      color: '#fbbf24',
      icon: 'fa-bolt',
      enemy: 'Quantum AI',
      desc: 'Synchronized global breach seed refreshed every 24 hours. 8s hard timer. Compete across academies.',
      code: 'SEED: GLOBAL_UTC\nDIFFICULTY: HARDCORE',
      reward: '+300 XP · +$1,200',
    },
    {
      id: 'practice',
      name: 'Training Simulator',
      classic: 'Practice',
      tag: 'SANDBOX',
      color: '#10b981',
      icon: 'fa-microchip',
      enemy: 'Sim-Bot v1',
      desc: 'Zero-alarm holodeck simulator. Sharpen grammar rules, inspect explanations, and master weak points.',
      code: 'ALARMS: DISABLED\nTELEMETRY: LEARNING MODE',
      reward: '+10 XP / rep',
    },
    {
      id: 'heist',
      name: 'Vault Breach Operation',
      classic: 'Terminal Heist',
      tag: 'HEIST',
      color: '#22d3ee',
      icon: 'fa-terminal',
      enemy: 'Syntax Guardian',
      desc: 'Type exact grammar exploits directly into the live command shell to crack vaults and earn emblems.',
      code: '> inject doesn\'t\n[ACCESS GRANTED // VAULT OPEN]',
      reward: '$5,000–$50,000',
    },
  ];

  /* ── 5 Multi-Objective Cyber Operations + 4-Phase THE MAINFRAME Boss Raid ── */
  const OPERATIONS = [
    {
      id: 'op_bank',
      nodeId: 'bank',
      name: 'Infiltrate Global Bank',
      enemy: 'Grammar Bot',
      enemyTitle: 'Tier-1 Security Drone',
      enemyImg: './images/syntax-clash-rpg/enemy-grammar-bot.jpg',
      taunts: [
        'GRAMMAR BOT: "Syntax anomaly detected. Locking offshore ledger."',
        'GRAMMAR BOT: "Human error logged. Deploying firewall patch."',
      ],
      hurtLines: [
        'NODE DEACTIVATED — Offshore vault ledger cracked!',
        'DATA PACKET EXTRACTED — Grammar Bot optic disrupted!',
      ],
      targetCount: 8,
      minAcc: 75,
      timeLimit: 150,
      maxAlarms: 3,
      diff: 1,
      modeMix: ['judge', 'fix'],
      xp: 250,
      credits: 1500,
      rep: 40,
      token: 'Bank Access Key',
      objectives: [
        'Correct 8 security sentences',
        'Maintain at least 75% accuracy',
        'Avoid triggering 3 security alarms',
        'Complete within 2m 30s',
      ],
    },
    {
      id: 'op_nexacorp',
      nodeId: 'corp',
      name: 'Infiltrate NexaCorp',
      enemy: 'Spelling Drone & Punctuation Sentinel',
      enemyTitle: 'Corporate Counter-Intrusion Unit',
      enemyImg: './images/syntax-clash-rpg/enemy-grammar-bot.jpg',
      taunts: [
        'SPELLING DRONE: "Intruder flagged in NexaCorp Sector 4! Raising shields!"',
        'PUNCTUATION SENTINEL: "Malformed syntax detected. Tracing IP!"',
      ],
      hurtLines: [
        'SECURITY NODE OFFLINE — Corporate memo decrypted!',
        'STEALTH MAINTAINED — NexaCorp data packet siphoned!',
      ],
      targetCount: 15,
      minAcc: 80,
      timeLimit: 180,
      maxAlarms: 4,
      diff: 2,
      modeMix: ['judge', 'fix', 'spot'],
      xp: 500,
      credits: 2500,
      rep: 85,
      token: 'Rare Access Token',
      objectives: [
        'Correct 15 sentences',
        'Maintain 80% accuracy',
        'Avoid triggering security scan lockout',
        'Complete within 3 minutes',
      ],
    },
    {
      id: 'op_vault',
      nodeId: 'vault',
      name: 'Breach The Vault',
      enemy: 'Syntax Guardian',
      enemyTitle: 'Armored Firewall Sentinel',
      enemyImg: './images/syntax-clash-rpg/enemy-syntax-guardian.jpg',
      taunts: [
        'SYNTAX GUARDIAN: "My firewall blades reject sloppy English!"',
        'SYNTAX GUARDIAN: "Shields reinforced! Try again, runner!"',
      ],
      hurtLines: [
        'VAULT LOCK DISENGAGED — Guardian armor fractured!',
        'ENCRYPTED PACKET CAPTURED — Vault door opening!',
      ],
      targetCount: 12,
      minAcc: 80,
      timeLimit: 180,
      maxAlarms: 3,
      diff: 2,
      modeMix: ['fix', 'spot'],
      xp: 650,
      credits: 4000,
      rep: 120,
      token: 'Vault Cipher Key',
      objectives: [
        'Repair 12 encrypted vault payloads',
        'Maintain 80% precision',
        'Defeat Syntax Guardian before lockout',
      ],
    },
    {
      id: 'op_gov',
      nodeId: 'gov',
      name: 'Infiltrate GovernNet',
      enemy: 'Logic Firewall',
      enemyTitle: 'Classified Neural Defense Grid',
      enemyImg: './images/syntax-clash-rpg/enemy-syntax-guardian.jpg',
      taunts: [
        'LOGIC FIREWALL: "Subjunctive violation! Counter-trace accelerating!"',
        'LOGIC FIREWALL: "Unverified operative detected. Reinforcing barriers!"',
      ],
      hurtLines: [
        'DEFENSE GRID BYPASSED — Classified dossier extracted!',
        'LOGIC NODE NEUTRALIZED — Trace signal scrambled!',
      ],
      targetCount: 14,
      minAcc: 85,
      timeLimit: 210,
      maxAlarms: 3,
      diff: 3,
      modeMix: ['spot', 'fix', 'judge'],
      xp: 900,
      credits: 6000,
      rep: 170,
      token: 'Ghost Clearance',
      objectives: [
        'Neutralize 14 high-security grammar nodes',
        'Maintain 85% accuracy',
        'Complete within 3m 30s',
      ],
    },
    {
      id: 'op_mainframe',
      nodeId: 'main',
      boss: true,
      name: 'RAID BOSS: THE MAINFRAME',
      enemy: 'Quantum AI · THE MAINFRAME',
      enemyTitle: '4-Phase Rogue Neural Overlord',
      enemyImg: './images/syntax-clash-rpg/enemy-quantum-ai.jpg',
      taunts: [
        'QUANTUM AI: "I control every syntax node on Earth. Your grammar is obsolete."',
        'QUANTUM AI: "ERROR DETECTED. Firewall matrix reinforced by +12%!"',
      ],
      hurtLines: [
        'QUANTUM CORE FRACTURED — Phase shield collapsing!',
        'NEURAL PACKET EXTRACTED — Mainframe control slipping!',
      ],
      targetCount: 12, // 3 challenges per phase × 4 phases
      minAcc: 75,
      timeLimit: 260,
      maxAlarms: 4,
      xp: 1500,
      credits: 12000,
      rep: 320,
      token: 'Mainframe Sovereign Core',
      objectives: [
        'Phase 1: Subject-Verb Agreement Breach (3 nodes)',
        'Phase 2: Tense Corrections Override (3 nodes)',
        'Phase 3: Sentence Reconstruction Assembly (3 payloads)',
        'Phase 4: Final Language Puzzle Decryption (3 master locks)',
      ],
    },
  ];

  /* ── Dedicated 4-Phase THE MAINFRAME Boss Challenge Bank ── */
  const BOSS_PHASES = [
    {
      phase: 1,
      title: 'PHASE 1 // SUBJECT-VERB AGREEMENT',
      kind: 'fix',
      items: [
        { s: 'Each of the cyber analysts ___ monitoring the firewall.', choices: ['is', 'are', 'were', 'be'], ans: 'is', rule: 'Each is singular — use "is".' },
        { s: 'Neither the drones nor the sentinel ___ detected our signal.', choices: ['has', 'have', 'were', 'are'], ans: 'has', rule: 'With neither…nor, match the closer singular noun ("sentinel has").' },
        { s: 'The committee of engineers ___ approving the security patch now.', choices: ['is', 'are', 'were', 'have'], ans: 'is', rule: 'Collective noun "committee" acts as a single unit — use "is".' },
      ],
    },
    {
      phase: 2,
      title: 'PHASE 2 // TENSE CORRECTIONS',
      kind: 'fix',
      items: [
        { s: 'By the time the alarm rang, the operative ___ already escaped.', choices: ['had', 'has', 'have', 'was'], ans: 'had', rule: 'Past perfect ("had escaped") marks an action completed before another past event.' },
        { s: 'If I ___ the lead architect, I would encrypt every node immediately.', choices: ['were', 'was', 'am', 'be'], ans: 'were', rule: 'Use subjunctive "were" for hypothetical "if" statements.' },
        { s: 'She has ___ three corporate firewalls since midnight.', choices: ['broken', 'broke', 'break', 'breaking'], ans: 'broken', rule: 'Present perfect takes the past participle: "has broken".' },
      ],
    },
    {
      phase: 3,
      title: 'PHASE 3 // SENTENCE RECONSTRUCTION',
      kind: 'reconstruct',
      items: [
        { target: 'The elite hacker bypassed the quantum firewall.', words: ['firewall.', 'The', 'quantum', 'bypassed', 'elite', 'the', 'hacker'], rule: 'Subject ("The elite hacker") + Verb ("bypassed") + Object ("the quantum firewall.").' },
        { target: 'Fewer errors mean stronger network security.', words: ['network', 'mean', 'Fewer', 'security.', 'errors', 'stronger'], rule: 'Use "fewer" with countable nouns ("errors") and plural verb "mean".' },
        { target: 'Between you and me, the vault is open.', words: ['vault', 'you', 'Between', 'is', 'and', 'open.', 'me,', 'the'], rule: 'Preposition "between" requires objective pronoun "me".' },
      ],
    },
    {
      phase: 4,
      title: 'PHASE 4 // FINAL LANGUAGE PUZZLE',
      kind: 'fix',
      items: [
        { s: 'The malware had a devastating ___ on the central server.', choices: ['effect', 'affect', 'affects', 'effecting'], ans: 'effect', rule: '"Effect" is the noun meaning result; "affect" is usually a verb.' },
        { s: 'To ___ did the shadow director send the encrypted key?', choices: ['whom', 'who', 'whose', 'which'], ans: 'whom', rule: 'After the preposition "to", use the objective pronoun "whom".' },
        { s: 'We could ___ breached the mainframe faster with clean syntax.', choices: ['have', 'of', 'has', 'had'], ans: 'have', rule: 'Always write "could have", never "could of".' },
      ],
    },
  ];

  /* ── Cyber Deck Skill Tree ── */
  const SKILLS = [
    { id: 'overclock', name: 'Clock Overclock', icon: 'fa-clock', max: 3, desc: '+15s operation countdown timer per rank.' },
    { id: 'dampener', name: 'Firewall Dampener', icon: 'fa-shield-virus', max: 3, desc: '+1 extra security alarm tolerance before lockout.' },
    { id: 'siphon', name: 'Data Siphon', icon: 'fa-coins', max: 3, desc: '+20% bonus XP & Credits from every breach.' },
    { id: 'scanner', name: 'Syntax Scanner', icon: 'fa-radar', max: 3, desc: 'Unlock hint charges during Operations to reveal weak rules.' },
  ];

  /* ── Persistent RPG Profile ── */
  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

  function defaultProfile() {
    const name =
      (window.CMC_NG && window.CMC_NG.get && window.CMC_NG.get()) ||
      safeGet('cmc-student-name') ||
      'Ghost_Operative';
    return {
      name: String(name || 'Ghost_Operative').slice(0, 24),
      xp: 0,
      rep: 0,
      skillPoints: 1,
      spentPoints: 0,
      skills: { overclock: 0, dampener: 0, siphon: 0, scanner: 0 },
      academy: 'syndicate',
      academyXp: { syndicate: 0, vanguard: 0, protocol: 0, agency: 0 },
      opsCleared: [],
      tokens: [],
      bossDefeated: 0,
      activeTab: 'protocols',
    };
  }

  function loadProfile() {
    const base = defaultProfile();
    try {
      const raw = safeGet(RPG_KEY);
      if (!raw) return base;
      const p = JSON.parse(raw);
      return {
        ...base,
        ...p,
        skills: { ...base.skills, ...(p.skills || {}) },
        academyXp: { ...base.academyXp, ...(p.academyXp || {}) },
      };
    } catch {
      return base;
    }
  }

  let RPG = loadProfile();
  function saveProfile() {
    safeSet(RPG_KEY, JSON.stringify(RPG));
  }

  function getHackRank(xp) {
    let idx = 0;
    for (let i = 0; i < HACK_RANKS.length; i++) {
      if (xp >= HACK_RANKS[i].xp) idx = i;
    }
    const cur = HACK_RANKS[idx];
    const next = HACK_RANKS[idx + 1] || null;
    const pct = next ? Math.min(100, Math.round(((xp - cur.xp) / (next.xp - cur.xp)) * 100)) : 100;
    return { level: idx + 1, name: cur.name, next, pct };
  }

  function getFactionRank(fxp) {
    let cur = FACTION_RANKS[0];
    for (const r of FACTION_RANKS) if (fxp >= r.xp) cur = r;
    return cur.name;
  }

  function awardRpg(xp, credits, rep, label) {
    const mult = 1 + (RPG.skills.siphon || 0) * 0.2;
    const facBonusXp = RPG.academy === 'syndicate' ? 1.15 : 1;
    const facBonusCr = RPG.academy === 'vanguard' ? 1.2 : 1;
    const facBonusRep = RPG.academy === 'protocol' ? 1.15 : 1;
    const finalXp = Math.round(xp * mult * facBonusXp);
    const finalCr = Math.round(credits * mult * facBonusCr);
    const finalRep = Math.round((rep || 10) * facBonusRep);

    const prevRank = getHackRank(RPG.xp).level;
    RPG.xp += finalXp;
    RPG.rep += finalRep;
    RPG.academyXp[RPG.academy] = (RPG.academyXp[RPG.academy] || 0) + finalXp;

    if (typeof window.STATS === 'object' && window.STATS) {
      window.STATS.money = (window.STATS.money || 0) + finalCr;
      if (typeof window.saveStats === 'function') window.saveStats();
    }

    const newRank = getHackRank(RPG.xp);
    if (newRank.level > prevRank) {
      RPG.skillPoints += newRank.level - prevRank;
      if (typeof window.snd === 'function') window.snd('levelup');
      if (typeof window.toast === 'function') {
        window.toast(`<b>RANK PROMOTION!</b><br>${newRank.name} (+1 Skill Point)`, 'fa-chevron-up');
      }
    }
    saveProfile();
    if (label) pushConsoleLog(`[+${finalXp} XP · +$${finalCr}] ${label}`);
    return { finalXp, finalCr, finalRep };
  }

  /* ── Live System Alert Console Feed ── */
  const consoleLines = [
    '> UPLINK ESTABLISHED // NEO-SECTOR 07',
    '> SCANNING 5 CORPORATE NODES... VULNERABILITIES DETECTED',
    '> WARNING: QUANTUM AI MONITORING SYNTAX TRAFFIC',
  ];
  function pushConsoleLog(line) {
    consoleLines.unshift(line);
    if (consoleLines.length > 4) consoleLines.pop();
    const el = document.getElementById('scLiveConsole');
    if (el) el.innerHTML = consoleLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  }

  /* ── Visual FX: Green Scan Sweep, Red Alert Flash, Floating XP/Credits ── */
  function fireGreenScan(popText) {
    const el = document.getElementById('sc-scan-beam');
    if (el) {
      el.classList.remove('fire');
      void el.offsetWidth;
      el.classList.add('fire');
    }
    if (popText) spawnFloatPop(popText, '#10b981');
    if (typeof window.spB === 'function') window.spB(window.innerWidth / 2, window.innerHeight * 0.42, '#10b981', 34);
  }

  function fireRedAlert(popText) {
    const el = document.getElementById('sc-red-alert');
    if (el) {
      el.classList.remove('fire');
      void el.offsetWidth;
      el.classList.add('fire');
    }
    if (typeof window.trigG === 'function') window.trigG();
    if (popText) spawnFloatPop(popText, '#f43f5e');
  }

  function spawnFloatPop(text, color) {
    const d = document.createElement('div');
    d.className = 'sc-float-pop';
    d.style.left = `${44 + Math.random() * 12}%`;
    d.style.top = `${36 + Math.random() * 8}%`;
    d.style.color = color || '#22d3ee';
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  /* ── 60-FPS Living Cyberpunk Background Canvas (Digital Rain + Tron Grid) ── */
  function mountCyberCanvas() {
    if (document.getElementById('sc-cyber-bg')) return;
    const c = document.createElement('canvas');
    c.id = 'sc-cyber-bg';
    document.body.insertBefore(c, document.body.firstChild);

    const scan = document.createElement('div');
    scan.id = 'sc-scan-beam';
    document.body.appendChild(scan);

    const red = document.createElement('div');
    red.id = 'sc-red-alert';
    document.body.appendChild(red);

    const arena = document.createElement('div');
    arena.id = 'sc-op-arena';
    arena.hidden = true;
    document.body.appendChild(arena);

    const ctx = c.getContext && c.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, drops = [];
    const glyphs = '01SYNTAX{}[]<>/$#%';
    function resize() {
      W = c.width = window.innerWidth || 1280;
      H = c.height = window.innerHeight || 720;
      const cols = Math.min(64, Math.floor(W / 24));
      drops = Array.from({ length: cols }, () => Math.random() * H);
    }
    resize();
    window.addEventListener('resize', resize);

    let gridOffset = 0;
    function tick() {
      ctx.clearRect(0, 0, W, H);
      const isLight = document.documentElement.classList.contains('light');

      // Digital rain streams
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.fillStyle = isLight ? 'rgba(3, 105, 161, 0.22)' : 'rgba(16, 185, 129, 0.20)';
      for (let i = 0; i < drops.length; i++) {
        const ch = glyphs[(i + Math.floor(drops[i] / 18)) % glyphs.length];
        ctx.fillText(ch, i * 24 + 8, drops[i]);
        drops[i] += 1.35 + (i % 3) * 0.45;
        if (drops[i] > H + 20) drops[i] = -Math.random() * 160;
      }

      // Tron perspective horizon grid at lower viewport
      const horizonY = H * 0.64;
      gridOffset = (gridOffset + 0.55) % 44;
      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.16)' : 'rgba(34, 211, 238, 0.14)';
      ctx.lineWidth = 1;
      for (let y = horizonY; y < H; y += 26) {
        const p = (y - horizonY) / (H - horizonY);
        const yy = horizonY + Math.pow(p, 1.5) * (H - horizonY) + gridOffset * p * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
        ctx.stroke();
      }
      for (let x = -W; x <= W * 2; x += 110) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5 + (x - W * 0.5) * 0.16, horizonY);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ── Theme Sync (Dark Cyberpunk / Light Holo-Daylight) ── */
  function applyCmcTheme(isLight, persist) {
    document.documentElement.classList.toggle('light', isLight);
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('scThemeToggle');
    if (btn) btn.innerHTML = isLight ? '<i class="fa-solid fa-moon"></i> Dark' : '<i class="fa-solid fa-sun"></i> Light';
    if (persist) safeSet('cmc-theme', isLight ? 'light' : 'dark');
  }

  /* ── Firestore Class Leaderboard POST (preserves exact CMC schema) ── */
  async function postOperationToLeaderboard(slug, title, scorePct, correctCount, totalCount) {
    try {
      const token = safeGet('cmc-student-token');
      const uid = token ? (safeGet('cmc-student-uid') || '') : '';
      if (!token || !uid) return false;
      const body = {
        fields: {
          drillSlug: { stringValue: slug || 'syntax-clash-practice' },
          drillTitle: { stringValue: String(title || 'Syntax Clash RPG').slice(0, 80) },
          drillSource: { stringValue: 'learning-games' },
          studentName: { stringValue: String(RPG.name || 'Operative').slice(0, 40) },
          studentUid: { stringValue: uid },
          classId: { nullValue: null },
          scorePct: { integerValue: String(Math.max(0, Math.min(100, Math.round(scorePct)))) },
          correctCount: { integerValue: String(correctCount) },
          totalCount: { integerValue: String(Math.max(1, totalCount)) },
          submittedAt: { timestampValue: new Date().toISOString() },
        },
      };
      const res = await fetch(FIRESTORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /* ==========================================================================
     RENDER THE CYBERPUNK COMMAND CENTER
     ========================================================================== */
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderCommandCenter() {
    const app = document.getElementById('app');
    if (!app) return;

    const rk = getHackRank(RPG.xp);
    const ac = ACADEMIES.find((a) => a.id === RPG.academy) || ACADEMIES[0];
    const credits = (window.STATS && window.STATS.money) || 0;
    const isLight = document.documentElement.classList.contains('light');
    const achUnlocked = (window.STATS && window.STATS.ach && window.STATS.ach.length) || 0;
    const achTotal = (window.ACH && window.ACH.length) || 25;

    // Network Topology Nodes
    const nodeCards = OPERATIONS.map((op) => {
      const cleared = RPG.opsCleared.includes(op.id);
      return `
        <button type="button" class="sc-node-btn ${cleared ? 'breached' : ''} ${op.boss ? 'boss' : ''}" data-launch-op="${op.id}">
          <div class="sc-node-status">
            <span style="color:${op.boss ? 'var(--sc-crimson)' : (cleared ? 'var(--sc-emerald)' : 'var(--sc-cyan)')}">${op.boss ? 'RAID BOSS' : (cleared ? 'BREACHED' : 'ONLINE')}</span>
            <span style="color:var(--sc-mute)">${op.targetCount} NODES</span>
          </div>
          <div class="sc-node-name">${op.boss ? '☠️ THE MAINFRAME' : op.name.replace('Infiltrate ', '').replace('Breach ', '')}</div>
          <div class="sc-node-meta">vs. ${op.enemy.split(' · ')[0]}</div>
          <div class="sc-node-reward">+${op.xp} XP · +$${op.credits.toLocaleString()}</div>
        </button>`;
    }).join('');

    let tabBody = '';
    if (RPG.activeTab === 'protocols') {
      tabBody = `
        <div class="sc-grid-3">
          ${PROTOCOLS.map((p) => `
            <button type="button" class="sc-proto-card" data-launch-proto="${p.id}">
              <div class="sc-proto-top">
                <div class="sc-proto-icon" style="color:${p.color};background:${p.color}20"><i class="fa-solid ${p.icon}"></i></div>
                <span class="sc-proto-tag" style="color:${p.color};background:${p.color}22">${p.tag}</span>
              </div>
              <div>
                <div class="sc-proto-name">${p.name}</div>
                <div class="sc-proto-classic">// ${p.classic} · Target: ${p.enemy}</div>
              </div>
              <p class="sc-proto-desc">${p.desc}</p>
              <div class="sc-proto-code">${p.code.replace(/\n/g, '<br>')}</div>
              <div class="sc-proto-foot">
                <span>${p.reward}</span>
                <span style="color:var(--sc-cyan)">LAUNCH OP →</span>
              </div>
            </button>`).join('')}
        </div>`;
    } else if (RPG.activeTab === 'operations') {
      tabBody = `
        <div class="sc-grid-2">
          ${OPERATIONS.map((op) => {
            const cleared = RPG.opsCleared.includes(op.id);
            return `
              <article class="sc-op-card ${op.boss ? 'boss-card' : ''}">
                <div class="sc-op-banner">
                  <img src="${op.enemyImg}" alt="${escapeHtml(op.enemy)}" />
                  <div class="sc-op-banner-info">
                    <div>
                      <small>${op.boss ? '🔥 4-PHASE QUANTUM AI RAID' : `OP // TARGET AI: ${op.enemy.toUpperCase()}`}</small>
                      <h3>${op.name}</h3>
                    </div>
                    <span class="sc-proto-tag" style="background:${cleared ? 'rgba(16,185,129,0.28)' : 'rgba(244,63,94,0.28)'};color:${cleared ? '#6ee7b7' : '#fda4af'}">${cleared ? 'BREACHED ✓' : `${op.minAcc}% ACC REQ`}</span>
                  </div>
                </div>
                <div class="sc-op-body">
                  <div class="sc-obj-list">
                    ${op.objectives.map((o) => `<div>▸ ${o}</div>`).join('')}
                  </div>
                  <div class="sc-reward-row">
                    <span class="sc-reward-pill">+${op.xp} XP</span>
                    <span class="sc-reward-pill gold">+$${op.credits.toLocaleString()} Credits</span>
                    <span class="sc-reward-pill violet">🔑 ${op.token}</span>
                  </div>
                  <div style="margin-top:auto;padding-top:6px">
                    <button type="button" class="sc-btn-primary" data-launch-op="${op.id}">
                      <i class="fa-solid ${op.boss ? 'fa-skull-crossbones' : 'fa-terminal'}"></i>
                      ${op.boss ? 'Initiate 4-Phase Mainframe Raid' : `Deploy: ${op.name}`}
                    </button>
                  </div>
                </div>
              </article>`;
          }).join('')}
        </div>`;
    } else if (RPG.activeTab === 'academies') {
      const standings = ACADEMIES.map((a) => ({
        ...a,
        total: a.seasonBase + (RPG.academyXp[a.id] || 0),
        mine: a.id === RPG.academy,
      })).sort((a, b) => b.total - a.total);

      tabBody = `
        <div class="sc-academy-banner">
          <img src="./images/syntax-clash-rpg/academy-hub.jpg" alt="Four glowing cyberpunk hacker academy pillars" />
          <div class="sc-academy-banner-txt">
            <span class="sc-eyebrow">Season 01 // Faction Warfare</span>
            <h2>4 Hacker Academies</h2>
            <p>Join an elite digital faction, climb from Initiate to Shadow Director, unlock exclusive academy perks, and drive your faction to #1 on the Seasonal Leaderboard.</p>
          </div>
        </div>
        <div class="sc-grid-2" style="margin-bottom:16px">
          ${ACADEMIES.map((a) => {
            const joined = RPG.academy === a.id;
            const fxp = RPG.academyXp[a.id] || 0;
            return `
              <div class="sc-fac-card ${joined ? 'joined' : ''}" style="border-color:${joined ? a.color : ''}">
                <div class="sc-fac-head">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="sc-proto-icon" style="color:${a.color};background:${a.color}22"><i class="fa-solid ${a.icon}"></i></div>
                    <div>
                      <div style="font-weight:800;font-size:16px">${a.name}</div>
                      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${a.color}">${a.domain}</div>
                    </div>
                  </div>
                  <span class="sc-fac-badge" style="color:${a.color};background:${a.color}22">${joined ? 'ACTIVE FACTION' : getFactionRank(fxp)}</span>
                </div>
                <p style="font-size:12.5px;color:var(--sc-soft)">“${a.motto}”</p>
                <div style="font-size:12px;color:var(--sc-ink)"><strong>Perk:</strong> ${a.perk}</div>
                <div style="font-size:12px;color:var(--sc-gold)"><strong>Unlockable:</strong> 🏅 ${a.reward} · Rank: ${getFactionRank(fxp)} (${fxp} XP)</div>
                <div style="margin-top:6px">
                  <button type="button" class="${joined ? 'sc-btn-ghost' : 'sc-btn-primary'}" data-join-academy="${a.id}" style="min-height:38px;font-size:13px">
                    ${joined ? '✓ Enlisted Operative' : `Join ${a.name}`}
                  </button>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="sc-netmap">
          <div class="sc-sec-head">
            <span class="sc-sec-title"><i class="fa-solid fa-trophy"></i> Season 01 Academy Leaderboard</span>
            <button type="button" class="sc-btn-ghost" id="scSyncSeasonLb" style="min-height:34px;font-size:12px">🏆 Sync My Score to CMC Leaderboard</button>
          </div>
          <table class="sc-lb-table">
            <thead><tr><th>#</th><th>Hacker Academy</th><th>Domain</th><th>Season XP</th><th>Status</th></tr></thead>
            <tbody>
              ${standings.map((s, idx) => `
                <tr class="${s.mine ? 'me' : ''}">
                  <td>#${idx + 1}</td>
                  <td style="color:${s.color};font-weight:800">${s.name}${s.mine ? ' ★' : ''}</td>
                  <td>${s.domain}</td>
                  <td>${s.total.toLocaleString()} XP</td>
                  <td>${s.mine ? `YOUR FACTION (${getFactionRank(RPG.academyXp[s.id] || 0)})` : 'ACTIVE'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } else {
      // Cyber Deck: Skills, Tokens, Ranks
      tabBody = `
        <div class="sc-netmap" style="margin-bottom:16px">
          <div class="sc-sec-head">
            <span class="sc-sec-title"><i class="fa-solid fa-microchip"></i> Cyber Deck Skill Augments</span>
            <span class="sc-chip violet">⚡ Skill Points Available: ${RPG.skillPoints}</span>
          </div>
          <div class="sc-grid-2">
            ${SKILLS.map((sk) => {
              const lv = RPG.skills[sk.id] || 0;
              return `
                <div class="sc-fac-card">
                  <div class="sc-fac-head">
                    <strong><i class="fa-solid ${sk.icon}" style="color:var(--sc-cyan);margin-right:8px"></i>${sk.name}</strong>
                    <span class="sc-chip mint">Lv ${lv} / ${sk.max}</span>
                  </div>
                  <p style="font-size:12.5px;color:var(--sc-soft)">${sk.desc}</p>
                  <button type="button" class="sc-btn-primary" data-upgrade-skill="${sk.id}" ${lv >= sk.max || RPG.skillPoints <= 0 ? 'disabled style="opacity:0.45;cursor:not-allowed;min-height:36px;font-size:12.5px"' : 'style="min-height:36px;font-size:12.5px"'}>
                    ${lv >= sk.max ? 'MAXED ✓' : 'Install Upgrade (1 SP)'}
                  </button>
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="sc-grid-2">
          <div class="sc-netmap">
            <div class="sc-sec-title" style="margin-bottom:10px"><i class="fa-solid fa-ranking-star"></i> Operative Rank Ladder</div>
            <div style="display:flex;flex-direction:column;gap:6px;font-family:'JetBrains Mono',monospace;font-size:12px">
              ${HACK_RANKS.map((r, i) => `
                <div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:8px;background:${RPG.xp >= r.xp ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.06)'};color:${RPG.xp >= r.xp ? 'var(--sc-emerald)' : 'var(--sc-mute)'}">
                  <span>Lv.${i + 1} ${r.name}</span><span>${r.xp.toLocaleString()} XP</span>
                </div>`).join('')}
            </div>
          </div>
          <div class="sc-netmap">
            <div class="sc-sec-title" style="margin-bottom:10px"><i class="fa-solid fa-key"></i> Stolen Access Tokens &amp; Emblems</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
              ${RPG.tokens.length ? RPG.tokens.map((t) => `<span class="sc-reward-pill violet">🔑 ${escapeHtml(t)}</span>`).join('') : '<span style="font-size:12.5px;color:var(--sc-soft)">Complete Cyber Operations to steal rare corporate Access Tokens!</span>'}
            </div>
            <div class="sc-sec-title" style="margin-bottom:10px"><i class="fa-solid fa-database"></i> Classic Systems &amp; Logs</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="sc-btn-ghost" onclick="showStats()">📊 Stats</button>
              <button type="button" class="sc-btn-ghost" onclick="showAchievements()">🏆 Achievements (${achUnlocked}/${achTotal})</button>
              <button type="button" class="sc-btn-ghost" onclick="showReference()">📖 Grammar Reference</button>
              <button type="button" class="sc-btn-ghost" onclick="showSettings()">⚙️ Audio &amp; Settings</button>
            </div>
          </div>
        </div>`;
    }

    app.innerHTML = `
      <div class="sc-shell">
        <!-- Top Holographic Operative HUD -->
        <header class="sc-topbar">
          <div class="sc-op-id">
            <div class="sc-op-hex">${escapeHtml((RPG.name[0] || 'G').toUpperCase())}<span class="sc-op-lvl">${rk.level}</span></div>
            <div>
              <div class="sc-op-name">${escapeHtml(RPG.name)} <span style="font-size:11px;color:${ac.color}">[${ac.name}]</span></div>
              <div class="sc-op-rank">${rk.name} · ${RPG.xp.toLocaleString()} XP${rk.next ? ` / ${rk.next.xp.toLocaleString()}` : ' MAX'}</div>
              <div class="sc-xp-track"><div class="sc-xp-fill" style="width:${rk.pct}%"></div></div>
            </div>
          </div>
          <div class="sc-hud-chips">
            <span class="sc-chip gold">💰 $${credits.toLocaleString()}</span>
            <span class="sc-chip mint">⚡ ${RPG.rep} REP</span>
            <span class="sc-chip violet">🧬 ${RPG.skillPoints} SP</span>
            <button type="button" class="sc-chip sc-chip-btn" id="scThemeToggle" title="Switch Dark Cyberpunk / Light Holo Theme">${isLight ? '<i class="fa-solid fa-moon"></i> Dark' : '<i class="fa-solid fa-sun"></i> Light'}</button>
            <button type="button" class="sc-chip sc-chip-btn" onclick="showReference()"><i class="fa-solid fa-book"></i> Intel</button>
            <button type="button" class="sc-chip sc-chip-btn" onclick="showSettings()"><i class="fa-solid fa-gear"></i></button>
          </div>
        </header>

        <!-- Hero Command Center Deck -->
        <section class="sc-hero">
          <img src="./images/syntax-clash-rpg/command-hero.jpg" alt="Cyberpunk hacker command center overlooking neon skyline" class="sc-hero-bg" />
          <div class="sc-hero-scrim"></div>
          <div class="sc-hero-grid">
            <div>
              <span class="sc-eyebrow"><span class="sc-pulse-dot"></span> CYBERNETIC BREACH COMMAND // LIVE UPLINK</span>
              <h1 class="sc-hero-title">SYNTAX <span>CLASH</span></h1>
              <p class="sc-hero-sub">Grammar is your hacking weapon. Infiltrate corporate networks, neutralize rogue AI firewalls, reconstruct encrypted payloads, and lead your Hacker Academy to Season 01 dominance.</p>
              <div class="sc-hero-actions">
                <button type="button" class="sc-btn-primary" data-launch-op="op_nexacorp"><i class="fa-solid fa-bolt"></i> Deploy: Infiltrate NexaCorp</button>
                <button type="button" class="sc-btn-ghost" data-launch-op="op_mainframe" style="border-color:rgba(244,63,94,0.55);color:var(--sc-crimson)"><i class="fa-solid fa-skull"></i> Raid THE MAINFRAME</button>
                <button type="button" class="sc-btn-ghost" onclick="openSheet('daily')"><i class="fa-solid fa-calendar-day"></i> Daily Zero-Day</button>
              </div>
            </div>

            <!-- Live Security Camera Feed + System Alert Terminal -->
            <div class="sc-telemetry-box">
              <div class="sc-cam-feed">
                <img src="./images/syntax-clash-rpg/vault-breach.jpg" alt="Live security camera feed of cyber vault" />
                <div class="sc-cam-scan"></div>
                <div class="sc-cam-hud">
                  <div class="sc-cam-top">
                    <span class="sc-rec"><i></i> CAM-04 // NEXACORP VAULT</span>
                    <span id="scCamClock">${new Date().toTimeString().slice(0, 8)}</span>
                  </div>
                  <div class="sc-cam-top">
                    <span style="color:#6ee7b7">AI THREAT: QUANTUM FIREWALL</span>
                    <span>STEALTH: ACTIVE</span>
                  </div>
                </div>
              </div>
              <div class="sc-live-console" id="scLiveConsole">
                ${consoleLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
              </div>
            </div>
          </div>
        </section>

        <!-- Interactive Network Topology Map -->
        <section class="sc-netmap" aria-label="Target network topology map">
          <div class="sc-sec-head">
            <span class="sc-sec-title"><i class="fa-solid fa-diagram-project"></i> Live Corporate Network Map — Select Target to Breach</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--sc-soft)">BREACHED: ${RPG.opsCleared.length} / ${OPERATIONS.length} NODES</span>
          </div>
          <div class="sc-nodes-row">${nodeCards}</div>
        </section>

        <!-- Command Navigation Tabs -->
        <nav class="sc-nav-tabs" aria-label="Command center sections">
          <button type="button" class="sc-nav-tab ${RPG.activeTab === 'protocols' ? 'active' : ''}" data-sc-tab="protocols"><i class="fa-solid fa-terminal"></i> Hacking Protocols (9)</button>
          <button type="button" class="sc-nav-tab ${RPG.activeTab === 'operations' ? 'active' : ''}" data-sc-tab="operations"><i class="fa-solid fa-crosshairs"></i> Cyber Operations &amp; Boss Raid</button>
          <button type="button" class="sc-nav-tab ${RPG.activeTab === 'academies' ? 'active' : ''}" data-sc-tab="academies"><i class="fa-solid fa-users-rays"></i> Hacker Academies (4)</button>
          <button type="button" class="sc-nav-tab ${RPG.activeTab === 'deck' ? 'active' : ''}" data-sc-tab="deck"><i class="fa-solid fa-microchip"></i> Cyber Deck &amp; Skills</button>
        </nav>

        <!-- Active Tab Content -->
        <section id="scTabPanel">${tabBody}</section>
      </div>`;

    bindCommandEvents();
  }

  function bindCommandEvents() {
    const thm = document.getElementById('scThemeToggle');
    if (thm) thm.onclick = () => applyCmcTheme(!document.documentElement.classList.contains('light'), true);

    document.querySelectorAll('[data-sc-tab]').forEach((b) => {
      b.onclick = () => {
        RPG.activeTab = b.getAttribute('data-sc-tab');
        saveProfile();
        if (typeof window.iS === 'function') window.iS();
        if (typeof window.snd === 'function') window.snd('click');
        renderCommandCenter();
      };
    });

    document.querySelectorAll('[data-launch-proto]').forEach((b) => {
      b.onclick = () => {
        const id = b.getAttribute('data-launch-proto');
        if (typeof window.openSheet === 'function') window.openSheet(id);
      };
    });

    document.querySelectorAll('[data-launch-op]').forEach((b) => {
      b.onclick = () => launchOperation(b.getAttribute('data-launch-op'));
    });

    document.querySelectorAll('[data-join-academy]').forEach((b) => {
      b.onclick = () => {
        const fid = b.getAttribute('data-join-academy');
        RPG.academy = fid;
        saveProfile();
        const ac = ACADEMIES.find((a) => a.id === fid);
        if (typeof window.snd === 'function') window.snd('grant');
        pushConsoleLog(`> ENLISTED IN ${ac.name.toUpperCase()} [${ac.domain.toUpperCase()}]`);
        if (typeof window.toast === 'function') window.toast(`<b>Joined ${ac.name}!</b><br>${ac.perk}`, ac.icon);
        renderCommandCenter();
      };
    });

    document.querySelectorAll('[data-upgrade-skill]').forEach((b) => {
      b.onclick = () => {
        const sid = b.getAttribute('data-upgrade-skill');
        const sk = SKILLS.find((s) => s.id === sid);
        if (!sk || RPG.skillPoints <= 0 || (RPG.skills[sid] || 0) >= sk.max) return;
        RPG.skillPoints--;
        RPG.spentPoints++;
        RPG.skills[sid] = (RPG.skills[sid] || 0) + 1;
        saveProfile();
        if (typeof window.snd === 'function') window.snd('levelup');
        pushConsoleLog(`> AUGMENT INSTALLED: ${sk.name.toUpperCase()} LV.${RPG.skills[sid]}`);
        renderCommandCenter();
      };
    });

    const syncBtn = document.getElementById('scSyncSeasonLb');
    if (syncBtn) {
      syncBtn.onclick = async () => {
        const ac = ACADEMIES.find((a) => a.id === RPG.academy) || ACADEMIES[0];
        const ok = await postOperationToLeaderboard('syntax-clash-practice', `Syntax Clash RPG · ${ac.name}`, Math.min(100, 75 + RPG.opsCleared.length * 5), Math.max(1, RPG.opsCleared.length), OPERATIONS.length);
        if (typeof window.toast === 'function') {
          window.toast(ok ? '<b>Synced to CMC Class Leaderboard!</b>' : '<b>Saved to local Season 01 standings!</b><br>Sign in to sync globally.', 'fa-trophy');
        }
      };
    }
  }

  /* ==========================================================================
     MULTI-OBJECTIVE CYBER OPERATION & 4-PHASE MAINFRAME BOSS ARENA
     ========================================================================== */
  let OP = null;
  let opTimer = null;

  function buildOpDeck(op) {
    if (op.boss) {
      const deck = [];
      BOSS_PHASES.forEach((ph) => {
        ph.items.forEach((item) => {
          deck.push({ ...item, kind: ph.kind, phase: ph.phase, phaseTitle: ph.title });
        });
      });
      return deck;
    }
    const source = Array.isArray(window.DB) ? window.DB : [];
    const usable = source.filter((item) => item.d <= op.diff || source.length < 20);
    const shuffled = usable.slice().sort(() => Math.random() - 0.5);
    const deck = [];
    for (let i = 0; i < op.targetCount; i++) {
      const item = shuffled[i % shuffled.length] || { t: "She don't like pizza.", w: ['She', "don't", 'like', 'pizza.'], e: 1, fx: "doesn't", d: 1 };
      const mode = op.modeMix[i % op.modeMix.length];
      if (mode === 'spot' && item.w) {
        deck.push({ kind: 'spot', item, rule: `Replace "${item.w[item.e]}" with "${item.fx}".` });
      } else if (mode === 'fix' && item.w && item.fx && item.fx !== '—') {
        const wrong = item.w[item.e];
        const distractors = ['is', 'are', 'were', 'has', 'have', "doesn't", "don't", 'their', "they're", 'whom', 'effect', 'fewer']
          .filter((x) => x.toLowerCase() !== String(item.fx).toLowerCase() && x.toLowerCase() !== String(wrong).toLowerCase())
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);
        const choices = [item.fx, wrong, ...distractors].sort(() => Math.random() - 0.5);
        const blanked = item.w.map((w, idx) => (idx === item.e ? '___' : w)).join(' ');
        deck.push({ kind: 'fix', s: blanked, choices, ans: item.fx, rule: `Correct form: "${item.fx}" (instead of "${wrong}").` });
      } else {
        deck.push({ kind: 'judge', item, rule: item.c ? 'Clean syntax — packet verified!' : `Corrupted word "${item.w ? item.w[item.e] : ''}" → "${item.fx}".` });
      }
    }
    return deck;
  }

  function launchOperation(opId) {
    const op = OPERATIONS.find((o) => o.id === opId);
    if (!op) return;
    if (typeof window.iS === 'function') window.iS();
    if (typeof window.snd === 'function') window.snd('click');

    const extraTime = (RPG.skills.overclock || 0) * 15;
    const extraAlarm = (RPG.skills.dampener || 0);
    const scannerCharges = (RPG.skills.scanner || 0) + (RPG.academy === 'agency' ? 1 : 0);

    OP = {
      def: op,
      deck: buildOpDeck(op),
      idx: 0,
      correct: 0,
      wrong: 0,
      alarms: 0,
      maxAlarms: op.maxAlarms + extraAlarm,
      firewallHp: 100,
      timeLeft: op.timeLimit + extraTime,
      scannerCharges,
      answered: false,
      reconstructPick: [],
      alertActive: false,
      enemyLine: op.boss ? 'QUANTUM AI: "Four firewall phases stand between you and root access. Begin."' : `${op.enemy.toUpperCase()}: "Intrusion detected! Prove your English mastery or face lockout."`,
    };

    clearInterval(opTimer);
    opTimer = setInterval(() => {
      if (!OP || OP.done) return;
      OP.timeLeft--;
      const tEl = document.getElementById('scOpTimer');
      if (tEl) tEl.textContent = `${Math.floor(OP.timeLeft / 60)}:${String(Math.max(0, OP.timeLeft % 60)).padStart(2, '0')}`;
      if (OP.timeLeft <= 0) finishOperation(false, 'SESSION TRACE COMPLETE — TIME EXPIRED');
    }, 1000);

    const arena = document.getElementById('sc-op-arena');
    arena.hidden = false;
    renderOpArena();
  }

  function closeOpArena() {
    clearInterval(opTimer);
    OP = null;
    const arena = document.getElementById('sc-op-arena');
    if (arena) arena.hidden = true;
    renderCommandCenter();
  }

  function renderOpArena() {
    if (!OP) return;
    const arena = document.getElementById('sc-op-arena');
    const cur = OP.deck[OP.idx];
    if (!cur) {
      const acc = Math.round((OP.correct / Math.max(1, OP.correct + OP.wrong)) * 100);
      finishOperation(acc >= OP.def.minAcc, acc >= OP.def.minAcc ? 'SYSTEM BREACHED — VAULT UNLOCKED!' : `ACCURACY ${acc}% BELOW ${OP.def.minAcc}% REQUIREMENT`);
      return;
    }

    const total = OP.deck.length;
    const acc = OP.correct + OP.wrong > 0 ? Math.round((OP.correct / (OP.correct + OP.wrong)) * 100) : 100;
    const alarmPct = Math.min(100, Math.round((OP.alarms / OP.maxAlarms) * 100));
    const phaseBanner = cur.phaseTitle ? `<span class="sc-proto-tag" style="background:rgba(244,63,94,0.24);color:#fda4af">${cur.phaseTitle}</span>` : `<span class="sc-proto-tag" style="background:rgba(34,211,238,0.18);color:var(--sc-cyan)">NODE ${OP.idx + 1} / ${total}</span>`;

    let interactionHtml = '';
    if (cur.kind === 'judge') {
      interactionHtml = `
        <div class="sc-sentence-box">${escapeHtml(cur.item.t)}</div>
        <div class="sc-choices-grid">
          <button type="button" class="sc-choice-btn" data-op-judge="true"><i class="fa-solid fa-check-circle" style="color:var(--sc-emerald)"></i> CLEAN PAYLOAD (Correct)</button>
          <button type="button" class="sc-choice-btn" data-op-judge="false"><i class="fa-solid fa-bug" style="color:var(--sc-crimson)"></i> CORRUPTED (Has Error)</button>
        </div>`;
    } else if (cur.kind === 'fix') {
      interactionHtml = `
        <div class="sc-sentence-box">${escapeHtml(cur.s)}</div>
        <div class="sc-choices-grid">
          ${cur.choices.map((ch) => `<button type="button" class="sc-choice-btn" data-op-fix="${escapeHtml(ch)}">${escapeHtml(ch)}</button>`).join('')}
        </div>`;
    } else if (cur.kind === 'spot') {
      interactionHtml = `
        <div style="font-size:12px;color:var(--sc-cyan);font-family:'JetBrains Mono',monospace;margin-bottom:8px">CLICK THE CORRUPTED WORD TO ISOLATE MALWARE:</div>
        <div class="sc-sentence-box">
          ${cur.item.w.map((w, idx) => `<button type="button" class="sc-word-btn" data-op-spot="${idx}">${escapeHtml(w)}</button>`).join('')}
        </div>`;
    } else if (cur.kind === 'reconstruct') {
      const built = OP.reconstructPick.map((i) => cur.words[i]).join(' ');
      interactionHtml = `
        <div style="font-size:12px;color:var(--sc-cyan);font-family:'JetBrains Mono',monospace;margin-bottom:8px">ASSEMBLE THE CLEAN EXPLOIT SENTENCE IN ORDER:</div>
        <div class="sc-sentence-box" style="min-height:66px;color:var(--sc-emerald)">${escapeHtml(built || '[ Click tokens below to reconstruct sentence… ]')}</div>
        <div style="margin-bottom:14px">
          ${cur.words.map((w, idx) => `<button type="button" class="sc-word-btn ${OP.reconstructPick.includes(idx) ? 'selected' : ''}" data-op-rec="${idx}" ${OP.reconstructPick.includes(idx) ? 'disabled style="opacity:0.38"' : ''}>${escapeHtml(w)}</button>`).join('')}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="sc-btn-primary" id="scRecSubmit">Inject Payload ✨</button>
          <button type="button" class="sc-btn-ghost" id="scRecClear">Clear Tokens</button>
        </div>`;
    }

    arena.innerHTML = `
      <div class="sc-arena-inner">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <button type="button" class="sc-btn-ghost" id="scOpAbort"><i class="fa-solid fa-arrow-left"></i> Abort Operation</button>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="sc-chip">⏱️ <span id="scOpTimer">${Math.floor(OP.timeLeft / 60)}:${String(Math.max(0, OP.timeLeft % 60)).padStart(2, '0')}</span></span>
            <span class="sc-chip mint">🎯 ACC: ${acc}% (Req ${OP.def.minAcc}%)</span>
            <span class="sc-chip ${OP.alarms > 0 ? 'gold' : ''}">🚨 ALARMS: ${OP.alarms}/${OP.maxAlarms}</span>
            ${OP.scannerCharges > 0 ? `<button type="button" class="sc-chip sc-chip-btn violet" id="scUseScanner">📡 Syntax Scanner (${OP.scannerCharges})</button>` : ''}
          </div>
        </div>

        <!-- Live Enemy AI Security Bar -->
        <div class="sc-enemy-bar ${OP.alertActive ? 'alert' : ''}">
          <div class="sc-enemy-avatar"><img src="${OP.def.enemyImg}" alt="${escapeHtml(OP.def.enemy)}" /></div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <div>
                <div style="font-weight:800;font-size:18px;color:var(--sc-ink)">${OP.def.enemy}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--sc-cyan)">${OP.def.enemyTitle}</div>
              </div>
              ${phaseBanner}
            </div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${OP.alertActive ? 'var(--sc-crimson)' : 'var(--sc-soft)'}">${escapeHtml(OP.enemyLine)}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10.5px;margin-bottom:4px">
                  <span>FIREWALL INTEGRITY</span><span style="color:var(--sc-crimson)">${OP.firewallHp}%</span>
                </div>
                <div class="sc-meter-track"><div class="sc-meter-fill hp" style="width:${OP.firewallHp}%"></div></div>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10.5px;margin-bottom:4px">
                  <span>SECURITY TRACE ALERT</span><span style="color:var(--sc-gold)">${alarmPct}%</span>
                </div>
                <div class="sc-meter-track"><div class="sc-meter-fill alarm" style="width:${alarmPct}%"></div></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Live Exploit Terminal Stage -->
        <div class="sc-terminal-stage">
          <div class="sc-term-head">
            <span style="color:var(--sc-emerald)">root@syntax-clash:~# ./breach --target=${OP.def.nodeId}</span>
            <span style="color:var(--sc-soft)">PROGRESS: ${OP.idx}/${total}</span>
          </div>
          <div class="sc-term-body">
            ${interactionHtml}
            <div class="sc-op-feedback" id="scOpFeedback"></div>
          </div>
        </div>
      </div>`;

    document.getElementById('scOpAbort').onclick = closeOpArena;

    const scanBtn = document.getElementById('scUseScanner');
    if (scanBtn) {
      scanBtn.onclick = () => {
        if (OP.scannerCharges <= 0 || OP.answered) return;
        OP.scannerCharges--;
        const fb = document.getElementById('scOpFeedback');
        fb.className = 'sc-op-feedback show ok';
        fb.textContent = `📡 SYNTAX SCANNER INTEL: ${cur.rule}`;
        if (typeof window.snd === 'function') window.snd('click');
        scanBtn.textContent = `📡 Syntax Scanner (${OP.scannerCharges})`;
      };
    }

    document.querySelectorAll('[data-op-judge]').forEach((b) => {
      b.onclick = () => {
        const pick = b.getAttribute('data-op-judge') === 'true';
        resolveOpStep(pick === Boolean(cur.item.c), cur.rule);
      };
    });
    document.querySelectorAll('[data-op-fix]').forEach((b) => {
      b.onclick = () => {
        const pick = b.getAttribute('data-op-fix');
        resolveOpStep(pick.toLowerCase() === String(cur.ans).toLowerCase(), cur.rule);
      };
    });
    document.querySelectorAll('[data-op-spot]').forEach((b) => {
      b.onclick = () => {
        const idx = Number(b.getAttribute('data-op-spot'));
        resolveOpStep(idx === cur.item.e, cur.rule);
      };
    });
    document.querySelectorAll('[data-op-rec]').forEach((b) => {
      b.onclick = () => {
        if (OP.answered) return;
        OP.reconstructPick.push(Number(b.getAttribute('data-op-rec')));
        if (typeof window.snd === 'function') window.snd('key');
        renderOpArena();
      };
    });
    const recClear = document.getElementById('scRecClear');
    if (recClear) recClear.onclick = () => { OP.reconstructPick = []; renderOpArena(); };
    const recSub = document.getElementById('scRecSubmit');
    if (recSub) {
      recSub.onclick = () => {
        const built = OP.reconstructPick.map((i) => cur.words[i]).join(' ').trim();
        resolveOpStep(built.toLowerCase() === cur.target.toLowerCase(), cur.rule);
      };
    }
  }

  function resolveOpStep(isCorrect, ruleText) {
    if (!OP || OP.answered) return;
    OP.answered = true;
    const fb = document.getElementById('scOpFeedback');
    const stepDmg = Math.ceil(100 / OP.deck.length);

    if (isCorrect) {
      OP.correct++;
      OP.alertActive = false;
      OP.firewallHp = Math.max(0, OP.firewallHp - stepDmg);
      OP.enemyLine = OP.def.hurtLines[OP.correct % OP.def.hurtLines.length];
      if (typeof window.snd === 'function') window.snd('correct');
      fireGreenScan(`⚡ +${Math.round(OP.def.xp / OP.deck.length)} XP · PACKET EXTRACTED`);
      if (fb) {
        fb.className = 'sc-op-feedback show ok';
        fb.innerHTML = `✅ <b>NODE DEACTIVATED!</b> ${escapeHtml(ruleText)}`;
      }
    } else {
      OP.wrong++;
      OP.alarms++;
      OP.alertActive = true;
      OP.firewallHp = Math.min(100, OP.firewallHp + 12);
      OP.enemyLine = OP.def.taunts[OP.wrong % OP.def.taunts.length];
      if (typeof window.snd === 'function') window.snd('warn');
      fireRedAlert('🚨 SECURITY ALERT! FIREWALL +12%');
      if (fb) {
        fb.className = 'sc-op-feedback show bad';
        fb.innerHTML = `🚨 <b>SECURITY ALARM TRIGGERED!</b> Firewall reinforced! ${escapeHtml(ruleText)}`;
      }
      if (OP.alarms >= OP.maxAlarms) {
        setTimeout(() => finishOperation(false, 'FIREWALL LOCKOUT — TOO MANY SECURITY ALARMS'), 950);
        return;
      }
    }

    setTimeout(() => {
      if (!OP || OP.done) return;
      OP.idx++;
      OP.answered = false;
      OP.reconstructPick = [];
      renderOpArena();
    }, 900);
  }

  function finishOperation(victory, headline) {
    if (!OP || OP.done) return;
    OP.done = true;
    clearInterval(opTimer);
    const acc = Math.round((OP.correct / Math.max(1, OP.correct + OP.wrong)) * 100);
    let earned = { finalXp: 40, finalCr: 200, finalRep: 10 };

    if (victory) {
      if (typeof window.snd === 'function') window.snd('grant');
      if (typeof window.confetti === 'function') window.confetti(window.innerWidth / 2, 140, 80);
      earned = awardRpg(OP.def.xp, OP.def.credits, OP.def.rep, `CLEARED ${OP.def.name}`);
      if (!RPG.opsCleared.includes(OP.def.id)) RPG.opsCleared.push(OP.def.id);
      if (!RPG.tokens.includes(OP.def.token)) RPG.tokens.push(OP.def.token);
      if (OP.def.boss) RPG.bossDefeated++;
      saveProfile();
      postOperationToLeaderboard('syntax-clash-practice', `Syntax Clash RPG · ${OP.def.name}`, acc, OP.correct, OP.deck.length);
    } else {
      if (typeof window.snd === 'function') window.snd('over');
      earned = awardRpg(Math.max(20, OP.correct * 12), OP.correct * 60, 10, `ATTEMPTED ${OP.def.name}`);
    }

    const arena = document.getElementById('sc-op-arena');
    arena.innerHTML = `
      <div class="sc-arena-inner" style="max-width:680px;margin-top:24px">
        <div class="sc-op-card ${victory ? '' : 'boss-card'}">
          <div class="sc-op-banner" style="height:200px">
            <img src="${victory ? './images/syntax-clash-rpg/vault-breach.jpg' : OP.def.enemyImg}" alt="Operation result" />
            <div class="sc-op-banner-info">
              <div>
                <small>${victory ? 'MISSION ACCOMPLISHED // ROOT ACCESS GRANTED' : 'CONNECTION SEVERED // TRACE DETECTED'}</small>
                <h3>${headline}</h3>
              </div>
            </div>
          </div>
          <div class="sc-op-body" style="padding:22px">
            <div class="sc-grid-3" style="margin-bottom:14px">
              <div class="sc-chip mint" style="justify-content:center;padding:12px">🎯 Accuracy: ${acc}%</div>
              <div class="sc-chip" style="justify-content:center;padding:12px">⚡ +${earned.finalXp} XP</div>
              <div class="sc-chip gold" style="justify-content:center;padding:12px">💰 +$${earned.finalCr.toLocaleString()}</div>
            </div>
            ${victory ? `<div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--sc-violet);margin-bottom:14px">🔑 UNLOCKED: <b>${OP.def.token}</b> · +${earned.finalRep} Reputation · Academy XP Boosted!</div>` : ''}
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button type="button" class="sc-btn-primary" id="scOpRetry"><i class="fa-solid fa-rotate-right"></i> Run Operation Again</button>
              <button type="button" class="sc-btn-ghost" id="scOpReturn"><i class="fa-solid fa-house"></i> Return to Command Center</button>
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('scOpRetry').onclick = () => launchOperation(OP.def.id);
    document.getElementById('scOpReturn').onclick = closeOpArena;
  }

  /* ── Bridge Classic Modes into RPG Progression + Animations! ── */
  function hookClassicEngine() {
    if (typeof window.endGame === 'function' && !window.endGame._scHooked) {
      const origEnd = window.endGame;
      window.endGame = function () {
        const res = origEnd.apply(this, arguments);
        try {
          const gm = window.GM || {};
          const earnedXp = Math.max(25, (gm.tc || 1) * 18);
          const earnedCr = Math.max(150, (gm.score || 10) * 15);
          awardRpg(earnedXp, earnedCr, 25, `COMPLETED ${String(gm.mode || 'PROTOCOL').toUpperCase()}`);
          fireGreenScan(`⚡ +${earnedXp} XP · +$${earnedCr}`);
        } catch {}
        return res;
      };
      window.endGame._scHooked = true;
    }

    // Override renderMenu so returning from any classic sheet always renders our Cyberpunk Command Center!
    window.renderMenu = renderCommandCenter;
  }

  /* ── Boot ── */
  function init() {
    document.body.classList.add('sc-rpg-active');
    mountCyberCanvas();
    applyCmcTheme(safeGet('cmc-theme') === 'light', false);
    hookClassicEngine();
    renderCommandCenter();

    // Update live security camera clock + periodic ambient cyber telemetry
    setInterval(() => {
      const clk = document.getElementById('scCamClock');
      if (clk) clk.textContent = new Date().toTimeString().slice(0, 8);
    }, 1000);

    window.addEventListener('storage', (e) => {
      if (e.key === 'cmc-theme') applyCmcTheme(e.newValue === 'light', false);
    });

    // Expose clean API for tests & debugging
    window.CMC_SC_RPG = {
      getState: () => RPG,
      launchOperation,
      closeOpArena,
      renderCommandCenter,
      HACK_RANKS,
      ACADEMIES,
      OPERATIONS,
      PROTOCOLS,
      BOSS_PHASES,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
