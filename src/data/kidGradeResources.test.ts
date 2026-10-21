import { describe, expect, it } from 'vitest';
import { KID_GRADE_RESOURCES } from './kidGradeResources';

describe('Kid Program grade resource pathway', () => {
  it('has one clearly identified space for every grade from 5 through 12', () => {
    expect(KID_GRADE_RESOURCES.map((grade) => grade.grade)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('links all four Kid 6 RFC2 worksheets, all four Kid 7 RFC1 worksheets, and all four Kid 11 RFC3 resources', () => {
    const kid6 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 6);
    const kid7 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 7);
    const kid11 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 11);
    expect(kid6?.status).toBe('available');
    // Kid 6 worksheets are served from this site's public/rfc2/ directory.
    expect(kid6?.materials.map((material) => material.href)).toEqual([
      './rfc2/rfc2unitwords.html',
      './rfc2/rfc2un.html',
      './rfc2/rfc2dic.html',
      './rfc2/rfc2unittest.html',
    ]);
    expect(kid7?.status).toBe('available');
    // Kid 7 worksheets are served from this site's public/rfc1/ directory,
    // following the same self-contained + back-to-CMC pattern as Kid 6.
    expect(kid7?.materials.map((material) => material.href)).toEqual([
      './rfc1/word-list.html',
      './rfc1/unscramble.html',
      './rfc1/dictation.html',
      './rfc1/unit-test.html',
    ]);
    expect(kid11?.status).toBe('available');
    // Kid 11 worksheets are served from this site's public/rfc3/ directory
    // (absolute URLs so the links also work from the static HTML worksheets).
    expect(kid11?.materials.map((material) => material.href)).toEqual([
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/word-list.html',
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/dictation.html',
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/review-tests.html',
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/unscramble.html',
    ]);
    expect(KID_GRADE_RESOURCES.filter((grade) => grade.grade !== 6 && grade.grade !== 7 && grade.grade !== 11).every((grade) => grade.status === 'planned' && grade.materials.length === 0)).toBe(true);
  });

  it('uses the published Reading Future book name per available grade', async () => {
    // The hub resolves book names through GRADE_BOOK_NAMES — keep the data
    // titles and the map in sync so no available card falls back to generic copy.
    const { GRADE_BOOK_NAMES } = await import('../components/KidGradeHub');
    for (const grade of KID_GRADE_RESOURCES) {
      if (grade.status === 'available' && grade.materials.length > 0) {
        expect(GRADE_BOOK_NAMES[grade.grade], `grade ${grade.grade} missing book name`).toBeDefined();
        for (const material of grade.materials) {
          expect(material.title).toContain(GRADE_BOOK_NAMES[grade.grade]);
        }
      }
    }
  });
});
