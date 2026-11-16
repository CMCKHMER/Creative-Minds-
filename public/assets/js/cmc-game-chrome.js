/*
 * CMC GAME CHROME — the furniture every standalone arcade page shares.
 * =====================================================================
 * One script puts the same three things on Mafia Noir, Galica, Word Creator
 * and any future cartridge dropped into public/arcade/:
 *
 *   1. ← Back to CMC      always visible, always in the same corner
 *   2. 🏆 Class board     the Brain Lounge leaderboard
 *   3. 📣 Share with class  copy link / WhatsApp / Telegram / email
 *
 * plus an optional "How to play" sheet built from the page's own words, so
 * the instructions stop living inside a 6px canvas font.
 *
 * ── USAGE ────────────────────────────────────────────────────────────
 *   <script>window.CMC_GAME_CHROME = {
 *     theme: 'neon',                 // neon | aurora | noir | glass
 *     title: 'Galica',
 *     bay: 'Bay 03',
 *     help: {                        // omit for no ? button
 *       intro: 'One line about the game.',
 *       sections: [ { h: 'Controls', items: ['← → move', 'Z fire'] } ],
 *       art: [ { src: './art/sector-1.jpg', title: 'Sector 1', sub: 'Deep Space' } ]
 *     },
 *     mount: '#cmcSlot',             // optional: render a compact inline
 *     inline: true,                  // cluster inside this element instead of
 *     actions: ['back','board','share'], // the fixed corner bar (Word Creator
 *     onPause: true                  // mounts into its own header)
 *   };</script>
 *   <script src="../../assets/js/cmc-game-chrome.js"></script>
 *
 * The page listens for pausing:
 *   window.addEventListener('cmc-chrome:modal', e => paused = e.detail.open);
 *
 * Public API (window.CMC_CHROME):
 *   share()        open the share sheet
 *   help()         open the how-to-play sheet
 *   openModal(html, title)   open any HTML
 *   close()
 *   toast(text)
 *
 * No dependencies, no build step, ES5 only — these pages also run on older
 * classroom browsers. Never blocks play: the bar is pointer-events:none and
 * only the buttons take clicks.
 */
