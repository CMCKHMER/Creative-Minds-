/*
 * CMC Student Invite — bi-weekly test share links (teacher → student).
 *
 * Loaded from <head> of every public test page under tests/, BEFORE
 * teacher-gate.js. Flow (owner request, Nov 2026):
 *
 *   1. Teachers share a per-test link that carries their personal teacher
 *      ID code:  .../tests/<slug>.html?invite=<TEACHER-CODE>
 *   2. Students can open a test ONLY through such a link (everyone else
 *      still hits the teacher-gate lock). When ?invite= is present this
 *      script sets window.CMC_INVITE_OK so teacher-gate.js lets the page
 *      through for students.
 *   3. The test stays fully locked behind an entry card until the student
 *      enters their name + student ID and ticks the honour code — answers
 *      cannot be selected and the timer cannot start before that.
 *   4. The Start button starts the timer (V2 engine) / the enforced exam
 *      timer (week8-recap engine) and begins recording every answer with
 *      its elapsed time.
 *   5. Submit records the full attempt (score + per-question answers +
 *      duration + integrity flags + teacher code) into Firestore
 *      drill_attempts, then auto-redirects to the homepage hero which
 *      shows a thank-you message (?thanks=1). Students never see the
 *      correct answers in invite mode — the reveal/grading UI is skipped.
 *
 * Recording identity: anonymous Firebase sign-in is NOT enabled on the
 * project, but email/password sign-up is. The first attempt on a device
 * creates a throwaway "invite-…@cmc-invite.example" account (stored in
 * localStorage) and every later attempt reuses it — the drill_attempts
 * rules require studentUid == request.auth.uid, which this satisfies
 * without any teacher action. Extra attempt fields (inviteCode,
 * studentCode, answers, integrity, inviteMode, startedAt) pass freely:
 * the rules only validate the original scoreboard fields.
 *
 * Soft limits (same class as teacher-gate.js): this is a static GitHub
 * Pages deploy — a student who reads page source can find the answer
 * data and a determined one can bypass client checks. It raises the bar
 * for a classroom, it is not an anti-cheat guarantee.
 */
