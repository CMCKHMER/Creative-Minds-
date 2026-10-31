'use strict';

// Creative Minds Cambodia — Blaze-plan server ticker rollup.
//
// WHAT THIS DOES
//   rollupTicker runs every 5 minutes, performs the same three queries the
//   homepage ticker used to run in EVERY visitor's browser (week-window
//   fetch + two exact count() aggregations), and writes ONE pre-aggregated
//   document to Firestore at ticker_stats/latest.
//
// WHY IT EXISTS
//   Per-poll client cost drops from ~2 + docs-in-week reads to exactly ONE
//   read (the ticker_stats/latest GET), and the heavy queries run once per
//   5 minutes server-side instead of once per visitor tab per poll. That
//   keeps the site inside the free Firestore allowances even with many open
//   tabs, and makes the 429 quota outages that plagued the ticker
//   structurally impossible to reintroduce.
//
// COST (why this stays at $0 on Blaze)
//   - 288 runs/day × (≤1000 week docs + 2 count() aggregations + 1 write).
//     At the school's current volume (~40 docs total) that is a few hundred
//     reads + ~290 writes per day — orders of magnitude below the free
//     50K reads/day and 20K writes/day that still apply on Blaze.
//   - Cloud Functions free tier: 2M invocations/mo — 8,640 used.
//   - The client treats the doc as stale after 20 minutes and falls back to
//     its own queries, so a broken/paused function degrades gracefully and
//     the ticker never breaks.
//
// DEPLOY
//   firebase deploy --only functions,firestore:rules
//   (firestore.rules grants public READ on ticker_stats; writes stay
//   server-only — the Admin SDK used here bypasses security rules.)

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { computeTickerStats, weekStartMs } = require('./lib/aggregate.cjs');

initializeApp();
const db = getFirestore();

const WEEK_LIMIT = 1000; // same cap as the client's week-window query

exports.rollupTicker = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Asia/Phnom_Penh',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
    maxInstances: 1, // 5-min schedule, seconds-long run — never overlap
  },
  async () => {
    const now = Date.now();
    const weekStart = new Date(weekStartMs(now));

    // Same three reads the client used to pay per poll — now paid once for
    // every visitor. count() aggregations give EXACT all-time totals (never
    // capped by a page size).
    const [weekSnap, totalSnap, assignSnap] = await Promise.all([
      db
        .collection('drill_attempts')
        .where('submittedAt', '>=', weekStart)
        .orderBy('submittedAt', 'desc')
        .limit(WEEK_LIMIT)
        .get(),
      db.collection('drill_attempts').count().get(),
      db.collection('drill_attempts').where('drillSource', '==', 'assignment').count().get(),
    ]);

    const attempts = weekSnap.docs.map((d) => {
      const v = d.data();
      const raw = v.submittedAt;
      // Firestore timestamps arrive as Date via the Admin SDK; tolerate
      // ISO strings in case any historic row stored one.
      const ms = raw && typeof raw.toMillis === 'function' ? raw.toMillis() : Date.parse(raw) || 0;
      return {
        drillSource: typeof v.drillSource === 'string' ? v.drillSource : 'unknown',
        studentName: typeof v.studentName === 'string' ? v.studentName : 'Anonymous',
        scorePct: Number(v.scorePct) || 0,
        submittedAt: ms,
      };
    });

    const { stats, leaderboard } = computeTickerStats(attempts, now, {
      totalDrills: totalSnap.data().count,
      assignmentsTotal: assignSnap.data().count,
    });

    await db.doc('ticker_stats/latest').set({
      ...stats,
      leaderboard,
      // Plain ISO string (not a server timestamp) so the client's freshness
      // check can Date.parse() it straight out of the REST payload.
      updatedAt: new Date(now).toISOString(),
    });
  },
);
