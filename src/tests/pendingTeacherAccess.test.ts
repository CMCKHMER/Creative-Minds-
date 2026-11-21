import { describe, expect, it } from 'vitest';
import type { RestoredSession } from '../lib/firebaseAuth';
import {
  canDownloadCopy,
  hasActiveAccount,
  hasVerifiedTeacherAccess,
  isAwaitingTeacherVerification,
} from '../lib/gameAccess';

function session(overrides: Partial<RestoredSession> = {}): RestoredSession {
  return {
    idToken: 'token',
    localId: 'uid-1',
    email: 'person@example.com',
    displayName: 'Person',
    emailVerified: true,
    isExpired: false,
    role: 'student',
    accountType: 'student',
    teacherVerified: false,
    isPendingTeacher: false,
    isRevokedTeacher: false,
    isAdmin: false,
    needsAccountTypePrompt: false,
    ...overrides,
  } as RestoredSession;
}

// A teacher who picked "Teacher" but has neither a verified school email nor
// an admin approval: resolveEffectiveAccess returns role 'student' + pending.
const pendingTeacher = session({
  email: 'teacher@gmail.com',
  accountType: 'teacher',
  isPendingTeacher: true,
});

describe('pending teacher accounts get no platform access until verified', () => {
  it('flags a pending teacher as awaiting verification', () => {
    expect(isAwaitingTeacherVerification(pendingTeacher)).toBe(true);
  });

  it('blocks every active-account check for a pending teacher, even with a verified email', () => {
    expect(hasActiveAccount(pendingTeacher)).toBe(false);
    expect(hasVerifiedTeacherAccess(pendingTeacher)).toBe(false);
    expect(canDownloadCopy(pendingTeacher, 'student')).toBe(false);
  });

  it('keeps a verified .edu teacher (teacherVerified) fully active', () => {
    const verified = session({
      email: 'mam@school.edu.kh',
      accountType: 'teacher',
      role: 'teacher',
      teacherVerified: true,
    });
    expect(isAwaitingTeacherVerification(verified)).toBe(false);
    expect(hasActiveAccount(verified)).toBe(true);
    expect(hasVerifiedTeacherAccess(verified)).toBe(true);
  });

  it('keeps an admin-approved teacher active (admin approval counts as verification)', () => {
    const approved = session({
      email: 'teacher@gmail.com',
      accountType: 'teacher',
      role: 'teacher',
      teacherVerified: true,
      isPendingTeacher: false,
    });
    expect(hasActiveAccount(approved)).toBe(true);
    expect(hasVerifiedTeacherAccess(approved)).toBe(true);
  });

  it('never locks the site admin out, even if the pending flag is set', () => {
    const admin = session({ accountType: 'teacher', role: 'teacher', isAdmin: true, isPendingTeacher: true });
    expect(isAwaitingTeacherVerification(admin)).toBe(false);
    expect(hasActiveAccount(admin)).toBe(true);
  });

  it('leaves students and general users unchanged', () => {
    expect(hasActiveAccount(session({ accountType: 'student' }))).toBe(true);
    expect(hasActiveAccount(session({ accountType: 'user' }))).toBe(true);
    expect(isAwaitingTeacherVerification(session({ accountType: 'student' }))).toBe(false);
  });

  it('treats signed-out and unverified-email sessions as before', () => {
    expect(isAwaitingTeacherVerification(null)).toBe(false);
    expect(hasActiveAccount(null)).toBe(false);
    expect(hasActiveAccount(session({ emailVerified: false }))).toBe(false);
  });
});
