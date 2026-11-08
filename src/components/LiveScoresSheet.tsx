// LiveScoresSheet — the teacher's bi-weekly scores as a real Excel-style
// grid, live in the dashboard. One colored tab per test (matching the .xls
// workbook), fully editable cells, and a Canva-style right-click tool menu:
// copy / paste (TSV — works with Excel & Google Sheets), clear, insert &
// delete rows and columns, sort, reset. Fullscreen-safe keyboard model
// (arrows, Enter, Tab, Del, Ctrl+Z/Y/A). Edits auto-save in the browser.
//
// Server rows carry a signature; a refresh only APPENDS attempts the
// teacher doesn't have yet, so manual rows and edits always survive.

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ClipboardPaste, Copy, Download,
  Eraser, FileSpreadsheet, Redo2, RotateCcw, SortAsc, SortDesc, Trash2, Undo2,
} from 'lucide-react';
import { groupByTest, TAB_COLOR_CSS, downloadBlob, scoresFileName } from '../lib/biweeklyScores';
import type { BiweeklyAttempt } from '../lib/biweeklyScores';
import {
  allSel, attemptsToRows, BLANK_ROWS, blankRows, clearRange, clearSheetStorage,
  DEFAULT_HEADERS, deleteCol, deleteRows, gridToCsv, gridWorkbookXml, gridWidth,
  insertColAt, insertRowAt, loadSheetStorage, normSel, parseTsv, pasteIntoRange,
  rangeTsv, saveSheetStorage, setCell, sortByColumn, syncServerRows,
} from '../lib/liveSheet';
import type { LiveSheetTab, Selection, SheetRow } from '../lib/liveSheet';

interface MenuPos { x: number; y: number; r: number; c: number }
interface EditState { r: number; c: number; value: string }

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(hi, lo));

const colPx = (c: number): number =>
  c === 0 ? 150 : c === 1 ? 90 : c >= 2 && c <= 4 ? 64 : c === 5 ? 118 : 100;

