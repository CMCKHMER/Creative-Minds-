import { Fragment, useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, CheckCircle2, Check, ChevronDown, ChevronUp, ClipboardList, Clock3, GraduationCap, KeyRound, Layers3, Link2, Lock, Share2, Sparkles } from 'lucide-react';
import { KID_GRADE_RESOURCES, type KidGradeMaterial } from '../data/kidGradeResources';
import { getProjectId, getValidIdToken, restoreSession } from '../lib/firebaseAuth';
import { Reveal } from './Reveal';

// Every online-homework share state lives in Firestore under biweekly_tests —
// public read, teacher-only write (same collection the bi-weekly test shells
// use, so NO rules change). EACH homework carries its OWN share doc
// (hw-kid11-u14-hw1|2|3 for Doctor Fish, hw-kid11-u13-hw1|2|3,
// hw-kid11-u15-hw1|2|3): the teacher assigns one homework at a time, and
// homeworks marked hideUntilShared stay completely invisible to students —
// row and worksheet content — until their doc flips to shared:true. Until a
// doc is read (or while it stays locked) students see no homework rows at
// all for these units.
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${getProjectId()}/databases/(default)/documents`;

type HomeworkShareStatus = 'pending' | 'locked' | 'open';

/** Why the share switch failed — each kind gets its own recovery copy so a
 *  signed-in teacher is never told to "sign in" when the real problem is an
 *  expired mirror, an unverified email, or a rules denial. */
type ToggleErrorKind = 'signed-out' | 'expired' | 'unverified' | 'forbidden' | 'network';

export interface KidGradeHubProps {
  /** Opens the teacher sign-in modal — wired to the Sign-in action the
   *  share-switch error shows when there is genuinely no session. */
  onOpenAuth?: () => void;
}

export const GRADE_BOOK_NAMES: Record<number, string> = {
  6: 'Reading Future Connect 2',
  7: 'Reading Future Change 1',
  11: 'Reading Future Create 3',
};

// AI-generated card artwork (public/images) for the grades that have live
// materials — same decorative treatment as the Quick Launch cards: image
// behind the card at low opacity with a dark veil so text stays readable.
// Planned grades intentionally have no artwork (nothing to showcase yet).
export const GRADE_CARD_IMAGES: Record<number, string> = {
  6: './images/card-kid6-connect2.jpg',
  7: './images/card-kid7-change1.jpg',
  11: './images/card-kid11-create3.jpg',
};

export function KidGradeHub({ onOpenAuth }: KidGradeHubProps) {
  const availableResourceCount = KID_GRADE_RESOURCES.reduce((sum, grade) => sum + grade.materials.length, 0);
  const availableGradeCount = KID_GRADE_RESOURCES.filter((grade) => grade.status === 'available' && grade.materials.length > 0).length;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Share state per homework doc — the card polls them all (public read),
  // so a homework the teacher shares WHILE someone is looking appears by
  // itself: re-check every 20s + on tab focus. No reload.
  const [shareStatus, setShareStatus] = useState<Record<string, HomeworkShareStatus>>({});
  const [isTeacher, setIsTeacher] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<ToggleErrorKind | null>(null);
  const [toggleErrEmail, setToggleErrEmail] = useState('');
  const [toggleErrFor, setToggleErrFor] = useState<string | null>(null);
  // Homework fold (owner request: "add a more button so the card does not
  // get too long" — a dedicated homework page was weighed and passed on:
  // the fold keeps students on the page with zero duplicated gate logic).
  // Per grade so the cards fold independently of each other.
  const [hwExpanded, setHwExpanded] = useState<Record<number, boolean>>({});

  // All homework share docs across the grade cards (deduped).
  const shareDocIds = Array.from(new Set(
    KID_GRADE_RESOURCES.flatMap((grade) => grade.materials)
      .filter((material) => material.kind === 'Online homework' && material.shareDoc)
      .map((material) => material.shareDoc as string),
  ));

  // Share state. The share docs are publicly readable, so every visitor sees
  // the homework appear the moment the teacher opens it — and because the
  // card re-checks every 20s (plus on tab focus), a homework that is shared
  // WHILE someone is looking at the page unlocks by itself. No reload. Each
  // doc settles INDEPENDENTLY — one slow/failed read must never hold the
  // other homeworks' state hostage.
  useEffect(() => {
    let alive = true;
    const load = () => {
      shareDocIds.forEach((docId) => {
        fetch(`${FS_BASE}/biweekly_tests/${docId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((doc) => {
            if (!alive) return;
            setShareStatus((prev) => ({ ...prev, [docId]: doc?.fields?.shared?.booleanValue === true ? 'open' : 'locked' }));
          })
          .catch(() => {
            // Fail closed on the FIRST read (a blip must not open the
            // homework); afterwards keep the last known state so a transient
            // network error never re-locks an open homework row.
            if (alive) setShareStatus((prev) => (prev[docId] ? prev : { ...prev, [docId]: 'locked' }));
          });
      });
    };
    load();
    const timer = window.setInterval(load, 20000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Role detection — same localStorage heuristic as RoleGate /
  // teacher-gate.js, but ALSO re-synced on `cmc-auth-changed` (fired by
  // every sign-in/out/refresh path). Without this, a teacher who signs in
  // after the page mounted never sees the share switch and the card keeps
  // claiming the homework is locked — the exact "it asks me to sign in
  // when I am already signed in" report this fixes.
  useEffect(() => {
    const sync = () => {
      try {
        const token = localStorage.getItem('cmc-student-token');
        const role = localStorage.getItem('cmc-student-role');
        const email = (localStorage.getItem('cmc-student-email') || '').toLowerCase();
        const uid = localStorage.getItem('cmc-student-uid') || '';
        setIsTeacher(!!token && (role === 'teacher' || email.includes('edu') || uid === '5iLvnjzmV8QY7WFZhyTq6PIgcI63'));
      } catch { setIsTeacher(false); }
    };
    sync();
    window.addEventListener('cmc-auth-changed', sync);
    return () => window.removeEventListener('cmc-auth-changed', sync);
  }, []);

  // Teacher-only: open/close ONE homework for the class. PATCH (upsert) the
  // homework's own share doc under the teacher's token — rules:
  // biweekly_tests write requires a verified teacher. getValidIdToken() now
  // recovers by itself (refresh → live SDK session), so a signed-in teacher
  // with a stale mirror goes through without any user action. When it still
  // fails, the error is CLASSIFIED so the message names the real problem
  // instead of blanket-asking an already-signed-in teacher to "sign in".
  async function toggleHomeworkShare(material: KidGradeMaterial) {
    const docId = material.shareDoc;
    if (!docId || toggling || (shareStatus[docId] ?? 'pending') === 'pending') return;
    setToggling(true);
    setToggleError(null);
    setToggleErrFor(null);
    const nextOpen = shareStatus[docId] !== 'open';
    try {
      // Snapshot the session BEFORE getValidIdToken — that call may legally
      // recover via the SDK or clear an unverified mirror, and the
      // classification has to describe the world the user is in.
      const session = restoreSession();
      if (!session) { setToggleError('signed-out'); setToggleErrFor(material.id); return; }
      const token = await getValidIdToken({ keepSessionOnUnverified: true });
      if (!token) {
        setToggleErrEmail(session.email || '');
        setToggleError(session.emailVerified === false ? 'unverified' : 'expired');
        setToggleErrFor(material.id);
        return;
      }
      const res = await fetch(`${FS_BASE}/biweekly_tests/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: {
          shared: { booleanValue: nextOpen },
          homeworkId: { stringValue: material.id },
          title: { stringValue: material.title },
          updatedAt: { timestampValue: new Date().toISOString() },
        } }),
      });
      if (res.status === 403) { setToggleError('forbidden'); setToggleErrFor(material.id); return; }
      if (!res.ok) { setToggleError('network'); setToggleErrFor(material.id); return; }
      setShareStatus((prev) => ({ ...prev, [docId]: nextOpen ? 'open' : 'locked' }));
    } catch {
      setToggleError('network');
      setToggleErrFor(material.id);
    } finally {
      setToggling(false);
    }
  }

  // Share a homework link: native share sheet first (phones), clipboard
  // fallback everywhere else — mirrors the worksheet's own Share button.
  async function shareHomework(material: KidGradeMaterial) {
    const url = new URL(material.href, window.location.href).toString();
    const text = `${material.title} — Creative Minds online homework`;
    if (navigator.share) {
      try { await navigator.share({ title: material.title, text, url }); return; } catch { /* user cancelled the sheet */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(material.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch { window.open(url, '_blank', 'noopener'); }
  }

  return (
    <section id="kid-grades" aria-labelledby="kid-grade-hub-title" className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-[#081522] py-20 sm:py-24 lg:py-28">
      {/* Full-bleed semi-transparent card background image */}
      <img src="./images/card-kid-program.jpg" srcSet={"./images/card-kid-program-640w.jpg 640w, ./images/card-kid-program-1280w.jpg 1280w, ./images/card-kid-program.jpg 1536w"} sizes="100vw" alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/55" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-13rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-cyan-500/[0.10] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-indigo-500/[0.14] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_78%)]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
        <header className="grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <span className="cmc-eyebrow"><GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Kid Program · Grades 5–12</span>
            <h2 id="kid-grade-hub-title" className="cmc-h2">A grade-by-grade home<br /><span className="cmc-gradient-text">for what comes next.</span></h2>
            <p className="cmc-lead">Build a clear path from Kid 5 through Kid 12. Kid 6 has four Reading Future Connect 2 worksheets and Kid 7 has four Reading Future Change 1 worksheets — Word List, Unscramble, Dictation, and Unit Test; Kid 11 has four Reading Future Create 3 worksheets plus online homework — Units 2, 13, 14 and 15 each come as three homeworks the teacher shares one at a time, auto-graded, and every completion is sent straight to the teacher.</p>
          </div>
          <div className="flex max-w-md items-start gap-3 border-l border-cyan-200/25 pl-4 text-xs leading-relaxed text-slate-400 lg:mb-1">
            <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
            <p><strong className="font-semibold text-slate-200">One grade, one place.</strong><br />{availableResourceCount} existing worksheet links across {availableGradeCount} grade groups. New materials can be added as they are created.</p>
          </div>
        </header>
        </Reveal>

        <Reveal stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KID_GRADE_RESOURCES.map((resource) => {
            const isAvailable = resource.status === 'available' && resource.materials.length > 0;
            const sheets = resource.materials.filter((material) => material.kind !== 'Online homework');
            const homework = resource.materials.filter((material) => material.kind === 'Online homework');
            // Fold math. Collapsed shows the first two rows PLUS every
            // homework that is currently open for the class — a homework the
            // teacher assigns must be visible on the folded card, so the
            // fold can never hide the assigned work behind "More". Students
            // count only viewer-visible rows: unshared homework stays
            // completely invisible to them, the fold is never a peek.
            const hwOpen = (material: KidGradeMaterial) => ((material.shareDoc && shareStatus[material.shareDoc]) || 'pending') === 'open';
            const expanded = !!hwExpanded[resource.grade];
            const viewerHomework = homework.filter((material) => !material.hideUntilShared || isTeacher || hwOpen(material));
            const foldedIds = new Set(viewerHomework.slice(0, 2).map((material) => material.id));
            const foldedHomework = viewerHomework.filter((material) => foldedIds.has(material.id) || hwOpen(material));
            const shownHomework = expanded ? viewerHomework : foldedHomework;
            const moreCount = viewerHomework.length - foldedHomework.length;
            return (
              <article key={resource.grade} aria-label={isAvailable ? `Kid ${resource.grade}, ${resource.materials.length} resources available` : `Kid ${resource.grade}, materials planned`} className={`flex min-h-[190px] flex-col rounded-2xl border p-4 transition duration-300 sm:p-5 ${isAvailable ? 'relative overflow-hidden border-cyan-200/25 bg-gradient-to-br from-cyan-400/[0.10] via-slate-900/90 to-indigo-500/[0.08] shadow-[0_20px_60px_-45px_rgba(34,211,238,.65)] hover:-translate-y-1 hover:border-cyan-100/45 hover:shadow-[0_28px_70px_-42px_rgba(34,211,238,.6)]' : 'border-white/[0.07] bg-slate-950/30 hover:border-white/15 hover:bg-slate-950/55'}`}>
                {isAvailable && GRADE_CARD_IMAGES[resource.grade] && (
                  <>
                    {/* AI artwork behind the card — decorative, pointer-transparent. */}
                    <img src={GRADE_CARD_IMAGES[resource.grade]} alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
                    {/* Dark veil keeps the title, badge and worksheet links readable. */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#081522]/55 via-[#081522]/72 to-[#081522]/88" />
                  </>
                )}
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <span className={`font-[var(--font-display)] text-3xl font-bold tracking-tight ${isAvailable ? 'text-white' : 'text-slate-400'}`}>Kid {resource.grade}</span>
                  {isAvailable
                    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-emerald-100 uppercase"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />{resource.materials.length} resources</span>
                    : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.025] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase"><Clock3 className="h-3 w-3" aria-hidden="true" />Planned</span>}
                </div>

                {isAvailable ? (
                  <>
                    <div className="relative z-10 mt-4"><h3 className="text-sm font-semibold leading-snug text-cyan-50">{GRADE_BOOK_NAMES[resource.grade] ?? `Kid ${resource.grade} learning materials`}</h3><p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">Select an existing resource to open its worksheet page:</p></div>
                    <div className="relative z-10 mt-3 space-y-2">
                      {sheets.map((material) => (
                        <a key={material.id} href={material.href} aria-label={`Open Kid ${resource.grade}: ${material.title}`} className="group/link flex items-start gap-2 rounded-lg border border-white/7 bg-slate-950/50 p-2.5 transition hover:border-cyan-200/25 hover:bg-cyan-200/[0.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
                          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200" aria-hidden="true" />
                          <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold leading-snug text-slate-200 group-hover/link:text-cyan-100">{material.title}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-500">{material.kind}{material.units ? ` · ${material.units} units` : ''}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-600">{material.description}</span></span>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200/75" aria-hidden="true" />
                        </a>
                      ))}
                    </div>

                    {/* Online homework — shareable worksheets with a student
                        completion submit button on the page itself. */}
                    {homework.length > 0 && (
                      <div className="relative z-10 mt-4 border-t border-white/10 pt-3">
                        <div className="flex items-center gap-1.5">
                          <ClipboardList className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" />
                          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-100">Online homework</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {shownHomework.map((material) => {
                            const docId = material.shareDoc ?? '';
                            const status: HomeworkShareStatus = (docId && shareStatus[docId]) || 'pending';
                            const isOpen = status === 'open';
                            const isPending = status === 'pending';
                            // Owner rule: a homework the teacher has NOT shared
                            // yet must not even be visible to students — the
                            // row (like the page tab) does not exist for them.
                            if (material.hideUntilShared && !isTeacher && !isOpen) return null;
                            const rowError = isTeacher && toggleError && toggleErrFor === material.id;
                            return (
                              <Fragment key={material.id}>
                                <div className={`group/hw flex items-start gap-2 rounded-lg border p-2.5 transition ${isOpen ? 'border-emerald-200/20 bg-emerald-200/[0.05] hover:border-emerald-100/40 hover:bg-emerald-200/[0.09]' : 'border-white/10 bg-slate-950/50'}`}>
                                  {isOpen ? (
                                    <a href={material.href} aria-label={`Open Kid ${resource.grade} homework: ${material.title}`} className="flex min-w-0 flex-1 items-start gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
                                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-200" aria-hidden="true" />
                                      <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold leading-snug text-slate-100 group-hover/hw:text-emerald-50">{material.title}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-500">{material.kind}{material.units ? ` · ${material.units} units` : ''}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-600">{material.description}</span></span>
                                    </a>
                                  ) : (
                                    <span className="flex min-w-0 flex-1 items-start gap-2">
                                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                                      <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold leading-snug text-slate-300">{material.title}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-500">{material.kind}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-600">{isPending ? 'Checking whether your teacher has opened this homework…' : isTeacher ? 'Not shared — students can’t see this homework until you open it.' : 'Locked — your teacher opens this homework for the class when it’s time.'}</span></span>
                                    </span>
                                  )}
                                  {isOpen && (
                                    <button type="button" onClick={() => shareHomework(material)} aria-label={`Share ${material.title} homework link`} title="Share this homework" className="shrink-0 rounded-md border border-emerald-200/25 bg-slate-950/50 p-1.5 text-emerald-100 transition hover:border-emerald-100/50 hover:bg-emerald-200/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
                                      {copiedId === material.id ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Share2 className="h-3.5 w-3.5" aria-hidden="true" />}
                                    </button>
                                  )}
                                  {isTeacher && (
                                    <button type="button" onClick={() => toggleHomeworkShare(material)} disabled={toggling || isPending} aria-label={isOpen ? `Close ${material.title} homework for students` : `Share ${material.title} homework with students`} title={isOpen ? 'Homework is open — select to close it again' : 'Share with students — opens this homework for the class'} className={`shrink-0 rounded-md border p-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:opacity-60 ${isOpen ? 'border-emerald-200/25 bg-slate-950/50 text-emerald-100 hover:border-emerald-100/50 hover:bg-emerald-200/10' : 'border-amber-200/30 bg-amber-200/[0.08] text-amber-100 hover:border-amber-100/60 hover:bg-amber-200/[0.16]'}`}>
                                      {isOpen ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
                                    </button>
                                  )}
                                </div>
                                {rowError && (
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-rose-300/20 bg-rose-400/[0.06] p-2 text-[9px] font-semibold leading-relaxed text-rose-300">
                                    <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 flex-1">
                                      {toggleError === 'signed-out' && 'Sharing needs a teacher sign-in on this device — no CMC session was found.'}
                                      {toggleError === 'expired' && 'Your sign-in expired before the share could be saved. Sign in again, then press the key once more.'}
                                      {toggleError === 'unverified' && `Almost there — Firebase allows the share only after the account's email is verified. Open the verification link we emailed ${toggleErrEmail || 'you'}, then press the key again.`}
                                      {toggleError === 'forbidden' && 'Firebase rejected the share write for this account — sharing needs a verified teacher account.'}
                                      {toggleError === 'network' && 'Could not reach Firestore — check the connection, then try again.'}
                                    </span>
                                    {(toggleError === 'signed-out' || toggleError === 'expired') && onOpenAuth && (
                                      <button type="button" onClick={onOpenAuth} className="shrink-0 rounded-md border border-emerald-200/30 bg-emerald-200/[0.08] px-2 py-1 text-[9px] font-bold text-emerald-100 transition hover:border-emerald-100/60 hover:bg-emerald-200/[0.16] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Sign in</button>
                                    )}
                                    {toggleError !== 'signed-out' && (
                                      <button type="button" onClick={() => toggleHomeworkShare(material)} disabled={toggling} className="shrink-0 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:opacity-60">Try again</button>
                                    )}
                                  </div>
                                )}
                              </Fragment>
                            );
                          })}
                        </div>
                        {(moreCount > 0 || expanded) && (
                          <button type="button" onClick={() => setHwExpanded((prev) => ({ ...prev, [resource.grade]: !prev[resource.grade] }))} aria-expanded={expanded} aria-label={expanded ? `Show fewer homework rows on the Kid ${resource.grade} card` : `Show ${moreCount} more homework row${moreCount === 1 ? '' : 's'} on the Kid ${resource.grade} card`} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-200/25 bg-slate-950/50 px-2.5 py-1 text-[9px] font-bold text-emerald-100 transition hover:border-emerald-100/50 hover:bg-emerald-200/10 hover:text-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
                            {expanded ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
                            {expanded ? 'Show less' : `More homeworks · ${moreCount} more`}
                          </button>
                        )}
                        {!isTeacher && homework.every((material) => material.hideUntilShared && ((material.shareDoc && shareStatus[material.shareDoc]) || 'pending') !== 'open') && (
                          <p className="mt-2 text-[9px] leading-relaxed text-slate-600">Your teacher hasn’t shared homework here yet — it appears the moment they open it.</p>
                        )}
                        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">{isTeacher ? 'Each homework has its own share switch — students only see the homeworks you have opened · they press “Submit to Teacher” when done.' : 'Your teacher opens each homework here · students press “Submit to Teacher” when done.'}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mt-4 min-h-[66px]"><h3 className="text-sm font-semibold leading-snug text-slate-300">Kid {resource.grade} learning materials</h3><p className="mt-2 text-[11px] leading-relaxed text-slate-500">Worksheets and created materials will be added here.</p></div>
                    <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-3"><span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-slate-500"><BookOpen className="h-3 w-3" aria-hidden="true" /> Collection space reserved</span><span className="text-[9px] font-semibold text-slate-600">Coming later</span></div>
                  </>
                )}
              </article>
            );
          })}
        </Reveal>

        <Reveal className="mt-5">
        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-600"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/60" aria-hidden="true" /><span>Kid 6 and Kid 7 worksheets open in this site (each with a back-to-CMC button; answer keys on Kid 7 dictation are teacher-locked); Kid 11 links to the separate Reading Future Create 3 pages, and its online homework opens here too — the teacher flips the Share-with-students switch for each homework (Units 2, 13, 14 and 15 each come as three homeworks the teacher shares one at a time, so students only ever see the homework that was assigned to them), and every page carries a Submit-to-Teacher completion button plus a share link for the class chat. Grades without linked material are intentionally marked planned; no placeholder worksheets are offered. For older learners, see the GEP &amp; ISEC Program Resources section below.</span></p>
        </Reveal>
      </div>
    </section>
  );
}
