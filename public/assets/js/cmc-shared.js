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
 *   3. Theme toggle + persisted restore — synced with the main site's
 *      "cmc-theme" key (legacy "biweek-theme" kept as fallback).
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
  global.CMC_IS_TEACHER = false; // fail-closed — verified server-side below
  var CMC_TEACHER_BADGE_CSS = 'position:fixed;top:62px;right:16px;z-index:99994;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(52,211,153,0.12);color:#6ee7b7;border:1px solid rgba(52,211,153,0.35);backdrop-filter:blur(8px);font-family:Inter,sans-serif;letter-spacing:0.02em;';
  var CMC_STUDENT_BADGE_CSS = 'position:fixed;top:62px;right:16px;z-index:99994;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(34,211,238,0.10);color:#67e8f9;border:1px solid rgba(34,211,238,0.30);backdrop-filter:blur(8px);font-family:Inter,sans-serif;letter-spacing:0.02em;';

  /* Server-verified teacher check for these standalone pages — identical
     contract to the worksheets: the ONLY proof is that Firestore's own
     rules (isCmcTeacher) accept the session's Bearer token on a
     teachers-only read. localStorage 'cmc-student-role' is never trusted. */
  function cmcRulesSayTeacher(tok) {
    return fetch('https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/assessment_classes?pageSize=1', {
      headers: tok ? { 'Authorization': 'Bearer ' + tok } : {}
    }).then(function (r) { return r.status === 200; }).catch(function () { return false; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.id = 'cmc-role-badge';
    // Fail-closed: everyone paints student until the rules say otherwise.
    b.textContent = 'Student mode';
    b.style.cssText = CMC_STUDENT_BADGE_CSS;
    document.body.appendChild(b);
    function upgrade() {
      global.CMC_IS_TEACHER = true;
      b.textContent = '🎓 Teacher mode';
      b.style.cssText = CMC_TEACHER_BADGE_CSS;
    }
    var tok = null;
    try { tok = localStorage.getItem('cmc-student-token'); } catch (e) {}
    var first = tok ? cmcRulesSayTeacher(tok) : Promise.resolve(false);
    first.then(function (ok) {
      if (ok) { upgrade(); return; }
      refreshFirebaseToken(function (t) {
        if (!t) return;
        cmcRulesSayTeacher(t).then(function (ok2) { if (ok2) upgrade(); });
      });
    });
  });

  /* ── 3. Theme toggle — synced with the main site sun/moon toggle ── */
  /* The main React app persists its light/dark choice under "cmc-theme"
     (applied as an html.light class). These standalone pages used to keep
     their own "biweek-theme" key, so they ignored the main toggle. Now:
       - restore prefers "cmc-theme" and falls back to "biweek-theme"
         (legacy key kept so previously saved choices still apply),
       - toggling writes BOTH keys, so the main site and any stale cached
         copies of these pages stay consistent,
       - a `storage` listener live-follows changes made in other tabs
         (main site toggle or a sibling planner page).                   */
  var THEME_MASTER = 'cmc-theme';
  var THEME_LEGACY = 'biweek-theme';
  function setToggleIcon(light) {
    var btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = light ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  }
  global.toggleTheme = function () {
    var goingLight = document.documentElement.getAttribute('data-theme') !== 'light';
    document.documentElement.setAttribute('data-theme', goingLight ? 'light' : 'dark');
    try {
      localStorage.setItem(THEME_MASTER, goingLight ? 'light' : 'dark');
      localStorage.setItem(THEME_LEGACY, goingLight ? 'light' : 'dark');
    } catch (e) {}
    setToggleIcon(goingLight);
    cmcTrack('theme_toggle', { theme: goingLight ? 'light' : 'dark' });
  };
  // Restore the saved theme before first paint of the body content.
  try {
    var saved = localStorage.getItem(THEME_MASTER) || localStorage.getItem(THEME_LEGACY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      global.addEventListener('DOMContentLoaded', function () { setToggleIcon(saved === 'light'); });
    }
  } catch (e) {}
  // Live-sync with other tabs: the main site toggle (React) or another
  // planner page changed the shared "cmc-theme" key.
  try {
    global.addEventListener('storage', function (e) {
      if (e.key !== THEME_MASTER || e.newValue == null) return;
      var light = e.newValue === 'light';
      document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
      setToggleIcon(light);
    });
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

  // Firebase web API key for creative-minds-cambodia — same public value as
  // .env.local / src/lib/firebase.ts (web keys are designed to be public;
  // access is controlled by Firestore security rules). Needed here for the
  // securetoken refresh grant on worksheet pages, where no React code runs.
  var FB_API_KEY = global.CMC_FB_API_KEY || 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';

  /** Exchange the stored refresh token for a fresh ID token; updates
   *  localStorage and calls cb(newToken|null). */
  function refreshFirebaseToken(cb) {
    var rt;
    try { rt = localStorage.getItem('cmc-student-refresh-token'); } catch (e) { rt = null; }
    if (!rt) { cb(null); return; }
    try {
      fetch('https://securetoken.googleapis.com/v1/token?key=' + FB_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt),
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.id_token) { cb(null); return; }
        try {
          localStorage.setItem('cmc-student-token', d.id_token);
          localStorage.setItem('cmc-student-token-expires', String(Date.now() + ((Number(d.expires_in) || 3600) * 1000) - 60000));
          if (d.refresh_token) localStorage.setItem('cmc-student-refresh-token', d.refresh_token);
        } catch (e) {}
        cb(d.id_token);
      }).catch(function () { cb(null); });
    } catch (e) { cb(null); }
  }

  /**
   * Submit a drill attempt for the signed-in student. No-ops silently when
   * there is no session — scoring UI never depends on it. When the stored
   * ID token has expired (they live ~1 hour) it is silently refreshed via
   * the securetoken grant before submitting. opts: { drillSlug?,
   * drillTitle?, drillSource?, scorePct, correctCount, totalCount,
   * durationSeconds? }
   */
  global.CMC.submitDrill = function (opts) {
    try {
      var token = localStorage.getItem('cmc-student-token');
      var name = localStorage.getItem('cmc-student-name') || '';
      var uid = localStorage.getItem('cmc-student-uid') || '';
      var clsId = localStorage.getItem('cmc-student-classId') || '';
      var exp = Number(localStorage.getItem('cmc-student-token-expires') || '0');
      if (!token || !name) return;

      var send = function (tok) {
        if (!tok) return;
        var url = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/drill_attempts';
        var body = {
          fields: {
            drillSlug: { stringValue: opts.drillSlug || global.location.pathname.split('/').pop() },
            drillTitle: { stringValue: opts.drillTitle || document.title.split('—')[0].trim() },
            drillSource: { stringValue: opts.drillSource || 'biweek-planner' },
            studentName: { stringValue: name },
            studentUid: { stringValue: uid },
            classId: clsId ? { stringValue: clsId } : { nullValue: null },
            durationSeconds: opts.durationSeconds != null ? { integerValue: String(opts.durationSeconds) } : { nullValue: null },
            scorePct: { integerValue: String(opts.scorePct) },
            correctCount: { integerValue: String(opts.correctCount) },
            totalCount: { integerValue: String(opts.totalCount) },
            submittedAt: { timestampValue: new Date().toISOString() },
          },
        };
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
          body: JSON.stringify(body),
        }).catch(function (e) {});
      };

      if (exp && exp <= Date.now()) {
        // Token aged out — silently refresh, then submit with the new one.
        refreshFirebaseToken(send);
      } else {
        send(token);
      }
    } catch (e) {}
  };

  /* ── 6. Fullscreen runtime (CMC.fs) + shared toast ──────────────── */
  /* Same hardened behavior as the week8 recap drills' built-in engine:
   *   - hidden / inert where fullscreen cannot work (iPhone Safari has no
   *     element fullscreen API; Messenger/FB/IG in-app WebViews block it)
   *   - blocked requests degrade to normal view with a toast, never lock up
   *   - always-visible "Exit fullscreen" button while in fullscreen
   *   - backdrop-filter / body overlay layers neutralized in :fullscreen
   *     (they misrender on some mobile WebViews and hid page content)
   * Pages with their own fullscreen engine (week8 recap drills) are inert:
   * injection is skipped when the page already ships a #fs-exit element. */
  (function () {
    var UA = global.navigator.userAgent || '';
    var IN_APP = /FBAN|FBAV|FB_IAB|FBSV|FBID|Instagram|Line|Zalo|Snapchat|musical_ly|; wv\)|\bwv\)/i.test(UA);
    var IOS = /iP(hone|ad|od)/.test(UA) || (/Macintosh/.test(UA) && global.navigator.maxTouchPoints > 1);
    var rootEl = document.documentElement;
    var HAS_API = !!(rootEl && (rootEl.requestFullscreen || rootEl.webkitRequestFullscreen));

    function supported() { return HAS_API && !IN_APP && !IOS; }
    function isActive() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }
    function say(msg) {
      if (global.CMC && global.CMC.toast) global.CMC.toast(msg);
    }
    function enter() {
      if (!supported()) return;
      var el = document.documentElement;
      var fn = el.requestFullscreen || el.webkitRequestFullscreen;
      try {
        var p = fn.call(el);
        if (p && p.catch) {
          p.catch(function () { say('Fullscreen was blocked — continuing in normal view.'); });
        }
      } catch (e) { say('Fullscreen is not available here — continuing in normal view.'); }
    }
    function exit() {
      if (!isActive()) return;
      var fn = document.exitFullscreen || document.webkitExitFullscreen;
      try { var p = fn.call(document); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    function toggle() {
      if (isActive()) exit(); else if (supported()) enter();
    }
    global.CMC.fs = { supported: supported, isActive: isActive, enter: enter, exit: exit, toggle: toggle };

    // Lazy toast host — usable before/without the DOM-ready injection.
    function toast(msg) {
      if (!document.body) return;
      var t = document.getElementById('cmc-toast');
      if (!t) { t = document.createElement('div'); t.id = 'cmc-toast'; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
    }
    global.CMC.toast = toast;

    function inject() {
      // Inert on pages that ship their own fullscreen UI (week8 recap drills).
      if (document.getElementById('fs-exit')) return;
      var st = document.createElement('style');
      st.id = 'cmc-fs-style';
      st.textContent =
        'html:fullscreen body::before,html:fullscreen body::after,' +
        'html:-webkit-full-screen body::before,html:-webkit-full-screen body::after{display:none!important}' +
        'html:fullscreen .glass,html:fullscreen .theme-toggle,html:fullscreen .btn,' +
        'html:-webkit-full-screen .glass,html:-webkit-full-screen .theme-toggle,html:-webkit-full-screen .btn{backdrop-filter:none!important}' +
        '#fs-exit{position:fixed;bottom:16px;right:16px;z-index:99996;display:none;align-items:center;gap:6px;padding:9px 14px;border-radius:12px;border:1px solid rgba(248,113,113,.45);background:rgba(30,10,15,.93);color:#fca5a5;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)}' +
        '#fs-exit:hover{background:rgba(60,15,25,.96);color:#fff}' +
        'html[data-theme="light"] #fs-exit{background:rgba(255,255,255,.97);border-color:rgba(225,29,72,.4);color:#e11d48;box-shadow:0 8px 24px rgba(0,0,0,.12)}' +
        '#cmc-toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%) translateY(8px);z-index:99997;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:600;font-family:\'Plus Jakarta Sans\',sans-serif;background:rgba(2,6,23,.95);color:#e2e8f0;border:1px solid rgba(56,189,248,.35);box-shadow:0 10px 30px rgba(0,0,0,.45);max-width:88vw;text-align:center}' +
        '#cmc-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
        'html[data-theme="light"] #cmc-toast{background:rgba(255,255,255,.98);color:#1e293b;border-color:rgba(2,132,199,.35)}';
      document.head.appendChild(st);

      var exitBtn = document.createElement('button');
      exitBtn.id = 'fs-exit';
      exitBtn.type = 'button';
      exitBtn.innerHTML = '<i class="fas fa-compress"></i> Exit fullscreen';
      exitBtn.addEventListener('click', exit);
      document.body.appendChild(exitBtn);

      function onChange() {
        var on = isActive();
        exitBtn.style.display = on ? 'inline-flex' : 'none';
        var tog = document.getElementById('fsToggle');
        if (tog) {
          var ico = tog.querySelector('i');
          if (ico) ico.className = on ? 'fas fa-compress' : 'fas fa-expand';
          tog.title = on ? 'Exit fullscreen' : 'Fullscreen';
        }
      }
      function onErr() { say('Fullscreen is not available on this device.'); }
      document.addEventListener('fullscreenchange', onChange);
      document.addEventListener('webkitfullscreenchange', onChange);
      document.addEventListener('fullscreenerror', onErr);
      document.addEventListener('webkitfullscreenerror', onErr);

      // Hide the toggle where fullscreen cannot work (in-app WebView, iPhone).
      var tog = document.getElementById('fsToggle');
      if (tog && !supported()) tog.style.display = 'none';
      onChange();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  })();
})(window);
