import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  attemptsToRows, blankRows, clearRange, deleteCol, deleteRows, gridToCsv,
  gridWorkbookXml, gridWidth, insertColAt, insertRowAt, normalizeWidth,
  parseTsv, pasteIntoRange, rangeTsv, setCell, sortByColumn, syncServerRows,
  loadSheetStorage, saveSheetStorage, clearSheetStorage, allSel,
} from '../lib/liveSheet';
import type { BiweeklyAttempt } from '../lib/biweeklyScores';
import type { SheetRow } from '../lib/liveSheet';

const attempt = (over: Partial<BiweeklyAttempt> = {}): BiweeklyAttempt => ({
  studentName: 'Sok Dara',
  drillTitle: 'Week 4 · Reading',
  drillSlug: 'week4-reading.html',
  classId: 'KID 11 A',
  scorePct: 80,
  correctCount: 8,
  totalCount: 10,
  submittedAt: '2026-11-08T02:30:00.000Z',
  ...over,
});

/** Test grid: header row sized to the data (the header defines the width). */
const grid = (data: string[][]): SheetRow[] => {
  const w = Math.max(1, ...data.map((r) => r.length));
  return [
    { cells: ['Student', 'Class', 'Score %', 'Correct', 'Total', 'Submitted'].slice(0, w) },
    ...data.map((cells) => ({ cells })),
  ];
};

afterEach(() => vi.unstubAllGlobals());

describe('liveSheet — grid model', () => {
  it('attemptsToRows: header row + one signed row per attempt', () => {
    const rows = attemptsToRows([attempt(), attempt({ studentName: 'Chan S' })]);
    expect(rows).toHaveLength(3);
    expect(rows[0].cells).toEqual(['Student', 'Class', 'Score %', 'Correct', 'Total', 'Submitted', 'Note']);
    expect(rows[1].cells[0]).toBe('Sok Dara');
    expect(rows[1].cells[6]).toBe(''); // no remark for an ordinary result
    expect(rows[1].cells[2]).toBe('80');
    expect(rows[1].sig).toBeTruthy();
    expect(rows[2].sig).not.toBe(rows[1].sig);
  });

  it('insertRowAt never moves the header; deleteRows keeps at least one row', () => {
    const rows = grid([['a'], ['b']]);
    const grown = insertRowAt(rows, 99); // clamps to append
    expect(grown).toHaveLength(4);
    expect(grown[3].cells.every((c) => c === '')).toBe(true);
    const atOne = insertRowAt(rows, 0); // clamps below the header
    expect(atOne[0].cells[0]).toBe('Student');
    const fewer = deleteRows(rows, 0, 2); // header range is guarded
    expect(fewer).toHaveLength(2); // header + last row survives
    expect(fewer[0].cells[0]).toBe('Student');
    expect(deleteRows(grid([['only']]), 1, 1)).toHaveLength(2); // never empties the sheet
  });

  it('insert/delete columns change the width, never below one column', () => {
    const rows = grid([['a', 'b'], ['c', 'd']]);
    const wider = insertColAt(rows, 1);
    expect(gridWidth(wider)).toBe(3);
    expect(wider[1].cells).toEqual(['a', '', 'b']);
    const narrower = deleteCol(wider, 1);
    expect(narrower[1].cells).toEqual(['a', 'b']);
    const single = grid([['x']]);
    expect(deleteCol(single, 0)).toBe(single); // refuses to empty the sheet
    expect(gridWidth(deleteCol(rows, 99))).toBe(2); // out-of-range is a no-op
  });

  it('setCell writes one cell, grows columns, and keeps blank rows below', () => {
    const rows = grid([['a', 'b']]);
    const set = setCell(rows, 1, 1, 'Z');
    expect(set[1].cells[1]).toBe('Z');
    const grown = setCell(rows, 1, 5, 'edge');
    expect(gridWidth(grown)).toBe(6);
    const auto = setCell(grid([['x']]), 1, 0, 'typed', true);
    expect(auto.length).toBe(5); // 1 header + edited row + 3 blanks
    expect(setCell([], 0, 0, 'x')).toHaveLength(0);
  });

  it('clearRange empties only the selection rectangle', () => {
    const rows = grid([['a', 'b'], ['c', 'd']]);
    const cleared = clearRange(rows, { r1: 1, c1: 1, r2: 2, c2: 1 });
    expect(cleared[1].cells).toEqual(['a', '']);
    expect(cleared[2].cells).toEqual(['c', '']);
    expect(cleared[0].cells[0]).toBe('Student');
  });

  it('allSel covers every data row and column but starts below the header', () => {
    const rows = grid([['a'], ['b'], ['c']]);
    const s = allSel(rows);
    expect(s).toEqual({ r1: 1, c1: 0, r2: 3, c2: 0 });
  });
});

