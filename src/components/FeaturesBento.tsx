import React from 'react';
import { 
  Sparkles, CheckCircle2, GraduationCap, ClipboardCheck,
  ArrowRight,
  Zap, Headphones, Cpu, Gamepad2, BrainCircuit
} from 'lucide-react';

interface FeaturesBentoProps {
  onExploreMockTest: () => void;
  onExploreJuniorAssessments: () => void;
  onExploreGames: () => void;
  onExploreDailyAssessment: () => void;
  onExploreKidGrades: () => void;
}

export const FeaturesBento: React.FC<FeaturesBentoProps> = ({
  onExploreMockTest,
  onExploreJuniorAssessments,
  onExploreGames,
  onExploreDailyAssessment,
  onExploreKidGrades
}) => {
  return (
    <section id="features" className="cmc-section relative scroll-mt-24 border-t border-slate-800/80 bg-slate-900/30 py-20 sm:py-24 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <span className="cmc-eyebrow"><Cpu className="h-3.5 w-3.5 text-indigo-300" aria-hidden="true" />Original teaching materials</span>
          <h2 className="cmc-h2">Ready-to-use practice, with clear boundaries</h2>
          <p className="cmc-lead mx-auto">Explore classroom assignment packs, fifteen TOEFL Junior-style skill assessments, a member mini mock, and a student game room.</p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-6">
          
          {/* Bento Item 1: Large Card - TOEFL Suite (7 Cols) */}
          <div className="lg:col-span-7 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 shadow-xl group relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all" />
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                   Original TOEFL-Style Practice
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300 transition">
                Timed TOEFL-Style Mini Mock
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                A short, original practice set with reading, listening, and language-use questions. A verified member account is checked by the server before its question bank is delivered.
              </p>

              {/* TOEFL Sub-skills Pill Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-cyan-400 mb-1">
                    <Headphones className="w-4 h-4" />
                    <span className="text-xs font-bold">Listening</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Listen twice + transcript</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-indigo-400 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold">Reading</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Evidence & inference</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-bold">Language</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Grammar in context</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-bold">Feedback</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Instant explanations</span>
                </div>
              </div>
            </div>

            {/* Bottom visual preview */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-cyan-300 font-semibold">MEMBER MINI MOCK</span>
                <span className="hidden sm:inline text-slate-500">|</span>
                <span className="hidden sm:inline text-slate-400">8 original questions · 8-minute timer</span>
              </div>
              <button 
                onClick={onExploreMockTest}
                className="font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Explore member mock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Daily student assessment records shortcut */}
          <div className="lg:col-span-5 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 shadow-xl group relative flex flex-col justify-between">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/15 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Separate workspace
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-300 transition">
                Daily Student Assessment Records
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Open the external record workbook to review reading, listening and speaking, projects, quizzes, homework, participation, and overall progress.
              </p>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-400">This is a separate service. Check access controls and privacy arrangements before entering identifiable student records.</div>
            </div>

            <button
              onClick={onExploreDailyAssessment}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer"
            >
                <span>View daily assessment card</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>

          {/* Bento Item 3: Prefix & Suffix Vocabulary Lab (4 Cols) */}
          <div className="lg:col-span-4 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-teal-500/40 transition-all duration-300 shadow-xl group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-black text-teal-400 px-2.5 py-1 rounded-lg bg-teal-950 border border-teal-800">
                  Original word-building pack
                </span>
                <span className="text-xs text-slate-400">All Levels</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-teal-300 transition">
                Morphology Mastery
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Explore word parts such as <span className="text-teal-300 font-mono">un-, re-, dis-, -able, -tion, -ment</span> and explain how they change meaning.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Root:</span>
                  <span className="text-teal-300 font-bold">courage</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">+ Prefix en-:</span>
                  <span className="text-cyan-300">encourage (v)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">+ Suffix -ment:</span>
                  <span className="text-emerald-300">encouragement (n)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Morphology assignment in the library</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
          </div>

          {/* Kid Program grade-path shortcut */}
          <div className="lg:col-span-4 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-purple-500/40 transition-all duration-300 shadow-xl group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded">
                  Grades 5–12
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition">
                Kid Program Grade Path
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Find the Kid 6 Reading Future Connect 2 vocabulary review. Grade spaces 5 and 7–12 are ready for worksheets and materials as they are created.
              </p>

              <div className="flex flex-wrap gap-2 text-[11px]">
                {[5, 6, 7, 8, 9, 10, 11, 12].map((grade) => <span key={grade} className={`rounded-md border px-2 py-1 ${grade === 6 ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100' : 'border-slate-800 bg-slate-950 text-slate-500'}`}>{grade}</span>)}
              </div>
            </div>

            <button type="button" onClick={onExploreKidGrades} className="group/button mt-5 inline-flex items-center gap-2 border-t border-slate-800 pt-4 text-xs font-semibold text-purple-200 transition hover:text-white">Explore Kid grades <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-1" aria-hidden="true" /></button>
          </div>

          {/* Bento Item 5: Account and test privacy */}
          <div className="lg:col-span-4 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-cyan-500/40 transition-all duration-300 shadow-xl group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                   <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded">
                   Server checked
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition">
                Verified Member Access
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Email-confirmed accounts receive a free member entitlement in the database. The browser cannot create its own access flag.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Protected by:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                   <CheckCircle2 className="w-3.5 h-3.5" /> RLS + Edge Function
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Question bank is served after access check</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
          </div>

          {/* Skill assessment library shortcut */}
          <div className="lg:col-span-6 rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-950/30 via-slate-900/80 to-slate-950/90 p-6 shadow-xl sm:p-8">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-violet-200"><BrainCircuit className="h-5 w-5" aria-hidden="true" /></span><div><span className="text-[9px] font-bold tracking-[0.15em] text-violet-200 uppercase">Assessment packs</span><h3 className="mt-0.5 text-lg font-bold text-white">TOEFL Junior · Speak, listen, write</h3></div></div>
            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-slate-300">Fifteen original assessment assignments: five per skill, with student prompts, separate read-aloud scripts, teacher keys, and rubrics.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-300"><span className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">05 speaking</span><span className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">05 listening</span><span className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">05 writing</span></div>
            <button type="button" onClick={onExploreJuniorAssessments} className="group/button mt-6 inline-flex items-center gap-2 text-xs font-bold text-violet-200 transition hover:text-white">Browse the 15 assessments <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-1" aria-hidden="true" /></button>
          </div>

          {/* Student games portal shortcut */}
          <div className="lg:col-span-6 rounded-3xl border border-teal-300/15 bg-gradient-to-br from-teal-950/35 via-slate-900/80 to-slate-950/90 p-6 shadow-xl sm:p-8">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-teal-300/20 bg-teal-300/10 text-teal-200"><Gamepad2 className="h-5 w-5" aria-hidden="true" /></span><div><span className="text-[9px] font-bold tracking-[0.15em] text-teal-200 uppercase">Student game room</span><h3 className="mt-0.5 text-lg font-bold text-white">Creative Minds Play Lab</h3></div></div>
            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-slate-300">A dedicated game page where students can read the challenge brief, pick a skill, and play an interactive mini-game with instant feedback.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-300"><span className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">Vocabulary</span><span className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">Reading</span><span className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">Grammar</span><span className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">Listening</span></div>
            <button type="button" onClick={onExploreGames} className="group/button mt-6 inline-flex items-center gap-2 text-xs font-bold text-teal-200 transition hover:text-white">Enter the Play Lab <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-1" aria-hidden="true" /></button>
          </div>

        </div>

      </div>
    </section>
  );
};