(function () {
  'use strict';

  /* ── 0. Session helpers (mirrors teacher-gate.js) ─────────────────── */
  function ls(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function setLs(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function detectRoleFromEmail(email) {
    var domain = (String(email || '').split('@')[1] || '').toLowerCase();
    return domain && domain.indexOf('edu') !== -1 ? 'teacher' : 'student';
  }
  function isTeacher() {
    if (!ls('cmc-student-token')) return false;
    var role = ls('cmc-student-role') || detectRoleFromEmail(ls('cmc-student-email'));
    return role === 'teacher';
  }
  function ss(key, val) {
    try {
      if (arguments.length === 2) { sessionStorage.setItem(key, val); return null; }
      return sessionStorage.getItem(key);
    } catch (e) { return null; }
  }

  var slug = (window.location.pathname.split('/').pop() || 'test').replace(/\.html$/, '');
  var LOCK_KEY = 'cmc-invite-attempt:' + slug;

  /* ── 1. Invite code from the URL (?invite=TEACHER-CODE) ───────────── */
  var rawInvite = '';
  try { rawInvite = new URLSearchParams(window.location.search).get('invite') || ''; } catch (e) {}
  var inviteCode = String(rawInvite).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  var INVITE_MODE = false;
  if (inviteCode.length >= 3 && !isTeacher()) INVITE_MODE = true;
  // Teacher preview (signed-in teacher, with or without ?invite=) → the
  // page keeps today's behaviour exactly: instant scoring + answers shown.
  window.CMC_INVITE_OK = INVITE_MODE;
  if (!INVITE_MODE) { flushPendingQueue(); return; }

  /* ── 2. Theme-aware palette (matches teacher-gate overlay) ────────── */
  function palette() {
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      bg: light ? '#f8fafc' : '#020617',
      cardBg: light ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.04)',
      border: light ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.10)',
      text: light ? '#1e293b' : '#f1f5f9',
      muted: light ? '#64748b' : '#94a3b8',
      glow1: light ? 'rgba(14,165,233,.10)' : 'rgba(56,189,248,.10)',
      glow2: light ? 'rgba(168,85,247,.08)' : 'rgba(139,92,246,.10)'
    };
  }

  /* ── 3. Entry overlay (shown before first paint of the test) ──────── */
  var OVERLAY_ID = 'cmc-invite-overlay';
  // Resolved lazily: at head-parse time TEST_CONFIG and <title> don't exist
  // yet — both are defined by inline scripts/markup further down the page.
  function getTestTitle() {
    var cfg = window.TEST_CONFIG || {};
    return cfg.title || document.title.split('·')[0].trim() || 'Bi-weekly test';
  }
  var startedAt = 0;
  var studentName = '', studentCode = '';
  var answerLog = {}; // qnum → { letters:'B', value:'1', sec:124 }
  var integrity = { blurs: 0, fsExits: 0 };
  var submitted = false;

  function ensureOverlayStyle() {
    if (document.getElementById('cmc-invite-style')) return;
    var st = document.createElement('style');
    st.id = 'cmc-invite-style';
    st.textContent =
      '#' + OVERLAY_ID + ' *{box-sizing:border-box}' +
      '#' + OVERLAY_ID + ' input{font-family:inherit}' +
      '#' + OVERLAY_ID + ' .ci-input{width:100%;padding:11px 13px;border-radius:11px;font-size:14px;' +
        'border:1px solid var(--ci-border);background:var(--ci-field);color:var(--ci-text);outline:none;transition:border-color .15s}' +
      '#' + OVERLAY_ID + ' .ci-input:focus{border-color:#38bdf8}' +
      '#' + OVERLAY_ID + ' .ci-btn{width:100%;padding:13px 18px;border:0;border-radius:12px;cursor:pointer;' +
        'background:linear-gradient(100deg,#c4b5fd,#67e8f9);color:#0f172a;font-size:14px;font-weight:800;' +
        'box-shadow:0 12px 36px -14px rgba(139,92,246,.75);transition:transform .15s,opacity .15s}' +
      '#' + OVERLAY_ID + ' .ci-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}' +
      '#' + OVERLAY_ID + ' .ci-btn:not(:disabled):hover{transform:translateY(-1px)}';
    document.documentElement.appendChild(st);
  }

  function buildOverlay(alreadyDone) {
    ensureOverlayStyle();
    var p = palette();
    var wrap = document.createElement('div');
    wrap.id = OVERLAY_ID;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Student test entry');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;' +
      'background:' + p.bg + ';' +
      'background-image:radial-gradient(ellipse 60% 40% at 15% 10%,' + p.glow1 + ',transparent 55%),' +
      'radial-gradient(ellipse 55% 45% at 85% 90%,' + p.glow2 + ',transparent 55%);' +
      "font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;color:" + p.text + ';';

    var inner = '<div style="max-width:430px;width:100%;text-align:center;padding:32px 26px;border-radius:18px;' +
      'background:' + p.cardBg + ';border:1px solid ' + p.border + ';' +
      'backdrop-filter:blur(12px);box-shadow:0 30px 80px -42px rgba(0,0,0,.6)">';

    if (alreadyDone) {
      var prev = {};
      try { prev = JSON.parse(ls(LOCK_KEY) || '{}'); } catch (e) {}
      var when = prev.at ? new Date(prev.at).toLocaleString() : '';
      inner +=
        '<div style="width:56px;height:56px;margin:0 auto;border-radius:16px;display:flex;align-items:center;justify-content:center;' +
        'background:linear-gradient(135deg,rgba(56,189,248,.16),rgba(139,92,246,.12));border:1px solid rgba(56,189,248,.35);color:#67e8f9;font-size:24px">' +
        '<i class="fas fa-lock" aria-hidden="true"></i></div>' +
        '<h1 style="margin:18px 0 0;font-family:Syne,Plus Jakarta Sans,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.02em">' +
        'Already submitted</h1>' +
        '<p style="margin:12px auto 0;max-width:340px;font-size:13px;line-height:1.65;color:' + p.muted + '">' +
        (prev.name ? '<b style="color:' + p.text + '">' + esc(prev.name) + '</b> — ' : '') +
        'this test was already submitted from this browser' + (when ? ' on ' + esc(when) : '') +
        '. Your teacher received the answers.</p>' +
        '<p style="margin:14px auto 0;max-width:340px;font-size:12px;line-height:1.6;color:' + p.muted + '">' +
        'Need a retake? Ask your teacher for help.</p>' +
        '<a href="../../" style="margin-top:22px;display:inline-flex;align-items:center;gap:7px;padding:12px 20px;border-radius:12px;' +
        'background:linear-gradient(100deg,#c4b5fd,#67e8f9);color:#0f172a;font-size:13px;font-weight:700;text-decoration:none;' +
        'box-shadow:0 12px 36px -14px rgba(139,92,246,.75)">' +
        '<i class="fas fa-house" aria-hidden="true"></i> Back to CMC</a>';
    } else {
      inner +=
        '<div style="display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;' +
        'background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.35);color:#c4b5fd">' +
        '<i class="fas fa-user-graduate" aria-hidden="true"></i> Bi-weekly test · invite only</div>' +
        '<h1 style="margin:16px 0 0;font-family:Syne,Plus Jakarta Sans,sans-serif;font-size:23px;line-height:1.25;' +
        'font-weight:800;letter-spacing:-0.02em">' + esc(getTestTitle()) + '</h1>' +
        '<p style="margin:10px 0 0;font-size:12.5px;line-height:1.6;color:' + p.muted + '">Your teacher invited you with code ' +
        '<b style="color:#67e8f9;letter-spacing:.06em">' + esc(inviteCode) + '</b></p>' +
        '<div style="margin-top:20px;text-align:left;display:grid;gap:12px">' +
        '<div><label for="ci-name" style="display:block;font-size:11px;font-weight:700;margin-bottom:5px;color:' + p.muted + '">FULL NAME</label>' +
        '<input id="ci-name" class="ci-input" type="text" autocomplete="name" maxlength="60" placeholder="e.g. Sok Dara"></div>' +
        '<div><label for="ci-sid" style="display:block;font-size:11px;font-weight:700;margin-bottom:5px;color:' + p.muted + '">STUDENT ID</label>' +
        '<input id="ci-sid" class="ci-input" type="text" maxlength="24" placeholder="e.g. CMC-0142"></div>' +
        '<label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer;padding:11px 12px;border-radius:11px;' +
        'border:1px solid ' + p.border + ';background:var(--ci-field)">' +
        '<input id="ci-honor" type="checkbox" style="margin-top:2px;accent-color:#8b5cf6;width:15px;height:15px">' +
        '<span style="font-size:11.5px;line-height:1.55;color:' + p.muted + '">I will work on my own — no help from other people, notes, apps, or other tabs.</span></label>' +
        '<button id="ci-start" class="ci-btn" type="button" disabled><i class="fas fa-play" aria-hidden="true"></i>&nbsp; Start test</button>' +
        '<p style="margin:2px 0 0;font-size:10.5px;line-height:1.55;color:' + p.muted + ';text-align:center">' +
        'The timer starts as soon as you click Start and records your answers for your teacher.</p>' +
        '</div>';
    }
    inner += '</div>';
    wrap.innerHTML = inner;
    // CSS vars for the inner inputs (theme-aware)
    wrap.style.setProperty('--ci-border', palette().border);
    wrap.style.setProperty('--ci-field', document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.05)');
    wrap.style.setProperty('--ci-text', palette().text);
    document.body.appendChild(wrap);

    if (!alreadyDone) wireEntryForm();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function wireEntryForm() {
    var nameEl = document.getElementById('ci-name');
    var sidEl = document.getElementById('ci-sid');
    var honorEl = document.getElementById('ci-honor');
    var startEl = document.getElementById('ci-start');
    if (!nameEl || !sidEl || !honorEl || !startEl) return;

    // Restore a half-finished entry from this session (page reload).
    var saved = null;
    try { saved = JSON.parse(ss('cmc-invite-entry:' + slug) || 'null'); } catch (e) {}
    if (saved) { nameEl.value = saved.name || ''; sidEl.value = saved.sid || ''; }

    function validate() {
      var ok = nameEl.value.trim().length >= 2 && sidEl.value.trim().length >= 2 && honorEl.checked;
      startEl.disabled = !ok;
    }
    nameEl.addEventListener('input', validate);
    sidEl.addEventListener('input', validate);
    honorEl.addEventListener('change', validate);
    startEl.addEventListener('click', beginTest);
    validate();
    try { nameEl.focus(); } catch (e) {}
  }

  /* ── 4. Start the test ────────────────────────────────────────────── */
  function beginTest() {
    var nameEl = document.getElementById('ci-name');
    var sidEl = document.getElementById('ci-sid');
    studentName = (nameEl && nameEl.value.trim()) || '';
    studentCode = (sidEl && sidEl.value.trim()) || '';
    if (studentName.length < 2 || studentCode.length < 2) return;
    ss('cmc-invite-entry:' + slug, JSON.stringify({ name: studentName, sid: studentCode }));
    startedAt = Date.now();

    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) { overlay.style.opacity = '0'; overlay.style.transition = 'opacity .25s'; setTimeout(function () { overlay.remove(); }, 260); }

    fillStudentFields();
    unlockFormInputs();
    startEngineTimer();
    startRecording();
    track('invite_start', { invite_code: inviteCode });
  }

  /** Fill the page's own name/date/id fields so native submit validation passes. */
  function fillStudentFields() {
    function setVal(id, val) {
      var el = document.getElementById(id);
      if (!el) {
        if (id !== 't-id') return;
        el = document.createElement('input');
        el.type = 'hidden'; el.id = 't-id';
        var form = document.getElementById('test-form');
        if (form) form.appendChild(el); else return;
      }
      el.value = val;
    }
    setVal('t-name', studentName);
    setVal('t-id', studentCode);
    var d = new Date();
    setVal('t-date', d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }

  /** V2 pages: timer is a manual widget → click Start for the student.
   *  W8 recap pages: their own start gate is beneath ours → drive it. */
  function startEngineTimer() {
    var gateStart = document.getElementById('gate-start');
    if (gateStart) {
      var honor = document.getElementById('honor-check');
      if (honor) honor.checked = true;
      var formEl = document.getElementById('test-form');
      if (formEl) formEl.style.display = '';
      setTimeout(function () { gateStart.click(); }, 120);
      return;
    }
    var minutes = document.querySelector('.timer-minutes');
    var startBtn = document.querySelector('.timer-start');
    if (minutes) {
      var mins = Number(window.TEST_CONFIG && window.TEST_CONFIG.examMinutes) || 20;
      minutes.value = String(Math.min(180, Math.max(1, mins)));
    }
    if (startBtn) setTimeout(function () { startBtn.click(); }, 120);
  }

  /** Lock every quiz input while the entry overlay is up — students cannot
   *  select answers or progress before name + ID + Start. */
  function lockQuizInputs() {
    var form = document.getElementById('test-form');
    if (!form) return;
    form.querySelectorAll('input[type="radio"],input[type="checkbox"]').forEach(function (i) { i.disabled = true; });
  }

  function unlockFormInputs() {
    var form = document.getElementById('test-form');
    if (!form) return;
    form.querySelectorAll('input[type="radio"],input[type="checkbox"]').forEach(function (i) { i.disabled = false; });
  }

  /* ── 5. Answer recording (per question, with elapsed seconds) ─────── */
  function startRecording() {
    var form = document.getElementById('test-form');
    if (form) {
      form.addEventListener('change', function (e) {
        var card = e.target && e.target.closest ? e.target.closest('.question-card') : null;
        if (!card || submitted) return;
        var qnum = card.dataset.qnum || '?';
        var checked = Array.prototype.slice.call(card.querySelectorAll('input:checked'));
        if (!checked.length) return;
        var inputs = Array.prototype.slice.call(card.querySelectorAll('input'));
        var letters = checked.map(function (i) {
          return String.fromCharCode(65 + inputs.indexOf(i));
        }).sort().join('');
        answerLog[qnum] = { letters: letters, sec: Math.round((Date.now() - startedAt) / 1000) };
        try { ss('cmc-invite-answers:' + slug, JSON.stringify(answerLog)); } catch (e) {}
      });
    }
    window.addEventListener('blur', function () {
      if (startedAt && !submitted && !document.hidden) integrity.blurs++;
    });
    document.addEventListener('fullscreenchange', function () {
      if (startedAt && !submitted && !document.fullscreenElement) integrity.fsExits++;
    });
    try {
      var prev = ss('cmc-invite-answers:' + slug);
      if (prev) answerLog = JSON.parse(prev) || {};
    } catch (e) {}
  }

  /* ── 6. Submit → record → hero thank-you redirect ─────────────────── */
  // Both engines expose a global doSubmit() (function declaration in a
  // classic script → writable window property). In invite mode we replace
  // it entirely: score is computed from the DOM, the attempt is recorded,
  // and the student is redirected — no answer reveal, no score screen.
  window.doSubmit = function () {
    if (submitted) return;
    submitted = true;
    recordAndRedirect();
  };
  // Belt-and-braces for engines wired directly to #rv-submit.
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('#rv-submit') && startedAt && !submitted) {
      e.preventDefault(); e.stopImmediatePropagation();
      submitted = true;
      recordAndRedirect();
    }
  }, true);

  function computeScore() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.question-card'));
    var correct = 0, answered = 0;
    var perQ = {};
    cards.forEach(function (card) {
      var qnum = card.dataset.qnum || '?';
      var checked = Array.prototype.slice.call(card.querySelectorAll('input:checked'));
      if (!checked.length) return;
      answered++;
      var inputs = Array.prototype.slice.call(card.querySelectorAll('input'));
      var letters = checked.map(function (i) { return String.fromCharCode(65 + inputs.indexOf(i)); }).sort().join('');
      perQ[qnum] = letters;
      var want = String(card.dataset.answer == null ? '' : card.dataset.answer);
      var vals = checked.map(function (i) { return i.value; }).sort().join('|');
      if (vals === want || (checked.length === 1 && String(Number(checked[0].value)) === want)) correct++;
    });
    return { cards: cards, correct: correct, answered: answered, perQ: perQ };
  }

  function recordAndRedirect() {
    var sc = computeScore();
    var total = sc.cards.length || 1;
    var pct = Math.max(0, Math.min(100, Math.round(sc.correct / total * 100)));
    var duration = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

    // Merge the live log (has timings) with the DOM snapshot (has everything).
    var merged = {};
    Object.keys(sc.perQ).forEach(function (q) { merged[q] = { letters: sc.perQ[q], sec: 0 }; });
    Object.keys(answerLog).forEach(function (q) {
      if (merged[q]) merged[q].sec = answerLog[q].sec || 0;
      else merged[q] = { letters: answerLog[q].letters, sec: answerLog[q].sec || 0 };
    });
    var answersStr = Object.keys(merged).sort(function (a, b) { return Number(a) - Number(b); })
      .map(function (q) { return q + ':' + merged[q].letters + (merged[q].sec ? ' (' + merged[q].sec + 's)' : ''); })
      .join('; ');

    var fields = {
      drillSlug: { stringValue: slug + '.html' },
      drillTitle: { stringValue: getTestTitle() },
      drillSource: { stringValue: 'biweek-planner' },
      studentName: { stringValue: studentName },
      studentUid: { stringValue: '__PENDING__' },
      classId: { nullValue: null },
      scorePct: { integerValue: String(pct) },
      correctCount: { integerValue: String(sc.correct) },
      totalCount: { integerValue: String(total) },
      durationSeconds: { integerValue: String(duration) },
      submittedAt: { timestampValue: new Date().toISOString() },
      inviteCode: { stringValue: inviteCode },
      studentCode: { stringValue: studentCode },
      inviteMode: { booleanValue: true },
      answers: { stringValue: answersStr || '(no answers recorded)' },
      startedAt: { timestampValue: new Date(startedAt || Date.now()).toISOString() },
      integrity: { mapValue: { fields: {
        blurs: { integerValue: String(integrity.blurs) },
        fsExits: { integerValue: String(integrity.fsExits) }
      } } }
    };

    showSending(function () {
      ensureInviteToken(function (token, uid) {
        if (!token || !uid) { queueAttempt(fields); goHome({ cloud: false }); return; }
        fields.studentUid = { stringValue: uid };
        fields.inviteUid = { stringValue: uid };
        postAttempt(token, fields, function (ok) {
          if (ok) {
            track('invite_submit', { invite_code: inviteCode, score_pct: pct, cloud: true });
            setLs(LOCK_KEY, JSON.stringify({ at: new Date().toISOString(), name: studentName, code: studentCode, score: sc.correct, total: total, pct: pct }));
            try { sessionStorage.removeItem('cmc-invite-answers:' + slug); sessionStorage.removeItem('cmc-invite-entry:' + slug); } catch (e) {}
            goHome({ cloud: true });
          } else {
            fields.studentUid = { stringValue: uid };
            queueAttempt(fields);
            goHome({ cloud: false });
          }
        });
      });
    });
  }

  function showSending(then) {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      var p = palette();
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;' +
        'background:' + p.bg + ";font-family:'Plus Jakarta Sans',sans-serif;color:" + p.text + ';';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '<div style="text-align:center">' +
      '<i class="fas fa-circle-notch fa-spin" style="font-size:30px;color:#67e8f9" aria-hidden="true"></i>' +
      '<p style="margin-top:14px;font-size:14px;font-weight:700">Recording your answers…</p>' +
      '<p style="margin-top:6px;font-size:11.5px;color:' + palette().muted + '">Do not close this page.</p></div>';
    setTimeout(then, 350);
  }

  function goHome(cloudState) {
    try {
      sessionStorage.setItem('cmc-invite-thanks', JSON.stringify({
        name: studentName, title: getTestTitle(), invite: inviteCode,
        cloud: cloudState.cloud, at: new Date().toISOString()
      }));
    } catch (e) {}
    try { window.location.replace('../../?thanks=1'); } catch (e) { window.location.href = '../../?thanks=1'; }
  }

  /* ── 7. Device-local Firebase identity (email/password sign-up) ───── */
  var FB_API_KEY = (window.CMC_FB_API_KEY || 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc');
  var AUTH_STORE = 'cmc-invite-auth';
  var authCache = null;

  function rand(n) {
    var s = '';
    while (s.length < n) s += Math.random().toString(36).slice(2);
    return s.slice(0, n);
  }

  function loadAuth() {
    if (authCache) return authCache;
    try { authCache = JSON.parse(ls(AUTH_STORE) || 'null'); } catch (e) { authCache = null; }
    return authCache;
  }

  function saveAuth(a) { authCache = a; setLs(AUTH_STORE, JSON.stringify(a)); }

  /** cb(idToken|null, uid|null) */
  function ensureInviteToken(cb) {
    var a = loadAuth();
    if (a && a.refresh) {
      try {
        fetch('https://securetoken.googleapis.com/v1/token?key=' + FB_API_KEY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(a.refresh)
        }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
          if (d && d.id_token) {
            a.uid = d.user_id || a.uid; a.refresh = d.refresh_token || a.refresh;
            a.expiresAt = Date.now() + ((Number(d.expires_in) || 3600) * 1000) - 60000;
            saveAuth(a);
            cb(d.id_token, a.uid);
          } else { createIdentity(cb); }
        }).catch(function () { cb(null, null); });
        return;
      } catch (e) { /* fall through to create */ }
    }
    createIdentity(cb);
  }

  function createIdentity(cb) {
    var email = 'invite-' + rand(14).toLowerCase() + '@cmc-invite.example';
    var password = rand(12) + 'aA7';
    try {
      fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FB_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
      }).then(function (r) { return r.ok ? r.json() : r.json().then(function (j) { throw new Error(j && j.error && j.error.message || 'SIGNUP_FAILED'); }); })
        .then(function (d) {
          saveAuth({ uid: d.localId, email: email, refresh: d.refreshToken, expiresAt: Date.now() + ((Number(d.expiresIn) || 3600) * 1000) - 60000 });
          cb(d.idToken, d.localId);
        })
        .catch(function () { cb(null, null); });
    } catch (e) { cb(null, null); }
  }

  function postAttempt(token, fields, cb) {
    try {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 9000) : null;
      fetch('https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ fields: fields }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        if (timer) clearTimeout(timer);
        cb(r.ok);
      }).catch(function () { if (timer) clearTimeout(timer); cb(false); });
    } catch (e) { cb(false); }
  }

  /* ── 8. Offline queue — retried on any later biweek page load ─────── */
  function queueAttempt(fields) {
    try {
      var q = JSON.parse(ls('cmc-invite-pending') || '[]');
      q.push({ at: new Date().toISOString(), fields: fields });
      while (q.length > 20) q.shift();
      setLs('cmc-invite-pending', JSON.stringify(q));
    } catch (e) {}
  }

  function flushPendingQueue() {
    var q;
    try { q = JSON.parse(ls('cmc-invite-pending') || '[]'); } catch (e) { q = []; }
    if (!q || !q.length) return;
    ensureInviteToken(function (token, uid) {
      if (!token || !uid) return;
      var remaining = q.slice();
      function next() {
        if (!remaining.length) { setLs('cmc-invite-pending', '[]'); return; }
        var item = remaining.shift();
        item.fields.studentUid = { stringValue: uid };
        if (item.fields.inviteUid) item.fields.inviteUid = { stringValue: uid };
        postAttempt(token, item.fields, function (ok) { if (ok) setTimeout(next, 250); else setLs('cmc-invite-pending', JSON.stringify([item].concat(remaining))); });
      }
      next();
    });
  }

  function track(event, params) {
    try { if (typeof window.cmcTrack === 'function') window.cmcTrack(event, params); } catch (e) {}
  }

  /* ── 9. Mount ─────────────────────────────────────────────────────── */
  var alreadyDone = false;
  try { alreadyDone = !!(ls(LOCK_KEY) && JSON.parse(ls(LOCK_KEY))); } catch (e) { alreadyDone = false; }
  function mount() {
    lockQuizInputs();
    buildOverlay(alreadyDone);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
