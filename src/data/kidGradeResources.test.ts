import { describe, expect, it } from 'vitest';
import { KID_GRADE_RESOURCES } from './kidGradeResources';

describe('Kid Program grade resource pathway', () => {
  it('has one clearly identified space for every grade from 5 through 12', () => {
    expect(KID_GRADE_RESOURCES.map((grade) => grade.grade)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('links Kid 6 RFC2, Kid 7 RFC1, Kid 8 Change 3, and Kid 11 RFC3 resources', () => {
    const kid6 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 6);
    const kid7 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 7);
    const kid8 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 8);
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
    expect(kid8?.status).toBe('available');
    expect(kid8?.materials.map((material) => material.href)).toEqual([
      './rfc-change3/dictation.html',
      './rfc-change3/unscramble.html',
    ]);
    expect(kid8?.materials.every((material) => material.units === 16)).toBe(true);
    expect(kid8?.materials.map((material) => material.kind)).toEqual(['Dictation worksheet', 'Unscramble sheet']);
    expect(kid11?.status).toBe('available');
    // Kid 11 worksheets are served from this site's public/rfc3/ directory
    // (absolute URLs so the links also work from the static HTML worksheets),
    // plus the shareable online-homework worksheets (relative URLs, deep
    // links into the Unit 2, Unit 13, Unit 14 and Unit 15 files) whose pages
    // carry the student \"Submit to Teacher\" completion button.
    expect(kid11?.materials.map((material) => material.href)).toEqual([
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/word-list.html',
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/dictation.html',
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/review-tests.html',
      'https://cmckhmer.github.io/Creative-Minds-/rfc3/unscramble.html',
      './rfc3/doctor-fish.html#hw-a',
      './rfc3/doctor-fish.html#hw-b',
      './rfc3/doctor-fish.html#hw-c',
      './rfc3/unit13hw.html#hw-a',
      './rfc3/unit13hw.html#hw-b',
      './rfc3/unit13hw.html#hw-c',
      './rfc3/unit15hw.html#hw-a',
      './rfc3/unit15hw.html#hw-b',
      './rfc3/unit15hw.html#hw-c',
      './rfc3/unit2hw.html#hw-a',
      './rfc3/unit2hw.html#hw-b',
      './rfc3/unit2hw.html#hw-c',
      './rfc3/unit3hw.html#hw-a',
      './rfc3/unit3hw.html#hw-b',
      './rfc3/unit3hw.html#hw-c',
      './rfc3/unit4hw.html#hw-a',
      './rfc3/unit4hw.html#hw-b',
      './rfc3/unit4hw.html#hw-c',
      './rfc3/unit12-13-quiz.html',
    ]);
    // The online-homework entries are the teacher's Unit 14 (Doctor Fish),
    // Unit 13, Unit 15, Unit 2 (Leonardo da Vinci), Unit 3 (Pocahontas) and
    // Unit 4 (Walt Disney) three-homework files (one row per homework) — the
    // only materials allowed outside the grade's Reading Future book naming.
    const kid11Homework = kid11?.materials.filter((material) => material.kind === 'Online homework') ?? [];
    expect(kid11Homework.map((material) => material.id)).toEqual([
      'kid-11-homework-u14-hw1',
      'kid-11-homework-u14-hw2',
      'kid-11-homework-u14-hw3',
      'kid-11-homework-u13-hw1',
      'kid-11-homework-u13-hw2',
      'kid-11-homework-u13-hw3',
      'kid-11-homework-u15-hw1',
      'kid-11-homework-u15-hw2',
      'kid-11-homework-u15-hw3',
      'kid-11-homework-u2-hw1',
      'kid-11-homework-u2-hw2',
      'kid-11-homework-u2-hw3',
      'kid-11-homework-u3-hw1',
      'kid-11-homework-u3-hw2',
      'kid-11-homework-u3-hw3',
      'kid-11-homework-u4-hw1',
      'kid-11-homework-u4-hw2',
      'kid-11-homework-u4-hw3',
    ]);
    expect(kid11Homework.slice(0, 3).map((material) => material.title)).toEqual([
      'Unit 14 · Homework 1 — Spa Intake File',
      'Unit 14 · Homework 2 — Treatment Analyst',
      'Unit 14 · Homework 3 — Health Writer',
    ]);
    expect(kid11Homework.slice(0, 3).every((material) => material.description.includes('Doctor Fish'))).toBe(true);
    // Each homework is gated by its own share doc; ALL of them stay
    // completely invisible to students until the teacher shares them, so
    // the teacher can assign ONE homework at a time.
    expect(kid11Homework.map((material) => material.shareDoc)).toEqual([
      'hw-kid11-u14-hw1',
      'hw-kid11-u14-hw2',
      'hw-kid11-u14-hw3',
      'hw-kid11-u13-hw1',
      'hw-kid11-u13-hw2',
      'hw-kid11-u13-hw3',
      'hw-kid11-u15-hw1',
      'hw-kid11-u15-hw2',
      'hw-kid11-u15-hw3',
      'hw-kid11-u2-hw1',
      'hw-kid11-u2-hw2',
      'hw-kid11-u2-hw3',
      'hw-kid11-u3-hw1',
      'hw-kid11-u3-hw2',
      'hw-kid11-u3-hw3',
      'hw-kid11-u4-hw1',
      'hw-kid11-u4-hw2',
      'hw-kid11-u4-hw3',
    ]);
    expect(kid11Homework.map((material) => material.hideUntilShared)).toEqual(new Array(18).fill(true));
    // The secure quiz is also share-gated (teacher-only until shared) and
    // relates to Kid 11 Review Quiz (Review Tests 1–4).
    const kid11Secure = kid11?.materials.find((m) => m.id === 'kid-11-secure-quiz-u12-13');
    expect(kid11Secure).toBeDefined();
    expect(kid11Secure?.shareDoc).toBe('hw-kid11-u12-13-quiz');
    expect(kid11Secure?.hideUntilShared).toBe(true);
    expect(kid11Secure?.kind).toBe('Review test');
    expect(kid11Secure?.href).toBe('./rfc3/unit12-13-quiz.html');
    expect(kid11Secure?.description).toContain('Review Tests 1–4');
    expect(kid11Secure?.description.toLowerCase()).toContain('teacher-only');
    expect(kid11Secure?.description.toLowerCase()).toContain('violation report');
    expect(kid11Secure?.description.toLowerCase()).toContain('leaderboard');
    expect(KID_GRADE_RESOURCES.filter((grade) => ![6, 7, 8, 11].includes(grade.grade)).every((grade) => grade.status === 'planned' && grade.materials.length === 0)).toBe(true);
  });

  it('uses the published Reading Future book name per available grade', async () => {
    // The hub resolves book names through GRADE_BOOK_NAMES — keep the data
    // titles and the map in sync so no available card falls back to generic copy.
    const { GRADE_BOOK_NAMES } = await import('../components/KidGradeHub');
    for (const grade of KID_GRADE_RESOURCES) {
      if (grade.status === 'available' && grade.materials.length > 0) {
        expect(GRADE_BOOK_NAMES[grade.grade], `grade ${grade.grade} missing book name`).toBeDefined();
        for (const material of grade.materials) {
          if (material.kind === 'Online homework') continue; // standalone homework, not a book worksheet
          expect(material.title).toContain(GRADE_BOOK_NAMES[grade.grade]);
        }
      }
    }
  });
});
