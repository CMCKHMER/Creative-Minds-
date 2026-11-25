import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEACHER_EMAIL_DOMAINS,
  deriveAllowedEmailDomainsPattern,
  effectiveTeacherEmailDomains,
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
    // An empty list is NOT a wildcard: it falls back to the school's own
    // domain, so the rules can never be relaxed by clearing the panel.
    expect(deriveAllowedEmailDomainsPattern([])).toBe('aii\\.edu\\.kh');
    expect(deriveAllowedEmailDomainsPattern(undefined)).toBe('aii\\.edu\\.kh');
    expect(deriveAllowedEmailDomainsPattern(null)).toBe('aii\\.edu\\.kh');
  });
});

describe('DEFAULT_TEACHER_EMAIL_DOMAINS (the school policy bottom line)', () => {
  it('is the school domain teachers sign up with', () => {
    expect(DEFAULT_TEACHER_EMAIL_DOMAINS).toEqual(['aii.edu.kh']);
    // Mirrored by the hardcoded default in schoolDomainPattern() in firestore.rules.
  });

  it('applies only when the owner has not configured a list', () => {
    expect(effectiveTeacherEmailDomains([])).toEqual(['aii.edu.kh']);
    expect(effectiveTeacherEmailDomains(null)).toEqual(['aii.edu.kh']);
    expect(effectiveTeacherEmailDomains([' School.EDU.kh ', 'school.edu.kh'])).toEqual(['school.edu.kh']);
  });
});

describe('isEmailDomainAllowed (client mirror of isAllowedSchoolDomain)', () => {
  const LIST = ['school.edu.kh', 'myschool.org'];
  it('falls back to the school domain when the list is empty — never a wildcard', () => {
    // name@aii.edu.kh is the teacher sign-up address; it passes by default.
    expect(isEmailDomainAllowed('teacher@aii.edu.kh', [])).toBe(true);
    expect(isEmailDomainAllowed('Teacher@AII.EDU.KH', undefined)).toBe(true);
    expect(isEmailDomainAllowed('teacher@aii.edu.kh', null)).toBe(true);
    // Any OTHER education address is not a teacher until the owner lists it.
    expect(isEmailDomainAllowed('you@harvard.edu', [])).toBe(false);
    expect(isEmailDomainAllowed('you@other.edu.kh', undefined)).toBe(false);
    expect(isEmailDomainAllowed('eduardo@gmail.com', [])).toBe(false);
    // Lookalikes and subdomains never pass, even for the school domain.
    expect(isEmailDomainAllowed('x@aii.edu.kh.evil.io', [])).toBe(false);
    expect(isEmailDomainAllowed('x@sub.aii.edu.kh', [])).toBe(false);
    expect(isEmailDomainAllowed('aii.edu.kh@gmail.com', [])).toBe(false);
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

  it('auto-verifies the school domain even with an empty config', () => {
    const out = resolveEffectiveAccess({
      ...base,
      uid: 'u3',
      email: 'teacher@aii.edu.kh',
      teacherAccess: { ...EMPTY_TEACHER_ACCESS },
    });
    expect(out.role).toBe('teacher');
    expect(out.isVerifiedTeacher).toBe(true);
  });

  it('keeps a foreign education address pending until the owner lists its domain', () => {
    const out = resolveEffectiveAccess({
      ...base,
      uid: 'u5',
      email: 'you@harvard.edu',
      teacherAccess: { ...EMPTY_TEACHER_ACCESS },
    });
    expect(out.isVerifiedTeacher).toBe(false);
    expect(out.isPendingTeacher).toBe(true);
  });

  it('still requires a verified email for the school domain', () => {
    const out = resolveEffectiveAccess({
      ...base,
      uid: 'u6',
      email: 'teacher@aii.edu.kh',
      emailVerified: false,
      teacherAccess: { ...EMPTY_TEACHER_ACCESS },
    });
    expect(out.isVerifiedTeacher).toBe(false);
    expect(out.isPendingTeacher).toBe(true);
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
