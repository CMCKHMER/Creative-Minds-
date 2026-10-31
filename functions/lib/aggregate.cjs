'use strict';

// Creative Minds Cambodia — pure ticker-aggregation logic.
//
// This module is the SINGLE SOURCE OF TRUTH for the live-ticker stats and is
// used in two places:
//   1. functions/index.js — the scheduled rollupTicker Cloud Function, which
//      recomputes the stats every 5 minutes server-side and writes them to
//      Firestore at ticker_stats/latest (one pre-aggregated doc that every
//      visitor's ticker reads with a single GET).
//   2. src/tests/tickerAggregate.test.ts — unit tests that pin the exact
//      semantics shared with the client-side aggregation in
//      src/components/TickerBanner.tsx (aggregate()).
//
// PARITY CONTRACT with TickerBanner.aggregate():
//   - "today" starts at local midnight; the site audience is Cambodia, so the
//     server uses a fixed ICT offset (UTC+7, no DST) instead of a browser TZ.
//   - "this week" is a rolling 7×24h window: [startOfToday - 6 days, now].
//   - Assignment rows (drillSource === 'assignment', logged by the private
//     teacher-assigned test pages) count toward assignmentsWeek and active
//     students, but NEVER toward drillsToday / drillsThisWeek / the
//     leaderboard — their scorePct is always 0 until the teacher grades,
//     and mixing them in would fake 0% averages.
//   - Leaderboard: per-name drills + rounded average score over the window,
//     sorted by drills desc then avgScore desc, top 6.
//   - Exact all-time totals (totalDrills / assignmentsTotal) are NOT computed
//     here — they arrive via the `totals` argument (count() aggregation
//     queries in index.js).

const DAY_MS = 24 * 60 * 60 * 1000;
// Cambodia (ICT) is UTC+7 year-round — no DST, unlike a host-machine TZ the
// schedule/function could land on. Fixed offset keeps "today" stable.
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Local (ICT) midnight for the day containing `now`, in epoch ms. */
function startOfTodayMs(now) {
  const shifted = now + ICT_OFFSET_MS;
  return shifted - (shifted % DAY_MS) - ICT_OFFSET_MS;
}

/** Rolling 7-day window start: [weekStart, now] — same formula as the client. */
function weekStartMs(now) {
  return startOfTodayMs(now) - 6 * DAY_MS;
}

/**
 * Compute the ticker stats from the last-7-days attempts.
 *
 * @param {Array<{drillSource: string, studentName: string, scorePct: number,
 *                submittedAt: number}>} attempts
 *        Rows from the week-window query (any order — result is
 *        order-independent).
 * @param {number} now   Epoch ms "as of" time for the day/window boundaries.
 * @param {{totalDrills: number, assignmentsTotal: number}} totals
 *        Exact all-time counts from count() aggregation queries.
 */
function computeTickerStats(attempts, now, totals) {
  const startOfToday = startOfTodayMs(now);
  const startOfWeek = startOfToday - 6 * DAY_MS;

  let drillsToday = 0;
  let drillsThisWeek = 0;
  let assignmentsWeek = 0;
  const studentSet = new Set();
  const perName = new Map();

  for (const a of attempts) {
    if (!a.submittedAt) continue;
    // Defensive parity: the queries that feed this function only return
    // week-window rows; dropping older strays here keeps the pure function
    // honest even if a future caller forgets the filter.
    if (a.submittedAt < startOfWeek) continue;

    if (a.drillSource === 'assignment') {
      // Assigned tests: completions, not drills. Counted in their own stat
      // and toward active students; never in the leaderboard (score is an
      // ungraded 0 until the teacher grades on the dashboard).
      assignmentsWeek += 1;
      studentSet.add(a.studentName);
      continue;
    }

    if (a.submittedAt >= startOfToday) drillsToday += 1;
    if (a.submittedAt >= startOfWeek) drillsThisWeek += 1;
    studentSet.add(a.studentName);

    const cur = perName.get(a.studentName) || { drills: 0, scoreSum: 0 };
    cur.drills += 1;
    cur.scoreSum += a.scorePct;
    perName.set(a.studentName, cur);
  }

  const leaderboard = Array.from(perName.entries())
    .map(([name, v]) => ({
      name,
      drills: v.drills,
      avgScore: Math.round(v.scoreSum / v.drills),
    }))
    .sort((x, y) => y.drills - x.drills || y.avgScore - x.avgScore)
    .slice(0, 6);

  return {
    stats: {
      totalDrills: totals.totalDrills,
      activeStudents: studentSet.size,
      drillsToday,
      drillsThisWeek,
      assignmentsWeek,
      assignmentsTotal: totals.assignmentsTotal,
    },
    leaderboard,
  };
}

module.exports = { DAY_MS, ICT_OFFSET_MS, startOfTodayMs, weekStartMs, computeTickerStats };
