import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, CheckCircle2, Check, ClipboardList, Clock3, GraduationCap, KeyRound, Layers3, Link2, Lock, Share2, Sparkles } from 'lucide-react';
import { KID_GRADE_RESOURCES, type KidGradeMaterial } from '../data/kidGradeResources';
import { getProjectId, getValidIdToken } from '../lib/firebaseAuth';
import { Reveal } from './Reveal';

// The homework share state lives in Firestore at
// biweekly_tests/hw-kid11-doctor-fish — public read, teacher-only write
// (same collection the bi-weekly test shells use, so NO rules change).
// Until the teacher flips the share switch, students see the row locked
// and the worksheet page itself sits behind a locked overlay.
const HW_SHARE_DOC_ID = 'hw-kid11-doctor-fish';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${getProjectId()}/databases/(default)/documents`;

type HomeworkShareStatus = 'pending' | 'locked' | 'open';

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

export function KidGradeHub() {
  const availableResourceCount = KID_GRADE_RESOURCES.reduce((sum, grade) => sum + grade.materials.length, 0);
  const availableGradeCount = KID_GRADE_RESOURCES.filter((grade) => grade.status === 'available' && grade.materials.length > 0).length;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<HomeworkShareStatus>('pending');
  const [isTeacher, setIsTeacher] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState(false);

  // Share state + role detection. The share doc is publicly readable, so
  // every visitor sees the homework appear the moment the teacher opens
  // it. The teacher switch only renders for a signed-in teacher session
  // (same localStorage heuristic as RoleGate / teacher-gate.js).
  useEffect(() => {
    let alive = true;
    fetch(`${FS_BASE}/biweekly_tests/${HW_SHARE_DOC_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        if (alive) setShareStatus(doc?.fields?.shared?.booleanValue === true ? 'open' : 'locked');
      })
      .catch(() => { if (alive) setShareStatus('locked'); });
    try {
      const token = localStorage.getItem('cmc-student-token');
      const role = localStorage.getItem('cmc-student-role');
      const email = (localStorage.getItem('cmc-student-email') || '').toLowerCase();
      const uid = localStorage.getItem('cmc-student-uid') || '';
      setIsTeacher(!!token && (role === 'teacher' || email.includes('edu') || uid === '5iLvnjzmV8QY7WFZhyTq6PIgcI63'));
    } catch { setIsTeacher(false); }
    return () => { alive = false; };
  }, []);

  // Teacher-only: open/close the homework for the class. PATCH (upsert) the
  // share doc under the teacher's own token — rules: biweekly_tests write
  // requires a verified teacher. On failure the row stays as it was and a
  // retry hint appears next to the switch.
  async function toggleHomeworkShare() {
    if (toggling || shareStatus === 'pending') return;
    setToggling(true);
    setToggleError(false);
    const nextOpen = shareStatus !== 'open';
    try {
      const token = await getValidIdToken();
      if (!token) throw new Error('sign-in required');
      const res = await fetch(`${FS_BASE}/biweekly_tests/${HW_SHARE_DOC_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: {
          shared: { booleanValue: nextOpen },
          homeworkId: { stringValue: 'kid-11-homework-doctor-fish' },
          title: { stringValue: 'Doctor Fish · Unit 14 · Kid 11 Online Homework' },
          updatedAt: { timestampValue: new Date().toISOString() },
        } }),
      });
      if (!res.ok) throw new Error(`share update failed (${res.status})`);
      setShareStatus(nextOpen ? 'open' : 'locked');
    } catch {
      setToggleError(true);
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
            <p className="cmc-lead">Build a clear path from Kid 5 through Kid 12. Kid 6 has four Reading Future Connect 2 worksheets and Kid 7 has four Reading Future Change 1 worksheets — Word List, Unscramble, Dictation, and Unit Test; Kid 11 has four Reading Future Create 3 worksheets plus an online homework page — auto-graded, shareable, and it sends each student's completion straight to the teacher.</p>
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
                          {homework.map((material) => {
                            const isOpen = shareStatus === 'open';
                            const isPending = shareStatus === 'pending';
                            return (
                              <div key={material.id} className={`group/hw flex items-start gap-2 rounded-lg border p-2.5 transition ${isOpen ? 'border-emerald-200/20 bg-emerald-200/[0.05] hover:border-emerald-100/40 hover:bg-emerald-200/[0.09]' : 'border-white/10 bg-slate-950/50'}`}>
                                {isOpen ? (
                                  <a href={material.href} aria-label={`Open Kid ${resource.grade} homework: ${material.title}`} className="flex min-w-0 flex-1 items-start gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
                                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-200" aria-hidden="true" />
                                    <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold leading-snug text-slate-100 group-hover/hw:text-emerald-50">{material.title}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-500">{material.kind}{material.units ? ` · ${material.units} units` : ''}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-600">{material.description}</span></span>
                                  </a>
                                ) : (
                                  <span className="flex min-w-0 flex-1 items-start gap-2">
                                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                                    <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold leading-snug text-slate-300">{material.title}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-500">{material.kind}</span><span className="mt-1 block text-[9px] leading-relaxed text-slate-600">{isPending ? 'Checking whether your teacher has opened this homework…' : 'Locked — your teacher opens this homework for the class when it’s time.'}</span></span>
                                  </span>
                                )}
                                {isOpen && (
                                  <button type="button" onClick={() => shareHomework(material)} aria-label={`Share ${material.title} homework link`} title="Share this homework" className="shrink-0 rounded-md border border-emerald-200/25 bg-slate-950/50 p-1.5 text-emerald-100 transition hover:border-emerald-100/50 hover:bg-emerald-200/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
                                    {copiedId === material.id ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Share2 className="h-3.5 w-3.5" aria-hidden="true" />}
                                  </button>
                                )}
                                {isTeacher && (
                                  <button type="button" onClick={toggleHomeworkShare} disabled={toggling || isPending} aria-label={isOpen ? `Close ${material.title} homework for students` : `Share ${material.title} homework with students`} title={isOpen ? 'Homework is open — select to close it again' : 'Share with students — opens the homework for the class'} className={`shrink-0 rounded-md border p-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:opacity-60 ${isOpen ? 'border-emerald-200/25 bg-slate-950/50 text-emerald-100 hover:border-emerald-100/50 hover:bg-emerald-200/10' : 'border-amber-200/30 bg-amber-200/[0.08] text-amber-100 hover:border-amber-100/60 hover:bg-amber-200/[0.16]'}`}>
                                    {isOpen ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {isTeacher && toggleError && <p className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold text-rose-300"><Link2 className="h-3 w-3" aria-hidden="true" />Could not reach Firestore — check you are signed in as a teacher, then try again.</p>}
                        <p className="mt-2 text-[9px] leading-relaxed text-slate-500">{isTeacher ? 'Teacher switch opens/closes the homework · students press “Submit to Teacher” when done.' : 'Your teacher opens each homework here · students press “Submit to Teacher” when done.'}</p>
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
        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-600"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/60" aria-hidden="true" /><span>Kid 6 and Kid 7 worksheets open in this site (each with a back-to-CMC button; answer keys on Kid 7 dictation are teacher-locked); Kid 11 links to the separate Reading Future Create 3 pages, and its online homework opens here too — the teacher flips the Share-with-students switch on the card to unlock it, and the page carries a Submit-to-Teacher completion button plus a share link for the class chat. Grades without linked material are intentionally marked planned; no placeholder worksheets are offered. For older learners, see the GEP &amp; ISEC Program Resources section below.</span></p>
        </Reveal>
      </div>
    </section>
  );
}
