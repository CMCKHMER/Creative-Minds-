// Bi-Weekly Test Scores — the simple replacement for the retired
// "Bi-Weekly Private Tests" panel (key installs + assignments + live
// scoreboard). Students take the OPEN drill pages; every attempt already
// lands in the public `drill_attempts` collection (cmc-shared.js posts it
// with drillSource 'biweek-planner'). This card reads those rows and hands
// the teacher a real spreadsheet they own: one landscape tab per test,
// ready to open in Excel / Google Sheets, print, or keep grading in.

import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import {
  fetchBiweeklyAttempts, groupByTest, toCsv, toSpreadsheetXml,
  downloadBlob, scoresFileName, TAB_COLOR_CSS,
  type BiweeklyAttempt,
} from '../lib/biweeklyScores';

export const BiWeeklyScoresCard: React.FC = () => {
  const [attempts, setAttempts] = useState<BiweeklyAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setAttempts(await fetchBiweeklyAttempts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load scores — try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = attempts ? groupByTest(attempts) : [];
  const students = attempts ? new Set(attempts.map((a) => a.studentName)).size : 0;

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
    <div data-keep-dark className="mt-8 rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-slate-950/70 via-slate-950/60 to-slate-950/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-[var(--font-display)] text-lg font-bold text-white">Bi-Weekly Test Scores</h3>
            <p className="text-[11px] text-slate-400">
              Every open drill records its scores automatically — download the workbook and keep grading in your own spreadsheet.
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
            </span>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            The .xls workbook opens in Excel and Google Sheets with one landscape tab per test —
            add your own columns, keep your own records, print it. Re-download any time for the latest rows.
          </p>

          {groups.length > 0 && (
            <div className="mt-3 grid max-h-44 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {groups.map((g, i) => (
                <div key={g.title} className="flex items-center gap-2 rounded-lg border border-white/8 bg-slate-950/40 px-3 py-1.5">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: TAB_COLOR_CSS[i % TAB_COLOR_CSS.length] }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-200" title={g.title}>{g.title}</span>
                  <span className="text-[10px] font-bold text-slate-500">{g.rows.length}</span>
                </div>
              ))}
            </div>
          )}

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
