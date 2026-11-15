// Bi-Weekly Test Scores — the teacher's live score sheet.
//
// Two sources feed it:
//   - the public `drill_attempts` feed: attempts made on the OPEN drill
//     pages (cmc-shared.js posts them with drillSource 'biweek-planner');
//   - the teacher's own invite-link results from the PRIVATE
//     `invite_attempts` collection, graded here against each test's sealed
//     answer key (src/lib/inviteScores.ts). Until Nov 2026 this second
//     source was missing, so a test taken through an invite link never
//     reached the sheet and the newest row a teacher saw was an old one.
//
// Results that were recorded for an earlier version of a test (another
// question count) are labelled in the Note column — see testCounts.ts.
//
// The card hands the teacher a real spreadsheet they own: one landscape tab
// per test, ready to open in Excel / Google Sheets, print, or keep grading in.

import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import {
  annotateVersions, fetchBiweeklyAttempts, groupByTest, mergeAttempts, toCsv, toSpreadsheetXml,
  downloadBlob, scoresFileName,
  type BiweeklyAttempt,
} from '../lib/biweeklyScores';
import { fetchInviteScores, type InviteScores } from '../lib/inviteScores';
import { loadTestCounts } from '../lib/testCounts';
import { LiveScoresSheet } from './LiveScoresSheet';

const INVITE_NOTE: Record<Exclude<InviteScores['state'], 'ok'>, string> = {
  signin: 'Results from your invite links are private to you — sign in with your teacher account to add them to this sheet.',
  denied: 'This account cannot read invite-link results (verified teacher accounts only), so the sheet shows the open drills only.',
  error: 'Could not load the results from your invite links just now — press Refresh to try again.',
};

export const BiWeeklyScoresCard: React.FC = () => {
  const [attempts, setAttempts] = useState<BiweeklyAttempt[] | null>(null);
  const [invite, setInvite] = useState<InviteScores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // The invite results and the counts never block the public feed:
      // both resolve to an empty/neutral value when they cannot be read.
      const [open, mine, counts] = await Promise.all([fetchBiweeklyAttempts(), fetchInviteScores(), loadTestCounts()]);
      setInvite(mine);
      setAttempts(annotateVersions(mergeAttempts(open, mine.attempts), counts));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load scores — try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = attempts ? groupByTest(attempts) : [];
  const students = attempts ? new Set(attempts.map((a) => a.studentName)).size : 0;
  const viaInvite = attempts ? attempts.filter((a) => a.viaInvite).length : 0;
  const earlier = attempts ? attempts.filter((a) => a.note).length : 0;

  const downloadXls = () => {
    if (!attempts) return;
    downloadBlob(
      toSpreadsheetXml(attempts), scoresFileName('xls'),
      'application/vnd.ms-excel',
    );
  };
  const downloadCsv = () => {
    if (!attempts) return;
    downloadBlob(toCsv(attempts), scoresFileName('csv'), 'text/csv;charset=utf-8');
  };

  return (
    <div data-keep-dark className="cmc-scores-card mt-8 rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-slate-950/70 via-slate-950/60 to-slate-950/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-[var(--font-display)] text-lg font-bold text-white">Bi-Weekly Test Scores</h3>
            <p className="text-[11px] text-slate-400">
              Open drills and your invite-link tests record here automatically — grade them in the live sheet below, or download the workbook for Excel / Google Sheets.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200">
          {error}
        </p>
      )}

      {attempts && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={downloadXls}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Download spreadsheet (.xls)
            </button>
            <button
              onClick={downloadCsv}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> CSV (all tests)
            </button>
            <span className="text-[11px] text-slate-500">
              {groups.length} test{groups.length === 1 ? '' : 's'} · {attempts.length} attempt{attempts.length === 1 ? '' : 's'} · {students} student{students === 1 ? '' : 's'}
              {viaInvite > 0 && ` · ${viaInvite} through your invite links`}
            </span>
          </div>

          {invite && invite.state !== 'ok' && (
            <p role="status" className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
              {INVITE_NOTE[invite.state]}
            </p>
          )}
          {invite && invite.unscored > 0 && (
            <p role="status" className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
              {invite.unscored} invite-link result{invite.unscored === 1 ? ' is' : 's are'} saved but not scored yet, so {invite.unscored === 1 ? 'it is' : 'they are'} not
              on the sheet: the answer key is not open on this account. See “Answer protection” in the Bi-Weekly Tests panel above, then press Refresh.
            </p>
          )}
          {earlier > 0 && (
            <p role="status" className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
              {earlier} result{earlier === 1 ? ' was' : 's were'} recorded for an <b className="text-white">earlier version</b> of a test (a different number of
              questions). {earlier === 1 ? 'It is' : 'They are'} kept and marked in the <b className="text-white">Note</b> column — {earlier === 1 ? 'it is' : 'they are'} not
              {earlier === 1 ? ' a result' : ' results'} of the test as it is today.
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            One live tab per test — right-click any cell for the tool menu, add your own grading columns, and
            download the workbook whenever you want a copy for Excel, Google Sheets or printing.
          </p>

          <LiveScoresSheet attempts={attempts} />

          {groups.length === 0 && (
            <p className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-3 text-[11px] leading-relaxed text-slate-400">
              No bi-weekly attempts yet. Share a test link from the planner hub — when students finish,
              their scores appear here and in the spreadsheet automatically.
            </p>
          )}
        </>
      )}
    </div>
  );
};
