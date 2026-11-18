import { describe, expect, it } from 'vitest';
import { isEduEmailDomain } from '../lib/userProfile';

// SECURITY REGRESSION GUARD — mirrors isCmcTeacher() in firestore.rules.
// The heuristic used to accept any domain CONTAINING "edu", which let an
// attacker who owned a lookalike domain (myedu-site.com) pass the teacher
// check, self-register a teachers/{uid} allowlist entry and read the answer
// keys. The fix anchors the match to real education TLDs.
describe('isEduEmailDomain (TLD-anchored education-domain heuristic)', () => {
  it('accepts real education domains', () => {
    expect(isEduEmailDomain('you@school.edu.kh')).toBe(true);
    expect(isEduEmailDomain('prof@harvard.edu')).toBe(true);
    expect(isEduEmailDomain('t@sub.university.edu.au')).toBe(true);
    expect(isEduEmailDomain('t@mail.ac.th')).toBe(true);
    expect(isEduEmailDomain('t@college.ac.in')).toBe(true);
    expect(isEduEmailDomain('PROF@SCHOOL.EDU.KH')).toBe(true);
  });

  it('rejects lookalike domains that merely contain "edu"', () => {
    expect(isEduEmailDomain('attacker@myedu-site.com')).toBe(false);
    expect(isEduEmailDomain('x@pwn.edu.com')).toBe(false);
    expect(isEduEmailDomain('x@education.blogspot.com')).toBe(false);
    expect(isEduEmailDomain('eduardo@gmail.com')).toBe(false);
    expect(isEduEmailDomain('a@stud.edu.evil.io')).toBe(false);
  });

  it('rejects empty and malformed input', () => {
    expect(isEduEmailDomain('')).toBe(false);
    expect(isEduEmailDomain('no-at-sign')).toBe(false);
    expect(isEduEmailDomain(null)).toBe(false);
    expect(isEduEmailDomain(undefined)).toBe(false);
  });
});
