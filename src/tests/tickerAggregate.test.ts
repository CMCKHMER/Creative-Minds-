import { describe, expect, it } from 'vitest';
import { computeTickerStats, startOfTodayMs, weekStartMs } from '../../functions/lib/aggregate.cjs';

/**
 * Pins the ticker stats semantics shared by the client-side aggregation
 * (src/components/TickerBanner.tsx, aggregate()) and the server-side
 * rollupTicker Cloud Function (functions/index.js via lib/aggregate.cjs).
 * If these tests change, BOTH implementations must move together.
 *
 * Time anchors use Cambodia time (ICT, UTC+7) — the fixed offset the server
 * function relies on instead of a browser timezone.
 */

const NOW = Date.parse('2026-10-31T10:00:00+07:00');
const START_OF_TODAY = Date.parse('2026-10-31T00:00:00+07:00');
const START_OF_WEEK = START_OF_TODAY - 6 * 24 * 60 * 60 * 1000;

function attempt(overrides: Partial<Parameters<typeof computeTickerStats>[0][number]> = {}) {
  return {
    drillSource: 'drill',
    studentName: 'Sophea',
    scorePct: 80,
    submittedAt: NOW - 60 * 60 * 1000, // 1h ago → today + week
    ...overrides,
  };
}

describe('ticker window boundaries (ICT)', () => {
  it('startOfTodayMs is local (ICT) midnight of the day containing now', () => {
    // 00:30 ICT on Oct 31 → midnight is Oct 31 00:00 ICT, NOT Oct 30 (UTC).
    const now = Date.parse('2026-10-31T00:30:00+07:00');
    expect(startOfTodayMs(now)).toBe(Date.parse('2026-10-31T00:00:00+07:00'));
    // Late-evening edge: 23:59 ICT Oct 30 → Oct 30 midnight ICT.
    const late = Date.parse('2026-10-30T23:59:00+07:00');
    expect(startOfTodayMs(late)).toBe(Date.parse('2026-10-30T00:00:00+07:00'));
  });

  it('weekStartMs is startOfToday minus 6 days (rolling 7×24h window)', () => {
    expect(weekStartMs(NOW)).toBe(START_OF_TODAY - 6 * 24 * 60 * 60 * 1000);
  });

  it('an attempt exactly at weekStart is in the window; 1ms earlier is not', () => {
    const { stats } = computeTickerStats(
      [
        attempt({ submittedAt: START_OF_WEEK }),
        attempt({ submittedAt: START_OF_WEEK - 1, studentName: 'Rithy' }),
      ],
      NOW,
      { totalDrills: 2, assignmentsTotal: 0 },
    );
    expect(stats.drillsThisWeek).toBe(1);
  });

  it('rows older than the window are dropped even if the caller forgets the filter', () => {
    const { stats } = computeTickerStats(
      [attempt({ submittedAt: START_OF_WEEK - 60_000, studentName: 'Old Row' })],
      NOW,
      { totalDrills: 1, assignmentsTotal: 0 },
    );
    expect(stats.drillsThisWeek).toBe(0);
    expect(stats.activeStudents).toBe(0);
  });
});

describe('drill counters', () => {
  it('splits today vs this week vs out-of-window', () => {
    const { stats } = computeTickerStats(
      [
        attempt({ submittedAt: NOW - 1 * 60 * 60 * 1000 }), // today
        attempt({ submittedAt: START_OF_TODAY - 60_000, studentName: 'Dara' }), // yesterday → week only
        attempt({ submittedAt: START_OF_WEEK, studentName: 'Linna' }), // window edge → week only
      ],
      NOW,
      { totalDrills: 3, assignmentsTotal: 0 },
    );
    expect(stats.drillsToday).toBe(1);
    expect(stats.drillsThisWeek).toBe(3);
    expect(stats.activeStudents).toBe(3);
  });

  it('counts distinct students once across many drills', () => {
    const { stats } = computeTickerStats(
      [
        attempt({ submittedAt: NOW - 60_000 }),
        attempt({ submittedAt: NOW - 120_000 }),
        attempt({ studentName: 'Dara', submittedAt: NOW - 180_000 }),
      ],
      NOW,
      { totalDrills: 3, assignmentsTotal: 0 },
    );
    expect(stats.activeStudents).toBe(2);
  });

  it('skips rows with a missing/zero submittedAt', () => {
    const { stats } = computeTickerStats(
      [attempt({ submittedAt: 0 }), attempt({ submittedAt: NOW - 60_000 })],
      NOW,
      { totalDrills: 1, assignmentsTotal: 0 },
    );
    expect(stats.drillsToday).toBe(1);
    expect(stats.activeStudents).toBe(1);
  });
});

