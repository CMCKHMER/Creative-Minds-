import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

const HOMEWORK_PAGES = [
  'public/rfc3/unit2hw.html',
  'public/rfc3/unit3hw.html',
  'public/rfc3/unit4hw.html',
  'public/rfc3/unit13hw.html',
  'public/rfc3/unit15hw.html',
  'public/rfc3/doctor-fish.html',
];

/**
 * Expired-session refresh on the Kid 11 homework pages.
 *
 * Firebase's securetoken endpoint takes a FORM body
 * (`grant_type=refresh_token&refresh_token=…`), and every other submitter in
 * this repo sends it as `application/x-www-form-urlencoded`
 * (src/lib/firebaseAuth.ts, public/assets/js/cmc-shared.js, dictation,
 * review-tests, the bi-week planner…). The six homework pages declared the
 * form body as `application/json` instead, so the exchange failed and an
 * expired session silently degraded to the guest branch: the score still
 * reached the teacher, but the row lost its `studentUid` — and with it the
 * student's own "My score" card (which matches the account first).
 *
 * The Firestore POST itself is JSON and must stay JSON.
 */
describe('kid 11 homework — expired-session refresh uses the securetoken form encoding', () => {
  it.each(HOMEWORK_PAGES)('%s refreshes with x-www-form-urlencoded', (file) => {
    const html = read(file);
    const refresh = html.slice(html.indexOf('securetoken.googleapis.com'));
    expect(refresh, file).not.toBe('');
    const block = refresh.slice(0, refresh.indexOf('.then('));
    expect(block, file).toContain("'Content-Type': 'application/x-www-form-urlencoded'");
    expect(block, file).toContain('grant_type=refresh_token&refresh_token=');
    // The form body must not be declared as JSON anywhere in the refresh call.
    expect(block, file).not.toContain("'Content-Type': 'application/json'");
  });

  it.each(HOMEWORK_PAGES)('%s still posts the attempt itself as JSON', (file) => {
    const html = read(file);
    // cmcPost is the only Firestore writer in these pages.
    expect(html, file).toContain("var h = { 'Content-Type': 'application/json' };");
  });

  it.each(HOMEWORK_PAGES)('%s retries through the refresh on a 401 before falling back', (file) => {
    const html = read(file);
    expect(html, file).toContain('if (r.status === 401');
    expect(html, file).toContain('cmcRefreshToken(');
    expect(html, file).toContain('cmcRefreshToken(function (t) {');
  });
});
