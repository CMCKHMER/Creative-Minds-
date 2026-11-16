/*
 * CMC GOOGLE — Drive + Classroom, in one dependency-free browser module.
 * =====================================================================
 *
 * Two very different jobs live here:
 *
 *   Level 0 — SHARE TO CLASSROOM  (no Google project at all)
 *     shareToClassroom(url, title) opens Google's own Classroom share
 *     dialog: the teacher picks a class and posts the page as an
 *     announcement / assignment / material. No client id, no scopes.
 *
 *   Level 1/2 — DRIVE + CLASSROOM API  (needs a Google Cloud project)
 *     connect()          teacher's Google account, via Google Identity
 *                        Services (GIS) — browser token, no backend
 *     drive.*            save a CSV / text / JSON file into the teacher's
 *                        Drive with the NON-SENSITIVE `drive.file` scope
 *     classroom.*        list classes, create an assignment or an
 *                        announcement, read submissions, push a grade
 *
 * ── CONFIGURE (one line, anywhere before this script) ────────────────
 *   <script>
 *     window.CMC_GOOGLE_APP = {
 *       clientId: '1234567890-abc123.apps.googleusercontent.com'
 *     };
 *   </script>
 *   <script src="/Creative-Minds-/assets/js/cmc-google.js"></script>
 *
 * …or on the tag itself:  <script src="…/cmc-google.js" data-client-id="…"></script>
 *
 * With no client id the module is INERT: it loads nothing from Google,
 * makes no network call, and every API call rejects with
 * `code: 'not-configured'`. shareToClassroom() still works — it needs
 * no credentials at all.
 *
 * ── USE ──────────────────────────────────────────────────────────────
 *   // level 0, always available
 *   CMC_GOOGLE.shareToClassroom(location.href, 'Mafia Noir');
 *
 *   // level 2: export the class sheet the teacher is looking at
 *   await CMC_GOOGLE.drive.saveCsvAsSheet({ name: 'CMC Week 8 — 7A', csv });
 *   const file = await CMC_GOOGLE.drive.saveFile({
 *     name: 'cmc-scores.csv', mimeType: 'text/csv', content: csv
 *   });
 *
 *   // level 1: post the assignment, then push the grade back
 *   const classes = await CMC_GOOGLE.classroom.listCourses();
 *   const work = await CMC_GOOGLE.classroom.postAssignment({
 *     courseId: classes[0].id,
 *     title: 'Brain Lounge · Word Creator',
 *     description: 'Play one match, then screenshot your score.',
 *     url: location.href,
 *     dueDate: '2026-11-20',      // YYYY-MM-DD, UTC
 *     maxPoints: 10
 *   });
 *   await CMC_GOOGLE.classroom.setGrade({
 *     courseId: classes[0].id, courseWorkId: work.id,
 *     submissionId: 'Cg4x…', grade: 8
 *   });
 *
 * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────
 *   • It never touches the user's whole Drive. `drive.file` only sees
 *     files CMC created (or the teacher hands over through a picker).
 *     Asking for `drive` or `drive.readonly` is a RESTRICTED scope:
 *     Google review + an annual CASA security assessment. Don't.
 *   • It stores nothing. The token lives in memory and dies with the tab.
 *     For overnight grade sync, move these calls into functions/ and keep
 *     a refresh token server-side (docs/google-classroom-drive.md).
 *   • Students never authorise Google here. Only a teacher can create
 *     coursework or set grades — Classroom enforces that server-side.
 */
