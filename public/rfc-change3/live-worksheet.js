(() => {
  'use strict';

  const sheetType = document.body.dataset.sheetType;
  const isDictation = sheetType === 'dictation';
  const book = 'Reading Future Change 3';
  const unitSelect = document.getElementById('unitSelect');
  const content = document.getElementById('content');
  const sharePanel = document.getElementById('sharePanel');
  const scoreDisplayId = 'scoreDisplay';
  let units = [];
  let activeUnit = null;
  let toastTimer = 0;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeAnswer(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('en')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function localDateValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function activeScoreDisplay() {
    return document.getElementById(scoreDisplayId);
  }

  function setScoreMessage(message, isPerfect = false) {
    const display = activeScoreDisplay();
    if (!display) return;
    display.textContent = message;
    display.classList.add('visible');
    display.style.color = isPerfect ? 'var(--green)' : 'var(--cyan)';
  }

  function unitHeader(unit, stats) {
    const unitNo = String(unit.number).padStart(2, '0');
    const track = isDictation
      ? `<span class="unit-meta">Audio track ${escapeHtml(unit.track)}</span>`
      : '<span class="unit-meta">4 sentences · 4 gaps</span>';
    return `
      <div class="unit-head">
        <span class="unit-bar" aria-hidden="true"></span>
        <h2 class="unit-title">Unit ${unit.number}. ${escapeHtml(unit.title)}</h2>
        ${track}
      </div>
      <div class="stats" aria-label="Worksheet details">
        ${stats.map(([value, label]) => `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('')}
      </div>`;
  }

  function buildPassageMarkup(passage, mode, answers = []) {
    const safePassage = escapeHtml(passage);
    return safePassage.replace(/\[(\d+)\]/g, (_marker, rawNumber) => {
      const number = Number(rawNumber);
      if (!Number.isInteger(number) || number < 1) return '';
      if (mode === 'dictation') {
        const variants = answers[number - 1] || [];
        const longest = variants.reduce((length, answer) => Math.max(length, String(answer).length), 0);
        const width = Math.min(25, Math.max(8, Math.ceil(longest * 0.72) + 2));
        return `<label class="answer-slot"><span class="blank-number">(${number})</span><span class="sr-only">Blank ${number}</span><input class="answer-input" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-answer="${number}" aria-label="Blank ${number}" style="--answer-width:${width}ch"></label>`;
      }
      const choices = ['A', 'B', 'C', 'D'].map((letter) => `<option value="${letter}">${letter}</option>`).join('');
      return `<span class="gap-row"><span class="blank-number">${['', '①', '②', '③', '④'][number] || `(${number})`}</span><label class="sr-only" for="gap-${number}">Sentence for gap ${number}</label><select class="gap-select" id="gap-${number}" data-gap="${number}" aria-label="Choose sentence for gap ${number}"><option value="">—</option>${choices}</select></span>`;
    });
  }

  function actionMarkup(showKey) {
    return `
      <div class="actions" aria-label="Worksheet actions">
        <button class="action-button primary" id="checkAnswers" type="button">Check answers</button>
        ${showKey ? '<button class="action-button key" id="showKey" data-cmc-gated="showKey" type="button" aria-label="Show answer key, teachers only">🔐 Show key · teachers</button>' : ''}
        <button class="action-button share" id="shareWorksheet" type="button">↗ Share</button>
        <button class="action-button print" id="printWorksheet" type="button">⎙ Print / Save PDF</button>
        <button class="action-button" id="resetWorksheet" type="button">Reset</button>
      </div>
      <div class="score-display" id="${scoreDisplayId}" role="status" aria-live="polite"></div>`;
  }

  function renderDictation(unit) {
    const answers = unit.dictation.answers;
    const passage = buildPassageMarkup(unit.dictation.passage, 'dictation', answers);
    const instructions = `Listen to course audio track ${unit.track} and fill each numbered blank. Use the Check answers button for instant feedback. The track number comes from the supplied worksheet; audio is not hosted here.`;
    content.innerHTML = `${unitHeader(unit, [[answers.length, 'Blanks'], [unit.track, 'Audio track'], [unit.number, 'Unit']])}
      <p class="instruction">${escapeHtml(instructions)}</p>
      <div class="passage-card">${passage}</div>
      ${actionMarkup(true)}`;
    document.getElementById('checkAnswers').addEventListener('click', checkDictation);
    document.getElementById('showKey').addEventListener('click', revealDictationKey);
    document.getElementById('printWorksheet').addEventListener('click', () => window.print());
    document.getElementById('resetWorksheet').addEventListener('click', () => renderActiveUnit());
    document.getElementById('shareWorksheet').addEventListener('click', shareWorksheet);
  }

  function renderUnscramble(unit) {
    const data = unit.unscramble;
    const passage = buildPassageMarkup(data.passage, 'unscramble');
    const shell = `
      ${unitHeader(unit, [['4', 'Sentences'], ['4', 'Passage gaps'], ['8', 'Total points']])}
      <p class="instruction"><strong>Step 1:</strong> Tap each scrambled chunk to build sentence A–D in the correct order; tap a placed chunk to return it. <strong>Step 2:</strong> Choose the sentence that belongs in each numbered passage gap, then check your work.</p>
      <div class="passage-card">${passage}</div>
      <h3 class="section-heading">Rebuild sentences A–D</h3>
      <div class="sentence-grid" id="sentenceGrid"></div>
      ${actionMarkup(false)}`;
    content.innerHTML = shell;

    const grid = document.getElementById('sentenceGrid');
    data.sentences.forEach((sentence) => {
      const card = document.createElement('article');
      card.className = 'sentence-card';
      card.id = `sentence-${sentence.letter}`;
      card.dataset.letter = sentence.letter;
      card.innerHTML = `<div class="sentence-head"><span class="sentence-letter" aria-hidden="true">${escapeHtml(sentence.letter)}</span><strong>Sentence ${escapeHtml(sentence.letter)}</strong><span class="sentence-status" id="status-${sentence.letter}">Build the sentence</span></div><div class="build-line" id="build-${sentence.letter}" aria-label="Your sentence ${escapeHtml(sentence.letter)}"></div><div class="word-bank" id="bank-${sentence.letter}" aria-label="Scrambled chunks for sentence ${escapeHtml(sentence.letter)}"></div>`;
      const bank = card.querySelector('.word-bank');
      sentence.chunks.forEach((chunk, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chunk';
        button.dataset.chunkIndex = String(index);
        button.textContent = chunk;
        button.setAttribute('aria-label', `Add “${chunk}” to sentence ${sentence.letter}`);
        bank.appendChild(button);
      });
      grid.appendChild(card);
    });

    document.getElementById('checkAnswers').addEventListener('click', checkUnscramble);
    document.getElementById('printWorksheet').addEventListener('click', () => window.print());
    document.getElementById('resetWorksheet').addEventListener('click', () => renderActiveUnit());
    document.getElementById('shareWorksheet').addEventListener('click', shareWorksheet);
  }

  function onChunkClick(event) {
    const button = event.target.closest('button.chunk');
    if (!button || !content.contains(button)) return;
    const letter = button.closest('.sentence-card')?.dataset.letter;
    if (!letter) return;
    const bank = document.getElementById(`bank-${letter}`);
    const build = document.getElementById(`build-${letter}`);
    if (button.parentElement === bank) {
      const hint = build.querySelector('.hint');
      if (hint) hint.remove();
      build.appendChild(button);
      button.setAttribute('aria-label', `Return “${button.textContent}” to the scrambled chunks for sentence ${letter}`);
    } else {
      bank.appendChild(button);
      Array.from(bank.children)
        .sort((a, b) => Number(a.dataset.chunkIndex) - Number(b.dataset.chunkIndex))
        .forEach((chip) => bank.appendChild(chip));
      button.setAttribute('aria-label', `Add “${button.textContent}” to sentence ${letter}`);
      if (!build.querySelector('.chunk')) build.innerHTML = '<span class="hint">Your sentence will appear here.</span>';
    }
    updateSentenceStatus(letter);
  }

  function expectedSentence(unit, letter) {
    return unit.unscramble.sentences.find((sentence) => sentence.letter === letter)?.answer || [];
  }

  function sentenceIsCorrect(unit, letter) {
    const build = document.getElementById(`build-${letter}`);
    if (!build) return false;
    const actual = Array.from(build.querySelectorAll('.chunk')).map((chip) => normalizeAnswer(chip.textContent));
    const expected = expectedSentence(unit, letter).map(normalizeAnswer);
    return actual.length === expected.length && actual.every((word, index) => word === expected[index]);
  }

  function updateSentenceStatus(letter) {
    if (!activeUnit) return;
    const build = document.getElementById(`build-${letter}`);
    const card = document.getElementById(`sentence-${letter}`);
    const status = document.getElementById(`status-${letter}`);
    if (!build || !card || !status) return;
    const placed = build.querySelectorAll('.chunk').length;
    const total = expectedSentence(activeUnit, letter).length;
    const correct = sentenceIsCorrect(activeUnit, letter);
    card.classList.toggle('solved', correct);
    status.textContent = correct ? '✓ Correct order' : placed ? `Placed ${placed} of ${total}` : 'Build the sentence';
  }

  function checkDictation() {
    if (!activeUnit) return;
    const answers = activeUnit.dictation.answers;
    let correct = 0;
    let answered = 0;
    content.querySelectorAll('.answer-input').forEach((input) => {
      const index = Number(input.dataset.answer) - 1;
      const response = normalizeAnswer(input.value);
      input.classList.remove('correct', 'incorrect');
      if (!response) return;
      answered += 1;
      const accepted = answers[index] || [];
      if (accepted.some((answer) => normalizeAnswer(answer) === response)) {
        input.classList.add('correct');
        correct += 1;
      } else {
        input.classList.add('incorrect');
      }
    });
    const remaining = answers.length - answered;
    const message = correct === answers.length
      ? `✓ Perfect! ${correct}/${answers.length} blanks correct.`
      : `Score: ${correct}/${answers.length} correct · ${remaining} blank${remaining === 1 ? '' : 's'} remaining.`;
    setScoreMessage(message, correct === answers.length);
  }

  async function revealDictationKey() {
    if (!activeUnit) return;
    let isTeacher = window.CMC_IS_TEACHER === true;
    if (!isTeacher && typeof window.cmcVerifyTeacher === 'function') {
      try { isTeacher = await window.cmcVerifyTeacher(); } catch { isTeacher = false; }
      window.CMC_IS_TEACHER = isTeacher;
    }
    if (!isTeacher) {
      if (typeof window.cmcTeacherOnlyPrompt === 'function') window.cmcTeacherOnlyPrompt();
      else showToast('The answer key is reserved for verified teachers.');
      return;
    }
    activeUnit.dictation.answers.forEach((accepted, index) => {
      const input = content.querySelector(`[data-answer="${index + 1}"]`);
      if (!input || !accepted.length) return;
      input.value = accepted[0];
      input.classList.remove('incorrect');
      input.classList.add('correct');
    });
    setScoreMessage(`Teacher key shown · ${activeUnit.dictation.answers.length}/${activeUnit.dictation.answers.length}. Press Reset to clear.`, true);
  }

  function checkUnscramble() {
    if (!activeUnit) return;
    let sentenceCorrect = 0;
    let gapsCorrect = 0;
    ['A', 'B', 'C', 'D'].forEach((letter) => {
      const correct = sentenceIsCorrect(activeUnit, letter);
      if (correct) sentenceCorrect += 1;
      const card = document.getElementById(`sentence-${letter}`);
      const status = document.getElementById(`status-${letter}`);
      card?.classList.toggle('solved', correct);
      if (status) status.textContent = correct ? '✓ Correct order' : 'Keep rearranging';
    });
    const placements = activeUnit.unscramble.placements;
    content.querySelectorAll('[data-gap]').forEach((select) => {
      const gapIndex = Number(select.dataset.gap) - 1;
      const correct = select.value === placements[gapIndex];
      select.classList.remove('correct', 'incorrect');
      if (select.value) {
        select.classList.add(correct ? 'correct' : 'incorrect');
        if (correct) gapsCorrect += 1;
      }
    });
    const total = sentenceCorrect + gapsCorrect;
    const perfect = total === 8;
    setScoreMessage(perfect
      ? '✓ Perfect! Sentences rebuilt 4/4 · Passage gaps placed 4/4.'
      : `Score: ${total}/8 · Sentences rebuilt ${sentenceCorrect}/4 · Gaps placed ${gapsCorrect}/4.`, perfect);
  }

  function shareUrl() {
    const url = new URL(window.location.href);
    if (unitSelect.value) url.searchParams.set('unit', unitSelect.value);
    return url.toString();
  }

  function shareText() {
    const label = activeUnit ? `Unit ${activeUnit.number}. ${activeUnit.title}` : 'all 16 units';
    return `${book} · ${isDictation ? 'Dictation Sheet' : 'Unscramble Sheet'} · ${label}`;
  }

  async function shareWorksheet() {
    const shareData = { title: shareText(), text: shareText(), url: shareUrl() };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    sharePanel?.classList.add('open');
  }

  async function copyShareLink() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl());
      } else {
        const input = document.createElement('textarea');
        input.value = shareUrl();
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      showToast('Link copied. Share it with your class.');
    } catch {
      showToast('Copy failed — copy the page address from your browser.');
    }
  }

  function updateUnitUrl(number) {
    try {
      const url = new URL(window.location.href);
      if (number) url.searchParams.set('unit', String(number));
      else url.searchParams.delete('unit');
      window.history.replaceState({}, '', url);
    } catch { /* The worksheet still works if URL updates are unavailable. */ }
  }

  function renderActiveUnit() {
    sharePanel?.classList.remove('open');
    const number = Number(unitSelect.value);
    activeUnit = units.find((unit) => unit.number === number) || null;
    if (!activeUnit) {
      content.innerHTML = '<div class="placeholder"><span class="placeholder-mark" aria-hidden="true">❖</span><p>Select a unit above to open the live worksheet.</p></div>';
      updateUnitUrl('');
      return;
    }
    updateUnitUrl(number);
    if (isDictation) renderDictation(activeUnit);
    else renderUnscramble(activeUnit);
  }

  function fillUnitSelector() {
    unitSelect.innerHTML = '<option value="">— Choose a unit —</option>';
    units.forEach((unit) => {
      const option = document.createElement('option');
      option.value = String(unit.number);
      option.textContent = `Unit ${unit.number}. ${unit.title}`;
      unitSelect.appendChild(option);
    });
  }

  function setupTheme() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const apply = (theme) => {
      document.body.classList.toggle('light', theme === 'light');
      document.documentElement.style.colorScheme = theme;
      button.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
      button.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      try {
        localStorage.setItem('cmc-theme', theme);
        localStorage.setItem('cm-theme', theme);
      } catch { /* Theme preference is optional. */ }
    };
    let theme = 'dark';
    try { theme = localStorage.getItem('cmc-theme') || localStorage.getItem('cm-theme') || 'dark'; } catch { /* ignored */ }
    apply(theme === 'light' ? 'light' : 'dark');
    button.addEventListener('click', () => apply(document.body.classList.contains('light') ? 'dark' : 'light'));
    window.addEventListener('storage', (event) => {
      if (event.key === 'cmc-theme' && (event.newValue === 'light' || event.newValue === 'dark')) apply(event.newValue);
    });
  }

  async function init() {
    if (!isDictation && sheetType !== 'unscramble') {
      content.innerHTML = '<p class="placeholder" role="alert">This worksheet type could not be loaded.</p>';
      return;
    }
    document.getElementById('dateField').value = localDateValue();
    document.getElementById('copyShareLink')?.addEventListener('click', copyShareLink);
    unitSelect.addEventListener('change', renderActiveUnit);
    content.addEventListener('click', onChunkClick);
    content.addEventListener('change', (event) => {
      if (event.target instanceof HTMLSelectElement && event.target.matches('[data-gap]')) {
        event.target.classList.remove('correct', 'incorrect');
      }
    });
    document.addEventListener('beforeprint', () => sharePanel?.classList.remove('open'));
    setupTheme();
    try {
      const response = await fetch(new URL('./data.json', window.location.href));
      if (!response.ok) throw new Error(`Worksheet data request failed (${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.units) || data.units.length !== 16) throw new Error('The unit list is incomplete.');
      units = data.units;
      fillUnitSelector();
      const requestedUnit = Number(new URLSearchParams(window.location.search).get('unit'));
      if (units.some((unit) => unit.number === requestedUnit)) unitSelect.value = String(requestedUnit);
      renderActiveUnit();
    } catch (error) {
      console.error('Could not load Reading Future Change 3 worksheet data:', error);
      content.innerHTML = '<div class="placeholder" role="alert"><span class="placeholder-mark" aria-hidden="true">!</span><p>These worksheet materials could not be loaded. Please refresh the page or return to the Kid 8 card and try again.</p></div>';
    }
  }

  void init();
})();
