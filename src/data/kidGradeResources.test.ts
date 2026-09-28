import { describe, expect, it } from 'vitest';
import { KID_GRADE_RESOURCES } from './kidGradeResources';

describe('Kid Program grade resource pathway', () => {
  it('has one clearly identified space for every grade from 5 through 12', () => {
    expect(KID_GRADE_RESOURCES.map((grade) => grade.grade)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('links both Kid 6 resources and the Kid 11 RFC3 resource', () => {
    const kid6 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 6);
    const kid11 = KID_GRADE_RESOURCES.find((grade) => grade.grade === 11);
    expect(kid6?.status).toBe('available');
    expect(kid6?.materials.map((material) => material.href)).toEqual([
      'https://cmckhmer.github.io/Word-Review-RFConnect-2/',
      'https://cmckhmer.github.io/Reading-Future-Connect-2/',
    ]);
    expect(kid11?.status).toBe('available');
    expect(kid11?.materials.map((material) => material.href)).toEqual(['https://cmckhmer.github.io/RFC3/']);
    expect(KID_GRADE_RESOURCES.filter((grade) => grade.grade !== 6 && grade.grade !== 11).every((grade) => grade.status === 'planned' && grade.materials.length === 0)).toBe(true);
  });
});