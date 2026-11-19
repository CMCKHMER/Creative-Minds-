import { describe, expect, it } from 'vitest';
import {
  deriveAllowedEmailDomainsPattern,
  emailDomainOf,
  EMPTY_TEACHER_ACCESS,
  isEduEmailDomain,
  isEmailDomainAllowed,
  resolveEffectiveAccess,
} from '../lib/userProfile';

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

describe('emailDomainOf', () => {
  it('extracts the lowercased domain after the @', () => {
    expect(emailDomainOf('You@School.EDU.kh')).toBe('school.edu.kh');
    expect(emailDomainOf('  prof@harvard.edu ')).toBe('harvard.edu');
  });

  it('returns "" for addresses without a usable domain', () => {
    expect(emailDomainOf('no-at-sign')).toBe('');
    expect(emailDomainOf('')).toBe('');
    expect(emailDomainOf('x@')).toBe('');
    expect(emailDomainOf(null)).toBe('');
    expect(emailDomainOf(undefined)).toBe('');
  });
});

describe('deriveAllowedEmailDomainsPattern (rules-side RE2 pattern)', () => {
  it('escapes regex metacharacters and joins entries with |', () => {
    expect(deriveAllowedEmailDomainsPattern(['school.edu.kh', 'myschool.org'])).toBe('school\\.edu\\.kh|myschool\\.org');
    expect(deriveAllowedEmailDomainsPattern(['weird.EDU.kh'])).toBe('weird\\.edu\\.kh');
    // A metacharacter can only arrive by hand-editing Firestore; the escape
    // keeps the pattern harmless instead of breaking matches() fail-closed.
    expect(deriveAllowedEmailDomainsPattern(['a*b.c'])).toBe('a\\*b\\.c');
  });

  it('normalises, dedupes and drops empties', () => {
    expect(deriveAllowedEmailDomainsPattern([' A.edu ', 'a.edu', '', '  '])).toBe('a\\.edu');
    expect(deriveAllowedEmailDomainsPattern([])).toBe('');
    expect(deriveAllowedEmailDomainsPattern(undefined)).toBe('');
    expect(deriveAllowedEmailDomainsPattern(null)).toBe('');
  });
});

describe('isEmailDomainAllowed (client mirror of isAllowedSchoolDomain)', () => {
  const LIST = ['school.edu.kh', 'myschool.org'];
  it('passes everything when the whitelist is empty (TLD anchor governs)', () => {
    expect(isEmailDomainAllowed('you@harvard.edu', [])).toBe(true);
    expect(isEmailDomainAllowed('you@harvard.edu', undefined)).toBe(true);
    expect(isEmailDomainAllowed('you@harvard.edu', null)).toBe(true);
    expect(isEmailDomainAllowed('eduardo@gmail.com', [])).toBe(true);
  });

  it('restricts to exact whitelisted domains when set', () => {
    expect(isEmailDomainAllowed('you@school.edu.kh', LIST)).toBe(true);
    expect(isEmailDomainAllowed('you@MYSCHOOL.ORG', LIST)).toBe(true);
    expect(isEmailDomainAllowed('you@other.edu.kh', LIST)).toBe(false);
    expect(isEmailDomainAllowed('x@sub.myschool.org', LIST)).toBe(false); // subdomains not implied
    expect(isEmailDomainAllowed('x@myschool.org.evil.io', LIST)).toBe(false);
    expect(isEmailDomainAllowed('eduardo@gmail.com', LIST)).toBe(false);
    expect(isEmailDomainAllowed('', LIST)).toBe(false);
  });
});

describe('resolveEffectiveAccess integrates the school-domain whitelist', () => {
  const base = { emailVerified: true, accountType: 'teacher' as const };

  it('auto-verifies a whitelisted school address', () => {
    const out = resolveEffectiveAccess({
      ...base,
      uid: 'u1',
      email: 'you@school.edu.kh',
      teacherAccess: { ...EMPTY_TEACHER_ACCESS, allowedEmailDomains: ['school.edu.kh'] },
    });
    expect(out.role).toBe('teacher');
    expect(out.isVerifiedTeacher).toBe(true);
  });

  it('downgrades an off-whitelist education address to pending, not verified', () => {
    const out = resolveEffectiveAccess({
      ...base,
      uid: 'u2',
      email: 'you@harvard.edu',
      teacherAccess: { ...EMPTY_TEACHER_ACCESS, allowedEmailDomains: ['school.edu.kh'] },
    });
    expect(out.role).toBe('student');
    expect(out.isVerifiedTeacher).toBe(false);
    expect(out.isPendingTeacher).toBe(true);
  });

  it('leaves the heuristic untouched while the whitelist is empty', () => {
    const out = resolveEffectiveAccess({
      ...base,
      uid: 'u3',
      email: 'you@harvard.edu',
      teacherAccess: { ...EMPTY_TEACHER_ACCESS },
    });
    expect(out.isVerifiedTeacher).toBe(true);
  });

  it('never restricts admin-approved or admin accounts', () => {
    const approved = resolveEffectiveAccess({
      ...base,
      uid: 'u4',
      email: 'gmail.teacher@gmail.com',
      teacherAccess: { approvedUids: ['u4'], revokedUids: [], allowedEmailDomains: ['school.edu.kh'] },
    });
    expect(approved.isVerifiedTeacher).toBe(true);
    const admin = resolveEffectiveAccess({
      ...base,
      uid: '5iLvnjzmV8QY7WFZhyTq6PIgcI63',
      email: 'owner@gmail.com',
      teacherAccess: { approvedUids: [], revokedUids: [], allowedEmailDomains: ['school.edu.kh'] },
    });
    expect(admin.isAdmin).toBe(true);
    expect(admin.isVerifiedTeacher).toBe(true);
  });
});
