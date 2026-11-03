// TransferStudentModal — move a student to another class with ALL stats intact.
//
// Shows exactly what travels with the student (flat scores, notes, identity,
// sponsorship, and the full weekly history) plus the safety guarantee: the
// copy into the destination lands BEFORE the source row is deleted, so the
// worst case after a failure is the student in both classes — never neither.

import { ArrowRight, Loader2, ShieldCheck, X } from 'lucide-react';
import { areaScores } from '../lib/assessmentScoring';
import type { AssessmentClassDoc, AssessmentStudentDoc } from '../lib/assessmentDb';

export function TransferStudentModal(props: {
  student: AssessmentStudentDoc;
  classes: AssessmentClassDoc[];
  currentClassId: string;
  busy: boolean;
  error: string | null;
  onConfirm: (toClassId: string) => void;
  onClose: () => void;
}) {
  const { student, classes, currentClassId, busy, error, onConfirm, onClose } = props;
  const destinations = classes.filter((c) => c.id !== currentClassId);
  const scores = areaScores(student);
  const weekCount = Object.keys(student.weeks ?? {}).filter(
    (k) => Object.keys(student.weeks?.[k] ?? {}).length > 0,
  ).length;

  const statChips: Array<{ label: string; value: string }> = [
    { label: 'Overall', value: scores.overall > 0 ? `${scores.overall}%` : '—' },
    { label: 'Listening', value: scores.listening > 0 ? `${scores.listening}%` : '—' },
    { label: 'Reading', value: scores.reading > 0 ? `${scores.reading}%` : '—' },
    { label: 'Weekly entries', value: String(weekCount) },
    { label: 'Comments', value: student.comments || student.teacherComment ? 'Yes' : '—' },
    { label: 'Sponsorship', value: student.sponsorship || 'Pending' },
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Transfer student to another class">
      <div className="w-full max-w-md rounded-2xl border border-cyan-300/20 bg-[#0b1724] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-cyan-300 uppercase">Assessment workspace</p>
            <h3 className="mt-1 text-base font-bold text-white">Transfer {student.name || 'this student'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Move this student to another class. Every stat comes along — flat scores, all weekly history, notes, comments, and sponsorship. Nothing is re-entered.
        </p>

        {/* Stats summary */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {statChips.map((s) => (
            <div key={s.label} className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-center">
              <p className="truncate text-[11px] font-bold text-slate-100">{s.value}</p>
              <p className="text-[8px] font-bold tracking-[0.08em] text-slate-500 uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Destination picker */}
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">Move to</p>
          {destinations.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => onConfirm(c.id)}
              className="group flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.06] disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-slate-100">{c.name || 'Untitled class'}</span>
                <span className="block truncate text-[10px] text-slate-500">{c.schoolName || '—'}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" aria-hidden="true" />
            </button>
          ))}
          {destinations.length === 0 && (
            <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-[11px] text-amber-100">
              No other class exists yet — create a second class first, then transfer.
            </p>
          )}
        </div>

        {/* Integrity notice */}
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-[10px] leading-relaxed text-emerald-100/90">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
          Safe by order: the full copy lands in the destination class first, and only then is the old row removed. If anything fails mid-way, the student exists in both classes — never in neither.
        </p>

        {error && <p className="mt-3 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[11px] font-bold text-slate-300 transition hover:-translate-y-0.5 disabled:opacity-40">Cancel</button>
        </div>
        {busy && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-cyan-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Transferring…
          </p>
        )}
      </div>
    </div>
  );
}
