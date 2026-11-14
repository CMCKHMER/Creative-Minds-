/**
 * Spreadsheet formula guard for CSV exports.
 *
 * Excel, Google Sheets and LibreOffice treat a cell that starts with
 * `=`, `+`, `-` or `@` (or a tab / carriage return before one) as a FORMULA.
 * The exports contain text typed by students and by anonymous visitors (the
 * guest score branch accepts any 1–40 character name), so a "name" such as
 * `=HYPERLINK("http://…","Click")` would run as a formula when a teacher
 * opens the downloaded file.
 *
 * The standard defence (OWASP "CSV injection") is to prefix such a cell with
 * an apostrophe, which every spreadsheet reads as "this is plain text".
 * Plain numbers — including negative ones like `-5` or `+3.5` — are left
 * alone so score columns still sort and sum.
 */
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?%?$/i;

export function csvSafeText(value: string | number | null | undefined): string {
  const s = String(value ?? '');
  if (!/^[=+\-@\t\r]/.test(s)) return s;
  if (PLAIN_NUMBER.test(s)) return s;
  return `'${s}`;
}
