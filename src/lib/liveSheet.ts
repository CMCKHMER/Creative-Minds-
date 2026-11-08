// Live teacher sheet — the bi-weekly scores as a real, editable Excel-style
// grid inside the dashboard (right-click tool menu, clipboard that speaks
// TSV with Excel/Google Sheets, per-test colored tabs, edits auto-saved in
// the teacher's browser).
//
// This module is the pure model: rows, selection math, insert/delete,
// sorting, TSV copy/paste (with Excel's quoted-field dialect), server-row
// sync and the SpreadsheetML export. No DOM here — vitest runs it in node.

import { groupByTest, fmtWhen, xmlEsc, sheetName, type BiweeklyAttempt } from './biweeklyScores';

export interface SheetRow {
  cells: string[];
  /** Server-row signature (student+test+timestamp). Rows the teacher typed
   *  themselves have no sig — sync only ever appends signed rows, so manual
   *  rows and edits survive a refresh. */
  sig?: string;
}

export interface LiveSheetTab {
  /** Stable key: drill slug or test title. */
  key: string;
  title: string;
  rows: SheetRow[];
}

export interface Selection {
  r1: number; c1: number; r2: number; c2: number;
}

export const DEFAULT_HEADERS = ['Student', 'Class', 'Score %', 'Correct', 'Total', 'Submitted'];
export const BLANK_ROWS = 24;
const LS_PREFIX = 'cmc.liveSheet.v1.';
const NUM_RE = /^-?\d+(\.\d+)?$/;

/* ── row helpers ────────────────────────────────────────────────────── */

const rowSig = (a: BiweeklyAttempt): string =>
  JSON.stringify([a.studentName, a.drillSlug || a.drillTitle, a.submittedAt]);

function attemptRow(a: BiweeklyAttempt, width: number): SheetRow {
  const cells = [
    a.studentName || 'Unknown',
    a.classId || '',
    String(a.scorePct),
    String(a.correctCount),
    String(a.totalCount),
    fmtWhen(a.submittedAt),
  ];
  while (cells.length < width) cells.push('');
  return { cells, sig: rowSig(a) };
}

/** Grid rows for one test: header + one row per attempt (newest first). */
export function attemptsToRows(attempts: BiweeklyAttempt[]): SheetRow[] {
  return [
    { cells: [...DEFAULT_HEADERS] },
    ...attempts.map((a) => attemptRow(a, DEFAULT_HEADERS.length)),
  ];
}

export const blankRow = (cols: number): SheetRow =>
  ({ cells: Array.from({ length: Math.max(cols, 1) }, () => '') });

export const blankRows = (n: number, cols: number): SheetRow[] =>
  Array.from({ length: Math.max(n, 0) }, () => blankRow(cols));

export function cloneRows(rows: SheetRow[]): SheetRow[] {
  return rows.map((r) => ({ cells: [...r.cells], sig: r.sig }));
}

/** Widest row length — the sheet's column count (never below 1). */
export function gridWidth(rows: SheetRow[]): number {
  return rows.reduce((w, r) => Math.max(w, r.cells.length), 1);
}

/** Pad (or trim) every row to exactly `width` columns. */
export function normalizeWidth(rows: SheetRow[], width: number): SheetRow[] {
  const w = Math.max(width, 1);
  return rows.map((r) => {
    if (r.cells.length === w) return r;
    const cells = r.cells.slice(0, w);
    while (cells.length < w) cells.push('');
    return { ...r, cells };
  });
}

const isBlankRow = (r: SheetRow): boolean => r.cells.every((c) => c.trim() === '');

/* ── structural edits ───────────────────────────────────────────────── */

/** Insert a blank row at `index`; the header (row 0) never moves. */
export function insertRowAt(rows: SheetRow[], index: number): SheetRow[] {
  const at = Math.min(Math.max(index, 1), rows.length);
  const next = cloneRows(rows);
  next.splice(at, 0, blankRow(gridWidth(rows)));
  return next;
}

/** Delete rows `from..to` inclusive; header row is untouchable. */
export function deleteRows(rows: SheetRow[], from: number, to: number): SheetRow[] {
  if (rows.length <= 1) return rows;
  const lo = Math.max(from, 1);
  const hi = Math.min(to, rows.length - 1);
  if (lo > hi) return rows;
  const next = cloneRows(rows);
  next.splice(lo, hi - lo + 1);
  if (next.length === 1) next.push(blankRow(gridWidth(rows)));
  return next;
}

export function insertColAt(rows: SheetRow[], index: number): SheetRow[] {
  const at = Math.min(Math.max(index, 0), gridWidth(rows));
  return rows.map((r) => {
    const cells = [...r.cells];
    cells.splice(at, 0, '');
    return { ...r, cells };
  });
}

export function deleteCol(rows: SheetRow[], index: number): SheetRow[] {
  if (gridWidth(rows) <= 1) return rows;
  return rows.map((r) => {
    if (index < 0 || index >= r.cells.length) return r;
    const cells = [...r.cells];
    cells.splice(index, 1);
    return { ...r, cells };
  });
}

