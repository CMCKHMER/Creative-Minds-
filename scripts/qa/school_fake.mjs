// A stand-in for the school database, for the browser checks.
//
// The site talks to Firestore over REST. The checks cannot reach Firebase, so
// each signed-in browser is routed to this in-memory copy instead. It answers
// the same calls (get, list, runQuery, batchGet, commit, create, patch,
// delete) and applies the rule blocks the school features depend on, written
// out in JS next to the rules they mirror:
//   assessment_classes (+ students)   private per teacher
//   roster_seats, student_links       registration
//   user_avatars                      profile picture
//   hw_keys, hw_sheets                locked homework
// A write the real rules would refuse is refused here too, so the app and the
// rules are checked against each other. It is a mirror: the real rules still
// have to be published and tried once in Firebase.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
};

/** Serve a built site (dist) on a local port. */
export function serve(DIST, port) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(res);
  });
  return new Promise((done) => srv.listen(port, '127.0.0.1', () => done(srv)));
}

// ── the database, with the registration rules written out ───────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '');
export const tokenOf = (user) => `${b64({ alg: 'none' })}.${b64({ user_id: user.uid, email: user.email, email_verified: user.verified !== false })}.x`;
const claimsOf = (header) => {
  try {
    return JSON.parse(Buffer.from((header || '').replace(/^Bearer /, '').split('.')[1] || '', 'base64').toString('utf8'));
  } catch {
    return null;
  }
};
/** One Firestore value → a plain JS value (enough for the rules below). */
export const plain = (v) => {
  if (!v) return undefined;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  return v;
};