describe('liveSheet — clipboard (Excel TSV dialect)', () => {
  it('rangeTsv emits tabs between cells and newlines between rows', () => {
    const tsv = rangeTsv(grid([['a', 'b'], ['c', 'd']]), { r1: 1, c1: 0, r2: 2, c2: 1 });
    expect(tsv).toBe('a\tb\nc\td');
  });

  it('rangeTsv quotes fields with tabs, newlines and quotes', () => {
    const tsv = rangeTsv(grid([['He said "hi"', 'a\tb', 'multi\nline']]), { r1: 1, c1: 0, r2: 1, c2: 2 });
    expect(tsv).toBe('"He said ""hi"""\t"a\tb"\t"multi\nline"');
  });

  it('parseTsv understands Excel quoting: "" escapes, tabs & newlines in quotes', () => {
    expect(parseTsv('"a""b"\t2')).toEqual([['a"b', '2']]);
    expect(parseTsv('x\ty\n"multi\nline"\tz')).toEqual([['x', 'y'], ['multi\nline', 'z']]);
    expect(parseTsv('a\t\r\nb')).toEqual([['a', ''], ['b']]); // CRLF + trailing tab
    expect(parseTsv('')).toEqual([]);
  });

  it('pasteIntoRange overwrites at the anchor, grows rows and columns', () => {
    const rows = grid([['a', 'b'], ['c', 'd']]);
    const { rows: next, sel } = pasteIntoRange(
      rows,
      [['X', 'Y'], ['1', '2']],
      { r: 2, c: 1 },
    );
    expect(sel).toEqual({ r1: 2, c1: 1, r2: 3, c2: 2 });
    expect(gridWidth(next)).toBe(3);
    expect(next).toHaveLength(4); // grew from 3 rows to cover the block
    expect(next[2].cells).toEqual(['c', 'X', 'Y']);
    expect(next[3].cells).toEqual(['', '1', '2']);
  });
});

describe('liveSheet — sorting', () => {
  it('sorts numbers numerically, text alphabetically, blanks always last', () => {
    const numeric = grid([['5'], ['100'], [''], ['23']]);
    expect(sortByColumn(numeric, 0, 'asc').slice(1).map((r) => r.cells[0]))
      .toEqual(['5', '23', '100', '']);
    expect(sortByColumn(numeric, 0, 'desc').slice(1).map((r) => r.cells[0]))
      .toEqual(['100', '23', '5', '']);
    const text = grid([['banana'], ['Apple'], ['cherry']]);
    expect(sortByColumn(text, 0, 'asc').slice(1).map((r) => r.cells[0]))
      .toEqual(['Apple', 'banana', 'cherry']);
  });

  it('keeps the header row in place and stays stable for equal keys', () => {
    const rows = grid([['b', '1'], ['a', '2'], ['b', '3']]);
    const sorted = sortByColumn(rows, 0, 'asc');
    expect(sorted[0].cells[0]).toBe('Student');
    expect(sorted[1].cells).toEqual(['a', '2']);
    expect(sorted[2].cells).toEqual(['b', '1']);
    expect(sorted[3].cells).toEqual(['b', '3']);
    expect(sortByColumn(rows, 0, 'asc')).toHaveLength(4);
  });
});