/** Set one cell; `grow` appends trailing blank rows when writing to the
 *  last row (Excel keeps a few empties below you). */
export function setCell(rows: SheetRow[], r: number, c: number, value: string, grow = false): SheetRow[] {
  if (rows.length === 0) return rows;
  const ri = Math.min(Math.max(r, 0), rows.length - 1);
  let next = cloneRows(rows);
  next = normalizeWidth(next, Math.max(gridWidth(next), c + 1));
  next[ri] = { ...next[ri], cells: next[ri].cells.map((old, i) => (i === c ? value : old)) };
  if (grow && value.trim() !== '' && ri === next.length - 1) {
    next = [...next, ...blankRows(3, gridWidth(next))];
  }
  return next;
}

/* ── selection, copy & paste ────────────────────────────────────────── */

export const normSel = (s: Selection): Selection => ({
  r1: Math.min(s.r1, s.r2), c1: Math.min(s.c1, s.c2),
  r2: Math.max(s.r1, s.r2), c2: Math.max(s.c1, s.c2),
});

/** Whole-sheet selection below the header (Ctrl+A). */
export const allSel = (rows: SheetRow[]): Selection =>
  ({ r1: 1, c1: 0, r2: Math.max(rows.length - 1, 1), c2: gridWidth(rows) - 1 });

export function clearRange(rows: SheetRow[], sel: Selection): SheetRow[] {
  const s = normSel(sel);
  return rows.map((row, r) => {
    if (r < s.r1 || r > s.r2) return row;
    if (!row.cells.some((_, c) => c >= s.c1 && c <= s.c2)) return row;
    return {
      ...row,
      cells: row.cells.map((v, c) => (c >= s.c1 && c <= s.c2 ? '' : v)),
    };
  });
}

/** Selected block as TSV (the dialect Excel + Google Sheets speak). */
export function rangeTsv(rows: SheetRow[], sel: Selection): string {
  const s = normSel(sel);
  const out: string[] = [];
  for (let r = Math.max(s.r1, 0); r <= Math.min(s.r2, rows.length - 1); r++) {
    const line: string[] = [];
    for (let c = s.c1; c <= s.c2; c++) line.push(tsvField(rows[r].cells[c] ?? ''));
    out.push(line.join('\t'));
  }
  return out.join('\n');
}

const tsvField = (v: string): string =>
  /["\t\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

/** Parse pasted TSV. Understands Excel's quoting: "a""b" → a"b and
 *  quoted fields may contain tabs and newlines. */
export function parseTsv(text: string): string[][] {
  let src = text.startsWith('\uFEFF') ? text.slice(1) : text;
  src = src.replace(/\r\n?/g, '\n');
  if (src === '') return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let pending = false;

  const pushField = () => { row.push(field); field = ''; quoted = false; };
  const pushRow = () => { pushField(); rows.push(row); row = []; pending = false; };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') { quoted = true; pending = true; continue; }
    if (ch === '\t') { pushField(); pending = true; continue; }
    if (ch === '\n') { pushRow(); continue; }
    field += ch; pending = true;
  }
  if (pending) pushRow();
  return rows.length > 0 ? rows : [['']];
}

/** Paste a TSV block with its top-left corner at the anchor; grows columns
 *  and appends blank rows as needed. Returns the covered selection. */
export function pasteIntoRange(
  rows: SheetRow[],
  block: string[][],
  anchor: { r: number; c: number },
): { rows: SheetRow[]; sel: Selection } {
  const h = block.length;
  const w = block.reduce((m, r) => Math.max(m, r.length), 1);
  const width = Math.max(gridWidth(rows), anchor.c + w);

  const next = normalizeWidth(cloneRows(rows), width);
  while (next.length < anchor.r + h) next.push(blankRow(width));
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      next[anchor.r + i].cells[anchor.c + j] = block[i][j] ?? '';
    }
  }
  return {
    rows: next,
    sel: { r1: anchor.r, c1: anchor.c, r2: anchor.r + h - 1, c2: anchor.c + w - 1 },
  };
}

/* ── sorting ────────────────────────────────────────────────────────── */

/** Stable sort of the data rows by one column; the header stays put and
 *  empty cells always land at the bottom (Excel behavior). */
export function sortByColumn(rows: SheetRow[], col: number, dir: 'asc' | 'desc'): SheetRow[] {
  if (rows.length <= 2) return rows;
  const val = (r: SheetRow): string => (r.cells[col] ?? '').trim();
  const data = rows.slice(1);

  const allNum = data.every((r) => val(r) === '' || NUM_RE.test(val(r)));
  const base = allNum
    ? (a: SheetRow, b: SheetRow): number => (parseFloat(val(a) || '0') - parseFloat(val(b) || '0'))
    : (a: SheetRow, b: SheetRow): number =>
        val(a).localeCompare(val(b), undefined, { sensitivity: 'base', numeric: true });

  const keyed = data.map((r, i) => ({ r, i, empty: val(r) === '' }));
  keyed.sort((A, B) => {
    if (A.empty !== B.empty) return A.empty ? 1 : -1;
    const c = base(A.r, B.r);
    return (dir === 'asc' ? c : -c) || A.i - B.i;
  });
  return [rows[0], ...keyed.map((k) => k.r)];
}

