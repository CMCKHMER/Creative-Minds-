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
  var HOME_URL = APP_ROOT;

  /* ── 1. Session check — mirrors restoreSession() in firebaseAuth.ts ── */
  function ls(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function detectRoleFromEmail(email) {
    var domain = (String(email || '').split('@')[1] || '').toLowerCase();
    return domain && domain.indexOf('edu') !== -1 ? 'teacher' : 'student';
  }
  function isTeacher() {
    if (!ls('cmc-student-token')) return false; // no Firebase session at all
    var role = ls('cmc-student-role') || detectRoleFromEmail(ls('cmc-student-email'));
    return role === 'teacher';
  }
  // Exposed so the page's own scripts can branch on the gate result.
  window.CMC_TEACHER_GATE_OK = isTeacher();
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
    var bg = light ? '#f8fafc' : '#020617';
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
      'font-weight:800;letter-spacing:-0.02em;color:' + text + '">Teacher access required</h1>' +
      '<p style="margin:14px auto 0;max-width:360px;font-size:13px;line-height:1.65;color:' + muted + '">' +
      'This TOEFL ITP Bi-Weekly Planner content is reserved for Creative Minds teacher accounts. ' +
      'Sign in with a work email containing <b>&ldquo;edu&rdquo;</b> (e.g., you@school.edu.kh) to unlock the full 8-week study plan and its tests.</p>' +
      '<a id="cmc-teacher-gate-signin" href="' + SIGNIN_URL + '" ' +
      'style="margin-top:24px;display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:12px;' +
      'background:linear-gradient(100deg,#c4b5fd,#67e8f9);color:#0f172a;font-size:13px;font-weight:700;' +
      'text-decoration:none;box-shadow:0 12px 36px -14px rgba(139,92,246,.75);transition:transform .2s,box-shadow .2s"' +
      ' onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">' +
      '<i class="fas fa-graduation-cap" aria-hidden="true"></i> Sign in as teacher</a>' +
      '<p style="margin:18px 0 0;font-size:10.5px;line-height:1.6;color:' + muted + ';opacity:.85">' +
      'Students: this section is locked to teacher accounts — your homepage drills and games stay open as usual.</p>' +
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
