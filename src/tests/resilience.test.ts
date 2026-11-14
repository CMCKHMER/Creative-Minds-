import { describe, expect, it, vi } from 'vitest';
import { failedModuleUrl, retryImport } from '../lib/lazyRetry';
import { uidFromIdToken } from '../lib/submitScore';

/** Build an unsigned JWT-shaped token with the given payload (base64url). */
function fakeToken(payload: Record<string, unknown>): string {
  const b64url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'RS256' })}.${b64url(payload)}.signature`;
}

describe('retryImport (lazy chunk loader)', () => {
  it('returns the module straight away when the first attempt works', async () => {
    const loader = vi.fn().mockResolvedValue({ default: 'chunk' });
    await expect(retryImport(loader)).resolves.toEqual({ default: 'chunk' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('recovers from a transient failure', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValue({ default: 'chunk' });
    await expect(retryImport(loader, 2, 1)).resolves.toEqual({ default: 'chunk' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured retries and surfaces the last error', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(retryImport(loader, 2, 1)).rejects.toThrow('offline');
    expect(loader).toHaveBeenCalledTimes(3); // first try + 2 retries
  });
});

describe('failedModuleUrl', () => {
  it('extracts the chunk URL from Chrome and Firefox error messages', () => {
    expect(
      failedModuleUrl(new TypeError('Failed to fetch dynamically imported module: https://x.test/app/assets/Pricing-abc.js')),
    ).toBe('https://x.test/app/assets/Pricing-abc.js');
    expect(
      failedModuleUrl(new TypeError('error loading dynamically imported module: https://x.test/assets/A-1.js')),
    ).toBe('https://x.test/assets/A-1.js');
  });

  it('drops a previous retry marker so retries do not pile up query strings', () => {
    expect(
      failedModuleUrl(new TypeError('Failed to fetch dynamically imported module: https://x.test/assets/A-1.js?retry=abc')),
    ).toBe('https://x.test/assets/A-1.js');
  });

  it('returns null when the message names no URL (Safari) or is not an import error', () => {
    expect(failedModuleUrl(new TypeError('Importing a module script failed.'))).toBeNull();
    expect(failedModuleUrl(new Error('offline'))).toBeNull();
    expect(failedModuleUrl('Failed to fetch dynamically imported module: not a url')).toBeNull();
  });
});

describe('uidFromIdToken (score submission fallback)', () => {
  it('reads the Firebase uid claim', () => {
    expect(uidFromIdToken(fakeToken({ user_id: 'abc123', sub: 'abc123' }))).toBe('abc123');
    expect(uidFromIdToken(fakeToken({ sub: 'only-sub' }))).toBe('only-sub');
  });

  it('handles payloads that need base64url translation and padding', () => {
    // "ÿ?>" style characters force '-' / '_' into the base64url text.
    const token = fakeToken({ user_id: 'uid-ÿÿ??>>', name: 'Dara' });
    expect(token.split('.')[1]).toMatch(/[-_]/);
    expect(uidFromIdToken(token)).toBe('uid-ÿÿ??>>');
  });

  it('returns an empty string for anything that is not a usable token', () => {
    expect(uidFromIdToken(null)).toBe('');
    expect(uidFromIdToken('')).toBe('');
    expect(uidFromIdToken('not-a-jwt')).toBe('');
    expect(uidFromIdToken('a.%%%.c')).toBe('');
    expect(uidFromIdToken(fakeToken({ user_id: 42 }))).toBe('');
  });
});

describe('CSV formula guard (csvSafeText)', () => {
  it('neutralises cells a spreadsheet would run as a formula', async () => {
    const { csvSafeText } = await import('../lib/csvSafe');
    expect(csvSafeText('=HYPERLINK("http://x","y")')).toBe(`'=HYPERLINK("http://x","y")`);
    expect(csvSafeText('+cmd|calc')).toBe(`'+cmd|calc`);
    expect(csvSafeText('-2+3')).toBe(`'-2+3`);
    expect(csvSafeText('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(csvSafeText('\t=1+1')).toBe(`'\t=1+1`);
  });

  it('leaves ordinary text and plain numbers untouched', async () => {
    const { csvSafeText } = await import('../lib/csvSafe');
    for (const v of ['Sok Dara', 'Doe, Jane "JD"', '—', '', '80', '-5', '+3.5', '-0.25', '95%', 'a=b', 'x@y.edu']) {
      expect(csvSafeText(v)).toBe(v);
    }
    expect(csvSafeText(-12)).toBe('-12');
    expect(csvSafeText(null)).toBe('');
    expect(csvSafeText(undefined)).toBe('');
  });

  it('is applied by the score exports', async () => {
    const { gridToCsv } = await import('../lib/liveSheet');
    const csv = gridToCsv([{ cells: ['=1+1', '-7', 'Doe, Jane'] }] as never);
    expect(csv).toBe(`\uFEFF'=1+1,-7,"Doe, Jane"`);
  });
});
