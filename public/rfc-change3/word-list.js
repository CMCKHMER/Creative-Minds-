(() => {
  'use strict';

  const tools = window.RFC3Tools;
  const unitSelect = document.getElementById('unitSelect');
  const content = document.getElementById('content');
  const sharePanel = document.getElementById('sharePanel');
  let units = [];
  let activeUnit = null;

  function renderWord(word, index) {
    const posKey = String(word.pos || '').replace(/\./g, '').trim().toLowerCase();
    const posClass = {
      n: 'pos-n', v: 'pos-v', adj: 'pos-adj', adv: 'pos-adv', prep: 'pos-prep',
      conj: 'pos-conj', phr: 'pos-phr', pron: 'pos-pron', det: 'pos-det',
    }[posKey] || 'pos-n';
    return `<article class="vocab-card" data-search="${tools.escapeHtml(`${word.word} ${word.pos} ${word.definition} ${word.example}`.toLocaleLowerCase('en'))}">
      <div class="vocab-card-head">
        <span class="vocab-index">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="vocab-term">${tools.escapeHtml(word.word)}</h3>
        <span class="vocab-pos ${posClass}">${tools.escapeHtml(word.pos)}</span>
      </div>
      <p class="vocab-definition">${tools.escapeHtml(word.definition)}</p>
      <p class="vocab-example">“${tools.escapeHtml(word.example)}”</p>
    </article>`;
  }

  function filterWords(query) {
    const normalized = String(query || '').trim().toLocaleLowerCase('en');
    const cards = Array.from(content.querySelectorAll('.vocab-card'));
    let shown = 0;
    cards.forEach((card) => {
      const visible = !normalized || card.dataset.search.includes(normalized);
      card.hidden = !visible;
      if (visible) shown += 1;
    });
    const count = document.getElementById('wordListCount');
    if (count) count.textContent = normalized ? `Showing ${shown} of ${cards.length} words` : `${cards.length} words`;
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

  function renderUnit() {
    sharePanel.classList.remove('open');
    activeUnit = units.find((unit) => unit.number === Number(unitSelect.value)) || null;
    if (!activeUnit) {
      content.innerHTML = '<div class="placeholder"><span class="placeholder-mark" aria-hidden="true">❖</span><p>Select a unit above to open its vocabulary list.</p></div>';
      tools.updateUrl('unit', '');
      return;
    }

    tools.updateUrl('unit', activeUnit.number);
    const words = activeUnit.words;
    const posCount = new Set(words.map((word) => word.pos)).size;
    content.innerHTML = `
      <div class="unit-head">
        <span class="unit-bar" aria-hidden="true"></span>
        <h2 class="unit-title">Unit ${activeUnit.number}. ${tools.escapeHtml(activeUnit.title)}</h2>
        <span class="unit-meta">${words.length} entries</span>
      </div>
      <p class="instruction">Use the filter to find a target word, then review its part of speech, meaning, and example sentence.</p>
      <div class="stats">
        <div class="stat"><strong>${words.length}</strong><span>Words</span></div>
        <div class="stat"><strong>${posCount}</strong><span>Word types</span></div>
        <div class="stat"><strong>${activeUnit.number}</strong><span>Unit</span></div>
      </div>
      <div class="word-list-toolbar">
        <label class="word-search-field" for="wordSearch">Search this unit
          <input id="wordSearch" type="search" autocomplete="off" placeholder="Word, definition, or example…">
        </label>
        <span class="word-list-count" id="wordListCount">${words.length} words</span>
      </div>
      <div class="vocabulary-grid">${words.map(renderWord).join('')}</div>
      <div class="actions" aria-label="Word list actions">
        <button class="action-button share" id="shareWords" type="button">↗ Share this unit</button>
        <button class="action-button print" id="printWords" type="button">⎙ Print / Save PDF</button>
      </div>`;

    document.getElementById('wordSearch').addEventListener('input', (event) => filterWords(event.target.value));
    document.getElementById('shareWords').addEventListener('click', () => {
      const text = `Reading Future Change 3 · Word List · Unit ${activeUnit.number}. ${activeUnit.title}`;
      void tools.sharePage('Reading Future Change 3 — Word List', text, tools.makeShareUrl('unit', activeUnit.number));
    });
    document.getElementById('printWords').addEventListener('click', () => window.print());
  }

  async function init() {
    document.getElementById('dateField').value = tools.localDateValue();
    tools.setupTheme();
    unitSelect.addEventListener('change', renderUnit);
    document.getElementById('copyShareLink').addEventListener('click', () => {
      void tools.copyText(tools.makeShareUrl('unit', activeUnit ? activeUnit.number : ''));
    });
    document.addEventListener('beforeprint', () => sharePanel.classList.remove('open'));

    try {
      const response = await fetch(new URL('./word-list.json', window.location.href));
      if (!response.ok) throw new Error(`Vocabulary request failed (${response.status})`);
      const data = await response.json();
      if (data.book !== 'Reading Future Change 3' || !Array.isArray(data.units) || data.units.length !== 16) {
        throw new Error('The 16-unit vocabulary list is incomplete.');
      }
      units = data.units;
      fillUnitSelector();
      const requested = Number(new URLSearchParams(window.location.search).get('unit'));
      if (units.some((unit) => unit.number === requested)) unitSelect.value = String(requested);
      renderUnit();
    } catch (error) {
      console.error('Could not load the Reading Future Change 3 word list:', error);
      content.innerHTML = '<div class="placeholder" role="alert"><span class="placeholder-mark" aria-hidden="true">!</span><p>The vocabulary list could not be loaded. Refresh the page or return to the Kid 8 card and try again.</p></div>';
    }
  }

  void init();
})();