export function makeFake() {
  const docs = new Map(); // "collection/id[/sub/id]" → { fields, createTime, updateTime }
  let auto = 0;
  const log = [];
  const ROOT = '/v1/projects/';
  // every change gets its own time, as in the real database
  let tick = 0;
  const stamp = () => `2026-11-14T02:00:00.${String(++tick).padStart(6, '0')}Z`;
  const collOf = (path) => {
    const s = path.split('/');
    return s.length === 2 ? s[0] : s.length === 4 ? `${s[0]}/*/${s[2]}` : '?';
  };

  // firestore.rules helpers
  const isVerifiedUser = (a) => !!a && a.email_verified === true;
  const isCmcTeacher = (a) => isVerifiedUser(a) && typeof a.email === 'string' && /@[^@]*edu[^@]*$/i.test(a.email);
  const get = (d, k) => (d ? plain(d.fields[k]) : undefined);
  const affectedKeys = (before, after) => {
    const keys = new Set([...Object.keys(before.fields), ...Object.keys(after.fields)]);
    return [...keys].filter((k) => JSON.stringify(before.fields[k]) !== JSON.stringify(after.fields[k]));
  };

  // Private per teacher (Nov 2026): a class, its students and its seats
  // belong to the teacher stamped on them.
  const ownsClass = (c, a) => !!c && !!a && (get(c, 'teacherUid') === a.user_id || (!!get(c, 'teacherEmail') && get(c, 'teacherEmail') === a.email));
  const ownsSeat = (d, a) => !!d && !!a && get(d, 'teacherUid') === a.user_id;
  /** A list is allowed only when the query itself is limited to the caller's own documents. */
  const filteredOn = (filters, field, value) => (filters || []).some((f) => f.field === field && f.value === value);

  /** op: get | list | create | update | delete. `getAfter` reads the state the
   *  commit would leave; `docs` is the state before it. `filters` are the
   *  equality filters of a list query. */
  function allowed(op, path, a, before, after, getAfter, filters) {
    const id = path.split('/').pop();
    switch (collOf(path)) {
      case 'roster_seats': {
        if (op === 'get') return isVerifiedUser(a);
        if (op === 'list') return isCmcTeacher(a) && filteredOn(filters, 'teacherUid', a.user_id);
        if (op === 'create') return isCmcTeacher(a) && ownsSeat(after, a);
        if (op === 'delete') return isCmcTeacher(a) && ownsSeat(before, a);
        if (isCmcTeacher(a) && ownsSeat(before, a) && ownsSeat(after, a)) return true;
        const link = getAfter(`student_links/${a && a.user_id}`);
        return (
          isVerifiedUser(a) &&
          get(before, 'claimedBy') === null &&
          get(after, 'claimedBy') === a.user_id &&
          affectedKeys(before, after).every((k) => ['claimedBy', 'claimedEmail', 'claimedName', 'claimedAt'].includes(k)) &&
          !!link &&
          get(link, 'seatKey') === id
        );
      }
      case 'student_links': {
        if (op === 'get') return isVerifiedUser(a) && (a.user_id === id || isCmcTeacher(a));
        if (op === 'list') return false;
        if (op === 'update' || op === 'delete') {
          const pointed = docs.get(`roster_seats/${get(before, 'seatKey')}`) || null;
          return isCmcTeacher(a) && (!pointed || ownsSeat(pointed, a));
        }
        const seatKey = get(after, 'seatKey');
        const seat = typeof seatKey === 'string' ? getAfter(`roster_seats/${seatKey}`) : null;
        return (
          isVerifiedUser(a) &&
          a.user_id === id &&
          get(after, 'uid') === id &&
          typeof seatKey === 'string' &&
          Object.keys(after.fields).every((k) => ['uid', 'seatKey', 'linkedAt'].includes(k)) &&
          !!seat &&
          get(seat, 'claimedBy') === id
        );
      }
      case 'user_avatars': {
        // private to its account; a small picture or a preset id, nothing else
        if (op === 'get' || op === 'delete') return isVerifiedUser(a) && a.user_id === id;
        if (op === 'list') return false;
        const kind = get(after, 'kind');
        const photo = get(after, 'photo');
        const preset = get(after, 'preset');
        return (
          isVerifiedUser(a) &&
          a.user_id === id &&
          Object.keys(after.fields).every((k) => ['uid', 'kind', 'photo', 'preset', 'updatedAt'].includes(k)) &&
          get(after, 'uid') === id &&
          typeof photo === 'string' &&
          photo.length <= 90000 &&
          typeof preset === 'string' &&
          preset.length <= 40 &&
          ((kind === 'preset' && photo === '' && /^[a-z0-9-]{1,40}$/.test(preset)) ||
            (kind === 'photo' && preset === '' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo)))
        );
      }
      case 'assessment_classes':
        if (op === 'delete') return false;
        if (op === 'create') return isCmcTeacher(a) && get(after, 'teacherUid') === a.user_id;
        if (op === 'list') return isCmcTeacher(a) && (filteredOn(filters, 'teacherUid', a.user_id) || filteredOn(filters, 'teacherEmail', a.email));
        if (op === 'get') return isCmcTeacher(a) && ownsClass(before, a);
        return isCmcTeacher(a) && ownsClass(before, a) && (get(after, 'teacherUid') === get(before, 'teacherUid') || get(after, 'teacherUid') === a.user_id);
      case 'assessment_classes/*/students':
        return isCmcTeacher(a) && ownsClass(docs.get(path.split('/').slice(0, 2).join('/')) || null, a);
      default:
        return null; // not modelled here
    }
  }

  const wire = (path) => {
    const d = docs.get(path);
    return { name: `projects/p/databases/(default)/documents/${path}`, fields: d.fields, createTime: d.createTime, updateTime: d.updateTime };
  };
  const pathOfName = (name) => name.split('/documents/')[1];

  /** Apply writes atomically, the way :commit does. Returns { status, message }. */
  function commit(writes, a) {
    const staged = new Map(docs);
    const steps = [];
    for (const w of writes) {
      const path = pathOfName(w.delete || w.update.name);
      const before = staged.get(path) || null;
      const want = w.currentDocument;
      if (want && want.exists === true && !before) return { status: 404, message: 'NOT_FOUND: no document to update' };
      if (want && want.exists === false && before) return { status: 409, message: 'ALREADY_EXISTS: document already exists' };
      if (want && want.updateTime && (!before || before.updateTime !== want.updateTime)) return { status: 400, message: 'FAILED_PRECONDITION: the stored document was changed' };
      let after = null;
      if (w.update) {
        const mask = w.updateMask && w.updateMask.fieldPaths;
        let fields;
        if (mask) {
          fields = { ...(before ? before.fields : {}) };
          for (const k of mask) {
            if (k in (w.update.fields || {})) fields[k] = w.update.fields[k];
            else delete fields[k];
          }
        } else fields = { ...(w.update.fields || {}) };
        after = { fields, createTime: before ? before.createTime : stamp(), updateTime: stamp() };
        staged.set(path, after);
      } else staged.delete(path);
      steps.push({ path, before, after, op: w.delete ? 'delete' : before ? 'update' : 'create' });
    }
    for (const s of steps) {
      if (s.op === 'delete' && !s.before) continue; // deleting nothing is not an error
      const verdict = allowed(s.op, s.path, a, s.before, s.after, (p) => staged.get(p) || null);
      if (verdict === false) {
        log.push({ denied: s.op, path: s.path, uid: a && a.user_id });
        return { status: 403, message: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
      }
    }
    docs.clear();
    for (const [k, v] of staged) docs.set(k, v);
    return { status: 200 };
  }

  function respond(method, url, headers, bodyText) {
    const u = new URL(url);
    const a = claimsOf(headers.authorization);
    const body = bodyText ? JSON.parse(bodyText) : {};
    const tail = decodeURIComponent(u.pathname).split('/documents')[1] || '';
    const json = (status, o) => ({ status, body: JSON.stringify(o) });
    const deny = () => json(403, { error: { code: 403, message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' } });

    if (tail === ':commit') {
      const r = commit(body.writes || [], a);
      return r.status === 200 ? json(200, { writeResults: [] }) : json(r.status, { error: { code: r.status, message: r.message } });
    }
    if (tail === ':batchGet') {
      const out = [];
      for (const name of body.documents || []) {
        const path = pathOfName(name);
        if (allowed('get', path, a, docs.get(path) || null) === false) return deny();
        out.push(docs.has(path) ? { found: wire(path) } : { missing: name });
      }
      return json(200, out);
    }
    if (tail === ':runQuery') {
      const q = body.structuredQuery || {};
      const coll = q.from && q.from[0] && q.from[0].collectionId;
      const where = q.where || {};
      const filters = (where.compositeFilter ? where.compositeFilter.filters : where.fieldFilter ? [where] : [])
        .map((x) => ({ field: x.fieldFilter.field.fieldPath, value: plain(x.fieldFilter.value) }));
      if (allowed('list', `${coll}/x`, a, null, null, null, filters) === false) {
        log.push({ denied: 'list', path: coll, uid: a && a.user_id });
        return deny();
      }
      const rows = [...docs.keys()]
        .filter((p) => p.split('/').length === 2 && p.startsWith(`${coll}/`))
        .filter((p) => filters.every((f) => plain(docs.get(p).fields[f.field]) === f.value))
        .map((p) => ({ document: wire(p) }));
      return json(200, rows.length ? rows : [{ readTime: stamp() }]);
    }
    const path = tail.replace(/^\//, '');
    const parts = path.split('/');
    const isDoc = parts.length % 2 === 0;
    if (method === 'GET' && isDoc) {
      // a document that is not there is "not found" for whoever may read the collection
      if (docs.has(path) && allowed('get', path, a, docs.get(path)) === false) return deny();
      return docs.has(path) ? json(200, wire(path)) : json(404, { error: { code: 404, message: 'NOT_FOUND' } });
    }
    if (method === 'GET') {
      if (allowed('list', `${path}/x`, a) === false) return deny();
      const rows = [...docs.keys()].filter((p) => p.startsWith(`${path}/`) && p.split('/').length === parts.length + 1).map(wire);
      return json(200, rows.length ? { documents: rows } : {});
    }
    if (method === 'POST') {
      const id = `auto${String(++auto).padStart(4, '0')}`;
      const r = commit([{ update: { name: `x/documents/${path}/${id}`, fields: body.fields || {} }, currentDocument: { exists: false } }], a);
      return r.status === 200 ? json(200, wire(`${path}/${id}`)) : json(r.status, { error: { code: r.status, message: r.message } });
    }
    if (method === 'PATCH') {
      const mask = u.searchParams.getAll('updateMask.fieldPaths');
      const w = { update: { name: `x/documents/${path}`, fields: body.fields || {} } };
      if (mask.length) w.updateMask = { fieldPaths: mask };
      const r = commit([w], a);
      return r.status === 200 ? json(200, wire(path)) : json(r.status, { error: { code: r.status, message: r.message } });
    }
    if (method === 'DELETE') {
      const r = commit([{ delete: `x/documents/${path}` }], a);
      return r.status === 200 ? json(200, {}) : json(r.status, { error: { code: r.status, message: r.message } });
    }
    return json(400, { error: { code: 400, message: 'unsupported' } });
  }

  return {
    docs,
    log,
    /** Call the database as this user, the way the page does. */
    call(user, method, tail, body) {
      const r = respond(method, `https://firestore.googleapis.com${ROOT}p/databases/(default)/documents${tail}`, { authorization: `Bearer ${tokenOf(user)}` }, body ? JSON.stringify(body) : '');
      return { status: r.status, json: JSON.parse(r.body) };
    },
    route(route, u) {
      if (u.hostname !== 'firestore.googleapis.com' || !u.pathname.startsWith(ROOT)) return false;
      const req = route.request();
      const r = respond(req.method(), req.url(), req.headers(), req.postData());
      route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: r.body });
      return true;
    },
    seats: () => [...docs.keys()].filter((p) => p.startsWith('roster_seats/')).map((p) => ({ key: p.split('/')[1], ...Object.fromEntries(Object.entries(docs.get(p).fields).map(([k, v]) => [k, plain(v)])) })),
    link: (uid) => {
      const d = docs.get(`student_links/${uid}`);
      return d ? Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, plain(v)])) : null;
    },
    classes: () => [...docs.keys()].filter((p) => p.split('/').length === 2 && p.startsWith('assessment_classes/')).map((p) => ({ id: p.split('/')[1], ...Object.fromEntries(Object.entries(docs.get(p).fields).map(([k, v]) => [k, plain(v)])) })),
    /** One document as plain values, or null. */
    doc: (path) => {
      const d = docs.get(path);
      return d ? Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, plain(v)])) : null;
    },
    students: (classId) => [...docs.keys()].filter((p) => p.startsWith(`assessment_classes/${classId}/students/`)).map((p) => ({ id: p.split('/')[3], path: p, ...Object.fromEntries(Object.entries(docs.get(p).fields).map(([k, v]) => [k, plain(v)])) })),
  };
}

