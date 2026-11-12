// Student display-name helpers — shared by every surface that shows or
// submits a student name (ticker, dashboard feed, leaderboard, submissions,
// homework hero prefill).
//
// WHY THIS EXISTS (Nov 2026): students who sign in with their Gmail / Google
// account can come back WITHOUT a profile displayName (supervised child
// accounts, Workspace accounts with directory sharing off, accounts created
// without a name). The auth layer used to fall back to the EMAIL address as
// the display name, so every submission carried e.g. "mam.ry@aii.edu.kh" and
// the homepage completion ticker showed raw emails instead of names — the
// owner reported this as "students that sign in with their gmail are not
// showing names on the completion ticker".
//
// Rule now: an email is NEVER a name.
//   · auth writes store '' instead of the email when no real name is known;
//   · submissions ask once ("Who's playing?" prompt) or derive a friendly
//     name from the email's local part ("mam.ry@aii.edu.kh" → "Mam Ry");
//   · display surfaces prettify any historical rows already stored with an
//     email so the ticker reads names again without touching the data.

/** Matches a full email-ish string (local@domain.tld) — used to detect the
 *  "email stored as a name" failure mode, never to validate real input. */
const EMAIL_LIKE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_LIKE_RE.test(value.trim());
}

/**
 * Derive a friendly display name from the local part of an email address:
 * "mam.ry@aii.edu.kh" → "Mam Ry", "sophea_chan05@gmail.com" → "Sophea
 * Chan05". Separators split words; each word's first letter is capitalized;
 * digits stay attached to their word. Returns '' when nothing usable.
 */
export function friendlyNameFromEmail(email: string): string {
  const local = (email || '').split('@')[0].trim();
  if (!local) return '';
  const words = local.split(/[._+-]+/).map((w) => w.trim()).filter(Boolean);
  if (words.length === 0) return local.slice(0, 40);
  const pretty = words
    .map((w) => (w.charAt(0).toUpperCase() + w.slice(1)).slice(0, 40))
    .join(' ')
    .trim();
  return pretty.slice(0, 40);
}

/**
 * Display/submission form of a stored student name. Email-like values are
 * converted to their friendly local-part name; everything else (real typed
 * names, 'Guest', 'Anonymous') passes through untouched.
 */
export function displayStudentName(name: string | null | undefined): string {
  const s = (name || '').trim();
  if (!s) return '';
  if (looksLikeEmail(s)) return friendlyNameFromEmail(s) || s;
  return s;
}

/**
 * One-time self-heal for sessions created before the fix: if the stored
 * display name is still an email, replace it in place with the friendly
 * name (the email itself stays in cmc-student-email). Idempotent — a real
 * name is never touched. Safe to call on every boot from any surface.
 */
export function selfHealStoredStudentName(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  if (!storage) return;
  try {
    const stored = storage.getItem('cmc-student-name') || '';
    if (!looksLikeEmail(stored)) return;
    const healed = friendlyNameFromEmail(stored);
    if (healed) storage.setItem('cmc-student-name', healed);
    else storage.removeItem('cmc-student-name');
  } catch {
    /* private mode / disabled storage — nothing to heal */
  }
}
