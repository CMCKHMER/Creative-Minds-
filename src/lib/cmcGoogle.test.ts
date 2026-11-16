// @vitest-environment jsdom
//
// public/assets/js/cmc-google.js is the Drive + Classroom client. It is inert
// until a Google OAuth client id is configured, which makes it easy to ship and
// easy to get wrong — so the parts that matter are pinned here with a fake
// Google Identity Services object and a fake fetch:
//
//   inert      no client id → clear 'not-configured' error, no network, and the
//              level-0 share dialog still works
//   scopes     the token request asks for exactly `drive.file` + the Classroom
//              scopes (never the restricted `drive`), and is cached
//   drive      a CSV becomes a multipart upload that Drive converts to a Sheet
//   classroom  assignments / announcements / grade passback hit the documented
//              URLs with the documented bodies
//   errors     Google's 403 is surfaced with the teacher-facing hint
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGoogleClient } from './google';

const SRC = readFileSync(resolve(process.cwd(), 'public/assets/js/cmc-google.js'), 'utf8');

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let tokenClientConfig: { client_id: string; scope: string } | null = null;
let nextResponse: { ok: boolean; status: number; body: unknown } = { ok: true, status: 200, body: {} };

function load(config: Record<string, unknown> | null = { clientId: 'test-client.apps.googleusercontent.com' }) {
  (window as unknown as { CMC_GOOGLE_APP?: unknown }).CMC_GOOGLE_APP = config;
  // eslint-disable-next-line no-new-func
  new Function(SRC)();
  return (window as unknown as { CMCG: any }).CMCG;
}

beforeEach(() => {
  calls = [];
  tokenClientConfig = null;
  nextResponse = { ok: true, status: 200, body: {} };
  (window as any).google = {
    accounts: {
      oauth2: {
        initTokenClient(cfg: any) {
          tokenClientConfig = cfg;
          return {
            requestAccessToken() {
              cfg.callback({ access_token: 'fake-token', expires_in: 3600 });
            },
          };
        },
        revoke() {},
      },
    },
  };
  (window as any).fetch = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: nextResponse.ok,
      status: nextResponse.status,
      text: () => Promise.resolve(JSON.stringify(nextResponse.body)),
    });
  });
  (window as any).open = vi.fn(() => ({}));
});

afterEach(() => {
  delete (window as any).google;
  delete (window as any).fetch;
  delete (window as any).CMCG;
  delete (window as any).CMC_GOOGLE;
  delete (window as any).CMC_GOOGLE_APP;
  document.querySelectorAll('script[data-cmc-google]').forEach((n) => n.remove());
});

