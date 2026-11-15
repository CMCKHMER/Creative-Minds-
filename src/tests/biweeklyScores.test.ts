import { describe, it, expect } from 'vitest';
import { annotateVersions, groupByTest, mergeAttempts, toCsv, toSpreadsheetXml, scoresFileName } from '../lib/biweeklyScores';
import type { BiweeklyAttempt } from '../lib/biweeklyScores';

const attempt = (over: Partial<BiweeklyAttempt> = {}): BiweeklyAttempt => ({
  studentName: 'Sok Dara',
  drillTitle: 'Week 4 · Reading: Genes, Health & Longevity',
  drillSlug: 'week4-reading.html',
  classId: 'KID 11 A',
  scorePct: 80,
  correctCount: 8,
  totalCount: 10,
  submittedAt: '2026-11-08T02:30:00.000Z',
  ...over,
});

describe('biweeklyScores — teacher spreadsheet export', () => {
  it('groups rows per test, most recently active test first', () => {
    const groups = groupByTest([
      attempt({ drillTitle: 'A test', submittedAt: '2026-11-01T00:00:00Z' }),
      attempt({ drillTitle: 'B test', submittedAt: '2026-11-05T00:00:00Z' }),
      attempt({ drillTitle: 'A test', submittedAt: '2026-11-06T00:00:00Z' }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(['A test', 'B test']);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].rows).toHaveLength(1);
  });

  it('builds one landscape worksheet per test with header + number cells', () => {
    const xml = toSpreadsheetXml([attempt(), attempt({ studentName: 'Chan S', drillTitle: 'Other' })]);
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect((xml.match(/<Worksheet /g) ?? []).length).toBe(2);
    // landscape page setup on every sheet
    expect((xml.match(/x:Orientation="Landscape"/g) ?? []).length).toBe(2);
    // frozen header row
    expect(xml).toContain('<FreezePanes/>');
    // numbers typed as Number cells
    expect(xml).toContain('<Data ss:Type="Number">80</Data>');
    // headers present
    expect(xml).toContain('>Student<');
    expect(xml).toContain('>Score %<');
  });

  it('escapes XML-unsafe text in titles and names', () => {
    const xml = toSpreadsheetXml([attempt({ studentName: 'A <B> & "C"', drillTitle: 'Grammar: <Modals> & If' })]);
    expect(xml).toContain('A &lt;B&gt; &amp; &quot;C&quot;');
    expect(xml).not.toContain('<Modals>');
    // sheet name: colons stripped, whitespace collapsed, ≤31 chars
    expect(xml).toMatch(/ss:Name="Grammar Modals &amp; If"/);
  });

  it('emits an empty Scores sheet when there are no attempts', () => {
    const xml = toSpreadsheetXml([]);
    expect((xml.match(/<Worksheet /g) ?? []).length).toBe(1);
    expect(xml).toContain('No attempts yet');
  });

  it('writes CSV with quoting and BOM', () => {
    const csv = toCsv([attempt({ studentName: 'Doe, Jane "JD"' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Doe, Jane ""JD"""');
    expect(csv).toContain('week4-reading.html');
  });

  it('merges the open drills and the invite results into one list, newest first', () => {
    const merged = mergeAttempts(
      [attempt({ studentName: 'open-old', submittedAt: '2026-11-01T00:00:00Z' })],
      [attempt({ studentName: 'invite-new', submittedAt: '2026-11-14T00:00:00Z', viaInvite: true })],
    );
    expect(merged.map((a) => a.studentName)).toEqual(['invite-new', 'open-old']);
  });

  it('marks results recorded for an earlier version of a test — and only those', () => {
    const counts = { diagnostic: { title: 'Orientation Diagnostic', kicker: '', total: 23, parts: [] } };
    const [old, current, unknown] = annotateVersions([
      attempt({ drillSlug: 'diagnostic.html', correctCount: 4, totalCount: 9 }),
      attempt({ drillSlug: 'diagnostic.html', correctCount: 17, totalCount: 23 }),
      attempt({ drillSlug: 'some-game', totalCount: 9 }),
    ], counts);
    expect(old.note).toBe('Earlier version of this test (9 questions; it now has 23)');
    expect(current.note).toBeUndefined();
    expect(unknown.note).toBeUndefined();
    // without the counts file nothing is flagged
    expect(annotateVersions([attempt({ drillSlug: 'diagnostic.html', totalCount: 9 })], null)[0].note).toBeUndefined();
  });

  it('the remark travels into the spreadsheet and the CSV', () => {
    const note = 'Earlier version of this test (9 questions; it now has 23)';
    const rows = [attempt({ note })];
    expect(toSpreadsheetXml(rows)).toContain(note);
    expect(toSpreadsheetXml(rows)).toContain('>Note<');
    expect(toCsv(rows)).toContain(note);
    expect(toCsv(rows).split('\r\n')[0]).toContain('Note');
  });

  it('datestamps the download filename', () => {
    expect(scoresFileName('xls')).toMatch(/^cmc-biweekly-scores-\d{4}-\d{2}-\d{2}\.xls$/);
  });
});
