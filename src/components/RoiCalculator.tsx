import React, { useState } from 'react';
import { Clock, Sparkles, ArrowRight, Info } from 'lucide-react';

interface RoiCalculatorProps {
  onOpenTeacherPass: () => void;
}

export const RoiCalculator: React.FC<RoiCalculatorProps> = ({ onOpenTeacherPass }) => {
  const [studentCount, setStudentCount] = useState(75);
  const [assignmentsPerMonth, setAssignmentsPerMonth] = useState(8);
  const [minutesPerPaper, setMinutesPerPaper] = useState(10);

  // Computations
  const totalSubmissions = studentCount * assignmentsPerMonth;
  const manualMinutesTotal = totalSubmissions * minutesPerPaper;
  const manualHours = Math.round(manualMinutesTotal / 60);

  const manualHoursPerWeek = (manualHours / 4.3).toFixed(1);

  return (
    <section id="roi-calc" className="cmc-section relative scroll-mt-24 border-t border-slate-800/80 bg-slate-900/40 py-20 sm:py-24 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-xs font-semibold text-emerald-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Workload estimator</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Estimate your current grading workload.
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            Change the assumptions to estimate time spent grading. This calculator does not predict product savings or automated performance.
          </p>
        </div>

        {/* Calculator Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-6 sm:p-10 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Sliders (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Slider 1: Students */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs sm:text-sm font-semibold text-slate-200">
                  Total Active Students / Tutees:
                </label>
                <span className="text-base font-bold text-cyan-400 font-mono bg-cyan-950/80 px-2.5 py-0.5 rounded-lg border border-cyan-800">
                  {studentCount} students
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="250"
                step="5"
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>10 (Private tutor)</span>
                <span>120 (Department)</span>
                <span>250+ (Multi-class)</span>
              </div>
            </div>

            {/* Slider 2: Assignments per month */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs sm:text-sm font-semibold text-slate-200">
                  Assessments / Worksheets per Month:
                </label>
                <span className="text-base font-bold text-indigo-400 font-mono bg-indigo-950/80 px-2.5 py-0.5 rounded-lg border border-indigo-800">
                  {assignmentsPerMonth} tests / student
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                step="1"
                value={assignmentsPerMonth}
                onChange={(e) => setAssignmentsPerMonth(Number(e.target.value))}
                className="w-full accent-indigo-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>2 (Bi-weekly)</span>
                <span>8 (Twice weekly)</span>
                <span>20 (Daily drills)</span>
              </div>
            </div>

            {/* Slider 3: Minutes per paper */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs sm:text-sm font-semibold text-slate-200">
                  Estimated Minutes to Grade 1 Paper Manually:
                </label>
                <span className="text-base font-bold text-emerald-400 font-mono bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-800">
                  {minutesPerPaper} mins
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="25"
                step="1"
                value={minutesPerPaper}
                onChange={(e) => setMinutesPerPaper(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>3 mins (Multiple choice)</span>
                <span>10 mins (Mixed paper)</span>
                <span>25 mins (TOEFL Essay)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
              <Info className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>Your inputs only. The calculation multiplies estimated submissions by minutes per paper; it is not based on external survey data.</span>
            </div>

          </div>

          {/* Results Summary Box (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-cyan-950/60 via-slate-950 to-indigo-950/60 border border-cyan-500/30 p-6 sm:p-7 flex flex-col justify-between text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Estimated manual grading workload
              </span>

              <div>
                <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300">
                  {manualHoursPerWeek} hrs
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-200 mt-1">
                  per week at these settings
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  approximately {manualHours} hours each month
                </div>
              </div>

              {/* Sub-metrics */}
              <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs text-left">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Submissions in your estimate:</span>
                  <span className="text-white font-mono font-bold">{totalSubmissions}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Time for one paper:</span>
                  <span className="text-white font-mono font-bold">{minutesPerPaper} minutes</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80">
              <button
                onClick={onOpenTeacherPass}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 font-bold text-xs sm:text-sm text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Explore member practice</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
