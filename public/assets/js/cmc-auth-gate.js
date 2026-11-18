/*
 * CMC account gate — one small runtime for every standalone page in public/.
 *
 * OWNER POLICY (Nov 2026): nothing on the site is usable without a CMC
 * account. Non-signed-up visitors may only LOOK at a couple of sample games
 * and can never download, print or submit anything.
 *
 * Roles (resolved by src/lib/userProfile.ts and mirrored here):
 *   guest            — no session. Locked everywhere; CTA to sign up.
 *   student / user   — identical privileges: every game, worksheet, test,
 *                      homework and student-copy download.
 *   teacher (pending)— chose Teacher but not yet verified (.edu unverified or
 *                      awaiting admin approval): same as student.
 *   teacher (verified) — everything except admin areas.
 *   admin            — everything.
 *
 * USAGE — drop this in <head> BEFORE any other script:
 *   <script src="../assets/js/cmc-auth-gate.js"></script>
 * then, on pages that must be fully gated, right after <body>:
 *   <script>CMC_GATE.guard('account', 'Sign up free to play this game.');</script>
 *   <script>CMC_GATE.guard('teacher', 'Teacher sign-in required.');</script>
 *
 * The guard renders a full-page overlay with Sign up / Sign in buttons that
 * round-trip through the React app:
 *   <app-root>/?auth=signup&next=<this page>&context=<reason>
 * After a successful sign-in the app returns here (authLinks.safeReturnUrl).
 *
 * It ALSO blocks downloads and prints for guests: every <a download>, every
 * .pdf/.doc/.zip/.pptx/.xlsx link, and window.print() are intercepted.
 *
 * No dependencies, no build step. ES5 only (these pages also run on older
 * classroom browsers).
 */
