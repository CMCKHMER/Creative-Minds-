import { ArrowRight, BookOpen, Calendar, CheckCircle2, GraduationCap, LockKeyhole, MessageSquare, Users } from 'lucide-react';
import { useMemberAuth } from '../hooks/useMemberAuth';

const LMS_URL = 'https://creative-minds-lms.onrender.com'; // placeholder — update with real deploy URL

const features = [
  { icon: BookOpen, label: 'Courses & modules' },
  { icon: CheckCircle2, label: 'Assignments & grades' },
  { icon: Calendar, label: 'Calendar & deadlines' },
  { icon: MessageSquare, label: 'Inbox & discussions' },
  { icon: Users, label: 'Student roster' },
  { icon: GraduationCap, label: 'Gradebook' },
];

export function LMSCard({ onOpenAuth }: { onOpenAuth: () => void }) {
  const memberAuth = useMemberAuth();
  const isTeacher = memberAuth.status === 'active' && memberAuth.member?.role?.toLowerCase().includes('educat');

  return (
    <section
      id="lms-workspace"
      aria-labelledby="lms-title"
      className="cmc-section scroll-mt-24 border-y border-white/10 bg-[#061018] py-16 sm:py-20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-10rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-emerald-500/[0.10] blur-[125px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-10rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-cyan-500/[0.10] blur-[125px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          {/* Left: copy */}
          <div>
            <span className="cmc-eyebrow">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Teacher Workspace
            </span>
            <h2 id="lms-title" className="cmc-h2 mt-4">
              The Learning Management<br />
              <span className="cmc-gradient-text">System (LMS).</span>
            </h2>
            <p className="cmc-lead">
              A full Canvas-style LMS for Creative Minds teachers — courses, modules, assignments,
              gradebook, discussions, calendar, and inbox. Includes a light/dark theme toggle
              and a demo-profile switcher. Teacher access required.
            </p>

            {/* Feature chips */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md border border-emerald-200/20 bg-emerald-200/[0.05] px-2 py-1 text-[10px] font-semibold text-emerald-100">
                    <Icon className="h-3 w-3" />
                    {f.label}
                  </span>
                );
              })}
            </div>

            {/* CTA */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {isTeacher ? (
                <a
                  href={LMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_36px_-14px_rgba(16,185,129,.72)] transition hover:-translate-y-0.5"
                >
                  Open LMS Workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/30 bg-emerald-200/[0.06] px-5 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-200/[0.12]"
                >
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  Sign up for teacher access
                </button>
              )}
              <span className="text-[11px] text-slate-500">
                {isTeacher ? 'Opens the full LMS workspace in a new tab' : 'Free teacher account required'}
              </span>
            </div>
          </div>

          {/* Right: preview / gated message */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-transparent blur-2xl" aria-hidden="true" />
            <div className="relative rounded-2xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-xl">
              {isTeacher ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/8 pb-3">
                    <span className="text-sm font-bold text-white">LMS Dashboard Preview</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-emerald-100 uppercase">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Access granted
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Courses</p>
                      <p className="mt-1 text-2xl font-bold text-white">6</p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">To do</p>
                      <p className="mt-1 text-2xl font-bold text-white">3</p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Announcements</p>
                      <p className="mt-1 text-2xl font-bold text-white">12</p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Unread</p>
                      <p className="mt-1 text-2xl font-bold text-white">2</p>
                    </div>
                  </div>
                  <a href={LMS_URL} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-emerald-200/20 bg-emerald-200/[0.05] py-2.5 text-center text-xs font-bold text-emerald-100 transition hover:bg-emerald-200/[0.12]">
                    Launch workspace →
                  </a>
                </div>
              ) : (
                <div className="space-y-4 text-center py-6">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-200">
                    <LockKeyhole className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-white">Teacher access required</p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    The LMS workspace is available to verified Creative Minds teachers.
                    Create a free teacher account to access courses, assignments, gradebook,
                    calendar, and discussions.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5"
                  >
                    Create teacher account <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
