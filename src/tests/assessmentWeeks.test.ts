import { describe, expect, it } from 'vitest';
import { formatWeekLabel, weekKeyOf } from '../lib/assessmentDb';

// Weekly assessment entries are keyed by the week's Monday date. These
// tests pin the local-time Monday math (Cambodia: no DST, UTC+7) and the
// human label used in the week selector and reports.
describe('weekKeyOf', () => {
  it('returns the Monday of the week containing the date', () => {
    // Wed 28 Oct 2026 → Mon 26 Oct 2026
    expect(weekKeyOf(new Date(2026, 9, 28))).toBe('2026-10-26');
    // Monday itself is its own week key
    expect(weekKeyOf(new Date(2026, 9, 26))).toBe('2026-10-26');
    // Sunday rolls back to the previous Monday
    expect(weekKeyOf(new Date(2026, 10, 1))).toBe('2026-10-26');
    // Year boundary: Fri 1 Jan 2027 → Mon 28 Dec 2026
    expect(weekKeyOf(new Date(2027, 0, 1))).toBe('2026-12-28');
  });

  it('pads single-digit months and days', () => {
    // Mon 2 Feb 2026
    expect(weekKeyOf(new Date(2026, 1, 2))).toBe('2026-02-02');
    expect(weekKeyOf(new Date(2026, 1, 5))).toBe('2026-02-02');
  });
});

describe('formatWeekLabel', () => {
  it('renders a human week label', () => {
    expect(formatWeekLabel('2026-10-26')).toBe('Week of 26 Oct 2026');
  });

  it('falls back to the raw key when unparseable', () => {
    expect(formatWeekLabel('not-a-date')).toBe('not-a-date');
  });
});
