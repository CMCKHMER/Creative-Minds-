(() => {
  'use strict';

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
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setupTheme() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const apply = (theme) => {
      const isLight = theme === 'light';
      document.body.classList.toggle('light', isLight);
      document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
      button.textContent = isLight ? '🌙 Dark' : '☀️ Light';
      button.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      try {
        localStorage.setItem('cmc-theme', isLight ? 'light' : 'dark');
        localStorage.setItem('cm-theme', isLight ? 'light' : 'dark');
      } catch { /* Theme preference is optional. */ }
    };
    let saved = 'dark';
    try { saved = localStorage.getItem('cmc-theme') || localStorage.getItem('cm-theme') || 'dark'; } catch { /* ignored */ }
    apply(saved === 'light' ? 'light' : 'dark');
    button.addEventListener('click', () => apply(document.body.classList.contains('light') ? 'dark' : 'light'));
    window.addEventListener('storage', (event) => {
      if (event.key === 'cmc-theme' && (event.newValue === 'light' || event.newValue === 'dark')) apply(event.newValue);
    });
  }

  function makeShareUrl(parameter, value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(parameter, String(value));
    else url.searchParams.delete(parameter);
    return url.toString();
  }

  function updateUrl(parameter, value) {
    try { window.history.replaceState({}, '', makeShareUrl(parameter, value)); } catch { /* The page still works without URL updates. */ }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      showToast('Link copied. Share it with your class.');
    } catch {
      showToast('Copy failed — copy the page address from your browser.');
    }
  }

  async function sharePage(title, text, url) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    document.getElementById('sharePanel')?.classList.add('open');
  }

  window.RFC3Tools = Object.freeze({
    escapeHtml,
    normalizeAnswer,
    localDateValue,
    showToast,
    setupTheme,
    makeShareUrl,
    updateUrl,
    copyText,
    sharePage,
  });
})();