describe('assignment rows (teacher-assigned tests)', () => {
  it('count in their own stat + active students, never in drill stats or the leaderboard', () => {
    const { stats, leaderboard } = computeTickerStats(
      [
        attempt(), // real drill
        attempt({ drillSource: 'assignment', studentName: 'Kanha', scorePct: 0, submittedAt: NOW - 30 * 60_000 }),
        attempt({ drillSource: 'assignment', studentName: 'Rithy', scorePct: 0, submittedAt: NOW - 5 * 24 * 60 * 60 * 1000 }),
      ],
      NOW,
      { totalDrills: 1, assignmentsTotal: 2 },
    );
    expect(stats.assignmentsWeek).toBe(2);
    expect(stats.drillsToday).toBe(1);
    expect(stats.drillsThisWeek).toBe(1);
    expect(stats.activeStudents).toBe(3); // drill student + 2 assignment students
    expect(leaderboard.map((e) => e.name)).toEqual(['Sophea']); // Kanha/Rithy excluded
    expect(stats.assignmentsTotal).toBe(2);
    expect(stats.totalDrills).toBe(1);
  });

  it('excludes assignments that fell outside the week window', () => {
    const { stats } = computeTickerStats(
      [attempt({ drillSource: 'assignment', submittedAt: START_OF_WEEK - 60_000 })],
      NOW,
      { totalDrills: 0, assignmentsTotal: 1 },
    );
    expect(stats.assignmentsWeek).toBe(0);
    expect(stats.activeStudents).toBe(0);
  });
});

describe('leaderboard', () => {
  it('averages per name, rounds, sorts by drills then avg, caps at 6', () => {
    const rows = [
      attempt({ studentName: 'A', scorePct: 80, submittedAt: NOW - 60_000 }),
      attempt({ studentName: 'A', scorePct: 91, submittedAt: NOW - 120_000 }), // avg 85.5 → 86 (round half up)
      attempt({ studentName: 'B', scorePct: 70, submittedAt: NOW - 60_000 }),
      attempt({ studentName: 'B', scorePct: 72, submittedAt: NOW - 120_000 }), // avg 71
      attempt({ studentName: 'C', scorePct: 50, submittedAt: NOW - 60_000 }),
      attempt({ studentName: 'D', scorePct: 90, submittedAt: NOW - 60_000 }),
      attempt({ studentName: 'E', scorePct: 90, submittedAt: NOW - 60_000 }),
      attempt({ studentName: 'F', scorePct: 90, submittedAt: NOW - 60_000 }),
      attempt({ studentName: 'G', scorePct: 90, submittedAt: NOW - 60_000 }),
    ];
    const { leaderboard } = computeTickerStats(rows, NOW, { totalDrills: 9, assignmentsTotal: 0 });
    expect(leaderboard.length).toBe(6); // top-6 cap
    expect(leaderboard[0]).toMatchObject({ name: 'A', drills: 2, avgScore: 86 }); // most drills wins
    expect(leaderboard[1]).toMatchObject({ name: 'B', drills: 2, avgScore: 71 });
    // D–G all have 1 drill and a 90 avg — they beat C (1 drill, 50 avg) on
    // the avgScore tie-break, so the cap keeps D..G and drops C.
    expect(leaderboard[2]).toMatchObject({ name: 'D', avgScore: 90 });
    expect(leaderboard.map((e) => e.name)).toContain('G');
    expect(leaderboard.map((e) => e.name)).not.toContain('C');
  });
});

describe('exact totals passthrough', () => {
  it('totalDrills/assignmentsTotal come from the count() aggregations verbatim', () => {
    const { stats } = computeTickerStats([attempt()], NOW, { totalDrills: 4321, assignmentsTotal: 512 });
    expect(stats.totalDrills).toBe(4321);
    expect(stats.assignmentsTotal).toBe(512);
  });
});