const MenuItem: React.FC<{
  icon: React.ReactNode; label: string; shortcut?: string;
  onClick: () => void; disabled?: boolean;
}> = ({ icon, label, shortcut, onClick, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
  >
    <span className="grid w-3.5 flex-none place-items-center text-slate-400">{icon}</span>
    <span className="flex-1">{label}</span>
    {shortcut && <span className="text-[9px] font-semibold tracking-wide text-slate-500">{shortcut}</span>}
  </button>
);

const MenuDivider: React.FC = () => <div className="mx-2 my-1 border-t border-white/10" />;

export const LiveScoresSheet: React.FC<{ attempts: BiweeklyAttempt[] }> = ({ attempts }) => {
  const [tabs, setTabs] = useState<LiveSheetTab[]>([]);
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState<Selection>({ r1: 1, c1: 0, r2: 1, c2: 0 });
  const [editing, setEditing] = useState<EditState | null>(null);
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SheetRow[][]>([]);
  const [redoStack, setRedoStack] = useState<SheetRow[][]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const touchTimer = useRef<number | null>(null);

  const tab = tabs[active];
  const rows = tab?.rows ?? [];
  const width = gridWidth(rows);
  const s = normSel(sel);

  /* Build tabs on first load; on refresh append only NEW attempts. */
  useEffect(() => {
    setTabs((prev) => {
      const groups = groupByTest(attempts);
      if (prev.length === 0) {
        return groups.map((g) => {
          const key = g.slug || g.title;
          const stored = loadSheetStorage(key);
          const base = stored
            ? syncServerRows(stored, g.rows).rows
            : [...attemptsToRows(g.rows), ...blankRows(BLANK_ROWS, DEFAULT_HEADERS.length)];
          return { key, title: g.title, rows: base };
        });
      }
      let next = prev.map((t) => {
        const g = groups.find((x) => (x.slug || x.title) === t.key);
        return g ? { ...t, title: g.title, rows: syncServerRows(t.rows, g.rows).rows } : t;
      });
      for (const g of groups) {
        const key = g.slug || g.title;
        if (!next.some((t) => t.key === key)) {
          next = [...next, {
            key,
            title: g.title,
            rows: [...attemptsToRows(g.rows), ...blankRows(BLANK_ROWS, DEFAULT_HEADERS.length)],
          }];
        }
      }
      return next;
    });
  }, [attempts]);

  /* Auto-save every tab in this browser. */
  useEffect(() => {
    for (const t of tabs) saveSheetStorage(t.key, t.rows);
  }, [tabs]);

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [hint]);

  const mutate = (fn: (rs: SheetRow[]) => SheetRow[]) => {
    const cur = tabs[active];
    if (!cur) return;
    setUndoStack((u) => [...u.slice(-49), cur.rows]);
    setRedoStack([]);
    setTabs((prev) => prev.map((t, i) => (i === active ? { ...t, rows: fn(t.rows) } : t)));
  };

  const undo = () => {
    const prevRows = undoStack[undoStack.length - 1];
    if (!tab || !prevRows) return;
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, tab.rows]);
    setTabs((p) => p.map((t, i) => (i === active ? { ...t, rows: prevRows } : t)));
  };
  const redo = () => {
    const nextRows = redoStack[redoStack.length - 1];
    if (!tab || !nextRows) return;
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, tab.rows]);
    setTabs((p) => p.map((t, i) => (i === active ? { ...t, rows: nextRows } : t)));
  };

  const switchTab = (i: number) => {
    setEditing(null); setMenu(null);
    setUndoStack([]); setRedoStack([]);
    setActive(i);
    setSel({ r1: 1, c1: 0, r2: 1, c2: 0 });
  };

  /* ── editing ─────────────────────────────────────────────────────── */

  const startEdit = (r: number, c: number, seed?: string) => {
    const row = rows[r];
    if (!row) return;
    setEditing({ r, c, value: seed !== undefined ? seed : row.cells[c] ?? '' });
  };

  const commitEdit = (move: 'down' | 'right' | 'none') => {
    if (!editing) return;
    const { r, c, value } = editing;
    setEditing(null);
    mutate((rs) => setCell(rs, r, c, value, true));
    if (move === 'down') {
      const lastValid = value.trim() !== '' && r === rows.length - 1 ? rows.length : rows.length - 1;
      const nr = clamp(r + 1, 0, lastValid);
      setSel({ r1: nr, c1: c, r2: nr, c2: c });
    } else if (move === 'right') {
      const nc = clamp(c + 1, 0, width - 1);
      setSel({ r1: r, c1: nc, r2: r, c2: nc });
    }
  };

  /* ── clipboard ───────────────────────────────────────────────────── */

  const doPaste = (text: string) => {
    const block = parseTsv(text);
    const anchor = { r: s.r1, c: s.c1 };
    const { rows: nextRows, sel: nextSel } = pasteIntoRange(rows, block, anchor);
    mutate(() => nextRows);
    setSel(nextSel);
    setHint(`Pasted ${block.length} row${block.length === 1 ? '' : 's'}.`);
  };

  const onCopyEvt = (e: React.ClipboardEvent) => {
    if (editing) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', rangeTsv(rows, sel));
  };
  const onCutEvt = (e: React.ClipboardEvent) => {
    if (editing) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', rangeTsv(rows, sel));
    mutate((rs) => clearRange(rs, sel));
  };
  const onPasteEvt = (e: React.ClipboardEvent) => {
    if (editing) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    doPaste(text);
  };

  const actCopy = async () => {
    setMenu(null);
    try {
      await navigator.clipboard.writeText(rangeTsv(rows, sel));
      setHint('Copied — paste straight into Excel or Google Sheets.');
    } catch {
      setHint('Copy blocked by the browser — select the cells and press Ctrl+C.');
    }
  };
  const actPaste = async () => {
    setMenu(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text) doPaste(text);
      else setHint('The clipboard is empty.');
    } catch {
      setHint('The browser blocked clipboard read — press Ctrl+V instead.');
    }
  };

  /* ── tool actions (the right-click menu) ─────────────────────────── */

  const openMenu = (x: number, y: number, r: number, c: number) => {
    if (r < s.r1 || r > s.r2 || c < s.c1 || c > s.c2) setSel({ r1: r, c1: c, r2: r, c2: c });
    setMenu({ x, y, r, c });
  };

  const resetTab = () => {
    const cur = tabs[active];
    if (!cur) return;
    clearSheetStorage(cur.key);
    const g = groupByTest(attempts).find((x) => (x.slug || x.title) === cur.key);
    const fresh = g
      ? [...attemptsToRows(g.rows), ...blankRows(BLANK_ROWS, DEFAULT_HEADERS.length)]
      : [...attemptsToRows([]), ...blankRows(BLANK_ROWS, DEFAULT_HEADERS.length)];
    mutate(() => fresh); // resetting is undoable with Ctrl+Z
    setMenu(null);
    setHint('Tab reset to the server data.');
  };

  /* ── keyboard ────────────────────────────────────────────────────── */

  const step = (dr: number, dc: number, extend: boolean) => {
    setSel((prev) => {
      const nr = clamp(prev.r2 + dr, 0, rows.length - 1);
      const nc = clamp(prev.c2 + dc, 0, width - 1);
      return extend ? { ...prev, r2: nr, c2: nc } : { r1: nr, c1: nc, r2: nr, c2: nc };
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (menu) {
      if (e.key === 'Escape') setMenu(null);
      return;
    }
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
    if (mod && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); setSel(allSel(rows)); return; }
    if (editing) return; // the input manages its own keys
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); step(-1, 0, e.shiftKey); return;
      case 'ArrowDown': e.preventDefault(); step(1, 0, e.shiftKey); return;
      case 'ArrowLeft': e.preventDefault(); step(0, -1, e.shiftKey); return;
      case 'ArrowRight': e.preventDefault(); step(0, 1, e.shiftKey); return;
      case 'Tab': e.preventDefault(); step(0, e.shiftKey ? -1 : 1, false); return;
      case 'Enter': case 'F2': e.preventDefault(); startEdit(s.r1, s.c1); return;
      case 'Delete': case 'Backspace':
        e.preventDefault();
        mutate((rs) => clearRange(rs, sel));
        return;
      default:
        break;
    }
    if (!mod && e.key.length === 1 && s.r1 <= rows.length - 1) startEdit(s.r1, s.c1, e.key);
  };

  /* ── touch: long-press opens the tool menu ───────────────────────── */

  const touchStart = (r: number, c: number) => (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const x0 = t.clientX;
    const y0 = t.clientY;
    touchCancel();
    touchTimer.current = window.setTimeout(() => {
      openMenu(x0, y0, r, c);
      touchTimer.current = null;
    }, 550);
  };
  const touchCancel = () => {
    if (touchTimer.current !== null) {
      window.clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  /* ── exports ─────────────────────────────────────────────────────── */

  const exportCsv = () => {
    if (!tab) return;
    downloadBlob(
      gridToCsv(tab.rows),
      `cmc-live-sheet-${tab.key.replace(/\.html$/, '')}.csv`,
      'text/csv;charset=utf-8',
    );
  };
  const exportXls = () => {
    if (!tab) return;
    downloadBlob(
      gridWorkbookXml(tabs.map((t) => ({ title: t.title, rows: t.rows }))),
      scoresFileName('xls'),
      'application/vnd.ms-excel',
    );
  };

  /* ── render ──────────────────────────────────────────────────────── */

  if (tabs.length === 0) return null;

  const selStyle = (r: number, c: number): string => {
    const inSel = r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2;
    const anchor = r === sel.r1 && c === sel.c1;
    return [
      inSel ? 'bg-emerald-400/10' : '',
      anchor ? 'outline outline-1 -outline-offset-1 outline-emerald-300' : '',
    ].filter(Boolean).join(' ');
  };

  const multiRow = s.r2 > s.r1;

  const toolMenu = (m: MenuPos) => (
    <>
      <MenuItem icon={<Copy className="h-3 w-3" />} label="Copy" shortcut="Ctrl+C" onClick={() => void actCopy()} />
      <MenuItem icon={<ClipboardPaste className="h-3 w-3" />} label="Paste" shortcut="Ctrl+V" onClick={() => void actPaste()} />
      <MenuItem
        icon={<Eraser className="h-3 w-3" />} label="Clear contents" shortcut="Del"
        onClick={() => { mutate((rs) => clearRange(rs, sel)); setMenu(null); }}
      />
      <MenuDivider />
      <MenuItem
        icon={<ArrowUp className="h-3 w-3" />} label="Insert row above"
        onClick={() => { mutate((rs) => insertRowAt(rs, m.r)); setMenu(null); }}
      />
      <MenuItem
        icon={<ArrowDown className="h-3 w-3" />} label="Insert row below"
        onClick={() => { mutate((rs) => insertRowAt(rs, m.r + 1)); setMenu(null); }}
      />
      <MenuItem
        icon={<Trash2 className="h-3 w-3" />} label={multiRow ? `Delete rows ${s.r1}–${s.r2}` : 'Delete row'}
        disabled={m.r === 0}
        onClick={() => { mutate((rs) => deleteRows(rs, s.r1, s.r2)); setMenu(null); }}
      />
      <MenuDivider />
      <MenuItem
        icon={<ArrowLeft className="h-3 w-3" />} label="Insert column left"
        onClick={() => { mutate((rs) => insertColAt(rs, m.c)); setMenu(null); }}
      />
      <MenuItem
        icon={<ArrowRight className="h-3 w-3" />} label="Insert column right"
        onClick={() => { mutate((rs) => insertColAt(rs, m.c + 1)); setMenu(null); }}
      />
      <MenuItem
        icon={<Trash2 className="h-3 w-3" />} label="Delete column"
        disabled={width <= 1}
        onClick={() => { mutate((rs) => deleteCol(rs, m.c)); setMenu(null); }}
      />
      <MenuDivider />
      <MenuItem
        icon={<SortAsc className="h-3 w-3" />} label="Sort sheet A → Z"
        onClick={() => { mutate((rs) => sortByColumn(rs, m.c, 'asc')); setMenu(null); }}
      />
      <MenuItem
        icon={<SortDesc className="h-3 w-3" />} label="Sort sheet Z → A"
        onClick={() => { mutate((rs) => sortByColumn(rs, m.c, 'desc')); setMenu(null); }}
      />
      <MenuDivider />
      <MenuItem icon={<RotateCcw className="h-3 w-3" />} label="Reset tab to server data" onClick={resetTab} />
    </>
  );

  return (
    <div className="mt-4">
      {/* sheet tabs — colored like the workbook */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map((t, i) => {
          const count = t.rows.reduce(
            (n, r, ri) => (ri > 0 && r.cells.some((c) => c.trim() !== '') ? n + 1 : n), 0,
          );
          const on = i === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(i)}
              className={`flex flex-none items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-1.5 text-[11px] font-semibold transition ${
                on
                  ? 'border-transparent bg-white/10 text-white'
                  : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
              style={on ? { borderBottomColor: TAB_COLOR_CSS[i % TAB_COLOR_CSS.length] } : undefined}
            >
              <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: TAB_COLOR_CSS[i % TAB_COLOR_CSS.length] }} />
              <span className="max-w-[180px] truncate">{t.title}</span>
              <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${on ? 'bg-emerald-300/20 text-emerald-200' : 'bg-white/10 text-slate-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* toolbar */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button" onClick={undo} disabled={undoStack.length === 0}
          className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-35"
        ><Undo2 className="h-3 w-3" /> Undo</button>
        <button
          type="button" onClick={redo} disabled={redoStack.length === 0}
          className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-35"
        ><Redo2 className="h-3 w-3" /> Redo</button>
        <span className="flex-1" />
        <button
          type="button" onClick={exportCsv}
          className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:bg-white/10"
        ><Download className="h-3 w-3" /> This sheet (.csv)</button>
        <button
          type="button" onClick={exportXls}
          className="flex items-center gap-1 rounded-md bg-gradient-to-r from-emerald-400 to-cyan-500 px-2 py-1 text-[10px] font-bold text-slate-950 transition hover:-translate-y-px"
        ><FileSpreadsheet className="h-3 w-3" /> Workbook with my edits (.xls)</button>
      </div>

      {/* grid */}
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onCopy={onCopyEvt}
        onCut={onCutEvt}
        onPaste={onPasteEvt}
        className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-white/10 bg-slate-950/60 outline-none ring-emerald-300/40 focus:ring-1"
      >
        <table className="w-max min-w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-9 border-b border-r border-white/10 bg-slate-900 px-1 py-1.5 text-[9px] font-bold text-slate-500">#</th>
              {(rows[0]?.cells ?? []).map((h, c) => (
                <th
                  key={c}
                  style={{ minWidth: colPx(c), maxWidth: colPx(c) }}
                  onMouseDown={(e) => { if (e.button === 0) setSel({ r1: 0, c1: c, r2: 0, c2: c }); }}
                  onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, 0, c); }}
                  className={`sticky top-0 z-20 overflow-hidden whitespace-nowrap border-b border-r border-white/10 bg-slate-900 px-2 py-1.5 text-left font-bold text-slate-200 ${selStyle(0, c)}`}
                >
                  {h || <span className="text-slate-600">·</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, ri) => {
              const r = ri + 1;
              return (
                <tr key={r} className={ri % 2 === 1 ? 'bg-white/[0.02]' : ''}>
                  <td
                    onMouseDown={(e) => { if (e.button === 0) setSel({ r1: r, c1: 0, r2: r, c2: width - 1 }); }}
                    onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, r, 0); }}
                    className="sticky left-0 z-10 border-b border-r border-white/10 bg-slate-900 px-1 py-1 text-center align-middle text-[9px] font-bold text-slate-500"
                  >{r}</td>
                  {row.cells.map((cell, c) => {
                    const isEditing = editing?.r === r && editing?.c === c;
                    return (
                      <td
                        key={c}
                        style={{ minWidth: colPx(c), maxWidth: colPx(c) }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          if (editing && !isEditing) commitEdit('none');
                          if (e.shiftKey) setSel((p) => ({ ...p, r2: r, c2: c }));
                          else setSel({ r1: r, c1: c, r2: r, c2: c });
                          gridRef.current?.focus({ preventScroll: true });
                        }}
                        onDoubleClick={() => startEdit(r, c)}
                        onContextMenu={(e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, r, c); }}
                        onTouchStart={touchStart(r, c)}
                        onTouchMove={touchCancel}
                        onTouchEnd={touchCancel}
                        className={`overflow-hidden whitespace-nowrap border-b border-r border-white/10 px-2 py-1 ${selStyle(r, c)} ${
                          c >= 2 && c <= 4 ? 'text-center' : ''
                        }`}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            onBlur={() => commitEdit('none')}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') { e.preventDefault(); commitEdit('down'); }
                              else if (e.key === 'Tab') { e.preventDefault(); commitEdit('right'); }
                              else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                            }}
                            className="w-full bg-transparent font-semibold text-white outline-none"
                          />
                        ) : (
                          <span className={cell.trim() === '' ? 'text-slate-700' : 'text-slate-200'}>{cell || ''}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        Right-click any cell (or long-press on touch) for the tool menu — copy, paste, insert / delete rows
        &amp; columns, sort. Ctrl+C / Ctrl+V swap data with Excel &amp; Google Sheets. Edits auto-save in this
        browser; the server only ever adds new attempts.
      </p>
      {hint && (
        <p className="mt-1 text-[10px] font-bold text-emerald-300">{hint}</p>
      )}

      {/* right-click tool menu */}
      {menu && (
        <div
          className="fixed inset-0 z-50"
          onMouseDown={() => setMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
        >
          <div
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute w-56 rounded-xl border border-white/10 bg-slate-950/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur"
            style={{
              left: clamp(menu.x, 8, window.innerWidth - 236),
              top: clamp(menu.y, 8, window.innerHeight - 430),
            }}
          >
            {toolMenu(menu)}
          </div>
        </div>
      )}
    </div>
  );
};