describe('CMC Google client', () => {
  it('is inert without a client id, and still shares to Classroom', async () => {
    const CMCG = load(null);
    expect(CMCG.configured).toBe(false);
    await expect(CMCG.connect()).rejects.toMatchObject({ code: 'not-configured' });
    expect(calls).toHaveLength(0);

    const href = CMCG.shareToClassroom('https://example.com/game', 'Mafia Noir');
    expect(href).toBe(
      'https://classroom.google.com/share?url=https%3A%2F%2Fexample.com%2Fgame&title=Mafia%20Noir',
    );
    expect((window as any).open).toHaveBeenCalled();
  });

  it('requests only the narrow scopes and caches the token', async () => {
    const CMCG = load();
    expect(CMCG.configured).toBe(true);
    await CMCG.connect();
    expect(tokenClientConfig!.client_id).toBe('test-client.apps.googleusercontent.com');
    expect(tokenClientConfig!.scope).toContain('https://www.googleapis.com/auth/drive.file');
    expect(tokenClientConfig!.scope).toContain('https://www.googleapis.com/auth/classroom.coursework.students');
    expect(tokenClientConfig!.scope).not.toMatch(/auth\/drive(\s|$)/); // never the restricted full-Drive scope
    expect(tokenClientConfig!.scope).not.toContain('classroom.rosters');

    await CMCG.connect();
    expect(calls).toHaveLength(0); // still cached, no second round trip
  });

  it('turns a CSV into a Drive upload that becomes a Google Sheet', async () => {
    nextResponse = { ok: true, status: 200, body: { id: 'file-1', webViewLink: 'https://drive.google.com/x' } };
    const CMCG = load();
    const file = await CMCG.drive.saveCsvAsSheet({ name: 'CMC Week 8', csv: 'name,score\nRy,9\n' });

    expect(file.id).toBe('file-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fake-token');
    expect(headers['Content-Type']).toMatch(/multipart\/related; boundary=/);

    const body = String(calls[0].init.body);
    expect(body).toContain('application/vnd.google-apps.spreadsheet'); // converted to a Sheet
    expect(body).toContain('"name":"CMC Week 8"');                     // .csv stripped
    expect(body).toContain('Content-Type: text/csv');
    expect(body).toContain('name,score');
  });

  it('creates a published Classroom assignment with the game link and a due date', async () => {
    nextResponse = { ok: true, status: 200, body: { id: 'work-1', state: 'PUBLISHED' } };
    const CMCG = load();
    const work = await CMCG.classroom.postAssignment({
      courseId: 'course 1',
      title: 'Brain Lounge · Word Creator',
      description: 'Play one match.',
      url: 'https://cmckhmer.github.io/Creative-Minds-/arcade/word-creator/',
      dueDate: '2026-11-20',
      maxPoints: 10,
    });

    expect(work.id).toBe('work-1');
    expect(calls[0].url).toBe('https://classroom.googleapis.com/v1/courses/course%201/courseWork');
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      title: 'Brain Lounge · Word Creator',
      workType: 'ASSIGNMENT',
      state: 'PUBLISHED',
      maxPoints: 10,
      dueDate: { year: 2026, month: 11, day: 20 },
    });
    expect(body.materials[0].link.url).toBe(
      'https://cmckhmer.github.io/Creative-Minds-/arcade/word-creator/',
    );
  });

  it('posts an announcement and pushes a grade back', async () => {
    nextResponse = { ok: true, status: 200, body: { id: 'an-1' } };
    const CMCG = load();
    await CMCG.classroom.postAnnouncement({ courseId: 'c1', text: 'New game in the lounge', url: 'https://x.test/g' });
    expect(calls[0].url).toBe('https://classroom.googleapis.com/v1/courses/c1/announcements');
    expect(JSON.parse(String(calls[0].init.body)).state).toBe('PUBLISHED');

    nextResponse = { ok: true, status: 200, body: { assignedGrade: 8 } };
    await CMCG.classroom.setGrade({ courseId: 'c1', courseWorkId: 'w1', submissionId: 's1', grade: 8 });
    expect(calls[1].url).toBe(
      'https://classroom.googleapis.com/v1/courses/c1/courseWork/w1/studentSubmissions/s1?updateMask=assignedGrade,draftGrade',
    );
    expect(calls[1].init.method).toBe('PATCH');
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ assignedGrade: 8, draftGrade: 8 });
  });

  it('injects the client script only when an id is configured', () => {
    loadGoogleClient(undefined);
    expect(document.querySelector('script[data-cmc-google]')).toBeNull();

    loadGoogleClient('abc123.apps.googleusercontent.com');
    const tag = document.querySelector<HTMLScriptElement>('script[data-cmc-google]');
    expect(tag).toBeTruthy();
    expect(tag!.src).toContain('assets/js/cmc-google.js');
    expect((window as any).CMC_GOOGLE_APP.clientId).toBe('abc123.apps.googleusercontent.com');

    loadGoogleClient('abc123.apps.googleusercontent.com');
    expect(document.querySelectorAll('script[data-cmc-google]')).toHaveLength(1);
  });

  it('explains a 403 instead of swallowing it', async () => {
    nextResponse = { ok: false, status: 403, body: { error: { message: 'The caller does not have permission' } } };
    const CMCG = load();
    await expect(CMCG.classroom.listCourses()).rejects.toMatchObject({ code: 'http', status: 403 });
    await expect(CMCG.classroom.listCourses()).rejects.toThrow(/not allowed|did not have/);
  });
});