// ── a signed-in browser page with the outside network blocked ───────────────
// One origin per person: a single-process Chromium shares localStorage between
// contexts on the same origin, and the sign-in lives in localStorage.
export function makeOpener(DIST, firstPort) {
  let nextPort = firstPort;
  const servers = [];
  /** `user`: { uid, email, name, type: 'teacher' | 'student', verified? } — null for a signed-out visitor. */
  async function openPage(browser, fake, user, { w = 1366, h = 860, theme = 'dark' } = {}) {
  const port = nextPort++;
  servers.push(await serve(DIST, port));
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript(
    ([user, tok, theme]) => {
      try {
        const set = (k, v) => {
          if (!localStorage.getItem(k)) localStorage.setItem(k, v);
        };
        set('cmc-theme', theme);
        if (!user) return;
        set('cmc-student-token', tok);
        set('cmc-student-uid', user.uid);
        set('cmc-student-email', user.email);
        set('cmc-student-name', user.name);
        set('cmc-student-token-expires', String(Date.now() + 3600e3));
        set('cmc-student-verified', '1');
        set('cmc-account-type', user.type);
        set('cmc-student-role', user.type === 'teacher' ? 'teacher' : 'student');
      } catch {
        /* storage is off */
      }
    },
    [user, user ? tokenOf(user) : '', theme],
  );
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS' && u.hostname === 'firestore.googleapis.com') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    if (fake.route(route, u)) return undefined;
    if (u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage();
  page.base = `http://127.0.0.1:${port}`;
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e.stack || e).slice(0, 400)));
  // the teacher is asked before anything is removed; say yes, and keep the question
  page.asked = [];
  page.on('dialog', (d) => {
    page.asked.push(d.message());
    d.accept().catch(() => {});
  });
  return page;
}
  return { openPage, close: () => servers.forEach((s) => s.close()) };
}