(function (global) {
  'use strict';

  var CFG = global.CMC_GAME_CHROME || {};
  var THEMES = {
    neon: { accent: '#00ffaa', accent2: '#ffd23d', ink: '#02070a', panel: 'rgba(4,14,12,.9)', text: '#e6fff6', muted: '#7fb9a6', font: "'Press Start 2P',ui-monospace,monospace", radius: '10px' },
    aurora: { accent: '#22d3ee', accent2: '#8b5cf6', ink: '#0b2545', panel: 'rgba(255,255,255,.86)', text: '#0f2544', muted: '#5b7899', font: "'Outfit',system-ui,sans-serif", radius: '14px' },
    noir: { accent: '#e8b64c', accent2: '#ff5b6e', ink: '#0a0d18', panel: 'rgba(20,26,51,.94)', text: '#f1e6cf', muted: '#8d96b8', font: "'Josefin Sans',system-ui,sans-serif", radius: '12px' },
    glass: { accent: '#67e8f9', accent2: '#c084fc', ink: '#0b1220', panel: 'rgba(15,23,42,.9)', text: '#f1f5f9', muted: '#94a3b8', font: "'Inter',system-ui,sans-serif", radius: '12px' }
  };

  // ── where the lounge lives ──────────────────────────────────────────
  // This site is published under /Creative-Minds-/ rather than a domain
  // root, so derive the app root from this script's own URL.
  var SCRIPT_URL = document.currentScript && document.currentScript.src;
  function appRoot() {
    if (SCRIPT_URL) {
      try {
        var root = new URL('../../', SCRIPT_URL).pathname;
        return root.charAt(root.length - 1) === '/' ? root : root + '/';
      } catch (e) { /* fall through */ }
    }
    var host = String(global.location && global.location.hostname || '');
    var first = String(global.location && global.location.pathname || '/').split('/')[1];
    return /(^|\.)github\.io$/i.test(host) && first ? '/' + first + '/' : '/';
  }
  var LOUNGE = appRoot() + '#brain-lounge';
  var HERE = String(global.location.href).split('#')[0];

  var t = THEMES[CFG.theme] || THEMES.glass;
  var TITLE = CFG.title || document.title.split(/[—–|-]/)[0].trim() || 'Brain Lounge game';
  var BAY = CFG.bay || '';
  var ids = { bar: 'cmc-gc', modal: 'cmc-gc-modal', toast: 'cmc-gc-toast' };

  // ── styles ──────────────────────────────────────────────────────────
  function css() {
    return ''
      + ':root{--cmc-gc-accent:' + t.accent + ';--cmc-gc-accent2:' + t.accent2 + ';--cmc-gc-panel:' + t.panel
      + ';--cmc-gc-text:' + t.text + ';--cmc-gc-muted:' + t.muted + ';--cmc-gc-font:' + t.font + ';--cmc-gc-radius:' + t.radius + '}'
      + '#' + ids.bar + '{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;align-items:center;justify-content:space-between;gap:8px;'
      + 'padding:10px 12px;pointer-events:none;font-family:var(--cmc-gc-font);-webkit-font-smoothing:antialiased}'
      + '#' + ids.bar + '>*{pointer-events:auto}'
      + '#cmc-gc-back,#cmc-gc-dock button,#cmc-gc-dock a{display:inline-flex;align-items:center;gap:7px;text-decoration:none;cursor:pointer;'
      + 'border:1px solid rgba(255,255,255,.28);border-radius:999px;'
      + 'background:var(--cmc-gc-panel);color:var(--cmc-gc-text);padding:8px 13px;font-family:inherit;'
      + 'font-size:11px;font-weight:700;letter-spacing:.06em;line-height:1;white-space:nowrap;'
      + 'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 20px rgba(0,0,0,.35);transition:transform .16s,border-color .16s,background .16s}'
      + '#cmc-gc-back:hover,#cmc-gc-dock button:hover,#cmc-gc-dock a:hover{transform:translateY(-1px);border-color:var(--cmc-gc-accent)}'
      + '#cmc-gc-back:focus-visible,#cmc-gc-dock button:focus-visible,#cmc-gc-dock a:focus-visible{outline:2px solid var(--cmc-gc-accent);outline-offset:2px}'
      + '#cmc-gc-back .arw{font-size:13px;color:var(--cmc-gc-accent)}'
      + '#cmc-gc-back .bay{color:var(--cmc-gc-muted);font-weight:600}'
      + '#cmc-gc-dock{display:flex;align-items:center;gap:7px}'
      + '#cmc-gc-dock .lbl{display:inline}'
      + '#cmc-gc-dock .ic{font-size:13px;line-height:1}'
      + '#cmc-gc-dock [data-act=help]{border-color:color-mix(in srgb,var(--cmc-gc-accent2) 45%,transparent)}'
      + '@supports (border-color:color-mix(in srgb,red 40%,transparent)){'
      + '#cmc-gc-back,#cmc-gc-dock button,#cmc-gc-dock a{border-color:color-mix(in srgb,var(--cmc-gc-accent) 40%,transparent)}'
      + '}'
      + '.cmc-gc-inline{display:flex;align-items:center;gap:6px}'
      + '.cmc-gc-inline #cmc-gc-back,.cmc-gc-inline #cmc-gc-dock button,.cmc-gc-inline #cmc-gc-dock a{'
      + 'padding:0;height:34px;min-width:34px;justify-content:center;border-radius:10px;font-size:10px;box-shadow:0 2px 8px rgba(0,0,0,.14)}'
      + '.cmc-gc-inline #cmc-gc-back{padding:0 10px;gap:5px}'
      + '.cmc-gc-inline #cmc-gc-dock{gap:6px}'
      + '.cmc-gc-inline .bay{display:none}'
      + 'html[data-cmc-gc-modal] body{overflow:hidden}'
      + '#' + ids.modal + '{position:fixed;inset:0;z-index:2147483100;display:none;place-items:center;padding:18px;'
      + 'background:rgba(2,6,12,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:var(--cmc-gc-font)}'
      + '#' + ids.modal + '.open{display:grid}'
      + '#' + ids.modal + ' .sheet{position:relative;width:min(680px,96vw);max-height:88dvh;overflow:auto;padding:26px 24px 22px;'
      + 'border-radius:calc(var(--cmc-gc-radius) + 8px);background:var(--cmc-gc-panel);color:var(--cmc-gc-text);'
      + 'border:1px solid currentColor;box-shadow:0 30px 80px rgba(0,0,0,.6);animation:cmcGcIn .28s cubic-bezier(.2,1.1,.3,1)}'
      + '@keyframes cmcGcIn{from{opacity:0;transform:translateY(16px) scale(.98)}}'
      + '#' + ids.modal + ' h2{margin:0 0 4px;font-size:19px;letter-spacing:.04em;color:var(--cmc-gc-text)}'
      + '#' + ids.modal + ' .kick{font-size:9px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--cmc-gc-accent);margin:0 0 8px}'
      + '#' + ids.modal + ' h3{margin:18px 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--cmc-gc-accent)}'
      + '#' + ids.modal + ' p,#' + ids.modal + ' li{font-size:13px;line-height:1.7;color:var(--cmc-gc-text);opacity:.92}'
      + '#' + ids.modal + ' ul{margin:0;padding-left:18px}'
      + '#' + ids.modal + ' li{margin:3px 0}'
      + '#' + ids.modal + ' .x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;'
      + 'border:1px solid rgba(255,255,255,.28);background:transparent;color:var(--cmc-gc-text);font-size:15px;cursor:pointer}'
      + '#' + ids.modal + ' .x:hover{background:color-mix(in srgb,var(--cmc-gc-accent) 18%,transparent)}'
      + '#' + ids.modal + ' .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));margin-top:10px}'
      + '#' + ids.modal + ' .art{border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.2);background:#000}'
      + '#' + ids.modal + ' .art img{display:block;width:100%;aspect-ratio:1;object-fit:cover}'
      + '#' + ids.modal + ' .art b{display:block;padding:7px 8px 0;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cmc-gc-accent)}'
      + '#' + ids.modal + ' .art span{display:block;padding:1px 8px 8px;font-size:10.5px;color:var(--cmc-gc-muted)}'
      + '#' + ids.modal + ' .share{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:14px}'
      + '#' + ids.modal + ' .share button,#' + ids.modal + ' .share a{display:flex;align-items:center;gap:9px;padding:12px 14px;border-radius:10px;cursor:pointer;'
      + 'text-decoration:none;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.04em;text-align:left;'
      + 'border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.05);color:var(--cmc-gc-text)}'
      + '#' + ids.modal + ' .share button:hover,#' + ids.modal + ' .share a:hover{border-color:var(--cmc-gc-accent);background:color-mix(in srgb,var(--cmc-gc-accent) 16%,transparent)}'
      + '#' + ids.modal + ' .foot{margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.16);font-size:11px;color:var(--cmc-gc-muted);line-height:1.6}'
      + '#' + ids.modal + ' .foot a{color:var(--cmc-gc-accent)}'
      + '#' + ids.toast + '{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(10px);z-index:2147483200;'
      + 'padding:10px 18px;border-radius:999px;background:var(--cmc-gc-panel);border:1px solid rgba(255,255,255,.3);'
      + 'color:var(--cmc-gc-text);font-family:var(--cmc-gc-font);font-size:11.5px;font-weight:700;opacity:0;pointer-events:none;transition:.24s;max-width:92vw;text-align:center}'
      + '#' + ids.toast + '.show{opacity:1;transform:translateX(-50%) translateY(0)}'
      + '@media(max-width:640px){'
      + '#cmc-gc-dock .lbl{display:none}#cmc-gc-back .bay{display:none}'
      + '#' + ids.bar + '{padding:8px}#cmc-gc-back,#cmc-gc-dock button,#cmc-gc-dock a{padding:8px 10px;font-size:10px}'
      + '#' + ids.modal + ' .sheet{padding:22px 16px 18px}'
      + '}'
      + '@media(prefers-reduced-motion:reduce){#' + ids.bar + ' *,#' + ids.modal + ' *{animation:none!important;transition:none!important}}'
      + '@media print{#' + ids.bar + ',#' + ids.modal + ',#' + ids.toast + '{display:none!important}}';
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    if (html != null) node.innerHTML = html;
    return node;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── bar ─────────────────────────────────────────────────────────────
  function buildBar() {
    var inline = !!CFG.inline;
    var acts = CFG.actions || (CFG.help ? ['back', 'help', 'board', 'share'] : ['back', 'board', 'share']);
    var has = function (a) { return acts.indexOf(a) !== -1; };

    var bar = el('div', inline
      ? { id: ids.bar, class: 'cmc-gc-inline', role: 'navigation', 'aria-label': 'Creative Minds arcade' }
      : { id: ids.bar, role: 'navigation', 'aria-label': 'Creative Minds arcade' });

    if (has('back')) {
      bar.appendChild(el('a', {
        id: 'cmc-gc-back',
        href: LOUNGE,
        title: 'Back to CMC · Brain Lounge',
        'aria-label': 'Back to CMC — the ' + TITLE + ' page is one bay in the Brain Lounge'
      }, '<span class="arw" aria-hidden="true">←</span>' + (inline ? '<span>CMC</span>' : '<span>Back to CMC</span>')
        + (BAY && !inline ? '<span class="bay">· ' + esc(BAY) + '</span>' : '')));
    }

    var dock = el('div', { id: 'cmc-gc-dock' });
    if (CFG.help && has('help')) {
      dock.appendChild(el('button', { type: 'button', 'data-act': 'help', 'aria-label': 'How to play ' + TITLE, title: 'How to play' },
        '<span class="ic" aria-hidden="true">?</span>' + (inline ? '' : '<span class="lbl">How to play</span>')));
    }
    if (has('board')) {
      dock.appendChild(el('a', {
        'data-act': 'board',
        href: LOUNGE,
        'aria-label': 'Open the class leaderboard in the Brain Lounge',
        title: 'Class leaderboard'
      }, '<span class="ic" aria-hidden="true">🏆</span>' + (inline ? '' : '<span class="lbl">Class board</span>')));
    }
    if (has('share')) {
      dock.appendChild(el('button', { type: 'button', 'data-act': 'share', 'aria-label': 'Share ' + TITLE + ' with your class', title: 'Share with class' },
        '<span class="ic" aria-hidden="true">📣</span>' + (inline ? '' : '<span class="lbl">Share</span>')));
    }
    if (dock.childNodes.length) bar.appendChild(dock);
    return bar;
  }

  // ── modal ───────────────────────────────────────────────────────────
  var lastFocus = null;
  function modalNode() {
    var m = document.getElementById(ids.modal);
    if (!m) {
      m = el('div', { id: ids.modal, role: 'dialog', 'aria-modal': 'true', 'aria-label': TITLE + ' — panel' });
      m.appendChild(el('div', { class: 'sheet', tabindex: '-1' }));
      m.addEventListener('click', function (e) { if (e.target === m) close(); });
      (document.body || document.documentElement).appendChild(m);
    }
    return m;
  }

  function open(html, label) {
    var m = modalNode();
    var sheet = m.querySelector('.sheet');
    sheet.innerHTML = '<button type="button" class="x" aria-label="Close">✕</button>' + html;
    sheet.querySelector('.x').addEventListener('click', close);
    m.setAttribute('aria-label', label || TITLE);
    m.classList.add('open');
    document.documentElement.setAttribute('data-cmc-gc-modal', '1');
    lastFocus = document.activeElement;
    try { sheet.focus(); } catch (e) { /* older browsers */ }
    // Tell the game to hold still while the sheet is up.
    try {
      global.dispatchEvent(new CustomEvent('cmc-chrome:modal', { detail: { open: true } }));
    } catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('cmc-chrome:modal', true, true);
      ev.detail = { open: true };
      global.dispatchEvent(ev);
    }
  }

  function close() {
    var m = document.getElementById(ids.modal);
    if (!m || !m.classList.contains('open')) return;
    m.classList.remove('open');
    m.querySelector('.sheet').innerHTML = '';
    document.documentElement.removeAttribute('data-cmc-gc-modal');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
    try {
      global.dispatchEvent(new CustomEvent('cmc-chrome:modal', { detail: { open: false } }));
    } catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('cmc-chrome:modal', true, true);
      ev.detail = { open: false };
      global.dispatchEvent(ev);
    }
  }

  function isOpen() {
    var m = document.getElementById(ids.modal);
    return !!(m && m.classList.contains('open'));
  }

  // While a sheet is open the page's own key handlers must not fire: Space in
  // Galica is "launch", in Word Creator it is "play word". Capture before the
  // page's window/document listeners and stop the event dead.
  ['keydown', 'keyup', 'keypress'].forEach(function (type) {
    global.addEventListener(type, function (e) {
      if (!isOpen()) return;
      if (type === 'keydown' && e.key === 'Escape') close();
      // Keep the event away from the game's handlers. Tab still moves focus
      // (the browser acts on it before it is dispatched) and arrows still
      // scroll the sheet, but Space/letters never reach the board.
      e.stopImmediatePropagation();
      e.stopPropagation();
    }, true);
  });

  // ── share ───────────────────────────────────────────────────────────
  function shareLinks() {
    var url = encodeURIComponent(HERE);
    var text = encodeURIComponent('Playing ' + TITLE + ' in the CMC Brain Lounge — ' + HERE);
    return {
      copy: HERE,
      // Google's documented Classroom share endpoint: no API key, no scopes.
      classroom: 'https://classroom.google.com/share?url=' + url
        + '&title=' + encodeURIComponent(TITLE + ' · CMC Brain Lounge'),
      wa: 'https://wa.me/?text=' + text,
      tg: 'https://t.me/share/url?url=' + url + '&text=' + encodeURIComponent('CMC Brain Lounge · ' + TITLE),
      mail: 'mailto:?subject=' + encodeURIComponent('CMC Brain Lounge · ' + TITLE) + '&body=' + text
    };
  }

  function shareSheet() {
    var s = shareLinks();
    var native = '';
    if (navigator.share) {
      native = '<button type="button" data-sh="native"><span aria-hidden="true">📱</span>Share…</button>';
    }
    open(
      '<p class="kick">Share with class</p>'
      + '<h2>' + esc(TITLE) + '</h2>'
      + '<p>Send the game to a classmate, or open the Brain Lounge scoreboard and see who is on top.</p>'
      + '<div class="share">'
      + native
      + '<button type="button" data-sh="copy"><span aria-hidden="true">🔗</span>Copy link</button>'
      + '<a href="' + s.classroom + '" target="_blank" rel="noopener"><span aria-hidden="true">🏫</span>Google Classroom</a>'
      + '<a href="' + s.wa + '" target="_blank" rel="noopener"><span aria-hidden="true">💬</span>WhatsApp</a>'
      + '<a href="' + s.tg + '" target="_blank" rel="noopener"><span aria-hidden="true">✈️</span>Telegram</a>'
      + '<a href="' + s.mail + '"><span aria-hidden="true">✉️</span>Email</a>'
      + '<a href="' + LOUNGE + '"><span aria-hidden="true">🏆</span>Class leaderboard</a>'
      + '</div>'
      + '<p class="foot">Google Classroom opens its own share dialog — pick the class, then post the game as an announcement or assignment. '
      + 'Students sign in with a free CMC account to play and post scores. '
      + '<a href="' + LOUNGE + '">Back to the Brain Lounge →</a></p>',
      'Share ' + TITLE
    );
    var sheet = document.querySelector('#' + ids.modal + ' .sheet');
    if (!sheet) return;
    sheet.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-sh]') : null;
      if (!btn) return;
      var how = btn.getAttribute('data-sh');
      if (how === 'copy') {
        copy(HERE).then(function (ok) { toast(ok ? 'Link copied ✓' : 'Copy failed — select the address bar'); });
      } else if (how === 'native') {
        navigator.share({ title: TITLE + ' · CMC Brain Lounge', text: 'CMC Brain Lounge · ' + TITLE, url: HERE }).catch(function () { /* dismissed */ });
      }
    });
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = el('textarea', { style: 'position:fixed;top:-999px;opacity:0' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function toast(msg) {
    var n = document.getElementById(ids.toast);
    if (!n) {
      n = el('div', { id: ids.toast, role: 'status', 'aria-live': 'polite' });
      (document.body || document.documentElement).appendChild(n);
    }
    n.textContent = msg;
    n.classList.add('show');
    clearTimeout(n._h);
    n._h = setTimeout(function () { n.classList.remove('show'); }, 2600);
  }

  // ── help sheet ──────────────────────────────────────────────────────
  function helpSheet() {
    var h = CFG.help || {};
    var html = '<p class="kick">' + esc(BAY ? BAY + ' · The Brain Lounge' : 'The Brain Lounge') + '</p>'
      + '<h2>' + esc(TITLE) + '</h2>'
      + (h.intro ? '<p>' + esc(h.intro) + '</p>' : '');
    (h.sections || []).forEach(function (sec) {
      html += '<h3>' + esc(sec.h) + '</h3>';
      if (sec.p) html += '<p>' + esc(sec.p) + '</p>';
      if (sec.items && sec.items.length) {
        html += '<ul>' + sec.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
      }
    });
    if (h.art && h.art.length) {
      html += '<h3>' + esc(h.artTitle || 'The board') + '</h3><div class="grid">'
        + h.art.map(function (a) {
          return '<div class="art"><img src="' + esc(a.src) + '" alt="' + esc(a.title || '') + '" loading="lazy">'
            + '<b>' + esc(a.title || '') + '</b><span>' + esc(a.sub || '') + '</span></div>';
        }).join('') + '</div>';
    }
    html += '<p class="foot">Every cartridge keeps its own rules — this sheet is only the briefing. '
      + '<a href="' + LOUNGE + '">Back to the Brain Lounge →</a></p>';
    open(html, 'How to play ' + TITLE);
  }

  // ── mount ───────────────────────────────────────────────────────────
  function mount() {
    var style = el('style');
    style.textContent = css();
    (document.head || document.documentElement).appendChild(style);
    var bar = buildBar();
    var slot = CFG.mount ? document.querySelector(CFG.mount) : null;
    if (slot) slot.appendChild(bar);
    else (document.body || document.documentElement).appendChild(bar);
    document.documentElement.setAttribute('data-cmc-gc-theme', CFG.theme || 'glass');
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'share') { e.preventDefault(); shareSheet(); }
      else if (act === 'help') { e.preventDefault(); helpSheet(); }
    });
  }

  var api = {
    share: shareSheet,
    help: helpSheet,
    openModal: open,
    close: close,
    toast: toast,
    lounge: LOUNGE,
    title: TITLE
  };
  global.CMC_CHROME = api;
  global.CMC_GAME_CHROME_API = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
