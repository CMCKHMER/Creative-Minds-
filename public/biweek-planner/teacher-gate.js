/*
 * CMC Teacher Gate — TOEFL ITP Bi-Weekly Planner (teacher-account-only).
 *
 * Loaded synchronously from <head> of the planner hub (index.html) and
 * every test page under tests/ (as ../teacher-gate.js).
 * When the visitor does not have a Firebase teacher session (same
 * localStorage session the main React app creates — cmc-student-* keys,
 * role from cmc-student-role or an "edu" email domain, mirroring
 * restoreSession() in src/lib/firebaseAuth.ts and RoleGate.tsx), the page
 * body is hidden before first paint and a locked "Teacher access required"
 * overlay is shown instead, with a button that deep-links into the main
 * app's teacher sign-in modal via /?auth=teacher.
 *
 * Scope: the planner hub AND every test/drill page under tests/*.html —
 * the whole bi-weekly TOEFL planner section is teacher-account-only
 * (owner request, Oct 2026). Students keep access to the homepage drills
 * and games (syntax-clash, writequest, mini-mock, daily assessment, ...).
 * To un-gate an individual test, just remove its <script src="../teacher-gate.js">.
 *
 * Soft-gating note (same trade-off as RoleGate.tsx): this is client-side
 * gating for a static GitHub Pages deploy. A determined student could
 * bypass it via devtools; real protection would require moving the plan
 * behind authenticated Firestore reads.
 */