(function (global) {
  'use strict';

  /* ── configuration ─────────────────────────────────────────────────── */
  var SELF = document.currentScript;
  var CFG = global.CMC_GOOGLE_APP || {};
  var CLIENT_ID = CFG.clientId
    || (SELF && SELF.getAttribute('data-client-id'))
    || '';

  var SCOPES = {
    drive: 'https://www.googleapis.com/auth/drive.file',
    courses: 'https://www.googleapis.com/auth/classroom.courses.readonly',
    coursework: 'https://www.googleapis.com/auth/classroom.coursework.students',
    courseworkRead: 'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    announcements: 'https://www.googleapis.com/auth/classroom.announcements',
  };
  // Narrow by default: create files, see the classes we teach, create and
  // grade coursework there. No rosters, no profile emails, no full Drive.
  var DEFAULT_SCOPES = CFG.scopes || [
    SCOPES.drive, SCOPES.courses, SCOPES.coursework, SCOPES.announcements,
  ];

  var GIS_SRC = 'https://accounts.google.com/gsi/client';
  var DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  var CLASSROOM = 'https://classroom.googleapis.com/v1';

  /* ── errors ────────────────────────────────────────────────────────── */
  function CMCGError(code, message, extra) {
    var err = new Error(message);
    err.name = 'CMCGError';
    err.code = code;
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) err[k] = extra[k];
    return err;
  }

  /* ── GIS (Google Identity Services) ────────────────────────────────── */
  var gisPromise = null;
  function loadGis() {
    if (global.google && global.google.accounts && global.google.accounts.oauth2) {
      return Promise.resolve(global.google.accounts.oauth2);
    }
    if (gisPromise) return gisPromise;
    gisPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.onload = function () {
        if (global.google && global.google.accounts && global.google.accounts.oauth2) {
          resolve(global.google.accounts.oauth2);
        } else reject(CMCGError('gis', 'Google Identity Services loaded but did not initialise.'));
      };
      s.onerror = function () {
        gisPromise = null;
        reject(CMCGError('network', 'Could not reach accounts.google.com — check the connection and try again.'));
      };
      (document.head || document.documentElement).appendChild(s);
    });
    return gisPromise;
  }

  var token = null;      // { value, expiresAt, scopes }
  var tokenClient = null;
  var tokenScopes = '';

  function fresh() {
    return !!(token && token.expiresAt - 60000 > Date.now());
  }

  /**
   * Ask the teacher for Google access. Resolves with an access token.
   * Call it from a click handler — Google requires a user gesture.
   */
  function connect(opts) {
    opts = opts || {};
    if (!CLIENT_ID) {
      return Promise.reject(CMCGError('not-configured',
        'Google is not configured yet — add the OAuth client id to window.CMC_GOOGLE_APP.clientId.'));
    }
    if (fresh() && !opts.force) return Promise.resolve(token);
    var wanted = (opts.scopes || DEFAULT_SCOPES).join(' ');
    return loadGis().then(function (oauth2) {
      return new Promise(function (resolve, reject) {
        if (!tokenClient || tokenScopes !== wanted) {
          tokenScopes = wanted;
          tokenClient = oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: wanted,
            callback: function (resp) {
              if (resp && resp.error) {
                reject(CMCGError(resp.error === 'access_denied' ? 'consent' : 'oauth',
                  resp.error === 'access_denied'
                    ? 'Google access was not granted — nothing was shared.'
                    : 'Google sign-in failed (' + resp.error + ').'));
                return;
              }
              token = {
                value: resp.access_token,
                expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
                scopes: wanted,
              };
              resolve(token);
            },
            error_callback: function (err) {
              reject(CMCGError('consent',
                (err && err.message) || 'Google sign-in was closed before it finished.'));
            },
          });
        }
        tokenClient.requestAccessToken({ prompt: opts.prompt || '' });
      });
    });
  }

  /** Forget the token (does not revoke it at Google). */
  function disconnect() {
    token = null;
    tokenClient = null;
    tokenScopes = '';
    return Promise.resolve();
  }

  /** Revoke the grant at Google as well. */
  function revoke() {
    var value = token && token.value;
    token = null;
    tokenClient = null;
    tokenScopes = '';
    if (!value) return Promise.resolve();
    return loadGis().then(function (oauth2) {
      oauth2.revoke(value, function () { /* best effort */ });
    }).catch(function () { /* best effort */ });
  }

  /* ── HTTP ──────────────────────────────────────────────────────────── */
  function api(url, options) {
    options = options || {};
    return connect().then(function (tok) {
      var headers = options.headers || {};
      headers.Authorization = 'Bearer ' + tok.value;
      return fetch(url, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body,
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!res.ok) {
            var detail = (data && data.error && (data.error.message || data.error.status)) || '';
            var hint = '';
            if (res.status === 401) hint = ' — sign in to Google again.';
            else if (res.status === 403) hint = ' — this account is not allowed to do that here (is it a teacher of this class?), or the Classroom API / scope is not enabled on the Google Cloud project.';
            else if (res.status === 404) hint = ' — the class, assignment or submission was not found.';
            throw CMCGError('http', 'Google answered ' + res.status + (detail ? ': ' + detail : '') + hint, {
              status: res.status, body: data,
            });
          }
          return data;
        });
      }).catch(function (err) {
        if (err && err.name === 'CMCGError') throw err;
        throw CMCGError('network', 'Could not reach Google — check the connection and try again.');
      });
    });
  }

  /* ── Level 0: the share dialog (no credentials) ────────────────────── */
  function shareToClassroom(url, title) {
    var target = url || global.location.href;
    var href = 'https://classroom.google.com/share?url=' + encodeURIComponent(target)
      + (title ? '&title=' + encodeURIComponent(title) : '');
    var win = global.open(href, '_blank', 'noopener,width=880,height=720');
    if (!win) global.location.href = href;
    return href;
  }

  /* ── Level 2: Drive ────────────────────────────────────────────────── */
  /** Upload one file. `convertTo: 'sheet'` turns a CSV into a Google Sheet. */
  function saveFile(opts) {
    opts = opts || {};
    if (!opts.name) return Promise.reject(CMCGError('bad-request', 'A file name is required.'));
    var metadata = { name: opts.name };
    if (opts.convertTo === 'sheet') {
      metadata.mimeType = 'application/vnd.google-apps.spreadsheet';
      metadata.name = opts.name.replace(/\.csv$/i, '');
    } else if (opts.mimeType) {
      metadata.mimeType = opts.mimeType;
    }
    if (opts.parents) metadata.parents = opts.parents;

    var boundary = 'cmc' + Math.random().toString(36).slice(2) + String(Date.now());
    var mediaType = opts.mimeType || 'text/plain; charset=UTF-8';
    var body = '--' + boundary + '\r\n'
      + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
      + JSON.stringify(metadata) + '\r\n'
      + '--' + boundary + '\r\n'
      + 'Content-Type: ' + mediaType + '\r\n\r\n'
      + String(opts.content == null ? '' : opts.content) + '\r\n'
      + '--' + boundary + '--';

    return api(DRIVE_UPLOAD + '?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: body,
    });
  }

  function saveCsvAsSheet(opts) {
    opts = opts || {};
    return saveFile({
      name: (opts.name || 'CMC results') + '.csv',
      mimeType: 'text/csv',
      content: opts.csv,
      convertTo: 'sheet',
      parents: opts.parents,
    });
  }

  /* ── Level 1: Classroom ────────────────────────────────────────────── */
  function listCourses() {
    return api(CLASSROOM + '/courses?teacherId=me&courseStates=ACTIVE&pageSize=100')
      .then(function (data) { return (data && data.courses) || []; });
  }

  function dueDateParts(dateLike) {
    if (!dateLike) return null;
    var d = dateLike instanceof Date ? dateLike : new Date(dateLike + 'T00:00:00Z');
    if (isNaN(d.getTime())) return null;
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  function materials(opts) {
    var list = [];
    if (opts.url) list.push({ link: { url: opts.url, title: opts.title || undefined } });
    if (opts.driveFileId) list.push({ driveFile: { driveFile: { id: opts.driveFileId } } });
    (opts.materials || []).forEach(function (m) { list.push(m); });
    return list;
  }

  function postAssignment(opts) {
    opts = opts || {};
    if (!opts.courseId) return Promise.reject(CMCGError('bad-request', 'A courseId is required.'));
    if (!opts.title) return Promise.reject(CMCGError('bad-request', 'An assignment title is required.'));
    var body = {
      title: opts.title,
      description: opts.description || '',
      workType: 'ASSIGNMENT',
      state: opts.draft ? 'DRAFT' : 'PUBLISHED',
      materials: materials(opts),
    };
    if (opts.maxPoints != null) body.maxPoints = Number(opts.maxPoints);
    var due = dueDateParts(opts.dueDate);
    if (due) body.dueDate = due;
    if (opts.topicId) body.topicId = opts.topicId;
    return api(CLASSROOM + '/courses/' + encodeURIComponent(opts.courseId) + '/courseWork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function postAnnouncement(opts) {
    opts = opts || {};
    if (!opts.courseId) return Promise.reject(CMCGError('bad-request', 'A courseId is required.'));
    return api(CLASSROOM + '/courses/' + encodeURIComponent(opts.courseId) + '/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: opts.text || opts.title || '',
        materials: materials(opts),
        state: opts.draft ? 'DRAFT' : 'PUBLISHED',
      }),
    });
  }

  function postMaterial(opts) {
    opts = opts || {};
    if (!opts.courseId) return Promise.reject(CMCGError('bad-request', 'A courseId is required.'));
    if (!opts.title) return Promise.reject(CMCGError('bad-request', 'A title is required.'));
    return api(CLASSROOM + '/courses/' + encodeURIComponent(opts.courseId) + '/courseWorkMaterials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: opts.title,
        description: opts.description || '',
        materials: materials(opts),
        state: opts.draft ? 'DRAFT' : 'PUBLISHED',
      }),
    });
  }

  function listSubmissions(opts) {
    opts = opts || {};
    return api(CLASSROOM + '/courses/' + encodeURIComponent(opts.courseId)
      + '/courseWork/' + encodeURIComponent(opts.courseWorkId)
      + '/studentSubmissions?pageSize=100')
      .then(function (data) { return (data && data.studentSubmissions) || []; });
  }

  /** Push a grade back to Classroom (the "grade passback" teachers ask for). */
  function setGrade(opts) {
    opts = opts || {};
    ['courseId', 'courseWorkId', 'submissionId'].forEach(function (k) {
      if (!opts[k]) throw CMCGError('bad-request', k + ' is required.');
    });
    if (opts.grade == null) throw CMCGError('bad-request', 'A grade is required.');
    var grade = Number(opts.grade);
    var url = CLASSROOM + '/courses/' + encodeURIComponent(opts.courseId)
      + '/courseWork/' + encodeURIComponent(opts.courseWorkId)
      + '/studentSubmissions/' + encodeURIComponent(opts.submissionId)
      + '?updateMask=assignedGrade,draftGrade';
    return api(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedGrade: grade, draftGrade: grade }),
    });
  }

  /* ── exports ───────────────────────────────────────────────────────── */
  var apiObject = {
    version: '1',
    clientId: CLIENT_ID,
    configured: !!CLIENT_ID,
    scopes: SCOPES,
    connect: connect,
    disconnect: disconnect,
    revoke: revoke,
    isConnected: fresh,
    shareToClassroom: shareToClassroom,
    drive: {
      saveFile: saveFile,
      saveCsvAsSheet: saveCsvAsSheet,
    },
    classroom: {
      listCourses: listCourses,
      postAssignment: postAssignment,
      postAnnouncement: postAnnouncement,
      postMaterial: postMaterial,
      listSubmissions: listSubmissions,
      setGrade: setGrade,
    },
  };

  global.CMC_GOOGLE = apiObject;
  global.CMCG = apiObject;   // short alias for console + inline handlers
  global.CMCGError = CMCGError;
})(window);
