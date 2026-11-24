import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, GraduationCap, RefreshCw, Search, ShieldCheck, ShieldX, UserRound, Users,
} from 'lucide-react';
import { useSignedInSession } from '../hooks/useSignedInSession';
import { getValidIdToken } from '../lib/firebaseAuth';
import {
  applyTeacherDecision,
  DEFAULT_TEACHER_EMAIL_DOMAINS,
  fetchTeacherAccessConfig,
  isEduEmailDomain,
  isEmailDomainAllowed,
  listAllUsersForAdmin,
  saveTeacherAccessConfig,
  sessionBadgeLabel,
  type TeacherAccessConfig,
  type UserProfileRecord,
} from '../lib/userProfile';
import { requestAuth } from '../lib/authPrompt';

type Filter = 'all' | 'teacher' | 'student' | 'user' | 'pending' | 'verified';

interface AdminUsersPanelProps {
  /** Rendered standalone on `#users-admin`; hides the page-level hero when
   *  embedded somewhere else. */
  embedded?: boolean;
}

/**
 * Admin-only "Users & Teacher Verification" panel.
 *
 * Shows every registered account (`users/{uid}`) grouped by the Student /
 * Teacher / General-user choice made at sign-up, and lets the site owner
 * approve or revoke teacher verification with one click. Decisions are
 * written to the public `site_config/teacher_access` document, which
 * firestore.rules reads for `isVerifiedTeacher()` and every gate here reads
 * through `resolveEffectiveAccess()`.
 *
 * Guards: ONLY `isCmcAdmin()` sessions ever fetch data. Verified teachers who
 * somehow open `#users-admin` get an "admin only" card — never the list.
 */
