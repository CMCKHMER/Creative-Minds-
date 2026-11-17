import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

/**
 * "Students said they submitted, yet I'm not seeing some students' scores."
 *
 * A sign-in token lives one hour. A page that posts a score with an older
 * token is refused (401) and must swap the saved refresh token for a new one
 * at securetoken.googleapis.com, then post again. That swap takes a FORM body
 * (`grant_type=refresh_token&refresh_token=…`).
 *
 * The six Kid 11 homework pages sent the form body under
 * `Content-Type: application/json`. Google answers that with HTTP 400
 * "Invalid JSON payload", so the swap never worked: only students who had
 * signed in within the hour could hand in under their account. Every other
 * page on the site already sent the right header.
 *
 * The browser check for the whole flow is scripts/verify_homework_submit.mjs.
 */
const HOMEWORK_PAGES = [
  'public/rfc3/unit2hw.html',
  'public/rfc3/unit3hw.html',
  'public/rfc3/unit4hw.html',
  'public/rfc3/unit13hw.html',
  'public/rfc3/unit15hw.html',
  'public/rfc3/doctor-fish.html',
];

const ENDPOINT = 'securetoken.googleapis.com/v1/token';

/** The text of each token-swap request in a file: from the endpoint to the end of its options. */
function renewalRequests(text: string): string[] {
  const out: string[] = [];
  let at = text.indexOf(ENDPOINT);
  while (at !== -1) {
    out.push(text.slice(at, at + 420));
    at = text.indexOf(ENDPOINT, at + ENDPOINT.length);
  }
  // A mention in a comment has no body; only real requests are checked.
  return out.filter((chunk) => /grant_type=refresh_token/.test(chunk));
}

function filesUnder(dir: string, keep: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) filesUnder(path, keep, out);
    else if (keep.test(name)) out.push(path);
  }
  return out;
}

describe('renewing an expired sign-in', () => {
  it.each(HOMEWORK_PAGES)('%s sends the renewal as a form', (page) => {
    const requests = renewalRequests(readFileSync(resolve(root, page), 'utf8'));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("'Content-Type': 'application/x-www-form-urlencoded'");
    expect(requests[0]).not.toContain('application/json');
  });

  it('no page or script on the site sends a form body under a JSON header', () => {
    const files = [
      ...filesUnder(resolve(root, 'public'), /\.(html|js)$/),
      ...filesUnder(resolve(root, 'src'), /\.(ts|tsx)$/).filter((f) => !/\.test\.tsx?$/.test(f)),
      ...filesUnder(resolve(root, 'scripts'), /^(build_|make_).*\.(py|mjs|js)$/),
    ];
    const wrong: string[] = [];
    let seen = 0;
    for (const file of files) {
      for (const request of renewalRequests(readFileSync(file, 'utf8'))) {
        seen += 1;
        // Only the form style is used on this site; a JSON body would need a JSON header instead.
        const formBody = /grant_type=refresh_token&refresh_token=/.test(request);
        if (formBody && !/application\/x-www-form-urlencoded/i.test(request)) wrong.push(relative(root, file));
        if (formBody && /application\/json/i.test(request)) wrong.push(relative(root, file));
      }
    }
    expect(seen).toBeGreaterThan(20);
    expect([...new Set(wrong)]).toEqual([]);
  });

  it('the homework pages retry with the renewed sign-in, on Submit and for scores kept from a failed send', () => {
    for (const page of HOMEWORK_PAGES) {
      const text = readFileSync(resolve(root, page), 'utf8');
      const submit = text.slice(text.indexOf('function submitCompletion()'), text.indexOf("getElementById('submitBtn').addEventListener('click', submitCompletion)"));
      expect(submit, page).toMatch(/r\.status === 401 && sess\.authed[\s\S]*cmcRefreshToken\(function \(t\) \{[\s\S]*cmcPost\(body, t\)/);
      const flush = text.slice(text.indexOf('function cmcFlushOutbox()'), text.indexOf('function submitCompletion()'));
      expect(flush, page).toMatch(/r\.status === 401[\s\S]*cmcRefreshToken\(function \(t\) \{/);
    }
  });
});
