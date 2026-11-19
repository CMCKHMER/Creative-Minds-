// Account type classification, teacher verification, and admin user directory.
//
// Access hierarchy (4 tiers):
//   1. Guest (not signed in)     — can ONLY sample select games (capped preview),
//                                  cannot do worksheets/tests, cannot download
//                                  anything; always directed to sign up.
//   2. Student / General User    — IDENTICAL privileges (`role: 'student'`). Can
//      (`student` | `user`)        play all games in full, take practice tests,
//                                  worksheets & homework, download student copies,
//                                  join classes, and track their own scores.
//   3. Verified Teacher          — FULL platform access (`role: 'teacher'`) to all
//      (`teacher` + verified)      games, worksheets, planner, Studio, Teacher
//                                  Tools, Daily Assessment workspace, answer keys,
//                                  class management, and all downloads — EXCEPT
//                                  admin areas (announcements publishing, admin
//                                  allowlists, answer-seal key setup, and the
//                                  admin user/teacher verification directory).
//      Note: an account that picks `teacher` without a verified `.edu` email (and
//      not yet approved by Admin) is recorded as `accountType: 'teacher'` with
//      `isPendingTeacher: true` and keeps standard Student/User privileges until
//      verified by Admin.
//   4. Admin (`ADMIN_UIDS`)      — site owner; full access including admin areas,
//                                  user directory, and teacher approve/revoke.

import { firebaseConfig } from './firebase';

/** Explicit self-identified user category collected at sign-up and sign-in. */
export type AccountType = 'student' | 'teacher' | 'user';

export interface AccountTypeOption {
  id: AccountType;
  label: string;
  shortLabel: string;
  tagline: string;
}

export const ACCOUNT_TYPE_OPTIONS: readonly AccountTypeOption[] = [
  {
    id: 'student',
    label: 'Student',
    shortLabel: 'Student',
    tagline: 'Games, classwork, tests & handouts',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    shortLabel: 'Teacher',
    tagline: 'Full tools & keys once verified',
  },
  {
    id: 'user',
    label: 'General User',
    shortLabel: 'User',
    tagline: 'Self-study, games & practice',
  },
];

export function isAccountType(value: unknown): value is AccountType {
  return value === 'student' || value === 'teacher' || value === 'user';
}

/** Site-owner admin UIDs — kept in sync with firestore.rules `isCmcAdmin()`. */
export const ADMIN_UIDS: readonly string[] = ['5iLvnjzmV8QY7WFZhyTq6PIgcI63'];

export function checkIsAdminUid(uid?: string | null): boolean {
  return !!uid && ADMIN_UIDS.includes(uid);
}

/** True when an email's domain is a REAL education domain, TLD-anchored:
 *  *.edu, *.edu.<2-letter country> (e.g. .edu.kh), *.ac.<2-letter country>
 *  (e.g. .ac.th). SECURITY: this mirrors isCmcTeacher() in firestore.rules.
 *  It used to accept any domain CONTAINING "edu" (education.*, myedu-site.com),
 *  which let attackers on lookalike domains present as teachers. Keep in
 *  sync with the rules if this ever changes. */
export function isEduEmailDomain(email?: string | null): boolean {
  const domain = ((email || '').split('@')[1] || '').toLowerCase().trim();
  return Boolean(domain) && /(^|[.])(edu|ac)([.][a-z]{2})?$/.test(domain);
}

/** Admin-managed override list stored in Firestore `site_config/teacher_access`. */
export interface TeacherAccessConfig {
  approvedUids: string[];
  revokedUids: string[];
}

export const EMPTY_TEACHER_ACCESS: TeacherAccessConfig = {
  approvedUids: [],
  revokedUids: [],
};

export interface EffectiveAccessInput {
  uid?: string | null;
  email?: string | null;
  emailVerified: boolean;
  accountType?: AccountType | null;
  teacherAccess?: TeacherAccessConfig | null;
}

export interface EffectiveAccess {
  /** Gating role used across React and static pages ('teacher' = verified teacher or admin). */
  role: 'teacher' | 'student';
  /** Stored user classification so admin knows whether each account is student, teacher, or user. */
  accountType: AccountType;
  /** True for verified teachers and site admins. */
  isVerifiedTeacher: boolean;
  /** True when user selected 'teacher' but is not yet verified (or was revoked). */
  isPendingTeacher: boolean;
  /** True when an admin explicitly revoked this user's teacher privileges. */
  isRevokedTeacher: boolean;
  /** True ONLY for site-owner admin UIDs — verified teachers NEVER receive this flag. */
  isAdmin: boolean;
  /** True when the account has no recorded accountType yet (legacy session
   *  or a fresh Google sign-in) and the UI should ask Student / Teacher / User. */
  needsAccountTypePrompt: boolean;
}

