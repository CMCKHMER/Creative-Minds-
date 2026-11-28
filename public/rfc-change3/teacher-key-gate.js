/* Verified teacher-only answer-key reveal, matching the Kid 6/7 worksheet gate. */
(() => {
  'use strict';

  const API_KEY = 'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
  const FIRESTORE_TEACHER_CHECK = 'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents/assessment_classes?pageSize=1';
  window.CMC_IS_TEACHER = false;

  async function refreshIdToken() {
    try {
      const refreshToken = localStorage.getItem('cmc-student-refresh-token');
      if (!refreshToken) return '';
      const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      });
      if (!response.ok) return '';
      const data = await response.json();
      if (!data.id_token) return '';
      try {
        localStorage.setItem('cmc-student-token', data.id_token);
        localStorage.setItem('cmc-student-token-expires', String(Date.now() + ((Number(data.expires_in) || 3600) * 1000) - 60000));
        if (data.refresh_token) localStorage.setItem('cmc-student-refresh-token', data.refresh_token);
      } catch { /* A blocked localStorage leaves the key fail-closed. */ }
      return data.id_token;
    } catch {
      return '';
    }
  }

  async function rulesConfirmTeacher(token) {
    try {
      const response = await fetch(FIRESTORE_TEACHER_CHECK, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  window.cmcVerifyTeacher = async function cmcVerifyTeacher() {
    try {
      const currentToken = localStorage.getItem('cmc-student-token') || '';
      if (currentToken && await rulesConfirmTeacher(currentToken)) {
        window.CMC_IS_TEACHER = true;
        return true;
      }
      const refreshedToken = await refreshIdToken();
      const verified = refreshedToken ? await rulesConfirmTeacher(refreshedToken) : false;
      window.CMC_IS_TEACHER = verified;
      return verified;
    } catch {
      window.CMC_IS_TEACHER = false;
      return false;
    }
  };

  window.cmcTeacherOnlyPrompt = function cmcTeacherOnlyPrompt() {
    if (document.getElementById('teacher-key-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'teacher-key-overlay';
    overlay.className = 'teacher-key-overlay';
    overlay.setAttribute('role', 'presentation');
    const dialog = document.createElement('section');
    dialog.className = 'teacher-key-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'teacher-key-title');
    const icon = document.createElement('span');
    icon.className = 'teacher-key-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔒';
    const title = document.createElement('h2');
    title.id = 'teacher-key-title';
    title.textContent = 'Answer key reserved for teachers';
    const copy = document.createElement('p');
    copy.textContent = 'Sign in with a verified teacher account to reveal the key. Students can complete and check the worksheet without the answer key.';
    const actions = document.createElement('div');
    actions.className = 'teacher-key-actions';
    const signIn = document.createElement('a');
    signIn.href = '../#toefl-mini-test';
    signIn.textContent = 'Open CMC sign-in';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    dialog.append(icon, title, copy);
    actions.append(signIn, close);
    dialog.append(actions);
    overlay.append(dialog);
    document.body.append(overlay);
    close.focus();
  };

  window.addEventListener('cmc-auth-changed', () => {
    void window.cmcVerifyTeacher();
  });
})();
