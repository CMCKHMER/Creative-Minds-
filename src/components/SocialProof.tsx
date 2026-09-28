import React from 'react';
import { BookOpen, Check, ClipboardCheck, Feather, Headphones, Shapes } from 'lucide-react';
import { CLASSROOM_ASSIGNMENTS } from '../data/assignments';
import { TOEFL_JUNIOR_ASSESSMENTS } from '../data/toeflJuniorAssessments';

const practiceAreas = [
  { label: 'Reading', icon: BookOpen },
  { label: 'Listening', icon: Headphones },
  { label: 'Language use', icon: Shapes },
  { label: 'Speaking', icon: Feather },
  { label: 'Writing', icon: ClipboardCheck },
];

export const SocialProof: React.FC = () => {
  const classroomPackCount = Object.keys(CLASSROOM_ASSIGNMENTS).length;
  const assessmentCount = TOEFL_JUNIOR_ASSESSMENTS.length;

  return (
    <section aria-labelledby="preview-materials-title" className="cmc-section scroll-mt-24 border-y border-slate-800/80 bg-slate-900/35 py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-300 uppercase">A look inside</p>
            <h2 id="preview-materials-title" className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">
              A practical toolkit, ready to explore.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              {classroomPackCount} general classroom packs and {assessmentCount} TOEFL Junior-style speaking, listening, and writing assessments, each with student and teacher editions.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="border-l border-cyan-300/30 pl-5">
              <span className="font-[var(--font-display)] text-4xl font-bold tracking-tight text-white">{String(classroomPackCount).padStart(2, '0')}</span>
              <p className="mt-1 text-sm font-semibold text-slate-200">Classroom assignment packs</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Student copy plus a separate suggested-answer guide.</p>
            </div>
            <div className="border-l border-teal-300/30 pl-5">
              <span className="font-[var(--font-display)] text-4xl font-bold tracking-tight text-white">{String(assessmentCount).padStart(2, '0')}</span>
              <p className="mt-1 text-sm font-semibold text-slate-200">TOEFL Junior skill assessments</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Five speaking, five listening, five writing.</p>
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/8 pt-5">
          <span className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase">Practice areas</span>
          {practiceAreas.map(({ label, icon: Icon }) => (
            <span key={label} className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Icon className="h-3.5 w-3.5 text-cyan-300/80" aria-hidden="true" />
              {label}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-slate-500"><Check className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" /> Original practice material</span>
        </div>
      </div>
    </section>
  );
};