/**
 * Pure access resolver — computes effective privileges from account identity,
 * chosen accountType, email verification, and admin teacher overrides.
 *
 * Rules:
 *  - Site admin (`ADMIN_UIDS`): always full access + `isAdmin: true` (cannot be revoked).
 *  - `student` and `user`: IDENTICAL privileges (`role: 'student'`), unless an admin
 *    explicitly approved their UID as a verified teacher.
 *  - `teacher`: receives `role: 'teacher'` (`isVerifiedTeacher: true`) ONLY when NOT
 *    revoked AND (email is verified with an `edu` domain OR UID is in `approvedUids`).
 *    Otherwise stays at `role: 'student'` with `isPendingTeacher: true`.
 *  - Legacy session (`accountType` null/undefined): falls back to verified `edu` domain
 *    or `approvedUids` (unless revoked) so pre-existing sessions do not break.
 */
export function resolveEffectiveAccess(input: EffectiveAccessInput): EffectiveAccess {
  const uid = (input.uid || '').trim();
  const email = (input.email || '').trim();
  const emailVerified = Boolean(input.emailVerified);
  const access = input.teacherAccess ?? EMPTY_TEACHER_ACCESS;

  if (checkIsAdminUid(uid)) {
    return {
      role: 'teacher',
      accountType: isAccountType(input.accountType) ? input.accountType : 'teacher',
      isVerifiedTeacher: true,
      isPendingTeacher: false,
      isRevokedTeacher: false,
      isAdmin: true,
      needsAccountTypePrompt: false,
    };
  }

  const isRevoked = Boolean(uid) && access.revokedUids.includes(uid);
  const isAdminApproved = Boolean(uid) && !isRevoked && access.approvedUids.includes(uid);
  const isVerifiedEdu = emailVerified && isEduEmailDomain(email);

  // Explicit admin approval promotes the account to a verified teacher (unless revoked).
  if (isAdminApproved && emailVerified) {
    return {
      role: 'teacher',
      accountType: 'teacher',
      isVerifiedTeacher: true,
      isPendingTeacher: false,
      isRevokedTeacher: false,
      isAdmin: false,
      needsAccountTypePrompt: false,
    };
  }

  // Explicit user selection: Student or General User → identical standard access.
  if (input.accountType === 'student' || input.accountType === 'user') {
    return {
      role: 'student',
      accountType: input.accountType,
      isVerifiedTeacher: false,
      isPendingTeacher: false,
      isRevokedTeacher: false,
      isAdmin: false,
      needsAccountTypePrompt: false,
    };
  }

  // Explicit user selection: Teacher → verified if .edu + verified email (and not revoked).
  if (input.accountType === 'teacher') {
    const verified = !isRevoked && isVerifiedEdu;
    return {
      role: verified ? 'teacher' : 'student',
      accountType: 'teacher',
      isVerifiedTeacher: verified,
      isPendingTeacher: !verified,
      isRevokedTeacher: isRevoked,
      isAdmin: false,
      needsAccountTypePrompt: false,
    };
  }

  // Legacy fallback (account signed in before the explicit accountType prompt
  // existed): a verified `edu` email still opens teacher access, but the UI
  // asks the user to confirm Student / Teacher / User once.
  if (!isRevoked && isVerifiedEdu) {
    return {
      role: 'teacher',
      accountType: 'teacher',
      isVerifiedTeacher: true,
      isPendingTeacher: false,
      isRevokedTeacher: false,
      isAdmin: false,
      needsAccountTypePrompt: !isAccountType(input.accountType),
    };
  }

  return {
    role: 'student',
    accountType: isAccountType(input.accountType) ? input.accountType : 'student',
    isVerifiedTeacher: false,
    isPendingTeacher: false,
    isRevokedTeacher: isRevoked,
    isAdmin: false,
    needsAccountTypePrompt: !isAccountType(input.accountType),
  };
}

/** Compact pill text shown in Navbar / modal badges. */
export function sessionBadgeLabel(info: {
  localId?: string | null;
  role?: 'teacher' | 'student';
  accountType?: AccountType | null;
  teacherVerified?: boolean;
}): string {
  if (checkIsAdminUid(info.localId)) return 'Admin';
  if (info.role === 'teacher' || info.teacherVerified) return 'Verified Teacher';
  if (info.accountType === 'teacher') return 'Teacher · Pending';
  if (info.accountType === 'user') return 'User';
  return 'Student';
}

