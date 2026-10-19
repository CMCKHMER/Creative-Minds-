/*
 * CMC shared page runtime — one copy of the blocks that used to be
 * copy-pasted into all 23 biweek-planner pages (and the generation
 * template). Loaded synchronously from <head>, so everything it defines
 * (toggleTheme, cmcTrack, CMC) is available to inline scripts below,
 * exactly like the original inline blocks were.
 *
 * Contains:
 *   1. Analytics bootstrap (gtag + cmcTrack) — GA id from window.CMC_GA_ID
 *      if set, else the default placeholder.
 *   2. Teacher/Student mode badge (was #cmc-role-gate).
 *   3. Theme toggle + persisted restore (localStorage "biweek-theme").
 *   4. Share button — injects its own markup, so pages no longer carry it.
 *   5. CMC.submitDrill(opts) — Firestore REST drill-score submission.
 *
 * Behavior-identical to the extracted originals; fixes now land here once.
 */
(function (global) {
  'use strict';

  /* ── 1. Analytics bootstrap ─────────────────────────────────────── */
  var GA_ID = global.CMC_GA_ID || 'G-XXXXXXXXXX';
  var gaLoader = document.createElement('script');
  gaLoader.async = true;
  gaLoader.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(gaLoader);
  global.dataLayer = global.dataLayer || [];
  function gtag() { global.dataLayer.push(arguments); }
  global.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: true });
  // cmcTrack helper — safe to call before/after gtag loads.
  global.cmcTrack = function (ev, params) {
    try { if (typeof global.gtag === 'function') { global.gtag('event', ev, params || {}); } } catch (e) {}
  };

  /* ── 2. Role indicator badge ────────────────────────────────────── */
  try { global.CMC_IS_TEACHER = localStorage.getItem('cmc-student-role') === 'teacher'; }
  catch (e) { global.CMC_IS_TEACHER = false; }
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    if (global.CMC_IS_TEACHER) {
      b.textContent = '🎓 Teacher mode';
      b.style.cssText = 'position:fixed;top:62px;right:16px;z-index:99994;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(52,211,153,0.12);color:#6ee7b7;border:1px solid rgba(52,211,153,0.35);backdrop-filter:blur(8px);font-family:Inter,sans-serif;letter-spacing:0.02em;';
    } else {
      b.textContent = 'Student mode';
      b.style.cssText = 'position:fixed;top:62px;right:16px;z-index:99994;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(34,211,238,0.10);color:#67e8f9;border:1px solid rgba(34,211,238,0.30);backdrop-filter:blur(8px);font-family:Inter,sans-serif;letter-spacing:0.02em;';
    }
    document.body.appendChild(b);
  });

  /* ── 3. Theme toggle ────────────────────────────────────────────── */
  global.toggleTheme = function () {
    var h = document.documentElement;
    var dark = h.getAttribute('data-theme') === 'dark';
    h.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('biweek-theme', dark ? 'light' : 'dark'); } catch (e) {}
    var btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = dark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    cmcTrack('theme_toggle', { theme: dark ? 'light' : 'dark' });
  };
  // Restore the saved theme before first paint of the body content.
  try {
    var saved = localStorage.getItem('biweek-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      global.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('themeToggle');
        if (btn) btn.innerHTML = saved === 'light' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
      });
    }
  } catch (e) {}

  /* ── 4. Share button (self-injecting) ───────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('cmc-share-btn')) return; // page ships its own markup
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<button id="cmc-share-btn" title="Share this page" aria-label="Share this page"><i class="fas fa-share-nodes"></i></button>' +
      '<div id="cmc-share-panel" role="menu" aria-label="Share options">' +
      '  <div class="share-title">Share this page</div>' +
      '  <a data-share="facebook" target="_blank" rel="noopener"><i class="fab fa-facebook" style="color:#1877f2"></i> Facebook</a>' +
      '  <a data-share="x" target="_blank" rel="noopener"><i class="fab fa-x-twitter" style="color:#e2e8f0"></i> X (Twitter)</a>' +
      '  <a data-share="whatsapp" target="_blank" rel="noopener"><i class="fab fa-whatsapp" style="color:#25d366"></i> WhatsApp</a>' +
      '  <a data-share="telegram" target="_blank" rel="noopener"><i class="fab fa-telegram" style="color:#229ed9"></i> Telegram</a>' +
      '  <a data-share="linkedin" target="_blank" rel="noopener"><i class="fab fa-linkedin" style="color:#0a66c2"></i> LinkedIn</a>' +
      '  <a data-share="email"><i class="fas fa-envelope" style="color:#f59e0b"></i> Email</a>' +
      '  <hr>' +
      '  <div class="share-copy" id="cmc-share-copy"><i class="fas fa-link" style="color:#67e8f9"></i> <span>Copy link</span></div>' +
      '</div>';
    document.body.appendChild(wrap);

    var btn = document.getElementById('cmc-share-btn');
    var panel = document.getElementById('cmc-share-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function (e) { e.stopPropagation(); panel.classList.toggle('open'); });
    document.addEventListener('click', function (e) { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.classList.remove('open'); });
    function buildURL(svc) {
      var u = encodeURIComponent(global.location.href);
      var t = encodeURIComponent(document.title || 'CMC Network practice page');
      if (svc === 'facebook') return 'https://www.facebook.com/sharer/sharer.php?u=' + u;
      if (svc === 'x') return 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t;
      if (svc === 'whatsapp') return 'https://api.whatsapp.com/send?text=' + t + '%20' + u;
      if (svc === 'telegram') return 'https://t.me/share/url?url=' + u + '&text=' + t;
      if (svc === 'linkedin') return 'https://www.linkedin.com/sharing/share-offsite/?url=' + u;
      if (svc === 'email') return 'mailto:?subject=' + t + '&body=' + u;
      return '#';
    }
    panel.querySelectorAll('a[data-share]').forEach(function (a) {
      a.addEventListener('click', function () {
        var svc = a.getAttribute('data-share');
        if (svc === 'email') { a.href = buildURL('email'); return; }
        a.href = buildURL(svc);
        cmcTrack('share_click', { service: svc });
      });
    });
    var copyBtn = document.getElementById('cmc-share-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var label = copyBtn.querySelector('span');
        var done = function () {
          if (label) {
            var orig = label.textContent;
            label.textContent = 'Copied!';
            setTimeout(function () { label.textContent = orig; }, 1500);
          }
        };
        try {
          navigator.clipboard.writeText(global.location.href).then(done).catch(function () { done(); });
          cmcTrack('share_click', { service: 'copy_link' });
        } catch (e) { done(); }
      });
    }
  });

  /* ── 5. Drill score submission (Firestore REST) ─────────────────── */
  global.CMC = global.CMC || {};
  /**
   * Submit a drill attempt for the signed-in student. No-ops silently when
   * there is no session or the token has expired — scoring UI never depends
   * on it. opts: { drillSlug?, drillTitle?, drillSource?, scorePct,
   * correctCount, totalCount, durationSeconds? }
   */
  global.CMC.submitDrill = function (opts) {
    try {
      var token = localStorage.getItem('cmc-student-token');
      var name = localStorage.getItem('cmc-student-name') || '';
      var uid = localStorage.getItem('cmc-student-uid') || '';
      var exp = Number(localStorage.getItem('cmc-student-token-expires') || '0');
      if (!token || !name || (exp && exp <= Date.now())) return;
      var url = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
      var body = {
        fields: {
          drillSlug: { stringValue: opts.drillSlug || global.location.pathname.split('/').pop() },
          drillTitle: { stringValue: opts.drillTitle || document.title.split('—')[0].trim() },
          drillSource: { stringValue: opts.drillSource || 'biweek-planner' },
          studentName: { stringValue: name },
          studentUid: { stringValue: uid },
          classId: { nullValue: null },
          durationSeconds: opts.durationSeconds != null ? { integerValue: String(opts.durationSeconds) } : { nullValue: null },
          scorePct: { integerValue: String(opts.scorePct) },
          correctCount: { integerValue: String(opts.correctCount) },
          totalCount: { integerValue: String(opts.totalCount) },
          submittedAt: { timestampValue: new Date().toISOString() },
        },
      };
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body),
      }).catch(function (e) {});
    } catch (e) {}
  };
})(window);
