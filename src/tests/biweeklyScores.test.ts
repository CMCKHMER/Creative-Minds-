import { describe, it, expect } from 'vitest';
import { groupByTest, toCsv, toSpreadsheetXml, scoresFileName } from '../lib/biweeklyScores';
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

  it('datestamps the download filename', () => {
    expect(scoresFileName('xls')).toMatch(/^cmc-biweekly-scores-\d{4}-\d{2}-\d{2}\.xls$/);
  });
});