describe('liveSheet — server sync', () => {
  it('adds only attempts the grid does not have yet (matched by sig)', () => {
    const a1 = attempt();
    const a2 = attempt({ studentName: 'Chan S', submittedAt: '2026-11-09T10:00:00.000Z' });
    const rows = [...attemptsToRows([a1]), ...blankRows(24, 6)];
    const { rows: next, added } = syncServerRows(rows, [a1, a2]);
    expect(added).toBe(1);
    expect(next.some((r) => r.sig === rows[1].sig)).toBe(true);
    expect(next.filter((r) => r.sig)).toHaveLength(2);
    expect(next[next.length - 1].cells.every((c) => c === '')).toBe(true); // blanks re-added
  });

  // A teacher watches a student finish and presses Refresh: the new result
  // must be the first row under the header, not below every older row.
  it('puts new attempts directly under the header, newest first', () => {
    const old1 = attempt({ studentName: 'Old One', submittedAt: '2026-11-01T10:00:00.000Z' });
    const old2 = attempt({ studentName: 'Old Two', submittedAt: '2026-11-02T10:00:00.000Z' });
    const new1 = attempt({ studentName: 'New One', submittedAt: '2026-11-14T09:00:00.000Z' });
    const new2 = attempt({ studentName: 'New Two', submittedAt: '2026-11-14T10:00:00.000Z' });
    const rows = [...attemptsToRows([old2, old1]), ...blankRows(24, 7)];
    const { rows: next, added } = syncServerRows(rows, [new1, old1, new2, old2]);
    expect(added).toBe(2);
    expect(next[0].cells[0]).toBe('Student');
    expect(next.slice(1, 5).map((r) => r.cells[0])).toEqual(['New Two', 'New One', 'Old Two', 'Old One']);
  });

  it('keeps rows and cells the teacher typed', () => {
    const a1 = attempt();
    let rows = [...attemptsToRows([a1]), ...blankRows(3, 7)];
    rows = setCell(rows, 1, 0, 'Sok Dara (resit)');
    rows = setCell(rows, 2, 0, 'my own row');
    const a2 = attempt({ studentName: 'Chan S', submittedAt: '2026-11-09T10:00:00.000Z' });
    const { rows: next } = syncServerRows(rows, [a1, a2]);
    expect(next.map((r) => r.cells[0]).slice(0, 4)).toEqual(['Student', 'Chan S', 'Sok Dara (resit)', 'my own row']);
  });

  // The owner's report: an old "4 of 9" row sat in the sheet (cached in the
  // browser) with nothing to say it belonged to the 9-question version of
  // a test that now has 23 questions.
  it('labels a row that is already on the sheet when the server has a remark for it', () => {
    const old = attempt({ drillTitle: 'Orientation Diagnostic', drillSlug: 'diagnostic.html', scorePct: 44, correctCount: 4, totalCount: 9 });
    const cached = [...attemptsToRows([old]).map((r) => ({ ...r, cells: r.cells.slice(0, 6) })), ...blankRows(2, 6)]; // sheet saved before the Note column existed
    expect(gridWidth(cached)).toBe(6);
    const note = 'Earlier version of this test (9 questions; it now has 23)';
    const { rows: next, added } = syncServerRows(cached, [{ ...old, note }]);
    expect(added).toBe(0);
    expect(next[0].cells[6]).toBe('Note');
    expect(next[1].cells.slice(3, 7)).toEqual(['4', '9', next[1].cells[5], note]);
    // idempotent: a second refresh changes nothing
    expect(syncServerRows(next, [{ ...old, note }]).rows).toBe(next);
  });

  it('never overwrites a column the teacher added: the Note goes to its own column', () => {
    const old = attempt({ totalCount: 9 });
    let rows = attemptsToRows([old]).map((r) => ({ ...r, cells: r.cells.slice(0, 6) }));
    rows = setCell(rows, 0, 6, 'My grade', true);
    rows = setCell(rows, 1, 6, 'B+', true);
    const { rows: next } = syncServerRows(rows, [{ ...old, note: 'Earlier version' }]);
    expect(next[0].cells.slice(6)).toEqual(['My grade', 'Note']);
    expect(next[1].cells.slice(6)).toEqual(['B+', 'Earlier version']);
  });

  it('a new attempt with a remark carries it in the Note column', () => {
    const rows = [...attemptsToRows([attempt()]), ...blankRows(2, 7)];
    const fresh = attempt({ studentName: 'Chan S', submittedAt: '2026-11-09T10:00:00.000Z', note: 'Earlier version' });
    const { rows: next } = syncServerRows(rows, [attempt(), fresh]);
    expect(next[1].cells[0]).toBe('Chan S');
    expect(next[1].cells[6]).toBe('Earlier version');
  });

  it('reports zero adds when everything is already there', () => {
    const rows = attemptsToRows([attempt()]);
    expect(syncServerRows(rows, [attempt()]).added).toBe(0);
  });
});