/** Descriptive account badge label shown in menus and dialogs. */
export function sessionAccountTitle(info: {
  localId?: string | null;
  role?: 'teacher' | 'student';
  accountType?: AccountType | null;
  teacherVerified?: boolean;
}): string {
  if (checkIsAdminUid(info.localId)) return 'Admin account';
  if (info.role === 'teacher' || info.teacherVerified) return 'Verified teacher account';
  if (info.accountType === 'teacher') return 'Teacher account (pending verification)';
  if (info.accountType === 'user') return 'General user account';
  return 'Student account';
}

// ── Local cache helpers ──────────────────────────────────────────────

const TEACHER_ACCESS_CACHE_KEY = 'cmc-teacher-access-cache';
const PENDING_SIGNUP_PREFIX = 'cmc-pending-signup:';

export interface PendingSignupMeta {
  accountType: AccountType;
  displayName?: string;
  school?: string;
  grade?: string;
  teachingRole?: string;
}

export function savePendingSignupMeta(email: string, meta: PendingSignupMeta): void {
  const key = email.trim().toLowerCase();
  if (!key) return;
  try {
    localStorage.setItem(PENDING_SIGNUP_PREFIX + key, JSON.stringify(meta));
  } catch { /* private mode */ }
}

export function loadPendingSignupMeta(email: string): PendingSignupMeta | null {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(PENDING_SIGNUP_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSignupMeta>;
    if (!isAccountType(parsed.accountType)) return null;
    return {
      accountType: parsed.accountType,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
      school: typeof parsed.school === 'string' ? parsed.school : undefined,
      grade: typeof parsed.grade === 'string' ? parsed.grade : undefined,
      teachingRole: typeof parsed.teachingRole === 'string' ? parsed.teachingRole : undefined,
    };
  } catch {
    return null;
  }
}

export function clearPendingSignupMeta(email: string): void {
  const key = email.trim().toLowerCase();
  if (!key) return;
  try {
    localStorage.removeItem(PENDING_SIGNUP_PREFIX + key);
  } catch { /* noop */ }
}

export function readCachedTeacherAccess(): TeacherAccessConfig {
  try {
    const raw = localStorage.getItem(TEACHER_ACCESS_CACHE_KEY);
    if (!raw) return EMPTY_TEACHER_ACCESS;
    const parsed = JSON.parse(raw) as Partial<TeacherAccessConfig>;
    return {
      approvedUids: Array.isArray(parsed.approvedUids)
        ? parsed.approvedUids.filter((u): u is string => typeof u === 'string' && u.length > 0)
        : [],
      revokedUids: Array.isArray(parsed.revokedUids)
        ? parsed.revokedUids.filter((u): u is string => typeof u === 'string' && u.length > 0)
        : [],
    };
  } catch {
    return EMPTY_TEACHER_ACCESS;
  }
}

export function writeCachedTeacherAccess(config: TeacherAccessConfig): void {
  try {
    localStorage.setItem(TEACHER_ACCESS_CACHE_KEY, JSON.stringify({
      approvedUids: [...new Set(config.approvedUids.filter(Boolean))],
      revokedUids: [...new Set(config.revokedUids.filter(Boolean))],
    }));
  } catch { /* private mode */ }
}

// ── Firestore REST helpers ───────────────────────────────────────────

const PROJECT_ID = (firebaseConfig.projectId || '').trim() || 'creative-minds-cambodia';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

interface FsStringArray { arrayValue?: { values?: Array<{ stringValue?: string }> } }
interface FsDoc {
  name?: string;
  fields?: Record<string, {
    stringValue?: string;
    booleanValue?: boolean;
    integerValue?: string;
    timestampValue?: string;
    arrayValue?: { values?: Array<{ stringValue?: string }> };
  }>;
}

function readStringArray(field?: FsStringArray): string[] {
  const vals = field?.arrayValue?.values;
  if (!Array.isArray(vals)) return [];
  return [...new Set(
    vals
      .map((v) => (typeof v?.stringValue === 'string' ? v.stringValue.trim() : ''))
      .filter((v) => v.length > 0),
  )];
}

/** Parse Firestore `site_config/teacher_access` into clean UID arrays. */
export function parseTeacherAccessDoc(doc: unknown): TeacherAccessConfig {
  const f = (doc as FsDoc | null)?.fields;
  if (!f) return EMPTY_TEACHER_ACCESS;
  return {
    approvedUids: readStringArray(f.approvedUids),
    revokedUids: readStringArray(f.revokedUids),
  };
}

