import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, LockKeyhole, Layers, FileImage, Palette } from 'lucide-react';
import { useMemberAuth } from '../hooks/useMemberAuth';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';

// The Studio is a real deployed Creative Minds design canvas (worksheets,
// posters, slides, photo editing) living at /studio/ in the same GitHub
// Pages site. Open it in the same tab so the teacher sees it in context
// (it has its own Back button in the menu bar).
const STUDIO_URL = './studio/';

const features = [
  { icon: Palette, label: 'Worksheet & poster designer' },
  { icon: FileImage, label: 'Image edit + place on canvas' },
  { icon: Layers, label: 'Layer + transform panel' },
  { icon: BookOpen, label: 'Export PDF, PNG, JPG, SVG' },
];

export function LMSCard({ onOpenAuth }: { onOpenAuth: () => void }) {
  const memberAuth = useMemberAuth();
  // Same pattern as FirebaseDashboard: also check the Firebase REST
  // session (the one TeacherPassModal writes to). Without this, a
  // teacher who signed in via the hero button — which uses Firebase
  // Auth, not Supabase — sees the "Sign up for teacher access" gate
  // even though they're fully authenticated. Supabase member-auth
  // stays the primary path (when configured), Firebase REST is the
  // fallback (the active deployment).
  const firebaseAuth = useFirebaseAuth();
  const isTeacher =
    (memberAuth.status === 'active' && memberAuth.member?.role?.toLowerCase().includes('educat')) ||
    (firebaseAuth.isTeacher && !!firebaseAuth.session);

  return (
    <section
      id="lms-workspace"
      aria-labelledby="lms-title"
      data-keep-dark className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-[#061018] py-20 sm:py-24 lg:py-28"
    >
      {/* Full-bleed semi-transparent card background image */}
      <img src="./images/card-lms.jpg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/55" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-10rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-emerald-500/[0.10] blur-[125px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-10rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-cyan-500/[0.10] blur-[125px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          {/* Left: copy */}
          <div>
            <span className="cmc-eyebrow">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> Teacher Workspace
            </span>
            <h2 id="lms-title" className="cmc-h2 mt-4">
              Creative Minds <span className="cmc-gradient-text">Studio.</span>
            </h2>
            <p className="cmc-lead">
              A browser-based design canvas for teachers — build worksheets, posters, slides, and
              photo-edit class resources without installing any software. Includes layer
              management, fonts, shapes, image placement, and export to PDF / PNG / JPG / SVG.
              Teacher access required.
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
                  href={STUDIO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_36px_-14px_rgba(16,185,129,.72)] transition hover:-translate-y-0.5"
                >
                  Open Studio <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
                {isTeacher ? 'Opens in a new tab · teacher access' : 'Free teacher account required'}
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
                    <span className="text-sm font-bold text-white">Studio Preview</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/20 bg-emerald-200/[0.06] px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-emerald-100 uppercase">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Access granted
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tools</p>
                      <p className="mt-1 text-2xl font-bold text-white">12+</p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Export formats</p>
                      <p className="mt-1 text-2xl font-bold text-white">5</p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Fonts</p>
                      <p className="mt-1 text-2xl font-bold text-white">14</p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-slate-950/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Runs in</p>
                      <p className="mt-1 text-2xl font-bold text-white">Browser</p>
                    </div>
                  </div>
                  <a href={STUDIO_URL} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-emerald-200/20 bg-emerald-200/[0.05] py-2.5 text-center text-xs font-bold text-emerald-100 transition hover:bg-emerald-200/[0.12]">
                    Launch Studio →
                  </a>
                </div>
              ) : (
                <div className="space-y-4 text-center py-6">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-200/[0.05] text-emerald-200">
                    <LockKeyhole className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-white">Teacher access required</p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Creative Minds Studio is available to verified teachers. Create a free teacher
                    account (work email ending in .edu or .edu.kh) to launch the design canvas.
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
