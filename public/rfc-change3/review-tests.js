(() => {
  'use strict';

  const tools = window.RFC3Tools;
  const testSelect = document.getElementById('testSelect');
  const content = document.getElementById('content');
  const sharePanel = document.getElementById('sharePanel');
  let tests = [];
  let activeTest = null;

  function renderFillIn(item, wordBank) {
    const [before, after = ''] = String(item.prompt).split('___');
    const options = wordBank.map((word) => `<option value="${tools.escapeHtml(word)}">${tools.escapeHtml(word)}</option>`).join('');
    return `<article class="question-card" data-question="${item.number}" data-kind="fill">
      <div class="question-head"><span class="question-number">${item.number}.</span><p class="question-prompt">${tools.escapeHtml(before)}<label class="sr-only" for="fill-${item.number}">Choose the missing word for question ${item.number}</label><select class="fill-select" id="fill-${item.number}" data-question="${item.number}" data-answer="${tools.escapeHtml(item.answer)}"><option value="">— choose a word —</option>${options}</select>${tools.escapeHtml(after)}</p></div>
    </article>`;
  }

  function renderChoiceQuestion(question) {
    const sentence = question.sentence
      ? `<div class="sentence-to-insert">“${tools.escapeHtml(question.sentence)}”</div>`
      : '';
    const options = question.choices.map((choice, index) => `<label class="choice-option">
      <input type="radio" name="q${question.number}" value="${index}" aria-label="Question ${question.number}, option ${String.fromCharCode(97 + index)}">
      <span><b>${String.fromCharCode(97 + index)}.</b> ${tools.escapeHtml(choice)}</span>
    </label>`).join('');
    return `<article class="question-card" data-question="${question.number}" data-kind="choice">
      <div class="question-head"><span class="question-number">${question.number}.</span><p class="question-prompt">${tools.escapeHtml(question.prompt)}</p></div>
      ${sentence}<div class="choice-options">${options}</div>
    </article>`;
  }

  function renderGapPassage(cloze) {
    const gaps = new Map(cloze.gaps.map((gap) => [String(gap.number), gap]));
    return String(cloze.passage).split(/(\{\{\d+\}\})/g).map((part) => {
      const marker = part.match(/^\{\{(\d+)\}\}$/);
      if (!marker) return tools.escapeHtml(part);
      const gap = gaps.get(marker[1]);
      if (!gap) return '';
      const options = gap.choices.map((choice) => `<option value="${tools.escapeHtml(choice)}">${tools.escapeHtml(choice)}</option>`).join('');
      return `<label class="gap-row"><span class="blank-number">${gap.number}</span><span class="sr-only">Select word for passage blank ${gap.number}</span><select class="gap-select" data-gap="${gap.number}" data-answer="${tools.escapeHtml(gap.answer)}" aria-label="Passage blank ${gap.number}"><option value="">—</option>${options}</select></label>`;
    }).join('');
  }

  function renderShortAnswer(question) {
    return `<article class="question-card" data-question="${question.number}" data-kind="short-answer">
      <div class="question-head"><span class="question-number">${question.number}.</span><p class="question-prompt">${tools.escapeHtml(question.prompt)}</p></div>
      <label class="sr-only" for="answer-${question.number}">Type your response for question ${question.number}</label>
      <input class="answer-line" id="answer-${question.number}" type="text" autocomplete="off" placeholder="Type your answer…">
      <div class="model-answer" data-model="${question.number}" hidden><b>Suggested model:</b> ${tools.escapeHtml(question.model)}</div>
    </article>`;
  }

  function renderUnscramble(question) {
    const chunks = question.chunks.map((chunk, index) => `<button class="chunk" type="button" data-chunk-index="${index}" aria-label="Add ${tools.escapeHtml(chunk)} to sentence ${question.number}">${tools.escapeHtml(chunk)}</button>`).join('');
    return `<article class="question-card unscramble-card" data-question="${question.number}" data-kind="unscramble">
      <div class="question-head"><span class="question-number">${question.number}.</span><p class="question-prompt">${tools.escapeHtml(question.prompt)}</p><span class="sentence-status" data-unscramble-status>Build the sentence</span></div>
      <div class="build-line" data-unscramble-build aria-label="Your answer for question ${question.number}"><span class="hint">Tap the chunks in the correct order.</span></div>
      <div class="word-bank" data-unscramble-bank aria-label="Scrambled chunks for question ${question.number}">${chunks}</div>
      <div class="model-answer" data-model="${question.number}" hidden><b>Suggested model:</b> ${tools.escapeHtml(question.model)}</div>
    </article>`;
  }

  function renderWrittenGroup(group) {
    const questions = group.questions.map((question) => question.type === 'unscramble'
      ? renderUnscramble(question)
      : renderShortAnswer(question)).join('');
    return `<div class="written-group">
      <p class="review-passage-label">${tools.escapeHtml(group.label)}</p>
      <div class="review-passage">${tools.escapeHtml(group.passage)}</div>
      ${questions}
    </div>`;
  }

  function fillTestSelector() {
    testSelect.innerHTML = '<option value="">— Choose a review test —</option>';
    tests.forEach((test) => {
      const option = document.createElement('option');
      option.value = String(test.number);
      option.textContent = `${test.title} · ${test.unitsLabel}`;
      testSelect.appendChild(option);
    });
  }

  function renderTest() {
    sharePanel.classList.remove('open');
    activeTest = tests.find((test) => test.number === Number(testSelect.value)) || null;
    if (!activeTest) {
      content.innerHTML = '<div class="placeholder"><span class="placeholder-mark" aria-hidden="true">❖</span><p>Select a review test above to begin.</p></div>';
      tools.updateUrl('test', '');
      return;
    }

    tools.updateUrl('test', activeTest.number);
    content.innerHTML = `
      <div class="review-test-heading">
        <span class="unit-bar" aria-hidden="true"></span>
        <h2 class="review-test-title">${tools.escapeHtml(activeTest.title)}</h2>
        <span class="review-test-units">${tools.escapeHtml(activeTest.unitsLabel)}</span>
      </div>
      <p class="review-instruction">Answer all 15 questions. The three cloze blanks in question 11 count as one question and must all be correct for credit. Written answers are checked against key phrases; sentence chunks must be placed in the correct order.</p>

      <section class="review-section" aria-labelledby="vocabulary-heading">
        <h3 class="review-section-title" id="vocabulary-heading">Vocabulary Check Up · A — Write the right word</h3>
        <p class="review-passage-label">Word bank · two words are not used</p>
        <div class="word-bank-display">${activeTest.wordBank.map((word) => `<span class="bank-chip">${tools.escapeHtml(word)}</span>`).join('')}</div>
        ${activeTest.fillIns.map((item) => renderFillIn(item, activeTest.wordBank)).join('')}
        <h3 class="review-section-title">Vocabulary Check Up · B — Choose the correct answer</h3>
        ${activeTest.vocabularyChoices.map(renderChoiceQuestion).join('')}
      </section>

      <section class="review-section" aria-labelledby="comprehension-heading">
        <h3 class="review-section-title" id="comprehension-heading">Comprehension Check Up · C — Read and choose</h3>
        <p class="review-passage-label">Questions 6–8</p>
        <div class="review-passage">${tools.escapeHtml(activeTest.reading.passage)}</div>
        ${activeTest.reading.questions.map(renderChoiceQuestion).join('')}
        <p class="review-passage-label">Questions 9–11</p>
        <div class="review-passage">${renderGapPassage(activeTest.cloze)}</div>
        ${activeTest.cloze.questions.map(renderChoiceQuestion).join('')}
        <article class="question-card" data-question="11" data-kind="gap-set">
          <div class="question-head"><span class="question-number">11.</span><p class="question-prompt">What is the correct answer for each number? Choose the best answer above.</p></div>
        </article>
      </section>

      <section class="review-section" aria-labelledby="written-heading">
        <h3 class="review-section-title" id="written-heading">D — Read the passages and write the correct answers</h3>
        ${activeTest.writtenGroups.map(renderWrittenGroup).join('')}
      </section>

      <div class="actions review-actions" aria-label="Review test actions">
        <button class="action-button primary" type="button" data-action="check">Check answers</button>
        <button class="action-button key" type="button" data-action="models" aria-label="Show suggested models, teachers only">🔒 Show suggested models · teachers</button>
        <button class="action-button share" type="button" data-action="share">↗ Share</button>
        <button class="action-button print" type="button" data-action="print">⎙ Print / Save PDF</button>
        <button class="action-button" type="button" data-action="reset">Reset test</button>
      </div>
      <p class="review-status" id="reviewStatus" role="status" aria-live="polite"></p>`;
  }

  function findChoiceQuestion(number) {
    return activeTest.vocabularyChoices.concat(activeTest.reading.questions, activeTest.cloze.questions)
      .find((question) => question.number === number);
  }

  function questionIsCorrect(question) {
    const number = question.number;
    if (question.type === 'fill') {
      const field = content.querySelector(`.fill-select[data-question="${number}"]`);
      return Boolean(field && field.value && tools.normalizeAnswer(field.value) === tools.normalizeAnswer(field.dataset.answer));
    }
    if (question.type === 'choice') {
      const choice = findChoiceQuestion(number);
      const selected = content.querySelector(`input[type="radio"][name="q${number}"]:checked`);
      return Boolean(choice && selected && Number(selected.value) === choice.answer);
    }
    if (question.type === 'gap-set') {
      const fields = Array.from(content.querySelectorAll('.gap-select'));
      return fields.length === activeTest.cloze.gaps.length && fields.every((field) => field.value && tools.normalizeAnswer(field.value) === tools.normalizeAnswer(field.dataset.answer));
    }
    if (question.type === 'short-answer') {
      const field = content.querySelector(`#answer-${number}`);
      const response = tools.normalizeAnswer(field ? field.value : '');
      const expected = activeTest.writtenGroups.flatMap((group) => group.questions).find((item) => item.number === number);
      return Boolean(response && expected && expected.accepted.some((answer) => response.includes(tools.normalizeAnswer(answer))));
    }
    if (question.type === 'unscramble') {
      const card = content.querySelector(`.unscramble-card[data-question="${number}"]`);
      const line = card?.querySelector('[data-unscramble-build]');
      const placed = line ? Array.from(line.querySelectorAll('.chunk')).map((chip) => tools.normalizeAnswer(chip.textContent)) : [];
      const expected = question.answer.map(tools.normalizeAnswer);
      return placed.length === expected.length && placed.every((chunk, index) => chunk === expected[index]);
    }
    return false;
  }

  function updateResult(number, isCorrect) {
    const card = content.querySelector(`.question-card[data-question="${number}"]`);
    if (!card) return;
    card.classList.toggle('correct', isCorrect);
    card.classList.toggle('incorrect', !isCorrect);
    if (number === 11) {
      content.querySelectorAll('.gap-select').forEach((field) => {
        const correct = field.value && tools.normalizeAnswer(field.value) === tools.normalizeAnswer(field.dataset.answer);
        field.classList.toggle('correct', Boolean(correct));
        field.classList.toggle('incorrect', !correct);
      });
    }
    if (card.classList.contains('unscramble-card')) {
      const status = card.querySelector('[data-unscramble-status]');
      if (status) status.textContent = isCorrect ? '✓ Correct order' : 'Check the chunk order';
    }
  }

  function checkAnswers() {
    const questions = [];
    activeTest.fillIns.forEach((item) => questions.push({ number: item.number, type: 'fill' }));
    activeTest.vocabularyChoices.forEach((item) => questions.push({ number: item.number, type: 'choice' }));
    activeTest.reading.questions.forEach((item) => questions.push({ number: item.number, type: 'choice' }));
    activeTest.cloze.questions.forEach((item) => questions.push({ number: item.number, type: 'choice' }));
    questions.push({ number: 11, type: 'gap-set' });
    activeTest.writtenGroups.flatMap((group) => group.questions).forEach((item) => questions.push({ ...item, number: item.number, type: item.type }));

    const results = questions.map((question) => ({ ...question, correct: questionIsCorrect(question) }));
    results.forEach((result) => updateResult(result.number, result.correct));
    const score = results.filter((result) => result.correct).length;
    const status = document.getElementById('reviewStatus');
    if (status) {
      status.classList.add('visible');
      status.textContent = score === 15 ? '✓ 15/15 according to this draft answer key.' : `Draft-key score: ${score}/15 questions.`;
    }
  }

  function updateUnscrambleStatus(card) {
    const line = card.querySelector('[data-unscramble-build]');
    const status = card.querySelector('[data-unscramble-status]');
    if (!line || !status) return;
    const placed = line.querySelectorAll('.chunk').length;
    status.textContent = placed ? `Placed ${placed} of ${card.querySelectorAll('.word-bank .chunk').length + placed}` : 'Build the sentence';
  }

  function moveChunk(button) {
    const card = button.closest('.unscramble-card');
    const bank = card?.querySelector('[data-unscramble-bank]');
    const line = card?.querySelector('[data-unscramble-build]');
    if (!card || !bank || !line) return;
    const hint = line.querySelector('.hint');
    if (button.parentElement === bank) {
      if (hint) hint.remove();
      line.appendChild(button);
      button.setAttribute('aria-label', `Return ${button.textContent} to the scrambled chunks for sentence ${card.dataset.question}`);
    } else {
      bank.appendChild(button);
      button.setAttribute('aria-label', `Add ${button.textContent} to sentence ${card.dataset.question}`);
      Array.from(bank.children).sort((a, b) => Number(a.dataset.chunkIndex) - Number(b.dataset.chunkIndex)).forEach((chip) => bank.appendChild(chip));
      if (!line.querySelector('.chunk')) line.innerHTML = '<span class="hint">Tap the chunks in the correct order.</span>';
    }
    card.classList.remove('correct', 'incorrect');
    const status = document.getElementById('reviewStatus');
    if (status) status.classList.remove('visible');
    updateUnscrambleStatus(card);
  }

  async function toggleModelAnswers(button) {
    let isTeacher = window.CMC_IS_TEACHER === true;
    if (!isTeacher && typeof window.cmcVerifyTeacher === 'function') {
      try { isTeacher = await window.cmcVerifyTeacher(); } catch { isTeacher = false; }
      window.CMC_IS_TEACHER = isTeacher;
    }
    if (!isTeacher) {
      if (typeof window.cmcTeacherOnlyPrompt === 'function') window.cmcTeacherOnlyPrompt();
      else tools.showToast('Suggested models are reserved for verified teachers.');
      return;
    }
    const models = Array.from(content.querySelectorAll('.model-answer'));
    const show = models.some((model) => model.hidden);
    models.forEach((model) => { model.hidden = !show; });
    button.textContent = show ? 'Hide suggested models' : '🔒 Show suggested models · teachers';
  }

  async function onContentClick(event) {
    const button = event.target.closest('button');
    if (!button || !content.contains(button)) return;
    if (button.classList.contains('chunk')) {
      moveChunk(button);
      return;
    }
    const action = button.dataset.action;
    if (action === 'check') checkAnswers();
    else if (action === 'models') await toggleModelAnswers(button);
    else if (action === 'share' && activeTest) {
      const text = `Reading Future Change 3 · ${activeTest.title} · ${activeTest.unitsLabel}`;
      await tools.sharePage('Reading Future Change 3 — Review Tests', text, tools.makeShareUrl('test', activeTest.number));
    } else if (action === 'print') window.print();
    else if (action === 'reset') renderTest();
  }

  function clearQuestionMark(event) {
    const control = event.target;
    if (!(control instanceof HTMLElement)) return;
    const card = control.closest('.question-card');
    if (card) card.classList.remove('correct', 'incorrect');
    if (control.matches('.gap-select') || card?.dataset.question === '11') {
      content.querySelector('.question-card[data-question="11"]')?.classList.remove('correct', 'incorrect');
      content.querySelectorAll('.gap-select').forEach((field) => field.classList.remove('correct', 'incorrect'));
    }
    const status = document.getElementById('reviewStatus');
    if (status) status.classList.remove('visible');
  }

  async function init() {
    document.getElementById('dateField').value = tools.localDateValue();
    tools.setupTheme();
    testSelect.addEventListener('change', renderTest);
    document.getElementById('copyShareLink').addEventListener('click', () => {
      void tools.copyText(tools.makeShareUrl('test', activeTest ? activeTest.number : ''));
    });
    content.addEventListener('click', (event) => { void onContentClick(event); });
    content.addEventListener('change', clearQuestionMark);
    content.addEventListener('input', clearQuestionMark);
    document.addEventListener('beforeprint', () => sharePanel.classList.remove('open'));

    try {
      const response = await fetch(new URL('./review-tests.json', window.location.href));
      if (!response.ok) throw new Error(`Review test request failed (${response.status})`);
      const data = await response.json();
      if (data.book !== 'Reading Future Change 3' || !Array.isArray(data.tests) || data.tests.length !== 4) {
        throw new Error('The four review tests are incomplete.');
      }
      tests = data.tests;
      fillTestSelector();
      const requested = Number(new URLSearchParams(window.location.search).get('test'));
      if (tests.some((test) => test.number === requested)) testSelect.value = String(requested);
      renderTest();
    } catch (error) {
      console.error('Could not load the Reading Future Change 3 review tests:', error);
      content.innerHTML = '<div class="placeholder" role="alert"><span class="placeholder-mark" aria-hidden="true">!</span><p>The review tests could not be loaded. Refresh the page or return to the Kid 8 card and try again.</p></div>';
    }
  }

  void init();
})();
