/*
 * World Class 1 — Teacher's Edition · Interactive Engine & Book Sync Runtime
 *
 * Powers public/gep/world-class-1/index.html and unit.html..unit12.html:
 *   - Two-way theme sync with the main CMC site via localStorage('cmc-theme')
 *   - Exact, zero-false-positive answer grading (contraction-aware, multi-answer
 *     '/' & '|' support, exercise-scoped — never leaks across cards)
 *   - Teacher Answer Key toggle (master topbar toggle + per-exercise Show Key)
 *     that displays inline key badges without overwriting typed responses
 *   - True/False/Possible (.tfp-btn), radio MCQ, survey, topic card & 1–5 star
 *     fluency self-assessment handlers + per-exercise Reset
 *   - Plain-text Enter/paste handling & ARIA roles for contenteditable blanks
 *   - Automatic per-unit localStorage persistence + whole-book progress rollup
 *     synced live across the Book Hub and all 12 unit navigation strips
 */
(function (global) {
  'use strict';

  var DOC = global.document;
  var ROOT = DOC.documentElement;
  var PROGRESS_KEY = 'cmc-wc1-progress';
  var KEY_PREF = 'cmc-wc1-show-keys';
  var THEME_KEY = 'cmc-theme';

  var UNITS = [
    { num: 1, file: 'unit.html',   title: 'Who We Are',                 grammar: 'Review of Past Tenses' },
    { num: 2, file: 'unit2.html',  title: 'The World Awaits',           grammar: 'Infinitives & Gerunds' },
    { num: 3, file: 'unit3.html',  title: 'The Great Energy Challenge', grammar: 'Review of Future Forms' },
    { num: 4, file: 'unit4.html',  title: "The World's a Stage",        grammar: 'Infinitive Complements' },
    { num: 5, file: 'unit5.html',  title: 'No Need to Panic',           grammar: 'Adverbial Clauses' },
    { num: 6, file: 'unit6.html',  title: 'In Style',                   grammar: 'Adjective Clauses' },
    { num: 7, file: 'unit7.html',  title: 'On the Move',                grammar: 'Comparative Forms' },
    { num: 8, file: 'unit8.html',  title: 'Think Twice',                grammar: 'Past Modals' },
    { num: 9, file: 'unit9.html',  title: 'In the Wild',                grammar: 'Review of Passive Voice' },
    { num: 10, file: 'unit10.html', title: 'Decisions, Decisions',      grammar: 'The Conditional' },
    { num: 11, file: 'unit11.html', title: 'Rain or Shine',             grammar: 'Phrasal Verbs' },
    { num: 12, file: 'unit12.html', title: "What's Your Game",          grammar: 'Reported Speech' }
  ];

  function lsGet(k) {
    try { return global.localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { global.localStorage.setItem(k, v); } catch (e) { /* quota / private mode */ }
  }
  function lsRemove(k) {
    try { global.localStorage.removeItem(k); } catch (e) { /* ignore */ }
  }

  function unitKey(n) { return 'cmc-wc1-unit:' + String(n); }
  function currentUnitNum() {
    var raw = ROOT.getAttribute('data-unit');
    var n = raw ? parseInt(raw, 10) : 0;
    return n >= 1 && n <= 12 ? n : 0;
  }

  /* ── 1. Theme Sync (dark smoked glass ↔ light milk glass) ──────────────── */
  function currentTheme() {
    return lsGet(THEME_KEY) === 'light' ? 'light' : 'dark';
  }

  function applyTheme(mode, persist) {
    var m = mode === 'light' ? 'light' : 'dark';
    ROOT.setAttribute('data-theme', m);
    if (m === 'light') ROOT.classList.add('light');
    else ROOT.classList.remove('light');
    if (persist) lsSet(THEME_KEY, m);

    var btns = DOC.querySelectorAll('[data-wc1-theme]');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      var isLight = m === 'light';
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      btn.setAttribute('title', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      btn.textContent = isLight ? '☀️ Light' : '🌙 Dark';
    }
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'light' ? 'dark' : 'light', true);
  }

  /* ── 2. Exact, Contraction-Aware Answer Normalization & Matching ───────── */
  var CONTRACTIONS = [
    [/\bwon't\b/g, 'will not'],
    [/\bcan't\b/g, 'cannot'],
    [/\bcannot\b/g, 'can not'],
    [/\bshan't\b/g, 'shall not'],
    [/\bdon't\b/g, 'do not'],
    [/\bdoesn't\b/g, 'does not'],
    [/\bdidn't\b/g, 'did not'],
    [/\bisn't\b/g, 'is not'],
    [/\baren't\b/g, 'are not'],
    [/\bwasn't\b/g, 'was not'],
    [/\bweren't\b/g, 'were not'],
    [/\bhaven't\b/g, 'have not'],
    [/\bhasn't\b/g, 'has not'],
    [/\bhadn't\b/g, 'had not'],
    [/\bwouldn't\b/g, 'would not'],
    [/\bcouldn't\b/g, 'could not'],
    [/\bshouldn't\b/g, 'should not'],
    [/\bmustn't\b/g, 'must not'],
    [/\bmightn't\b/g, 'might not'],
    [/\bi'm\b/g, 'i am'],
    [/\byou're\b/g, 'you are'],
    [/\bwe're\b/g, 'we are'],
    [/\bthey're\b/g, 'they are'],
    [/\bhe's\b/g, 'he is'],
    [/\bshe's\b/g, 'she is'],
    [/\bit's\b/g, 'it is'],
    [/\bthat's\b/g, 'that is'],
    [/\bthere's\b/g, 'there is'],
    [/\bi've\b/g, 'i have'],
    [/\byou've\b/g, 'you have'],
    [/\bwe've\b/g, 'we have'],
    [/\bthey've\b/g, 'they have'],
    [/\bi'll\b/g, 'i will'],
    [/\byou'll\b/g, 'you will'],
    [/\bhe'll\b/g, 'he will'],
    [/\bshe'll\b/g, 'she will'],
    [/\bit'll\b/g, 'it will'],
    [/\bwe'll\b/g, 'we will'],
    [/\bthey'll\b/g, 'they will'],
    [/^'ll\b/g, 'will'],
    [/^'m\b/g, 'am'],
    [/^'re\b/g, 'are'],
    [/^'ve\b/g, 'have'],
    [/^'d\b/g, 'would']
  ];

  function normalizeAnswer(raw) {
    var s = String(raw || '')
      .replace(/[\u2018\u2019\u2032`]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u00A0/g, ' ')
      .toLowerCase()
      .trim();

    // Normalize temperature notations like "-40°C", "-40 °c", "-40 degrees c", "-40c"
    s = s.replace(/(-?\d+)\s*(?:°|degrees?\s*)\s*c\b/g, '$1c');
    s = s.replace(/(-?\d+)\s*c\b/g, '$1c');

    for (var i = 0; i < CONTRACTIONS.length; i++) {
      s = s.replace(CONTRACTIONS[i][0], CONTRACTIONS[i][1]);
    }

    // Strip trailing sentence punctuation and normalize internal comma spacing
    s = s
      .replace(/[.?!;:]+$/g, '')
      .replace(/\s*,\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return s;
  }

  function splitAlternatives(rawExpected) {
    var parts = String(rawExpected || '').split(/\s*(?:\||\/)\s*/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p) out.push(p);
    }
    return out;
  }

  function primaryAnswer(rawExpected) {
    var alts = splitAlternatives(rawExpected);
    return alts.length ? alts[0] : String(rawExpected || '').trim();
  }

  /**
   * Returns true ONLY when `given` matches one of the accepted answers in
   * `rawExpected` after normalization — never passes substrings like "the",
   * "not", "off", or negated phrases like "did not lived".
   */
  function matchAnswer(given, rawExpected) {
    var normGiven = normalizeAnswer(given);
    if (!normGiven) return false;
    var alts = splitAlternatives(rawExpected);
    for (var i = 0; i < alts.length; i++) {
      if (normGiven === normalizeAnswer(alts[i])) return true;
    }
    return false;
  }

  /* ── 3. Feedback Banner Helper ─────────────────────────────────────────── */
  function showFeedback(exercise, correct, total, extraNote) {
    if (!exercise) return;
    var fb = exercise.querySelector('.feedback');
    if (!fb) {
      fb = DOC.createElement('div');
      fb.className = 'feedback';
      fb.setAttribute('role', 'status');
      fb.setAttribute('aria-live', 'polite');
      exercise.appendChild(fb);
    }
    fb.classList.remove('is-ok', 'is-partial', 'is-bad');
    var pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    var prefix = correct === total ? '✓ Perfect! ' : (correct > 0 ? 'Keep going — ' : '');
    fb.textContent = prefix + 'You got ' + correct + ' out of ' + total + ' correct (' + pct + '%).' + (extraNote ? ' ' + extraNote : '');
    fb.classList.add('show');
    if (correct === total && total > 0) fb.classList.add('is-ok');
    else if (correct > 0) fb.classList.add('is-partial');
    else fb.classList.add('is-bad');
  }

  function clearFeedback(exercise) {
    if (!exercise) return;
    var fb = exercise.querySelector('.feedback');
    if (fb) {
      fb.textContent = '';
      fb.classList.remove('show', 'is-ok', 'is-partial', 'is-bad');
    }
  }

  /* ── 4. Exercise-Scoped Grading Functions ──────────────────────────────── */
  function resolveExercise(btnOrSelector) {
    if (btnOrSelector && typeof btnOrSelector.closest === 'function') {
      var ex = btnOrSelector.closest('.exercise');
      if (ex) return ex;
    }
    if (typeof btnOrSelector === 'string') {
      return DOC.querySelector(btnOrSelector);
    }
    return null;
  }

  function gradeBlankExercise(exercise) {
    if (!exercise) return { correct: 0, total: 0 };
    var inputs = exercise.querySelectorAll('.blank-input[data-answer]');
    var correct = 0;
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var expected = input.getAttribute('data-answer') || '';
      var val = input.textContent || '';
      if (matchAnswer(val, expected)) {
        input.classList.add('correct');
        input.classList.remove('wrong');
        correct++;
      } else {
        input.classList.add('wrong');
        input.classList.remove('correct');
      }
    }
    exercise.setAttribute('data-checked', '1');
    exercise.setAttribute('data-score', correct + '/' + inputs.length);
    showFeedback(exercise, correct, inputs.length, '');
    saveUnitState();
    return { correct: correct, total: inputs.length };
  }

  function gradeTfpExercise(exercise) {
    if (!exercise) return { correct: 0, total: 0 };
    var groups = exercise.querySelectorAll('.tfp-options[data-tfp-answer]');
    var correct = 0;
    var answered = 0;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var want = (g.getAttribute('data-tfp-answer') || '').trim().toUpperCase();
      var picked = g.querySelector('.tfp-btn.selected');
      var row = g.closest('.wc1-tfp-row') || g.parentElement;
      var allBtns = g.querySelectorAll('.tfp-btn');
      for (var b = 0; b < allBtns.length; b++) {
        allBtns[b].classList.remove('is-correct', 'is-wrong');
      }
      if (row) row.classList.remove('correct-answer', 'wrong-answer');

      if (picked) {
        answered++;
        var got = (picked.textContent || '').trim().toUpperCase();
        if (got === want) {
          picked.classList.add('is-correct');
          if (row) row.classList.add('correct-answer');
          correct++;
        } else {
          picked.classList.add('is-wrong');
          if (row) row.classList.add('wrong-answer');
        }
      } else if (row) {
        row.classList.add('wrong-answer');
      }
    }
    exercise.setAttribute('data-checked', '1');
    exercise.setAttribute('data-score', correct + '/' + groups.length);
    var note = answered < groups.length ? '(' + (groups.length - answered) + ' unanswered)' : '';
    showFeedback(exercise, correct, groups.length, note);
    saveUnitState();
    return { correct: correct, total: groups.length };
  }

  function gradeRadioExercise(exercise) {
    if (!exercise) return { correct: 0, total: 0 };
    var groups = exercise.querySelectorAll('.wc1-radio-group[data-radio-answer]');
    var correct = 0;
    var answered = 0;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var want = (g.getAttribute('data-radio-answer') || '').trim().toLowerCase();
      var checked = g.querySelector('input[type="radio"]:checked');
      g.classList.remove('correct-answer', 'wrong-answer');
      if (checked) {
        answered++;
        if ((checked.value || '').trim().toLowerCase() === want) {
          g.classList.add('correct-answer');
          correct++;
        } else {
          g.classList.add('wrong-answer');
        }
      } else {
        g.classList.add('wrong-answer');
      }
    }
    exercise.setAttribute('data-checked', '1');
    exercise.setAttribute('data-score', correct + '/' + groups.length);
    var note = answered < groups.length ? '(' + (groups.length - answered) + ' unanswered)' : '';
    showFeedback(exercise, correct, groups.length, note);
    saveUnitState();
    return { correct: correct, total: groups.length };
  }

  function checkExercise(btn) {
    var ex = resolveExercise(btn);
    if (!ex) return { correct: 0, total: 0 };
    if (ex.querySelector('.blank-input[data-answer]')) return gradeBlankExercise(ex);
    if (ex.querySelector('.tfp-options[data-tfp-answer]')) return gradeTfpExercise(ex);
    if (ex.querySelector('.wc1-radio-group[data-radio-answer]')) return gradeRadioExercise(ex);
    return { correct: 0, total: 0 };
  }

  function toggleExerciseKey(btn) {
    var ex = resolveExercise(btn);
    if (!ex) return;
    var on = !ex.classList.contains('wc1-local-keys');
    if (on) ex.classList.add('wc1-local-keys');
    else ex.classList.remove('wc1-local-keys');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? '🙈 Hide Key' : '🔑 Show Key';
    }
  }

  function resetExercise(btn) {
    var ex = resolveExercise(btn);
    if (!ex) return;
    var blanks = ex.querySelectorAll('.blank-input');
    for (var i = 0; i < blanks.length; i++) {
      blanks[i].textContent = '';
      blanks[i].classList.remove('correct', 'wrong');
    }
    var tfpBtns = ex.querySelectorAll('.tfp-btn');
    for (var j = 0; j < tfpBtns.length; j++) {
      tfpBtns[j].classList.remove('selected', 'is-correct', 'is-wrong');
      tfpBtns[j].setAttribute('aria-pressed', 'false');
    }
    var marked = ex.querySelectorAll('.correct-answer, .wrong-answer');
    for (var k = 0; k < marked.length; k++) {
      marked[k].classList.remove('correct-answer', 'wrong-answer');
    }
    var radios = ex.querySelectorAll('input[type="radio"]');
    for (var r = 0; r < radios.length; r++) radios[r].checked = false;
    ex.classList.remove('wc1-local-keys');
    ex.removeAttribute('data-checked');
    ex.removeAttribute('data-score');
    var keyBtn = ex.querySelector('.wc1-key-btn');
    if (keyBtn) {
      keyBtn.setAttribute('aria-pressed', 'false');
      keyBtn.textContent = '🔑 Show Key';
    }
    clearFeedback(ex);
    saveUnitState();
  }

  /* ── 5. Master Teacher Answer Key Toggle ───────────────────────────────── */
  function applyGlobalKeys(show, persist) {
    if (show) ROOT.classList.add('wc1-show-keys');
    else ROOT.classList.remove('wc1-show-keys');
    if (persist) lsSet(KEY_PREF, show ? '1' : '0');
    var btns = DOC.querySelectorAll('[data-wc1-keys]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', show ? 'true' : 'false');
      btns[i].textContent = show ? '🔑 Key: On' : '🔑 Answer Key';
    }
  }

  function toggleGlobalKeys() {
    applyGlobalKeys(!ROOT.classList.contains('wc1-show-keys'), true);
  }

  function injectKeyBadges() {
    var blanks = DOC.querySelectorAll('.blank-input[data-answer]');
    for (var i = 0; i < blanks.length; i++) {
      var b = blanks[i];
      if (b.nextElementSibling && b.nextElementSibling.classList.contains('wc1-key-hint')) continue;
      var hint = DOC.createElement('span');
      hint.className = 'wc1-key-hint';
      hint.setAttribute('aria-label', 'Answer key');
      hint.textContent = '✓ ' + primaryAnswer(b.getAttribute('data-answer'));
      if (b.parentNode) b.parentNode.insertBefore(hint, b.nextSibling);
    }

    var tfpGroups = DOC.querySelectorAll('.tfp-options[data-tfp-answer]');
    for (var j = 0; j < tfpGroups.length; j++) {
      var g = tfpGroups[j];
      var want = (g.getAttribute('data-tfp-answer') || '').trim().toUpperCase();
      var btns = g.querySelectorAll('.tfp-btn');
      for (var m = 0; m < btns.length; m++) {
        if ((btns[m].textContent || '').trim().toUpperCase() === want) {
          btns[m].setAttribute('data-is-key', 'true');
        }
      }
      if (!g.querySelector('.wc1-key-hint')) {
        var th = DOC.createElement('span');
        th.className = 'wc1-key-hint';
        th.textContent = 'Key: ' + want;
        g.appendChild(th);
      }
    }

    var radioGroups = DOC.querySelectorAll('.wc1-radio-group[data-radio-answer]');
    for (var r = 0; r < radioGroups.length; r++) {
      var rg = radioGroups[r];
      var rw = (rg.getAttribute('data-radio-answer') || '').trim().toUpperCase();
      if (!rg.querySelector('.wc1-key-hint')) {
        var rh = DOC.createElement('span');
        rh.className = 'wc1-key-hint';
        rh.textContent = 'Key: ' + rw;
        var qHead = rg.querySelector('.wc1-radio-q') || rg;
        qHead.appendChild(rh);
      }
    }
  }

  /* ── 6. Interactive Widget Handlers (backwards-compatible globals) ─────── */
  function checkVocab(btn) {
    var ex = resolveExercise(btn) || DOC.querySelector('#vocab .exercise, #vocabulary .exercise');
    return gradeBlankExercise(ex);
  }

  function checkGrammar(btn) {
    var ex = resolveExercise(btn) || DOC.querySelector('#grammar .exercise');
    return gradeBlankExercise(ex);
  }

  function checkQuiz(btn) {
    var ex = resolveExercise(btn) || DOC.querySelector('#vocab .exercise, #vocabulary .exercise');
    return checkExercise(ex);
  }

  function toggleQuiz(el) {
    if (!el) return;
    var opt = el.closest ? el.closest('.quiz-option') : el.parentElement;
    if (opt) opt.classList.remove('correct-answer', 'wrong-answer');
    saveUnitState();
  }

  function selectTFP(btn) {
    if (!btn || !btn.parentElement) return;
    var group = btn.parentElement;
    var wasSelected = btn.classList.contains('selected');
    var siblings = group.querySelectorAll('.tfp-btn');
    for (var i = 0; i < siblings.length; i++) {
      siblings[i].classList.remove('selected', 'is-correct', 'is-wrong');
      siblings[i].setAttribute('aria-pressed', 'false');
    }
    if (!wasSelected) {
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
    }
    var row = group.closest ? group.closest('.wc1-tfp-row') : group.parentElement;
    if (row) row.classList.remove('correct-answer', 'wrong-answer');
    saveUnitState();
  }

  function selectSurvey(opt) {
    if (!opt || !opt.parentElement) return;
    var wasSelected = opt.classList.contains('selected');
    var siblings = opt.parentElement.querySelectorAll('.survey-opt');
    for (var i = 0; i < siblings.length; i++) {
      siblings[i].classList.remove('selected');
      siblings[i].setAttribute('aria-pressed', 'false');
    }
    if (!wasSelected) {
      opt.classList.add('selected');
      opt.setAttribute('aria-pressed', 'true');
    }
    saveUnitState();
  }

  function selectTopic(el) {
    if (!el) return;
    var scope = (el.closest && el.closest('.card')) || DOC;
    var all = scope.querySelectorAll('.energy-stat');
    var wasSelected = el.classList.contains('selected');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.remove('selected');
      all[i].style.background = '';
      all[i].style.borderColor = '';
      all[i].setAttribute('aria-pressed', 'false');
    }
    if (!wasSelected) {
      el.classList.add('selected');
      el.setAttribute('aria-pressed', 'true');
    }
    saveUnitState();
  }

  function rate(star, num) {
    if (!star || !star.parentElement) return;
    var parent = star.parentElement;
    var stars = parent.querySelectorAll('.star');
    var current = parseInt(parent.getAttribute('data-rating') || '0', 10);
    var next = current === num ? 0 : num;
    parent.setAttribute('data-rating', String(next));
    for (var i = 0; i < stars.length; i++) {
      var active = i < next;
      if (active) stars[i].classList.add('active');
      else stars[i].classList.remove('active');
      stars[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    saveUnitState();
  }

  /* ── 7. Per-Unit State Autosave & Cross-Book Progress Rollup ───────────── */
  function readProgress() {
    try {
      var raw = lsGet(PROGRESS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function gradableExercises() {
    return DOC.querySelectorAll('.exercise[data-gradable="1"]');
  }

  function updateUnitBadges() {
    var prog = readProgress();
    var pills = DOC.querySelectorAll('.wc1-unit-pill[data-unit-num]');
    for (var i = 0; i < pills.length; i++) {
      var un = pills[i].getAttribute('data-unit-num');
      var rec = prog[un];
      if (rec && rec.total > 0 && rec.checked >= rec.total) {
        pills[i].classList.add('done');
      } else {
        pills[i].classList.remove('done');
      }
    }

    var cur = currentUnitNum();
    if (cur) {
      var chip = DOC.querySelector('[data-wc1-unit-progress]');
      var exs = gradableExercises();
      var done = 0;
      for (var e = 0; e < exs.length; e++) {
        if (exs[e].getAttribute('data-checked') === '1') done++;
      }
      if (chip) {
        chip.textContent = done + ' / ' + exs.length + ' exercises checked';
      }
    }
  }

  function saveUnitState() {
    var u = currentUnitNum();
    if (!u) return;

    var state = {
      blanks: [],
      inputs: [],
      areas: [],
      checks: [],
      radios: [],
      tfp: [],
      surveys: [],
      topics: [],
      ratings: [],
      scores: {}
    };

    var blanks = DOC.querySelectorAll('.blank-input');
    for (var i = 0; i < blanks.length; i++) state.blanks.push(blanks[i].textContent || '');

    var inputs = DOC.querySelectorAll('.container input[type="text"], .container input[type="email"], .container input[type="date"]');
    for (var t = 0; t < inputs.length; t++) state.inputs.push(inputs[t].value || '');

    var areas = DOC.querySelectorAll('.container textarea');
    for (var a = 0; a < areas.length; a++) state.areas.push(areas[a].value || '');

    var cbs = DOC.querySelectorAll('.container input[type="checkbox"]');
    for (var c = 0; c < cbs.length; c++) state.checks.push(Boolean(cbs[c].checked));

    var rds = DOC.querySelectorAll('.container input[type="radio"]');
    for (var r = 0; r < rds.length; r++) state.radios.push(Boolean(rds[r].checked));

    var tfps = DOC.querySelectorAll('.tfp-options');
    for (var f = 0; f < tfps.length; f++) {
      var sel = tfps[f].querySelector('.tfp-btn.selected');
      state.tfp.push(sel ? (sel.textContent || '').trim() : '');
    }

    var survs = DOC.querySelectorAll('.survey-opts');
    for (var s = 0; s < survs.length; s++) {
      var sSel = survs[s].querySelector('.survey-opt.selected');
      state.surveys.push(sSel ? (sSel.textContent || '').trim() : '');
    }

    var tops = DOC.querySelectorAll('.energy-stat');
    for (var p = 0; p < tops.length; p++) state.topics.push(tops[p].classList.contains('selected'));

    var rats = DOC.querySelectorAll('.rating');
    for (var g = 0; g < rats.length; g++) {
      state.ratings.push(parseInt(rats[g].getAttribute('data-rating') || '0', 10));
    }

    var exs = gradableExercises();
    var checkedCount = 0;
    for (var e = 0; e < exs.length; e++) {
      var sc = exs[e].getAttribute('data-score');
      if (exs[e].getAttribute('data-checked') === '1' && sc) {
        state.scores[String(e)] = sc;
        checkedCount++;
      }
    }

    lsSet(unitKey(u), JSON.stringify(state));

    var prog = readProgress();
    prog[String(u)] = {
      visited: true,
      checked: checkedCount,
      total: exs.length,
      updatedAt: Date.now()
    };
    lsSet(PROGRESS_KEY, JSON.stringify(prog));
    updateUnitBadges();
  }

  function restoreUnitState() {
    var u = currentUnitNum();
    if (!u) return;
    var raw = lsGet(unitKey(u));
    var exs = gradableExercises();

    if (!raw) {
      // Mark unit as visited in rollup for "Continue" on Book Hub
      var prog = readProgress();
      if (!prog[String(u)]) {
        prog[String(u)] = { visited: true, checked: 0, total: exs.length, updatedAt: Date.now() };
        lsSet(PROGRESS_KEY, JSON.stringify(prog));
      }
      updateUnitBadges();
      return;
    }

    try {
      var state = JSON.parse(raw);
      if (!state || typeof state !== 'object') return;

      var blanks = DOC.querySelectorAll('.blank-input');
      if (Array.isArray(state.blanks)) {
        for (var i = 0; i < blanks.length && i < state.blanks.length; i++) {
          blanks[i].textContent = String(state.blanks[i] || '');
        }
      }

      var inputs = DOC.querySelectorAll('.container input[type="text"], .container input[type="email"], .container input[type="date"]');
      if (Array.isArray(state.inputs)) {
        for (var t = 0; t < inputs.length && t < state.inputs.length; t++) {
          inputs[t].value = String(state.inputs[t] || '');
        }
      }

      var areas = DOC.querySelectorAll('.container textarea');
      if (Array.isArray(state.areas)) {
        for (var a = 0; a < areas.length && a < state.areas.length; a++) {
          areas[a].value = String(state.areas[a] || '');
        }
      }

      var cbs = DOC.querySelectorAll('.container input[type="checkbox"]');
      if (Array.isArray(state.checks)) {
        for (var c = 0; c < cbs.length && c < state.checks.length; c++) {
          cbs[c].checked = Boolean(state.checks[c]);
        }
      }

      var rds = DOC.querySelectorAll('.container input[type="radio"]');
      if (Array.isArray(state.radios)) {
        for (var r = 0; r < rds.length && r < state.radios.length; r++) {
          rds[r].checked = Boolean(state.radios[r]);
        }
      }

      var tfps = DOC.querySelectorAll('.tfp-options');
      if (Array.isArray(state.tfp)) {
        for (var f = 0; f < tfps.length && f < state.tfp.length; f++) {
          var want = state.tfp[f];
          if (!want) continue;
          var btns = tfps[f].querySelectorAll('.tfp-btn');
          for (var b = 0; b < btns.length; b++) {
            if ((btns[b].textContent || '').trim() === want) {
              btns[b].classList.add('selected');
              btns[b].setAttribute('aria-pressed', 'true');
            }
          }
        }
      }

      var survs = DOC.querySelectorAll('.survey-opts');
      if (Array.isArray(state.surveys)) {
        for (var s = 0; s < survs.length && s < state.surveys.length; s++) {
          var sw = state.surveys[s];
          if (!sw) continue;
          var sBtns = survs[s].querySelectorAll('.survey-opt');
          for (var sb = 0; sb < sBtns.length; sb++) {
            if ((sBtns[sb].textContent || '').trim() === sw) {
              sBtns[sb].classList.add('selected');
              sBtns[sb].setAttribute('aria-pressed', 'true');
            }
          }
        }
      }

      var tops = DOC.querySelectorAll('.energy-stat');
      if (Array.isArray(state.topics)) {
        for (var p = 0; p < tops.length && p < state.topics.length; p++) {
          if (state.topics[p]) {
            tops[p].classList.add('selected');
            tops[p].setAttribute('aria-pressed', 'true');
          }
        }
      }

      var rats = DOC.querySelectorAll('.rating');
      if (Array.isArray(state.ratings)) {
        for (var g = 0; g < rats.length && g < state.ratings.length; g++) {
          var rv = parseInt(state.ratings[g], 10) || 0;
          rats[g].setAttribute('data-rating', String(rv));
          var st = rats[g].querySelectorAll('.star');
          for (var si = 0; si < st.length; si++) {
            if (si < rv) {
              st[si].classList.add('active');
              st[si].setAttribute('aria-pressed', 'true');
            }
          }
        }
      }

      if (state.scores && typeof state.scores === 'object') {
        for (var e = 0; e < exs.length; e++) {
          if (state.scores[String(e)]) {
            exs[e].setAttribute('data-checked', '1');
            exs[e].setAttribute('data-score', state.scores[String(e)]);
          }
        }
      }
    } catch (e) { /* corrupted storage — ignore safely */ }

    updateUnitBadges();
  }

  function resetUnit() {
    var u = currentUnitNum();
    if (!u) return;
    lsRemove(unitKey(u));
    var exs = DOC.querySelectorAll('.exercise');
    for (var i = 0; i < exs.length; i++) resetExercise(exs[i]);
    var inputs = DOC.querySelectorAll('.container input[type="text"], .container input[type="email"], .container input[type="date"]');
    for (var t = 0; t < inputs.length; t++) inputs[t].value = '';
    var areas = DOC.querySelectorAll('.container textarea');
    for (var a = 0; a < areas.length; a++) areas[a].value = '';
    var cbs = DOC.querySelectorAll('.container input[type="checkbox"]');
    for (var c = 0; c < cbs.length; c++) cbs[c].checked = false;
    var rds = DOC.querySelectorAll('.container input[type="radio"]');
    for (var r = 0; r < rds.length; r++) rds[r].checked = false;
    var survs = DOC.querySelectorAll('.survey-opt.selected, .energy-stat.selected');
    for (var s = 0; s < survs.length; s++) {
      survs[s].classList.remove('selected');
      survs[s].setAttribute('aria-pressed', 'false');
    }
    var rats = DOC.querySelectorAll('.rating');
    for (var g = 0; g < rats.length; g++) {
      rats[g].setAttribute('data-rating', '0');
      var st = rats[g].querySelectorAll('.star');
      for (var si = 0; si < st.length; si++) {
        st[si].classList.remove('active');
        st[si].setAttribute('aria-pressed', 'false');
      }
    }
    var prog = readProgress();
    prog[String(u)] = { visited: true, checked: 0, total: gradableExercises().length, updatedAt: Date.now() };
    lsSet(PROGRESS_KEY, JSON.stringify(prog));
    updateUnitBadges();
  }

  /* ── 8. Contenteditable Accessibility, Plain-Text Paste & Scroll Spy ───── */
  function enhanceInputs() {
    var allBlanks = Array.prototype.slice.call(DOC.querySelectorAll('.blank-input'));
    allBlanks.forEach(function (el, idx) {
      el.setAttribute('role', 'textbox');
      el.setAttribute('tabindex', '0');
      el.setAttribute('spellcheck', 'false');
      if (!el.getAttribute('aria-label')) {
        el.setAttribute('aria-label', 'Blank ' + (idx + 1));
      }
      if (!el.getAttribute('data-placeholder')) {
        el.setAttribute('data-placeholder', 'type…');
      }
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          var next = allBlanks[idx + 1];
          if (next) next.focus();
        }
      });
      el.addEventListener('paste', function (ev) {
        ev.preventDefault();
        var text = '';
        if (ev.clipboardData && ev.clipboardData.getData) {
          text = ev.clipboardData.getData('text/plain');
        }
        text = String(text || '').replace(/[\r\n]+/g, ' ');
        var sel = global.getSelection ? global.getSelection() : null;
        if (sel && sel.rangeCount) {
          sel.deleteFromDocument();
          sel.getRangeAt(0).insertNode(DOC.createTextNode(text));
          sel.collapseToEnd();
        } else {
          el.textContent = (el.textContent || '') + text;
        }
        el.classList.remove('correct', 'wrong');
        saveUnitState();
      });
      el.addEventListener('input', function () {
        el.classList.remove('correct', 'wrong');
        saveUnitState();
      });
    });

    var container = DOC.querySelector('.container');
    if (container) {
      container.addEventListener('input', function (ev) {
        var t = ev.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
          saveUnitState();
        }
      });
      container.addEventListener('change', function (ev) {
        var t = ev.target;
        if (t && (t.type === 'checkbox' || t.type === 'radio')) {
          var rg = t.closest && t.closest('.wc1-radio-group');
          if (rg) rg.classList.remove('correct-answer', 'wrong-answer');
          saveUnitState();
        }
      });
    }
  }

  function initScrollSpy() {
    var nav = DOC.querySelector('.section-nav');
    if (!nav || typeof global.IntersectionObserver !== 'function') return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var map = {};
    var targets = [];
    links.forEach(function (a) {
      var id = (a.getAttribute('href') || '').slice(1);
      var sec = id ? DOC.getElementById(id) : null;
      if (sec) {
        map[id] = a;
        targets.push(sec);
      }
    });
    if (!targets.length) return;
    var obs = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var active = map[entry.target.id];
        if (!active) return;
        links.forEach(function (l) { l.classList.remove('is-current'); });
        active.classList.add('is-current');
      });
    }, { rootMargin: '-22% 0px -68% 0px', threshold: 0 });
    targets.forEach(function (t) { obs.observe(t); });
  }

  /* ── 9. Book Hub (index.html) Search, Filter, Scope & Live Progress ────── */
  function initHub() {
    var grid = DOC.querySelector('[data-wc1-hub-grid]');
    if (!grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-unit-card]'));
    var search = DOC.querySelector('[data-wc1-search]');
    var filterBtns = Array.prototype.slice.call(DOC.querySelectorAll('[data-wc1-filter]'));
    var emptyMsg = DOC.querySelector('[data-wc1-empty]');
    var scopeToggle = DOC.querySelector('[data-wc1-scope-toggle]');
    var scopePanel = DOC.querySelector('[data-wc1-scope-panel]');
    var activeFilter = 'all';

    function refreshHubProgress() {
      var prog = readProgress();
      var totalChecked = 0;
      var totalEx = 0;
      var visitedUnits = 0;
      var latestUnit = 0;
      var latestTime = 0;

      cards.forEach(function (card) {
        var un = card.getAttribute('data-unit-card');
        var defTotal = parseInt(card.getAttribute('data-ex-count') || '0', 10);
        var rec = prog[un];
        var ch = rec ? (rec.checked || 0) : 0;
        var tot = (rec && rec.total) ? rec.total : defTotal;
        totalChecked += ch;
        totalEx += tot;
        if (rec && rec.visited) {
          visitedUnits++;
          card.setAttribute('data-started', '1');
          if ((rec.updatedAt || 0) > latestTime) {
            latestTime = rec.updatedAt || 0;
            latestUnit = parseInt(un, 10);
          }
        } else {
          card.setAttribute('data-started', '0');
        }
        var status = card.querySelector('[data-unit-status]');
        if (status) {
          if (ch >= tot && tot > 0) {
            status.textContent = '✓ ' + ch + '/' + tot + ' checked';
            status.classList.add('is-done');
          } else if (ch > 0) {
            status.textContent = ch + '/' + tot + ' checked';
            status.classList.remove('is-done');
          } else if (rec && rec.visited) {
            status.textContent = 'Opened · ' + tot + ' exercises';
            status.classList.remove('is-done');
          } else {
            status.textContent = tot + ' interactive checks';
            status.classList.remove('is-done');
          }
        }
      });

      var statProgress = DOC.querySelector('[data-wc1-total-checked]');
      if (statProgress) statProgress.textContent = totalChecked + ' / ' + totalEx;

      var statVisited = DOC.querySelector('[data-wc1-visited-count]');
      if (statVisited) statVisited.textContent = visitedUnits + ' / 12';

      var contBtn = DOC.querySelector('[data-wc1-continue]');
      if (contBtn) {
        var meta = latestUnit ? UNITS[latestUnit - 1] : UNITS[0];
        contBtn.href = meta.file;
        contBtn.textContent = latestUnit
          ? 'Continue Unit ' + meta.num + ': ' + meta.title + ' →'
          : 'Start Unit 1: Who We Are →';
      }
      updateUnitBadges();
    }

    function applyFilter() {
      var q = search ? normalizeAnswer(search.value) : '';
      var shown = 0;
      cards.forEach(function (card) {
        var n = parseInt(card.getAttribute('data-unit-card') || '0', 10);
        var hay = (card.getAttribute('data-search') || '').toLowerCase();
        var started = card.getAttribute('data-started') === '1';
        var passGroup =
          activeFilter === 'all' ||
          (activeFilter === '1-6' && n >= 1 && n <= 6) ||
          (activeFilter === '7-12' && n >= 7 && n <= 12) ||
          (activeFilter === 'started' && started);
        var passQuery = !q || hay.indexOf(q) !== -1;
        var vis = passGroup && passQuery;
        card.style.display = vis ? '' : 'none';
        if (vis) shown++;
      });
      if (emptyMsg) emptyMsg.style.display = shown === 0 ? 'block' : 'none';
    }

    if (search) search.addEventListener('input', applyFilter);
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-wc1-filter') || 'all';
        filterBtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyFilter();
      });
    });

    if (scopeToggle && scopePanel) {
      scopeToggle.addEventListener('click', function () {
        var open = scopePanel.hidden;
        scopePanel.hidden = !open;
        scopeToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        scopeToggle.textContent = open ? '📋 Hide Scope & Sequence' : '📋 Scope & Sequence';
      });
    }

    refreshHubProgress();
    global.addEventListener('storage', refreshHubProgress);
    global.addEventListener('focus', refreshHubProgress);
  }

  /* ── 10. Boot & Global Synchronization ─────────────────────────────────── */
  function boot() {
    applyTheme(currentTheme(), false);
    applyGlobalKeys(lsGet(KEY_PREF) === '1', false);

    // Wire Back-to-CMC links dynamically using resolved app root when available
    if (global.CMC_WC1_APP_ROOT) {
      var homeLinks = DOC.querySelectorAll('[data-wc1-cmc-home]');
      for (var h = 0; h < homeLinks.length; h++) {
        homeLinks[h].setAttribute('href', global.CMC_WC1_APP_ROOT + '#gep-isec');
      }
    }

    var themeBtns = DOC.querySelectorAll('[data-wc1-theme]');
    for (var i = 0; i < themeBtns.length; i++) {
      themeBtns[i].addEventListener('click', toggleTheme);
    }

    var keyBtns = DOC.querySelectorAll('[data-wc1-keys]');
    for (var k = 0; k < keyBtns.length; k++) {
      keyBtns[k].addEventListener('click', toggleGlobalKeys);
    }

    var printBtns = DOC.querySelectorAll('[data-wc1-print]');
    for (var p = 0; p < printBtns.length; p++) {
      printBtns[p].addEventListener('click', function () { global.print(); });
    }

    var resetUnitBtns = DOC.querySelectorAll('[data-wc1-reset-unit]');
    for (var ru = 0; ru < resetUnitBtns.length; ru++) {
      resetUnitBtns[ru].addEventListener('click', resetUnit);
    }

    if (currentUnitNum()) {
      injectKeyBadges();
      enhanceInputs();
      restoreUnitState();
      initScrollSpy();
    } else {
      initHub();
    }

    // Live cross-tab sync for theme, key visibility, and progress dots
    global.addEventListener('storage', function (ev) {
      if (!ev || ev.key === THEME_KEY) applyTheme(currentTheme(), false);
      if (!ev || ev.key === KEY_PREF) applyGlobalKeys(lsGet(KEY_PREF) === '1', false);
      if (!ev || ev.key === PROGRESS_KEY) updateUnitBadges();
    });

    // Keyboard navigation (Alt+ArrowLeft / Alt+ArrowRight between units)
    DOC.addEventListener('keydown', function (ev) {
      var t = ev.target;
      var editing = t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (editing) return;
      var u = currentUnitNum();
      if (ev.altKey && u) {
        if (ev.key === 'ArrowLeft' && u > 1) {
          ev.preventDefault();
          global.location.assign(UNITS[u - 2].file);
        } else if (ev.key === 'ArrowRight' && u < 12) {
          ev.preventDefault();
          global.location.assign(UNITS[u].file);
        }
      }
    });
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Export clean namespace + backwards-compatible unit handlers
  global.WC1 = {
    UNITS: UNITS,
    normalizeAnswer: normalizeAnswer,
    matchAnswer: matchAnswer,
    checkExercise: checkExercise,
    toggleExerciseKey: toggleExerciseKey,
    resetExercise: resetExercise,
    resetUnit: resetUnit,
    toggleTheme: toggleTheme,
    applyTheme: applyTheme,
    toggleGlobalKeys: toggleGlobalKeys,
    applyGlobalKeys: applyGlobalKeys,
    saveUnitState: saveUnitState,
    readProgress: readProgress
  };
  global.checkVocab = checkVocab;
  global.checkGrammar = checkGrammar;
  global.checkQuiz = checkQuiz;
  global.toggleQuiz = toggleQuiz;
  global.selectTFP = selectTFP;
  global.selectSurvey = selectSurvey;
  global.selectTopic = selectTopic;
  global.rate = rate;
})(window);
