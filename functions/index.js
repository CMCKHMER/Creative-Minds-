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
const {
  KID11_HOMEWORK_SLUGS,
  buildHomeworkExports,
  parseHomeworkRow,
} = require('./lib/homeworkExport.cjs');

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

// ── Kid 11 homework archive (daily) ────────────────────────────────────────
//
// What this does
//   Every evening it reads the six Grade-11 online-homework pages out of
//   drill_attempts ONCE (one equality query per page — the same single-field
//   index the teacher's live sheet already uses, so no composite index is
//   needed) and writes three small documents per page to
//   homework_exports/<page>__hw<1|2|3>: a ready-made CSV score sheet plus the
//   counts a teacher needs to see at a glance.
//
// Why
//   The live "Scores" sheet re-reads the whole page list every time it opens
//   and again whenever the row count changes — correct for "who handed in
//   just now", but a poor permanent record: the read is capped, it costs a
//   full page read per view, and nothing would survive a term-end cleanup of
//   drill_attempts. This function pays that read once a day and stores the
//   answer, so a teacher can download a term's worth of sheets instantly.
//
// Cost (why this stays inside the free tier)
//   6 queries + 18 small writes per day, on rows that exist anyway. Firestore
//   keeps the same free allowances on Blaze (50K reads / 20K writes per day),
//   so this is well under 1% of them. Cloud Scheduler's first three jobs are
//   free and this is one job at maxInstances:1 — a stuck run cannot fan out.
//
// Deploy
//   firebase deploy --only functions,firestore:rules
//   (firestore.rules grants teacher-only READ on homework_exports; writes
//   stay server-only — the Admin SDK bypasses security rules.)
exports.exportHomeworkSheets = onSchedule(
  {
    schedule: '0 21 * * *', // 21:00 Cambodia time, after the school day
    timeZone: 'Asia/Phnom_Penh',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
    maxInstances: 1,
  },
  async () => {
    const now = Date.now();
    const batch = db.batch();

    for (const slug of KID11_HOMEWORK_SLUGS) {
      // Equality-only query: automatic single-field index, no composite index.
      // 3000 matches HOMEWORK_FETCH_CAP in src/lib/kidHomework.ts.
      const snap = await db
        .collection('drill_attempts')
        .where('drillSlug', '==', slug)
        .limit(3000)
        .get();

      const rows = snap.docs
        .map((d) => parseHomeworkRow(d.data()))
        .filter((row) => row !== null);

      for (const { docId, fields } of buildHomeworkExports({ slug, rows, now })) {
        batch.set(db.doc(`homework_exports/${docId}`), fields);
      }
    }

    await batch.commit();
  },
);