export function AdminUsersPanel({ embedded = false }: AdminUsersPanelProps) {
  const session = useSignedInSession();
  const isAdmin = Boolean(session?.isAdmin);

  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [access, setAccess] = useState<TeacherAccessConfig>({ approvedUids: [], revokedUids: [], allowedEmailDomains: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getValidIdToken();
      if (!token) {
        setError('Your admin session expired — sign in again to manage users.');
        return;
      }
      const [rows, teacherAccess] = await Promise.all([
        listAllUsersForAdmin(token),
        fetchTeacherAccessConfig(),
      ]);
      setUsers(rows);
      setAccess(teacherAccess);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const base = { student: 0, teacher: 0, user: 0, pending: 0, verified: 0 };
    for (const u of users) {
      base[u.accountType] += 1;
      if (u.accountType === 'teacher') {
        if (access.approvedUids.includes(u.uid) || (u.emailVerified && isEduEmailDomain(u.email) && isEmailDomainAllowed(u.email, access.allowedEmailDomains))) base.verified += 1;
        else base.pending += 1;
      }
    }
    return base;
  }, [users, access]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((u) => {
      const verified = access.approvedUids.includes(u.uid) || (u.emailVerified && isEduEmailDomain(u.email) && isEmailDomainAllowed(u.email, access.allowedEmailDomains));
      const revoked = access.revokedUids.includes(u.uid);
      if (filter === 'teacher' && u.accountType !== 'teacher') return false;
      if (filter === 'student' && u.accountType !== 'student') return false;
      if (filter === 'user' && u.accountType !== 'user') return false;
      if (filter === 'verified' && !(verified && !revoked)) return false;
      if (filter === 'pending' && !(u.accountType === 'teacher' && !verified)) return false;
      if (!needle) return true;
      return `${u.displayName} ${u.email} ${u.school} ${u.accountType}`.toLowerCase().includes(needle);
    });
  }, [users, access, filter, query]);

  const decide = async (uid: string, decision: 'approve' | 'revoke') => {
    setBusyUid(uid);
    setError(null);
    setNotice(null);
    try {
      const token = await getValidIdToken();
      if (!token) {
        setError('Your admin session expired — sign in again.');
        return;
      }
      const next = applyTeacherDecision(access, uid, decision);
      const saved = await saveTeacherAccessConfig(token, next);
      setAccess(saved);
      const target = users.find((u) => u.uid === uid);
      setNotice(
        decision === 'approve'
          ? `Approved ${target?.displayName || target?.email || uid} as a verified teacher.`
          : `Revoked teacher access for ${target?.displayName || target?.email || uid}.`,
      );
      window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the teacher decision.');
    } finally {
      setBusyUid(null);
    }
  };

  /** Save the whitelist change through the same endpoint as the approval
   *  decisions — the library call derives the rules-side pattern, so the
   *  list and its `allowedEmailDomainsPattern` never drift apart. */
  const saveDomains = async (allowedEmailDomains: string[], successNote: string) => {
    setDomainBusy(true);
    setDomainError(null);
    try {
      const token = await getValidIdToken();
      if (!token) {
        setDomainError('Your admin session expired — sign in again to manage the whitelist.');
        return;
      }
      const saved = await saveTeacherAccessConfig(token, { ...access, allowedEmailDomains });
      setAccess(saved);
      setNotice(successNote);
      window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
    } catch (e) {
      setDomainError(e instanceof Error ? e.message : 'Could not save the school-domain list.');
    } finally {
      setDomainBusy(false);
    }
  };

  /** Domains the owner added on top of the school's own (always-on) ones. */
  const extraDomains = access.allowedEmailDomains.filter(
    (d) => !DEFAULT_TEACHER_EMAIL_DOMAINS.includes(d),
  );

  const addDomain = () => {
    const d = domainInput.trim().toLowerCase();
    if (!d) return;
    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(d) || !d.includes('.') || d.length > 100) {
      setDomainError('Enter a real domain, e.g. partner-school.edu.kh — letters, digits, dots and hyphens only.');
      return;
    }
    if (DEFAULT_TEACHER_EMAIL_DOMAINS.includes(d)) {
      setDomainError(`@${d} is the school domain and always counts — add a partner school instead.`);
      return;
    }
    if (access.allowedEmailDomains.includes(d)) {
      setDomainError(`@${d} is already on the list.`);
      return;
    }
    if (access.allowedEmailDomains.length >= 50) {
      setDomainError('The whitelist holds at most 50 domains.');
      return;
    }
    setDomainInput('');
    void saveDomains([...extraDomains, d], `School domain added: only @${d}, the school domain and your other listed domains now count as verified school addresses.`);
  };

  const removeDomain = (d: string) => {
    void saveDomains(
      extraDomains.filter((x) => x !== d),
      `School domain removed: @${d}. Its addresses now need your one-click approval above.`,
    );
  };

  // ── Guards ─────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-cyan-300" aria-hidden="true" />
        <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold text-white">Admin sign-in required</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          This panel lists every registered account and controls teacher verification. Sign in with the site-owner account to open it.
        </p>
        <button
          type="button"
          onClick={() => requestAuth({ mode: 'sign-in', contextPrompt: 'Sign in with the site-owner account to manage users.' })}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-5 py-2.5 text-sm font-bold text-slate-950"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-rose-300/25 bg-rose-300/[0.05] p-8 text-center">
        <ShieldX className="mx-auto h-10 w-10 text-rose-300" aria-hidden="true" />
        <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold text-white">Admin only</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
          You are signed in as <strong className="text-white">{sessionBadgeLabel(session)}</strong>. The Users &amp;
          Teacher Verification panel is reserved for the site owner — verified teachers get everything else on the site.
        </p>
      </div>
    );
  }

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All accounts', count: users.length },
    { id: 'student', label: 'Students', count: counts.student },
    { id: 'teacher', label: 'Teachers', count: counts.teacher },
    { id: 'user', label: 'General users', count: counts.user },
    { id: 'verified', label: 'Verified', count: counts.verified },
    { id: 'pending', label: 'Pending', count: counts.pending },
  ];

  return (
    <section className={embedded ? '' : 'cmc-section py-14'}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="cmc-eyebrow"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Admin · User directory</span>
            <h1 className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Users &amp; teacher verification
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Every account appears here with the type it chose at sign-up. Teachers with a verified
              school address on the school domain (name@aii.edu.kh) are auto-verified; approve Gmail
              teachers below, and revoke anyone who should lose teacher access. Revoking never removes
              their student access. Add more school domains at the bottom of the page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 bg-cyan-200/[0.06] px-4 py-2.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-200/[0.14] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Students', value: counts.student, tone: 'text-cyan-300' },
            { label: 'Teachers', value: counts.teacher, tone: 'text-emerald-300' },
            { label: 'General users', value: counts.user, tone: 'text-violet-300' },
            { label: 'Awaiting approval', value: counts.pending, tone: 'text-amber-300' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-center">
              <p className={`font-[var(--font-display)] text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                filter === chip.id
                  ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-50'
                  : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500'
              }`}
            >
              {chip.label} <span className="ml-1 text-slate-400">{chip.count}</span>
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or email"
              aria-label="Search users"
              className="w-44 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-300/25 bg-rose-300/[0.06] px-3.5 py-2.5 text-xs text-rose-100">{error}</p>
        )}
        {notice && (
          <p role="status" className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.06] px-3.5 py-2.5 text-xs text-emerald-100">{notice}</p>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700/70">
          {loading && users.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Loading accounts…</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {users.length === 0
                ? 'No registered accounts yet — new sign-ups appear here automatically.'
                : 'No accounts match this filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {visible.map((user) => {
                const adminApproved = access.approvedUids.includes(user.uid);
                const revoked = access.revokedUids.includes(user.uid);
                const eduVerified = user.emailVerified && isEduEmailDomain(user.email) && isEmailDomainAllowed(user.email, access.allowedEmailDomains);
                const verified = (adminApproved || eduVerified) && !revoked;
                const pending = user.accountType === 'teacher' && !verified;
                const TypeIcon = user.accountType === 'teacher' ? GraduationCap : user.accountType === 'user' ? UserRound : Users;
                return (
                  <li key={user.uid} className="flex flex-wrap items-center gap-3 bg-slate-950/40 px-4 py-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      verified ? 'bg-emerald-400/15 text-emerald-200' : user.accountType === 'teacher' ? 'bg-amber-300/15 text-amber-200' : 'bg-cyan-400/15 text-cyan-200'
                    }`}>
                      <TypeIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {user.displayName || user.email}
                        {eduVerified && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" /> .edu verified
                          </span>
                        )}
                        {revoked && (
                          <span className="ml-2 rounded-full bg-rose-400/15 px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-rose-200">Revoked</span>
                        )}
                        {pending && !revoked && (
                          <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-amber-200">Pending</span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {user.email}
                        {user.school ? ` · ${user.school}` : ''}
                        {user.signInCount > 1 ? ` · ${user.signInCount} sign-ins` : ''}
                        {' · '}
                        <span className="uppercase tracking-wider">{user.accountType}</span>
                      </p>
                    </div>
                    {user.accountType === 'teacher' ? (
                      <div className="flex shrink-0 gap-2">
                        {!verified && (
                          <button
                            type="button"
                            disabled={busyUid === user.uid}
                            onClick={() => void decide(user.uid, 'approve')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-300 to-teal-200 px-3 py-1.5 text-[11px] font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50"
                          >
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Approve
                          </button>
                        )}
                        {verified && (
                          <button
                            type="button"
                            disabled={busyUid === user.uid}
                            onClick={() => void decide(user.uid, 'revoke')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/35 bg-rose-300/10 px-3 py-1.5 text-[11px] font-bold text-rose-100 transition hover:bg-rose-300/20 disabled:opacity-50"
                          >
                            <ShieldX className="h-3 w-3" aria-hidden="true" /> Revoke
                          </button>
                        )}
                        {revoked && (
                          <button
                            type="button"
                            disabled={busyUid === user.uid}
                            onClick={() => void decide(user.uid, 'approve')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                        {user.accountType === 'user' ? 'General user access' : 'Student access'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Owner-managed school-domain list (the teacher policy) ── */}
        <div className="mt-6 rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 sm:p-5">
          <h2 className="font-[var(--font-display)] text-sm font-bold text-white">School email domains</h2>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-400">
            Teachers sign up as <code className="rounded bg-white/10 px-1">name@aii.edu.kh</code>. The school
            domain below always counts; add a domain here to accept a partner school too. ONLY the listed
            domains (subdomains not included — list them too) count as school addresses, and every other
            address needs your one-click approval above. Removing every entry leaves just the school
            domain — it never opens the door to other .edu addresses. Enforced in firestore.rules, so it
            holds even for tampered clients.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 sm:max-w-xs">
              <input
                value={domainInput}
                onChange={(event) => { setDomainInput(event.target.value); setDomainError(null); }}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDomain(); } }}
                placeholder="partner-school.edu.kh"
                aria-label="Add an extra school email domain"
                className="w-full min-w-0 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
              />
            </label>
            <button
              type="button"
              onClick={() => addDomain()}
              disabled={domainBusy || !domainInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-3 py-1.5 text-[11px] font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              Add domain
            </button>
          </div>
          {domainError && (
            <p role="alert" className="mt-2 text-[11px] text-rose-100">{domainError}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {DEFAULT_TEACHER_EMAIL_DOMAINS.map((d) => (
              <span
                key={`default-${d}`}
                title="The school's own domain — always accepted, cannot be removed"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/80"
              >
                @{d}
                <span className="text-[9px] font-semibold tracking-wide text-white/40 uppercase">school</span>
              </span>
            ))}
            {extraDomains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold text-cyan-100"
              >
                @{d}
                <button
                  type="button"
                  onClick={() => removeDomain(d)}
                  disabled={domainBusy}
                  aria-label={`Remove ${d} from the school domain list`}
                  className="text-cyan-300/70 transition hover:text-rose-200 disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {extraDomains.length === 0 && (
            <p className="mt-2 text-[11px] italic text-slate-500">No extra domains — only the school domain above counts as a school address.</p>
          )}
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
          Decisions are stored in <code className="rounded bg-white/5 px-1">site_config/teacher_access</code> and take effect
          on the user's next sign-in or session refresh. Approving a teacher unlocks Teacher Tools, answer keys and every
          download; the admin areas stay limited to the site owner.
        </p>
      </div>
    </section>
  );
}

export default AdminUsersPanel;