(function () {
  'use strict';

  /* ── 0. Resolve the main-app root relative to this script's location.
         Works from any page depth: the planner hub loads ./teacher-gate.js
         and test pages could load ../teacher-gate.js — both resolve the
         script URL to .../Creative-Minds-/ (the React app root). ───────── */
  var APP_ROOT = '../';
  try {
    var gateScript = document.currentScript;
    if (!gateScript) {
      var allScripts = document.getElementsByTagName('script');
      for (var i = allScripts.length - 1; i >= 0; i--) {
        if (allScripts[i].src && allScripts[i].src.indexOf('teacher-gate.js') !== -1) {
          gateScript = allScripts[i];
          break;
        }
      }
    }
    if (gateScript && gateScript.src) {
      APP_ROOT = gateScript.src.replace(/teacher-gate\.js.*$/, '').replace(/biweek-planner\/$/, '');
    }
  } catch (e) { /* keep the relative fallback */ }
  var SIGNIN_URL = APP_ROOT + '?auth=teacher#toefl-itp-planner';
  // Sign-up lands back on the teacher gate (which then asks them to sign in
  // with the freshly verified account).
  var SIGNUP_URL = APP_ROOT + '?auth=teacher';
  var HOME_URL = APP_ROOT;

  /* ── 1. Session check — mirrors restoreSession() in firebaseAuth.ts ── */
  function ls(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  /* School-domain gate — mirrors DEFAULT_TEACHER_EMAIL_DOMAINS in
     src/lib/userProfile.ts and schoolDomainPattern() in firestore.rules: only
     the school's own domain is a teacher by email. A foreign .edu address
     stays a student until the site admin approves the account. */
  var SCHOOL_DOMAINS = ['aii.edu.kh'];
  function detectRoleFromEmail(email) {
    var domain = (String(email || '').split('@')[1] || '').toLowerCase();
    return SCHOOL_DOMAINS.indexOf(domain) !== -1 ? 'teacher' : 'student';
  }
  /** Decode the `email_verified` claim of an ID token (no network call). */
  function tokenVerified(token) {
    try {
      var payload = String(token || '').split('.')[1] || '';
      var padded = payload.replace(/-/g, '+').replace(/_/g, '/');
      while (padded.length % 4) padded += '=';
      var json = decodeURIComponent(atob(padded).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      var claim = JSON.parse(json).email_verified;
      return typeof claim === 'boolean' ? claim : null;
    } catch (e) { return null; }
  }
  /**
   * VERIFIED teacher only (Nov 2026): the role written by the app's
   * resolveEffectiveAccess() plus the explicit `cmc-teacher-verified` flag.
   * Students, general users, PENDING teachers (Gmail awaiting admin
   * approval / unverified school domain) and revoked teachers are all locked out —
   * the same rule Firestore enforces for the answer keys.
   */
  function isTeacher() {
    var token = ls('cmc-student-token');
    if (!token) return false; // no Firebase session at all
    var claimed = tokenVerified(token);
    var verified = claimed === null ? ls('cmc-student-verified') === '1' : claimed;
    if (!verified) return false;
    var uid = ls('cmc-student-uid') || '';
    if (uid === '5iLvnjzmV8QY7WFZhyTq6PIgcI63') return true; // site owner
    var role = ls('cmc-student-role') || detectRoleFromEmail(ls('cmc-student-email'));
    if (role !== 'teacher') return false;
    // `cmc-teacher-verified` is '0' for a pending/revoked teacher on the new
    // session shape; older sessions have no key and fall back to the role.
    var flag = ls('cmc-teacher-verified');
    return flag === null || flag === '' || flag === '1';
  }
  // Student share links (?invite=CODE) are honoured for SIGNED-IN accounts
  // only — student-invite.js shows a sign-up card to guests.
  // Exposed so the page's own scripts can branch on the gate result.
  // Invite links (student-invite.js, loaded before this script) set
  // window.CMC_INVITE_OK when the URL carries a valid ?invite=<teacher-code>
  // — students arriving through a teacher's share link are let through and
  // student-invite.js runs its own name/ID entry gate instead.
  window.CMC_TEACHER_GATE_OK = isTeacher() || window.CMC_INVITE_OK === true;
  if (window.CMC_TEACHER_GATE_OK) return; // teacher — page runs normally

  /* ── 2. Lock the page before first paint ───────────────────────────── */
  var LOCK_CLASS = 'cmc-teacher-gate-locked';
  var OVERLAY_ID = 'cmc-teacher-gate-overlay';
  try {
    var st = document.createElement('style');
    st.id = 'cmc-teacher-gate-style';
    st.textContent =
      'html.' + LOCK_CLASS + ' body>*:not(#' + OVERLAY_ID + '){display:none!important}' +
      'html.' + LOCK_CLASS + ',html.' + LOCK_CLASS + ' body{overflow:hidden!important;min-height:100vh!important}';
    document.documentElement.appendChild(st);
    document.documentElement.classList.add(LOCK_CLASS);
  } catch (e) { /* very old browser — fall through, overlay may still work */ }

  /* ── 3. Locked overlay — matches the planner's glass theme ─────────── */
  function buildOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var bg = light ? '#cbd5e1' : '#020617';
    var cardBg = light ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.04)';
    var border = light ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.10)';
    var text = light ? '#1e293b' : '#f1f5f9';
    var muted = light ? '#64748b' : '#94a3b8';
    var glow1 = light ? 'rgba(14,165,233,.10)' : 'rgba(56,189,248,.10)';
    var glow2 = light ? 'rgba(168,85,247,.08)' : 'rgba(139,92,246,.10)';

    var wrap = document.createElement('div');
    wrap.id = OVERLAY_ID;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Teacher access required');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;' +
      'background:' + bg + ';' +
      'background-image:radial-gradient(ellipse 60% 40% at 15% 10%,' + glow1 + ',transparent 55%),' +
      'radial-gradient(ellipse 55% 45% at 85% 90%,' + glow2 + ',transparent 55%);' +
      "font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;color:" + text + ';';
    wrap.innerHTML =
      '<div style="max-width:440px;width:100%;text-align:center;padding:36px 28px;border-radius:18px;' +
      'background:' + cardBg + ';border:1px solid ' + border + ';' +
      'backdrop-filter:blur(12px);box-shadow:0 30px 80px -42px rgba(0,0,0,.6)">' +
      '<div style="width:56px;height:56px;margin:0 auto;border-radius:16px;display:flex;align-items:center;justify-content:center;' +
      'background:linear-gradient(135deg,rgba(139,92,246,.18),rgba(56,189,248,.12));' +
      'border:1px solid rgba(139,92,246,.35);color:#a78bfa;font-size:24px">' +
      '<i class="fas fa-user-graduate" aria-hidden="true"></i></div>' +
      '<h1 style="margin:20px 0 0;font-family:Syne,Plus Jakarta Sans,sans-serif;font-size:24px;line-height:1.2;' +
      'font-weight:800;letter-spacing:-0.02em;color:' + text + '">Verified teacher access</h1>' +
      '<p style="margin:14px auto 0;max-width:360px;font-size:13px;line-height:1.65;color:' + muted + '">' +
      'This TOEFL ITP Bi-Weekly Planner content is reserved for verified teacher accounts. ' +
      'A school address containing <b>&ldquo;edu&rdquo;</b> (e.g., you@school.edu.kh) verifies automatically once the email is confirmed; ' +
      'other addresses unlock after the site admin approves the account.</p>' +
      '<a id="cmc-teacher-gate-signin" href="' + SIGNIN_URL + '" ' +
      'style="margin-top:24px;display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:12px;' +
      'background:linear-gradient(100deg,#c4b5fd,#67e8f9);color:#0f172a;font-size:13px;font-weight:700;' +
      'text-decoration:none;box-shadow:0 12px 36px -14px rgba(139,92,246,.75);transition:transform .2s,box-shadow .2s"' +
      ' onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">' +
      '<i class="fas fa-graduation-cap" aria-hidden="true"></i> Sign in as teacher</a>' +
      '<p style="margin:12px 0 0;font-size:11.5px;line-height:1.6;color:' + muted + '">' +
      'New here? <a href="' + SIGNUP_URL + '" style="color:#67e8f9;font-weight:700;text-decoration:none">Create a free account</a>.</p>' +
      '<p style="margin:14px 0 0;font-size:10.5px;line-height:1.6;color:' + muted + ';opacity:.85">' +
      'Students and general users: this planner stays locked, but every game, worksheet, test and student-copy download is yours.</p>' +
      '<a href="' + HOME_URL + '" style="margin-top:16px;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;' +
      'color:#67e8f9;text-decoration:none"><i class="fas fa-arrow-left" aria-hidden="true"></i> Back to CMC homepage</a>' +
      '</div>';
    document.body.appendChild(wrap);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildOverlay);
  } else {
    buildOverlay();
  }

  /* ── 4. Auto-sync: if the session changes in another tab (teacher signs
         in on the main site, or signs out), reload so this page matches.
         The `storage` event fires cross-tab on same-origin localStorage
         writes; focus/visibility/pageshow cover same-tab restores. ─────── */
  function recheck() {
    var now = isTeacher();
    if (now !== window.CMC_TEACHER_GATE_OK) { window.location.reload(); }
  }
  window.addEventListener('focus', recheck);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) recheck();
  });
  window.addEventListener('pageshow', recheck); // bfcache restores
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('cmc-student-') === 0) recheck();
  });
})();