(function (global) {
  'use strict';

  var LS_TOKEN = 'cmc-student-token';
  var LS_UID = 'cmc-student-uid';
  var LS_EMAIL = 'cmc-student-email';
  var LS_ROLE = 'cmc-student-role';
  var LS_TYPE = 'cmc-account-type';
  var LS_VERIFIED = 'cmc-student-verified';
  var LS_EXPIRES = 'cmc-student-token-expires';

  // This site is published under /Creative-Minds-/ on GitHub Pages, rather
  // than at the domain root. Derive the app root from this shared script's
  // URL so the same links also work on a custom domain or local root deploy.
  var GATE_SCRIPT_URL = document.currentScript && document.currentScript.src;
  function appRoot() {
    if (GATE_SCRIPT_URL) {
      try {
        var root = new URL('../../', GATE_SCRIPT_URL).pathname;
        return root.charAt(root.length - 1) === '/' ? root : root + '/';
      } catch (e) { /* use the root fallback below */ }
    }
    // `document.currentScript` is available for the normal script include;
    // keep a project-site fallback for older embedded browsers that omit it.
    var host = String(global.location && global.location.hostname || '');
    var firstSegment = String(global.location && global.location.pathname || '/').split('/')[1];
    return /(^|\.)github\.io$/i.test(host) && firstSegment ? '/' + firstSegment + '/' : '/';
  }

  var ADMIN_UIDS = ['5iLvnjzmV8QY7WFZhyTq6PIgcI63'];
  var DOWNLOAD_EXT = /\.(pdf|docx?|pptx?|xlsx?|zip|rar|7z|csv|txt|rtf|odt|ods|epub|mp3|mp4|png|jpe?g|gif|svg|html?)$/i;

  function ls(key) {
    try { return global.localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  /** Decode the `email_verified` claim without a network call. */
  function tokenEmailVerified(token) {
    try {
      var payload = String(token || '').split('.')[1] || '';
      var padded = payload.replace(/-/g, '+').replace(/_/g, '/');
      while (padded.length % 4) padded += '=';
      var json = decodeURIComponent(atob(padded).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      var claim = JSON.parse(json).email_verified;
      return typeof claim === 'boolean' ? claim : null;
    } catch (e) {
      return null;
    }
  }

  /** The current session, resolved exactly like the React app does. */
  function session() {
    var token = ls(LS_TOKEN);
    if (!token) return null;
    var uid = ls(LS_UID);
    var email = ls(LS_EMAIL);
    var expiresAt = Number(ls(LS_EXPIRES) || '0');
    var claimed = tokenEmailVerified(token);
    var verified = claimed === null ? ls(LS_VERIFIED) === '1' : claimed;
    var isAdmin = ADMIN_UIDS.indexOf(uid) !== -1;
    var role = ls(LS_ROLE) === 'teacher' ? 'teacher' : 'student';
    var accountType = ls(LS_TYPE) || (role === 'teacher' ? 'teacher' : 'student');
    if (isAdmin) { role = 'teacher'; accountType = 'teacher'; }
    return {
      uid: uid,
      email: email,
      name: ls('cmc-student-name'),
      token: token,
      role: role,
      accountType: accountType,
      emailVerified: verified,
      isAdmin: isAdmin,
      isVerifiedTeacher: role === 'teacher' && verified,
      isPendingTeacher: accountType === 'teacher' && !(role === 'teacher'),
      isExpired: expiresAt > 0 && Date.now() >= expiresAt,
      signedIn: Boolean(token && uid) && verified
    };
  }

  function isSignedIn() {
    var s = session();
    return Boolean(s && s.signedIn);
  }

  function isTeacher() {
    var s = session();
    return Boolean(s && s.signedIn && s.isVerifiedTeacher);
  }

  function isAdmin() {
    var s = session();
    return Boolean(s && s.signedIn && s.isAdmin);
  }

  /** Where to send a visitor who wants an account, then back here. */
  function authUrl(mode) {
    var next = global.location.pathname + global.location.search + global.location.hash;
    // Keep it relative — the React app validates this (authLinks.safeReturnUrl).
    if (next.charAt(0) !== '/') next = '/' + next.replace(/^\.?\//, '');
    return appRoot() + '?auth=' + encodeURIComponent(mode || 'signup') + '&next=' + encodeURIComponent(next);
  }

  function goAuth(mode) {
    global.location.assign(authUrl(mode));
  }

  /**
   * Send the visitor straight to the account flow for this page. Same
   * destination as the gate overlay's buttons — `/?auth=…&next=<here>` —
   * so a static page can prompt for an account from anywhere in its UI.
   */
  function requestAuth(mode) {
    goAuth(mode === 'signin' || mode === 'sign-in' ? 'signin' : 'signup');
  }

  var OVERLAY_ID = 'cmc-account-gate-overlay';

  function removeOverlay() {
    var el = global.document.getElementById(OVERLAY_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function overlayCopy(mode) {
    if (mode === 'teacher') {
      return {
        title: 'Verified teacher access',
        body: 'This page is for verified teachers. Teacher access is granted by the site admin — school (.edu) and other addresses alike are approved in the Admin teacher-verification panel, then unlock once your email is verified.',
        primary: 'Sign up free',
        secondary: 'I already have an account'
      };
    }
    if (mode === 'admin') {
      return {
        title: 'Admin only',
        body: 'This page is limited to the site owner account.',
        primary: 'Sign in',
        secondary: ''
      };
    }
    return {
      title: 'Create a free account to continue',
      body: 'Games, worksheets, practice tests and homework are free — we just need a confirmed email so your work is saved.',
      primary: 'Sign up free',
      secondary: 'I already have an account'
    };
  }

  /**
   * Render a blocking overlay. `mode` is 'account' | 'teacher' | 'admin'.
   * Safe to call before DOMContentLoaded (it waits for <body>).
   */
  function showOverlay(mode, reason) {
    if (typeof document === 'undefined') return;
    var mount = function () {
      removeOverlay();
      var copy = overlayCopy(mode);
      var host = document.createElement('div');
      host.id = OVERLAY_ID;
      host.setAttribute('data-cmc-auth-gate', mode);
      host.innerHTML =
        '<style>' +
        '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:24px;' +
        'background:radial-gradient(ellipse at 50% 0%,rgba(34,211,238,.16),transparent 60%),rgba(2,8,20,.96);' +
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e2e8f0;overflow:auto}' +
        '#' + OVERLAY_ID + ' .gate-card{width:100%;max-width:460px;text-align:center;' +
        'background:linear-gradient(160deg,#0d1b2e,#0a1424);border:1px solid rgba(148,197,255,.22);border-radius:22px;' +
        'box-shadow:0 30px 80px -20px rgba(0,0,0,.85);padding:34px 28px}' +
        '#' + OVERLAY_ID + ' .gate-icon{display:inline-flex;width:56px;height:56px;align-items:center;justify-content:center;' +
        'border-radius:16px;background:linear-gradient(135deg,rgba(34,211,238,.25),rgba(20,184,166,.12));' +
        'border:1px solid rgba(34,211,238,.4);font-size:26px;margin-bottom:18px}' +
        '#' + OVERLAY_ID + ' h1{margin:0 0 10px;font-size:22px;line-height:1.25;font-weight:800;color:#fff}' +
        '#' + OVERLAY_ID + ' p{margin:0 0 8px;font-size:13px;line-height:1.6;color:#9fb3c8}' +
        '#' + OVERLAY_ID + ' .gate-reason{margin:14px 0 0;padding:10px 12px;border-radius:10px;font-size:12px;' +
        'background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.28);color:#c8f4ff}' +
        '#' + OVERLAY_ID + ' .gate-actions{display:flex;flex-direction:column;gap:9px;margin-top:22px}' +
        '#' + OVERLAY_ID + ' button{font:inherit;cursor:pointer;border-radius:12px;padding:12px 18px;font-size:13.5px;font-weight:700;' +
        'border:1px solid transparent;transition:transform .15s ease,filter .15s ease}' +
        '#' + OVERLAY_ID + ' button:hover{transform:translateY(-1px);filter:brightness(1.06)}' +
        '#' + OVERLAY_ID + ' .gate-primary{background:linear-gradient(135deg,#22d3ee,#14b8a6);color:#04121f;border:none}' +
        '#' + OVERLAY_ID + ' .gate-secondary{background:rgba(255,255,255,.05);border-color:rgba(148,163,184,.3);color:#e2e8f0}' +
        '#' + OVERLAY_ID + ' .gate-note{margin-top:16px;font-size:11px;line-height:1.6;color:#64748b}' +
        '</style>' +
        '<div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="cmc-gate-title">' +
        '<div class="gate-icon" aria-hidden="true">🔒</div>' +
        '<h1 id="cmc-gate-title"></h1>' +
        '<p></p>' +
        (reason ? '<p class="gate-reason"></p>' : '') +
        '<div class="gate-actions">' +
        '<button type="button" class="gate-primary"></button>' +
        (copy.secondary ? '<button type="button" class="gate-secondary"></button>' : '') +
        '</div>' +
        '<p class="gate-note">Students and general users get the same access: every game, worksheet, test and student-copy download. Only the admin area is limited to the site owner.</p>' +
        '</div>';
      // Text is assigned with textContent so page-supplied reasons can never
      // inject markup.
      host.querySelector('h1').textContent = copy.title;
      host.querySelectorAll('p')[0].textContent = copy.body;
      if (reason) host.querySelector('.gate-reason').textContent = reason;
      var buttons = host.querySelectorAll('button');
      buttons[0].textContent = copy.primary;
      buttons[0].addEventListener('click', function () { goAuth(mode === 'admin' ? 'signin' : 'signup'); });
      if (buttons[1]) {
        buttons[1].textContent = copy.secondary;
        buttons[1].addEventListener('click', function () { goAuth('signin'); });
      }
      document.body.appendChild(host);
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }

  /**
   * Gate the whole page. Returns true when the visitor may continue.
   *   CMC_GATE.guard('account')  — any signed-in verified account
   *   CMC_GATE.guard('teacher')  — verified teacher (or admin)
   *   CMC_GATE.guard('admin')    — site owner only
   */
  function guard(mode, reason) {
    mode = mode || 'account';
    var allowed = mode === 'admin' ? isAdmin() : mode === 'teacher' ? isTeacher() : isSignedIn();
    if (!allowed) {
      showOverlay(mode, reason || '');
      // Hide the page content while the overlay is up, so a slow script can
      // never leak the locked experience underneath.
      try {
        document.documentElement.setAttribute('data-cmc-gate', mode);
        var style = document.getElementById('cmc-gate-hide-style');
        if (!style) {
          style = document.createElement('style');
          style.id = 'cmc-gate-hide-style';
          style.textContent = 'html[data-cmc-gate] body > *:not(#' + OVERLAY_ID + '){visibility:hidden!important}' +
            'html[data-cmc-gate] body{overflow:hidden}';
          (document.head || document.documentElement).appendChild(style);
        }
      } catch (e) { /* cosmetic only */ }
    }
    return allowed;
  }

  /** Unlock the page after an in-page sign-in (e.g. a modal). */
  function unlock() {
    removeOverlay();
    try { document.documentElement.removeAttribute('data-cmc-gate'); } catch (e) { /* noop */ }
  }

  // ── Download / print blocker ─────────────────────────────────────────
  // Guests cannot download anything. Signed-in accounts may (student copies);
  // teacher-only keys are inside the page's own gates.
  function blockDownload(event) {
    if (isSignedIn()) return;
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    var target = link || event.target;
    var href = link ? link.getAttribute('href') || '' : '';
    var wantsDownload = link && (
      link.hasAttribute('download') ||
      /blob:|data:application\//.test(href) ||
      DOWNLOAD_EXT.test(href.split('?')[0])
    );
    if (!wantsDownload) return;
    event.preventDefault();
    event.stopPropagation();
    showOverlay('account', 'Downloads need a free account — sign up and the file unlocks immediately.');
  }

  function installGuards() {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', blockDownload, true);
    // Printing is a copy of the content: not for guests.
    var nativePrint = global.print;
    global.print = function () {
      if (!isSignedIn()) {
        showOverlay('account', 'Printing needs a free account — sign up and print or save as PDF right away.');
        return;
      }
      if (nativePrint) nativePrint.call(global);
    };
    // Ctrl/Cmd+P on guests.
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'p' && !isSignedIn()) {
        e.preventDefault();
        showOverlay('account', 'Printing needs a free account — sign up and print or save as PDF right away.');
      }
    }, true);
    // Keep the page honest when the session changes in another tab.
    global.addEventListener('storage', function (e) {
      if (!e || !e.key || e.key.indexOf('cmc-') !== 0) return;
      var gated = document.documentElement.getAttribute('data-cmc-gate');
      if (!gated) return;
      var allowed = gated === 'admin' ? isAdmin() : gated === 'teacher' ? isTeacher() : isSignedIn();
      if (allowed) unlock();
    });
  }

  installGuards();

  global.CMC_GATE = {
    session: session,
    isSignedIn: isSignedIn,
    isTeacher: isTeacher,
    isAdmin: isAdmin,
    guard: guard,
    unlock: unlock,
    showOverlay: showOverlay,
    authUrl: authUrl,
    requestAuth: requestAuth,
    downloadAllowed: isSignedIn,
    ADMIN_UIDS: ADMIN_UIDS
  };
})(typeof window !== 'undefined' ? window : this);