/** Fetch live `site_config/teacher_access` (public read, owner-only write). */
export async function fetchTeacherAccessConfig(): Promise<TeacherAccessConfig> {
  try {
    const res = await fetch(`${FIRESTORE_BASE}/site_config/teacher_access`);
    if (res.status === 404) {
      writeCachedTeacherAccess(EMPTY_TEACHER_ACCESS);
      return EMPTY_TEACHER_ACCESS;
    }
    if (!res.ok) return readCachedTeacherAccess();
    const data = await res.json().catch(() => null);
    const parsed = parseTeacherAccessDoc(data);
    writeCachedTeacherAccess(parsed);
    return parsed;
  } catch {
    return readCachedTeacherAccess();
  }
}

/** Admin-only: save approved and revoked teacher UID lists to `site_config/teacher_access`. */
export async function saveTeacherAccessConfig(
  idToken: string,
  config: TeacherAccessConfig,
): Promise<TeacherAccessConfig> {
  const clean: TeacherAccessConfig = {
    approvedUids: [...new Set(config.approvedUids.map((u) => u.trim()).filter(Boolean))],
    revokedUids: [...new Set(config.revokedUids.map((u) => u.trim()).filter(Boolean))],
  };
  const mask = 'updateMask.fieldPaths=approvedUids&updateMask.fieldPaths=revokedUids&updateMask.fieldPaths=updatedAt';
  const res = await fetch(`${FIRESTORE_BASE}/site_config/teacher_access?${mask}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fields: {
        approvedUids: { arrayValue: { values: clean.approvedUids.map((u) => ({ stringValue: u })) } },
        revokedUids: { arrayValue: { values: clean.revokedUids.map((u) => ({ stringValue: u })) } },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `Could not save teacher verification list (HTTP ${res.status})`);
  }
  writeCachedTeacherAccess(clean);
  return clean;
}

/** Compute next teacher-access lists when admin approves or revokes a UID. */
export function applyTeacherDecision(
  current: TeacherAccessConfig,
  uid: string,
  decision: 'approve' | 'revoke' | 'reset',
): TeacherAccessConfig {
  const target = uid.trim();
  if (!target || checkIsAdminUid(target)) return current;
  const approved = current.approvedUids.filter((u) => u !== target);
  const revoked = current.revokedUids.filter((u) => u !== target);
  if (decision === 'approve') approved.push(target);
  if (decision === 'revoke') revoked.push(target);
  return { approvedUids: approved, revokedUids: revoked };
}

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  accountType: AccountType;
  school: string;
  grade: string;
  teachingRole: string;
  emailVerified: boolean;
  eduDomain: boolean;
  /** How many times the account has signed in (admin triage signal). */
  signInCount: number;
  createdAt: number;
  lastSignInAt: number;
}

/** Parse one Firestore `users/{uid}` document into a `UserProfileRecord`. */
export function parseUserProfileDoc(doc: unknown): UserProfileRecord | null {
  const d = doc as FsDoc | null;
  const f = d?.fields;
  if (!f) return null;
  const docId = typeof d?.name === 'string' ? d.name.split('/').pop() || '' : '';
  const uid = (f.uid?.stringValue || docId).trim();
  if (!uid) return null;
  const email = (f.email?.stringValue || '').trim();
  const rawType = f.accountType?.stringValue;
  const accountType: AccountType = isAccountType(rawType)
    ? rawType
    : isEduEmailDomain(email)
      ? 'teacher'
      : 'student';
  const createdAt = f.createdAt?.timestampValue ? Date.parse(f.createdAt.timestampValue) || 0 : 0;
  const lastSignInAt = f.lastSignInAt?.timestampValue ? Date.parse(f.lastSignInAt.timestampValue) || 0 : createdAt;
  return {
    uid,
    email,
    displayName: (f.displayName?.stringValue || '').trim(),
    accountType,
    school: (f.school?.stringValue || '').trim(),
    grade: (f.grade?.stringValue || '').trim(),
    teachingRole: (f.teachingRole?.stringValue || '').trim(),
    emailVerified: Boolean(f.emailVerified?.booleanValue),
    eduDomain: f.eduDomain?.booleanValue ?? isEduEmailDomain(email),
    signInCount: Number(f.signInCount?.integerValue || 0) || 0,
    createdAt,
    lastSignInAt,
  };
}

/** Fetch the caller's own `users/{uid}` record (returns null when absent or unreachable). */
export async function fetchOwnUserProfile(uid: string, idToken: string): Promise<UserProfileRecord | null> {
  if (!uid || !idToken) return null;
  try {
    const res = await fetch(`${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return parseUserProfileDoc(data);
  } catch {
    return null;
  }
}

export interface UpsertUserProfileInput {
  uid: string;
  idToken: string;
  email: string;
  displayName?: string | null;
  accountType: AccountType;
  emailVerified: boolean;
  school?: string;
  grade?: string;
  teachingRole?: string;
  isNewSignup?: boolean;
  /** Bump the stored sign-in counter (sign-ins only, not profile edits). */
  countSignIn?: boolean;
}

/** Create or update `users/{uid}` so Admin can see every registered user's role and status. */
export async function upsertUserProfileDoc(input: UpsertUserProfileInput): Promise<boolean> {
  if (!input.uid || !input.idToken || !input.email) return false;
  const nowIso = new Date().toISOString();
  const fields: Record<string, unknown> = {
    uid: { stringValue: input.uid },
    email: { stringValue: input.email.trim().toLowerCase().slice(0, 254) },
    accountType: { stringValue: input.accountType },
    emailVerified: { booleanValue: Boolean(input.emailVerified) },
    eduDomain: { booleanValue: isEduEmailDomain(input.email) },
    lastSignInAt: { timestampValue: nowIso },
  };
  const maskFields = ['uid', 'email', 'accountType', 'emailVerified', 'eduDomain', 'lastSignInAt'];

  if (input.displayName && input.displayName.trim()) {
    fields.displayName = { stringValue: input.displayName.trim().slice(0, 80) };
    maskFields.push('displayName');
  }
  if (input.school && input.school.trim()) {
    fields.school = { stringValue: input.school.trim().slice(0, 120) };
    maskFields.push('school');
  }
  if (input.grade && input.grade.trim()) {
    fields.grade = { stringValue: input.grade.trim().slice(0, 24) };
    maskFields.push('grade');
  }
  if (input.teachingRole && input.teachingRole.trim()) {
    fields.teachingRole = { stringValue: input.teachingRole.trim().slice(0, 80) };
    maskFields.push('teachingRole');
  }
  if (input.isNewSignup) {
    fields.createdAt = { timestampValue: nowIso };
    maskFields.push('createdAt');
  }
  if (input.countSignIn) {
    // Firestore REST has no atomic increment here (it would need a commit
    // with a transform), so the counter is best-effort: read the current
    // doc and write +1. Admin triage only — never used for gating.
    const previous = await fetchOwnUserProfile(input.uid, input.idToken).catch(() => null);
    fields.signInCount = { integerValue: String((previous?.signInCount ?? 0) + 1) };
    maskFields.push('signInCount');
  }

  const qs = maskFields.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  try {
    const res = await fetch(`${FIRESTORE_BASE}/users/${encodeURIComponent(input.uid)}?${qs}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.idToken}`,
      },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Attempt to register the caller in the `teachers/{uid}` allowlist.
 *  SECURITY (Nov 2026): the rules close self-registration — only the
 *  site-owner admin can create entries now, so for every other account this
 *  is a silent no-op (403 is caught below). New teachers are approved by the
 *  owner in the Admin panel (site_config/teacher_access approvedUids) or
 *  seeded into teachers/. Kept as a best-effort call so the owner's own
 *  flows still record the allowlist entry without a separate step. */
export async function ensureTeacherAllowlist(
  uid: string,
  email: string,
  displayName: string,
  idToken: string,
): Promise<void> {
  if (!uid || !idToken || checkIsAdminUid(uid)) return;
  try {
    await fetch(`${FIRESTORE_BASE}/teachers?documentId=${encodeURIComponent(uid)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: uid },
          email: { stringValue: email.trim().toLowerCase() },
          displayName: { stringValue: (displayName || '').trim().slice(0, 80) },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });
  } catch { /* best-effort — 409 means already registered */ }
}

/** Admin-only: fetch all registered user records from `users`. */
export async function listAllUsersForAdmin(idToken: string): Promise<UserProfileRecord[]> {
  const res = await fetch(`${FIRESTORE_BASE}/users?pageSize=300`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } })?.error?.message || `Could not load users (HTTP ${res.status})`);
  }
  const data = await res.json().catch(() => ({}));
  const docs = Array.isArray((data as { documents?: unknown[] })?.documents)
    ? (data as { documents: unknown[] }).documents
    : [];
  const parsed = docs
    .map(parseUserProfileDoc)
    .filter((u): u is UserProfileRecord => u !== null);
  parsed.sort((a, b) => (b.lastSignInAt || b.createdAt) - (a.lastSignInAt || a.createdAt));
  return parsed;
}
