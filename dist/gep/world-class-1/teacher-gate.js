/*
 * CMC Teacher Gate & Pre-Paint Theme Sync — World Class 1 Teacher's Edition.
 *
 * Loaded synchronously in <head> of public/gep/world-class-1/index.html and
 * unit.html..unit12.html so that:
 *   1. html[data-theme] and html.light match localStorage('cmc-theme') before
 *      first paint (zero light/dark flash, synced with the main CMC site).
 *   2. Non-teacher visitors (guests, students, pending/unverified teachers)
 *      never see teacher book content or answer keys; instead they get a
 *      themed "Teacher Access Required" panel that round-trips through the
 *      main React app's teacher sign-in modal (?auth=teacher&next=...) and
 *      auto-unlocks live if the teacher signs in from another tab.
 */
(function (global) {
  'use strict';

  var DOC = global.document;
  var ROOT = DOC.documentElement;
  var ADMIN_UIDS = ['5iLvnjzmV8QY7WFZhyTq6PIgcI63'];
  var LOCK_CLASS = 'cmc-wc1-gate-locked';
  var OVERLAY_ID = 'cmc-wc1-gate-overlay';
  var SCRIPT_URL = DOC.currentScript && DOC.currentScript.src;

  function ls(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }

  /* ── 1. Pre-paint theme sync (matches src/components/ThemeToggle.tsx) ── */
  function applyStoredTheme() {
    var stored = ls('cmc-theme');
    var mode = stored === 'light' ? 'light' : 'dark';
    ROOT.setAttribute('data-theme', mode);
    if (mode === 'light') ROOT.classList.add('light');
    else ROOT.classList.remove('light');
    return mode;
  }
  applyStoredTheme();

  /* ── 2. Resolve deployment root (/Creative-Minds-/ on GH Pages, / locally) */
  function resolveAppRoot() {
    if (SCRIPT_URL) {
      try {
        var root = new URL('../../', SCRIPT_URL).pathname;
        return root.charAt(root.length - 1) === '/' ? root : root + '/';
      } catch (e) { /* fall through */ }
    }
    var host = String((global.location && global.location.hostname) || '');
    var path = String((global.location && global.location.pathname) || '/');
    var first = path.split('/')[1];
    return /(^|\.)github\.io$/i.test(host) && first ? '/' + first + '/' : '/';
  }

  var APP_ROOT = resolveAppRoot();
  global.CMC_WC1_APP_ROOT = APP_ROOT;

  function signInUrl() {
    var loc = global.location || { pathname: '/', search: '', hash: '' };
    var next = String(loc.pathname || '/') + String(loc.search || '') + String(loc.hash || '');
    if (next.charAt(0) !== '/') next = '/' + next.replace(/^\.?\//, '');
    return APP_ROOT + '?auth=teacher&next=' + encodeURIComponent(next) + '#gep-isec';
  }

  /* ── 3. Verified teacher check (mirrors biweek-planner/teacher-gate.js) ── */
  function detectRoleFromEmail(email) {
    var domain = (String(email || '').split('@')[1] || '').toLowerCase();
    return domain && domain.indexOf('edu') !== -1 ? 'teacher' : 'student';
  }

  function decodeEmailVerified(token) {
    try {
      var payload = String(token || '').split('.')[1] || '';
      var padded = payload.replace(/-/g, '+').replace(/_/g, '/');
      while (padded.length % 4) padded += '=';
      var raw = global.atob(padded);
      var hex = '';
      for (var i = 0; i < raw.length; i++) {
        hex += '%' + ('00' + raw.charCodeAt(i).toString(16)).slice(-2);
      }
      var claim = JSON.parse(decodeURIComponent(hex)).email_verified;
      return typeof claim === 'boolean' ? claim : null;
    } catch (e) {
      return null;
    }
  }

  function isVerifiedTeacher() {
    var token = ls('cmc-student-token');
    if (!token) return false;
    var claimed = decodeEmailVerified(token);
    var verified = claimed === null ? ls('cmc-student-verified') === '1' : claimed;
    if (!verified) return false;
    var uid = ls('cmc-student-uid') || '';
    if (ADMIN_UIDS.indexOf(uid) !== -1) return true;
    var role = ls('cmc-student-role') || detectRoleFromEmail(ls('cmc-student-email'));
    if (role !== 'teacher') return false;
    var flag = ls('cmc-teacher-verified');
    return flag === null || flag === '' || flag === '1';
  }

  function sessionStatusNote() {
    var token = ls('cmc-student-token');
    if (!token) return 'You are not currently signed in.';
    var email = ls('cmc-student-email') || 'your account';
    var acctType = ls('cmc-account-type') || '';
    var tFlag = ls('cmc-teacher-verified');
    if (acctType === 'teacher' && tFlag === '0') {
      return 'Signed in as ' + email + ' — teacher verification is still pending admin approval.';
    }
    return 'Signed in as ' + email + ' (student account). Sign in with a verified teacher account to open this book.';
  }

  global.CMC_WC1_GATE = {
    appRoot: function () { return APP_ROOT; },
    signInUrl: signInUrl,
    isTeacher: isVerifiedTeacher
  };

  if (isVerifiedTeacher()) {
    global.CMC_TEACHER_GATE_OK = true;
    return;
  }

  global.CMC_TEACHER_GATE_OK = false;

  /* ── 4. Lock document before first paint ── */
  try {
    var st = DOC.createElement('style');
    st.id = 'cmc-wc1-gate-style';
    st.textContent =
      'html.' + LOCK_CLASS + ' body>*:not(#' + OVERLAY_ID + '){display:none!important}' +
      'html.' + LOCK_CLASS + ',html.' + LOCK_CLASS + ' body{overflow:hidden!important;min-height:100vh!important;margin:0!important}';
    ROOT.appendChild(st);
    ROOT.classList.add(LOCK_CLASS);
  } catch (e) { /* ignore */ }

  function renderOverlay() {
    var existing = DOC.getElementById(OVERLAY_ID);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (!DOC.body) return;

    var light = applyStoredTheme() === 'light';
    var bg = light ? '#cbd5e1' : '#0b1220';
    var cardBg = light ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.78)';
    var border = light ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.14)';
    var ink = light ? '#11151c' : '#f3f6fb';
    var bodyInk = light ? '#37404d' : '#c7d0dd';
    var mute = light ? '#626d7e' : '#8f9bae';
    var chipBg = light ? 'rgba(43,63,214,0.10)' : 'rgba(90,114,255,0.18)';
    var chipInk = light ? '#2b3fd6' : '#cdd7ff';
    var glowA = light ? 'rgba(43,63,214,0.12)' : 'rgba(90,114,255,0.22)';
    var glowB = light ? 'rgba(14,165,233,0.10)' : 'rgba(56,189,248,0.14)';

    var wrap = DOC.createElement('div');
    wrap.id = OVERLAY_ID;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Teacher access required');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;' +
      'font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;' +
      'background:' + bg + ';' +
      'background-image:radial-gradient(ellipse 60% 45% at 15% 12%,' + glowA + ',transparent 58%),' +
      'radial-gradient(ellipse 55% 45% at 88% 88%,' + glowB + ',transparent 58%);';

    var card = DOC.createElement('div');
    card.style.cssText =
      'max-width:460px;width:100%;border-radius:24px;padding:32px 28px;text-align:center;' +
      'background:' + cardBg + ';border:1px solid ' + border + ';' +
      'backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);' +
      'box-shadow:0 36px 80px -36px rgba(0,0,0,0.55);color:' + ink + ';';

    var badge = DOC.createElement('div');
    badge.style.cssText =
      'display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;' +
      'font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;' +
      'background:' + chipBg + ';color:' + chipInk + ';margin-bottom:16px;';
    badge.textContent = 'GEP Program · Teacher Book';

    var h1 = DOC.createElement('h1');
    h1.style.cssText = 'font-size:24px;font-weight:800;letter-spacing:-0.02em;margin:0 0 10px;line-height:1.25;';
    h1.textContent = 'Teacher Access Required';

    var desc = DOC.createElement('p');
    desc.style.cssText = 'font-size:14px;line-height:1.65;color:' + bodyInk + ';margin:0 0 14px;';
    desc.textContent = 'World Class 1 (Units 1–12) is a verified teacher resource with integrated classroom answer keys and lesson guides.';

    var note = DOC.createElement('p');
    note.style.cssText =
      'font-size:12px;line-height:1.5;color:' + mute + ';margin:0 0 22px;padding:10px 12px;' +
      'border-radius:12px;border:1px solid ' + border + ';';
    note.textContent = sessionStatusNote();

    var actions = DOC.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;';

    var btnSign = DOC.createElement('a');
    btnSign.href = signInUrl();
    btnSign.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;padding:11px 22px;border-radius:999px;' +
      'font-size:13px;font-weight:700;text-decoration:none;' +
      'background:linear-gradient(135deg,#5a72ff,#3f55e8);color:#ffffff;' +
      'box-shadow:0 12px 28px -10px rgba(90,114,255,0.65);';
    btnSign.textContent = 'Sign in as Teacher';

    var btnBack = DOC.createElement('a');
    btnBack.href = APP_ROOT + '#gep-isec';
    btnBack.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;padding:11px 18px;border-radius:999px;' +
      'font-size:13px;font-weight:700;text-decoration:none;color:' + ink + ';' +
      'border:1px solid ' + border + ';background:transparent;';
    btnBack.textContent = '← Back to GEP & ISEC';

    actions.appendChild(btnSign);
    actions.appendChild(btnBack);
    card.appendChild(badge);
    card.appendChild(h1);
    card.appendChild(desc);
    card.appendChild(note);
    card.appendChild(actions);
    wrap.appendChild(card);
    DOC.body.appendChild(wrap);
  }

  function recheckGate() {
    if (isVerifiedTeacher()) {
      global.CMC_TEACHER_GATE_OK = true;
      ROOT.classList.remove(LOCK_CLASS);
      var ov = DOC.getElementById(OVERLAY_ID);
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      var stEl = DOC.getElementById('cmc-wc1-gate-style');
      if (stEl && stEl.parentNode) stEl.parentNode.removeChild(stEl);
    } else if (DOC.body) {
      renderOverlay();
    }
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', renderOverlay);
  } else {
    renderOverlay();
  }
  global.addEventListener('storage', recheckGate);
  global.addEventListener('focus', recheckGate);
  DOC.addEventListener('visibilitychange', function () {
    if (!DOC.hidden) recheckGate();
  });
})(window);