describe('liveSheet — browser persistence', () => {
  it('saves, loads and clears tab grids (round-trip)', () => {
    const backing = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string): string | null => (backing.has(k) ? backing.get(k) ?? null : null),
      setItem: (k: string, v: string): void => { backing.set(k, String(v)); },
      removeItem: (k: string): void => { backing.delete(k); },
    });
    const rows = grid([['Sok', '80']]);
    saveSheetStorage('week4-reading.html', rows);
    const loaded = loadSheetStorage('week4-reading.html');
    expect(loaded).toEqual(rows);
    clearSheetStorage('week4-reading.html');
    expect(loadSheetStorage('week4-reading.html')).toBeNull();
    expect(loadSheetStorage('missing')).toBeNull();
  });

  it('rejects corrupted storage payloads instead of crashing', () => {
    const backing = new Map<string, string>([['cmc.liveSheet.v1.bad', '{"v":2,"rows":[]}']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string): string | null => backing.get(k) ?? null,
      setItem: (): void => undefined,
      removeItem: (): void => undefined,
    });
    expect(loadSheetStorage('bad')).toBeNull();
  });
});

describe('liveSheet — workbook export', () => {
  it('emits an Excel workbook with one landscape sheet per tab', () => {
    const xml = gridWorkbookXml([
      { title: 'Week 4 · Reading', rows: grid([['Sok', '', '80']]) },
      { title: 'Week 5 · Grammar', rows: [...attemptsToRows([]), ...blankRows(4, 6)] },
    ]);
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect((xml.match(/<Worksheet /g) ?? []).length).toBe(2);
    expect((xml.match(/x:Orientation="Landscape"/g) ?? []).length).toBe(2);
    expect(xml).toContain('<FreezePanes/>');
    expect(xml).toContain('<Data ss:Type="Number">80</Data>');
  });

  it('escapes XML-unsafe text and sanitizes sheet names', () => {
    const xml = gridWorkbookXml([
      { title: 'Grammar: <Modals> & If', rows: grid([['A <B> & "C"']]) },
    ]);
    expect(xml).toContain('A &lt;B&gt; &amp; &quot;C&quot;');
    expect(xml).not.toContain('<Modals>');
    expect(xml).toMatch(/ss:Name="Grammar Modals &amp; If"/);
  });

  it('falls back to one empty Scores sheet when there are no tabs', () => {
    const xml = gridWorkbookXml([]);
    expect((xml.match(/<Worksheet /g) ?? []).length).toBe(1);
    expect(xml).toContain('No attempts yet');
  });

  it('gridToCsv writes a BOM and quotes commas', () => {
    const csv = gridToCsv(grid([['Doe, Jane', '80']]));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Doe, Jane",80');
  });
});

describe('liveSheet — normalizeWidth', () => {
  it('pads short rows and trims long ones', () => {
    const rows = normalizeWidth(
      [{ cells: ['a'] }, { cells: ['b', 'c', 'd', 'e'] }],
      3,
    );
    expect(rows[0].cells).toEqual(['a', '', '']);
    expect(rows[1].cells).toEqual(['b', 'c', 'd']);
  });
});
