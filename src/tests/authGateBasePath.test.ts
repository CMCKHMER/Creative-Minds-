import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const gateSource = readFileSync(resolve(process.cwd(), 'public/assets/js/cmc-auth-gate.js'), 'utf8');
const inviteSource = readFileSync(resolve(process.cwd(), 'public/biweek-planner/student-invite.js'), 'utf8');

function authUrlFor(scriptUrl: string | null, pagePath: string, hostname = 'cmckhmer.github.io'): string {
  const document = {
    currentScript: scriptUrl ? { src: scriptUrl } : null,
    addEventListener() {},
    getElementById() { return null; },
  };
  const window = {
    document,
    location: { pathname: pagePath, search: '?invite=CLASS-1', hash: '', hostname },
    localStorage: { getItem() { return null; } },
    addEventListener() {},
    print() {},
  };
  runInNewContext(gateSource, { window, document, URL, console });
  return (window as unknown as { CMC_GATE: { authUrl(mode: string): string } }).CMC_GATE.authUrl('signup');
}

function inviteAppRoot(scriptUrl: string, pagePath: string): string {
  const match = inviteSource.match(/function appRoot\(\) \{[\s\S]*?\n {2}\}/);
  if (!match) throw new Error('student invite auth root helper not found');
  return runInNewContext(`(${match[0]})()`, {
    INVITE_SCRIPT_URL: scriptUrl,
    window: { location: { pathname: pagePath } },
    URL,
  }) as string;
}

describe('static homework auth links respect the deployment base path', () => {
  it('returns invite sign-up and sign-in links to the app under GitHub Pages', () => {
    const root = inviteAppRoot(
      'https://cmckhmer.github.io/Creative-Minds-/biweek-planner/student-invite.js',
      '/Creative-Minds-/biweek-planner/tests/homework.html',
    );
    expect(root).toBe('/Creative-Minds-/');
    expect(inviteSource).toContain("var signup = appRoot() + '?auth=signup&next='");
    expect(inviteSource).toContain("var signin = appRoot() + '?auth=signin&next='");
  });

  it('returns students to the React app under the GitHub Pages project path', () => {
    expect(authUrlFor(
      'https://cmckhmer.github.io/Creative-Minds-/assets/js/cmc-auth-gate.js',
      '/Creative-Minds-/rfc3/unit2hw.html',
    )).toBe('/Creative-Minds-/?auth=signup&next=%2FCreative-Minds-%2Frfc3%2Funit2hw.html%3Finvite%3DCLASS-1');
  });

  it('also works when deployed at a custom domain root', () => {
    expect(authUrlFor(
      'https://example.edu/assets/js/cmc-auth-gate.js',
      '/rfc3/unit2hw.html',
      'example.edu',
    )).toBe('/?auth=signup&next=%2Frfc3%2Funit2hw.html%3Finvite%3DCLASS-1');
  });

  it('falls back to the project prefix on GitHub Pages if currentScript is unavailable', () => {
    expect(authUrlFor(null, '/Creative-Minds-/rfc3/unit2hw.html')).toBe(
      '/Creative-Minds-/?auth=signup&next=%2FCreative-Minds-%2Frfc3%2Funit2hw.html%3Finvite%3DCLASS-1',
    );
  });
});
