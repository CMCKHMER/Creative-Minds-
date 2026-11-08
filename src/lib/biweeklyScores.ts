// Bi-Weekly test scores → the teacher's own spreadsheet.
//
// The OPEN bi-weekly drill pages (public/biweek-planner/tests/*.html) grade
// themselves in the browser and POST every attempt to the public
// `drill_attempts` collection through cmc-shared.js (drillSource:
// 'biweek-planner'). This module turns those rows into a real Excel workbook
// (SpreadsheetML 2003 .xls — opens natively in Microsoft Excel, Google Sheets
// and LibreOffice) with one landscape tab per test, so teachers keep scores
// in a spreadsheet they own — print it, add grading columns, share it —
// instead of a built-in scoreboard.

export interface BiweeklyAttempt {
  studentName: string;
  drillTitle: string;
  drillSlug: string;
  classId: string;
  scorePct: number;
  correctCount: number;
  totalCount: number;
  submittedAt: string; // ISO timestamp
}

const FIRESTORE_RUNQUERY =
  'https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents:runQuery';

/** Public read (firestore.rules → drill_attempts: allow read: if true) — no
 *  auth needed. Follows pageToken until every row is fetched, then sorts
 *  newest-first in the browser (avoids a composite index on where+orderBy). */
export async function fetchBiweeklyAttempts(): Promise<BiweeklyAttempt[]> {
  const rows: BiweeklyAttempt[] = [];
  let pageToken: string | undefined;

  do {
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: 'drill_attempts', allDescendants: false }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'drillSource' },
          op: 'EQUAL',
          value: { stringValue: 'biweek-planner' },
        },
      },
      limit: 800,
    };
    if (pageToken) structuredQuery.pageToken = pageToken;

    const res = await fetch(FIRESTORE_RUNQUERY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) throw new Error(`Firestore read failed (HTTP ${res.status})`);
    const payload = (await res.json()) as Array<{
      document?: { fields?: Record<string, Record<string, unknown>> };
      nextPageToken?: string;
    }>;

    for (const row of payload) {
      if (!row?.document?.fields) continue;
      const f = row.document.fields;
      const str = (k: string): string =>
        typeof f[k]?.stringValue === 'string' ? (f[k].stringValue as string) : '';
      const int = (k: string): number => {
        const raw = f[k]?.integerValue ?? f[k]?.doubleValue;
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
      };
      const ts = f.submittedAt?.timestampValue;
      rows.push({
        studentName: str('studentName') || 'Unknown',
        drillTitle: str('drillTitle') || str('drillSlug') || 'Bi-weekly test',
        drillSlug: str('drillSlug'),
        classId: str('classId'),
        scorePct: int('scorePct'),
        correctCount: int('correctCount'),
        totalCount: int('totalCount'),
        submittedAt: typeof ts === 'string' ? ts : '',
      });
    }
    pageToken = payload[payload.length - 1]?.nextPageToken;
  } while (pageToken);

  rows.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  return rows;
}

/** Group rows into one bucket per test, ordered by most recent activity. */
export function groupByTest(
  attempts: BiweeklyAttempt[],
): Array<{ title: string; slug: string; rows: BiweeklyAttempt[] }> {
  const map = new Map<string, { title: string; slug: string; rows: BiweeklyAttempt[] }>();
  for (const a of attempts) {
    const key = a.drillTitle || a.drillSlug || 'Bi-weekly test';
    let g = map.get(key);
    if (!g) {
      g = { title: key, slug: a.drillSlug, rows: [] };
      map.set(key, g);
    }
    g.rows.push(a);
  }
  return [...map.values()];
}

/* ── SpreadsheetML workbook ─────────────────────────────────────────── */

const xmlEsc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    // strip control chars XML 1.0 forbids
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const fmtWhen = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return xmlEsc(iso);
  // Excel-friendly local time
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Excel sheet names: ≤31 chars, no : \ / ? * [ ] (<> also stripped for tidiness) */
const sheetName = (title: string): string => {
  const clean = title.replace(/[:\\/?*[\]<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean || 'Sheet').slice(0, 31);
};

const HEADERS = ['Student', 'Class', 'Score %', 'Correct', 'Total', 'Submitted'];

function sheetXml(title: string, rows: BiweeklyAttempt[]): string {
  const cell = (v: string | number, style = ''): string => {
    const s = style ? ` ss:StyleID="${style}"` : '';
    if (typeof v === 'number') return `<Cell${s}><Data ss:Type="Number">${v}</Data></Cell>`;
    return `<Cell${s}><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`;
  };
  const rowHtml = (cells: string[]): string => `<Row>${cells.join('')}</Row>`;

  const body = rows
    .map((r) =>
      rowHtml([
        cell(r.studentName || 'Unknown'),
        cell(r.classId || '—'),
        cell(r.scorePct, 'sScore'),
        cell(r.correctCount),
        cell(r.totalCount),
        cell(fmtWhen(r.submittedAt)),
      ]),
    )
    .join('');

  const note =
    rows.length === 0
      ? `<Row><Cell ss:StyleID="sNote"><Data ss:Type="String">No attempts yet — share the test link; scores appear here the moment students finish.</Data></Cell></Row>`
      : '';

  return `
 <Worksheet ss:Name="${xmlEsc(sheetName(title))}">
  <Table ss:DefaultRowHeight="18">
   <Column ss:Width="150"/><Column ss:Width="90"/><Column ss:Width="52"/>
   <Column ss:Width="56"/><Column ss:Width="48"/><Column ss:Width="110"/>
   ${rowHtml(HEADERS.map((h) => cell(h, 'sHead')))}
   ${body}${note}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup><Layout x:Orientation="Landscape"/><PageMargins x:Bottom="0.5" x:Left="0.4" x:Right="0.4" x:Top="0.5"/></PageSetup>
   <Print><ValidPrinterInfo/><PaperSizeIndex>9</PaperSizeIndex><Scale>85</Scale></Print>
   <Selected/>
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
   <ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>`;
}

const TAB_CSS = ['#22d3ee', '#8b5cf6', '#34d399', '#fbbf24', '#f87171', '#60a5fa'];

/** Build the full SpreadsheetML workbook: one landscape tab per test. */
export function toSpreadsheetXml(attempts: BiweeklyAttempt[]): string {
  const groups = groupByTest(attempts);
  const sheets = groups.length
    ? groups.map((g) => sheetXml(g.title, g.rows)).join('')
    : sheetXml('Scores', []);

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
  <Style ss:ID="sScore"><ss:Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <ss:Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="sNote"><ss:Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#64748B"/></Style>
 </Styles>
${sheets}
</Workbook>`;
}

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Single-sheet CSV of every attempt (newest first), BOM for Excel UTF-8. */
export function toCsv(attempts: BiweeklyAttempt[]): string {
  const lines = [HEADERS.concat(['Test ID']).join(',')];
  for (const a of attempts) {
    lines.push(
      [a.studentName || 'Unknown', a.classId || '—', a.scorePct, a.correctCount, a.totalCount,
        fmtWhen(a.submittedAt), a.drillSlug].map(csvCell).join(','),
    );
  }
  return '\ufeff' + lines.join('\r\n');
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const scoresFileName = (ext: 'xls' | 'csv'): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `cmc-biweekly-scores-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`;
};

export const TAB_COLOR_CSS = TAB_CSS;