/* ── server sync & persistence ──────────────────────────────────────── */

/** Append attempts the teacher's grid doesn't have yet (matched by sig);
 *  trailing blank rows are trimmed first and re-added after. */
export function syncServerRows(
  rows: SheetRow[],
  attempts: BiweeklyAttempt[],
): { rows: SheetRow[]; added: number } {
  const present = new Set(rows.map((r) => r.sig).filter((s): s is string => typeof s === 'string'));
  const missing = attempts.filter((a) => !present.has(rowSig(a)));
  if (missing.length === 0) return { rows, added: 0 };

  const width = Math.max(gridWidth(rows), DEFAULT_HEADERS.length);
  let next = normalizeWidth(cloneRows(rows), width);
  let end = next.length;
  while (end > 1 && isBlankRow(next[end - 1])) end--;
  next = next.slice(0, end);
  for (const a of missing) next.push(attemptRow(a, width));
  while (next.length - 1 < BLANK_ROWS) next.push(blankRow(width));
  return { rows: next, added: missing.length };
}

/** Build the tab list for a batch of attempts (one tab per test). */
export function tabsForAttempts(attempts: BiweeklyAttempt[]): Array<{ key: string; title: string; rows: SheetRow[] }> {
  return groupByTest(attempts).map((g) => ({
    key: g.slug || g.title,
    title: g.title,
    rows: [...attemptsToRows(g.rows), ...blankRows(BLANK_ROWS, DEFAULT_HEADERS.length)],
  }));
}

export const storageKey = (tabKey: string): string => LS_PREFIX + tabKey;

export function saveSheetStorage(tabKey: string, rows: SheetRow[]): void {
  try {
    localStorage.setItem(storageKey(tabKey), JSON.stringify({ v: 1, rows }));
  } catch {
    // private mode / quota exceeded — sheet still works for this session
  }
}

export function loadSheetStorage(tabKey: string): SheetRow[] | null {
  try {
    const raw = localStorage.getItem(storageKey(tabKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; rows?: SheetRow[] };
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed.rows.map((r) => ({
      cells: (Array.isArray(r.cells) ? r.cells : []).map((c) => String(c ?? '')),
      sig: typeof r.sig === 'string' ? r.sig : undefined,
    }));
  } catch {
    return null;
  }
}

export function clearSheetStorage(tabKey: string): void {
  try {
    localStorage.removeItem(storageKey(tabKey));
  } catch {
    // nothing to clean up
  }
}

/* ── export (SpreadsheetML + CSV), same look as biweeklyScores ──────── */

export function gridWorkbookXml(tabs: Array<{ title: string; rows: SheetRow[] }>): string {
  const cell = (v: string, style = ''): string => {
    const s = style ? ` ss:StyleID="${style}"` : '';
    return NUM_RE.test(v.trim())
      ? `<Cell${s}><Data ss:Type="Number">${v.trim()}</Data></Cell>`
      : `<Cell${s}><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`;
  };

  const sheets = (tabs.length ? tabs : [{ title: 'Scores', rows: [{ cells: [...DEFAULT_HEADERS] }] }])
    .map((t) => {
      const width = gridWidth(t.rows);
      const cols = Array.from({ length: width }, (_, i) =>
        `<Column ss:Width="${i === 0 ? 150 : i === 5 ? 110 : i < 6 ? [90, 52, 56, 48][i - 1] ?? 90 : 100}"/>`,
      ).join('');
      const body = t.rows
        .map((r) => `<Row>${r.cells.map((v) => cell(v)).join('')}</Row>`)
        .join('');
      const note = t.rows.length <= 1
        ? `<Row><Cell ss:StyleID="sNote"><Data ss:Type="String">No attempts yet — share the test link; scores appear here the moment students finish.</Data></Cell></Row>`
        : '';
      return `
 <Worksheet ss:Name="${xmlEsc(sheetName(t.title))}">
  <Table ss:DefaultRowHeight="18">${cols}${body}${note}</Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup><Layout x:Orientation="Landscape"/><PageMargins x:Bottom="0.5" x:Left="0.4" x:Right="0.4" x:Top="0.5"/></PageSetup>
   <Print><ValidPrinterInfo/><PaperSizeIndex>9</PaperSizeIndex><Scale>85</Scale></Print>
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><ss:Font ss:FontName="Calibri" ss:Size="11"/>
   <ss:Alignment ss:Vertical="Center"/><ss:Borders/></Style>
  <Style ss:ID="sHead"><ss:Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <ss:Interior ss:Pattern="Solid" ss:Color="#0F172A"/>
   <ss:Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="sNote"><ss:Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#64748B"/></Style>
 </Styles>
${sheets}
</Workbook>`;
}

const csvCell = (v: string): string =>
  /["\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

/** Active tab as CSV (BOM for Excel UTF-8). */
export function gridToCsv(rows: SheetRow[]): string {
  const lines = rows.map((r) => r.cells.map(csvCell).join(','));
  return '\uFEFF' + lines.join('\r\n');
}
