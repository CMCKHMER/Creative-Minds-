import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ClipboardList, Pause, Play, Printer, Volume2, X } from 'lucide-react';
import type { AssignmentQuestion, AssignmentSection, ClassroomAssignment } from '../types/assignment';
import { downloadAssignment, openAssignmentPrintView, type AssignmentCopy } from '../utils/assignmentDocument';
import { assignmentAudioPrompt } from '../utils/assignmentAudio';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';

interface AssignmentPreviewProps {
  assignment: ClassroomAssignment;
  onClose: () => void;
}

function SpeechPromptButton({ kind, text }: { kind: 'listening' | 'speaking'; text: string }) {
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState('');
  const label = kind === 'listening' ? 'Play listening passage' : 'Hear speaking-task prompt';

  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const togglePlayback = () => {
    setNotice('');
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setPlaying(false);
      setNotice('Audio is unavailable in this browser. Use the written directions; a teacher can read the listening script from the key.');
      return;
    }

    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      setNotice('Playback stopped.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.onend = () => {
      setPlaying(false);
      setNotice('Prompt finished. Replay if needed.');
    };
    utterance.onerror = () => {
      setPlaying(false);
      setNotice('Audio could not play. Use the visible text to continue.');
    };
    setPlaying(true);
    setNotice('Playing synthesized speech from your device voice; this is not a recording.');
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`audio-player mt-4 rounded-xl border p-3.5 ${kind === 'listening' ? 'border-cyan-200/15 bg-cyan-50/60' : 'border-violet-200/15 bg-violet-50/60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 place-items-center rounded-lg border ${kind === 'listening' ? 'border-cyan-200/30 bg-white/70 text-cyan-800' : 'border-violet-200/30 bg-white/70 text-violet-800'}`}><Volume2 className="h-4 w-4" aria-hidden="true" /></span>
          <span><span className={`block text-xs font-semibold ${kind === 'listening' ? 'text-cyan-950' : 'text-violet-950'}`}>{label}</span><span className="mt-0.5 block text-[9px] text-slate-500">Device-generated English voice · not a recorded speaker</span></span>
        </div>
        <button type="button" onClick={togglePlayback} aria-pressed={playing} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${kind === 'listening' ? 'border-cyan-800/15 bg-white/75 text-cyan-950 hover:bg-white focus-visible:outline-cyan-700' : 'border-violet-800/15 bg-white/75 text-violet-950 hover:bg-white focus-visible:outline-violet-700'}`}>
          {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
          {playing ? 'Stop audio' : 'Play audio'}
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-3 text-[9px] text-slate-500">{notice}</p>
      {kind === 'speaking' && <p className="mt-1 text-[9px] leading-relaxed text-slate-500">Hear the prompt, then answer aloud yourself. The browser voice models the task instruction.</p>}
      {kind === 'listening' && <p className="mt-1 text-[9px] leading-relaxed text-slate-500">The student version offers audio playback; the text transcript stays in the teacher key.</p>}
    </div>
  );
}

function WritingLines({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <div className="mt-3 grid gap-5 pl-7" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => <span key={index} className="h-1 border-b border-slate-200" />)}
    </div>
  );
}

function StudentQuestion({ question, number }: { question: AssignmentQuestion; number: number }) {
  const lines = question.responseLines ?? (question.choices?.length ? 0 : 1);
  return (
    <article className="break-inside-avoid py-3 first:pt-0">
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-1.5 text-sm leading-relaxed text-slate-800">
        <span className="font-bold text-teal-700">{number}.</span>
        <span>{question.prompt}</span>
      </div>
      {question.choices && (
        <ul className="mt-2 ml-7 grid gap-1.5">
          {question.choices.map((choice) => <li key={choice} className="text-sm leading-relaxed text-slate-600">{choice}</li>)}
        </ul>
      )}
      <WritingLines count={lines} />
    </article>
  );
}

function StudentSection({ assignment, section, sectionIndex, firstQuestionNumber }: { assignment: ClassroomAssignment; section: AssignmentSection; sectionIndex: number; firstQuestionNumber: number }) {
  const audioPrompt = assignmentAudioPrompt(assignment, section);

  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
          {String(sectionIndex + 1).padStart(2, '0')}
        </span>
        <h4 className="font-[var(--font-display)] text-lg font-bold tracking-tight text-slate-900">{section.title}</h4>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600"><strong className="text-slate-800">Directions</strong> {section.directions}</p>
      {section.wordBank && (
        <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/70 p-3 text-sm leading-relaxed text-slate-700">
          <strong className="mr-2 block text-[10px] font-bold tracking-[0.14em] text-teal-800 uppercase">Word bank</strong>
          {section.wordBank}
        </div>
      )}
      {audioPrompt?.kind === 'listening' ? (
        <div className="mt-4">
          <ListeningAudioPlayer
            key={`${assignment.resourceId}-${sectionIndex}-listening`}
            script={audioPrompt.text}
            title={section.title}
            tone="cyan"
          />
        </div>
      ) : (
        audioPrompt && <SpeechPromptButton key={`${assignment.resourceId}-${sectionIndex}-audio`} text={audioPrompt.text} kind={audioPrompt.kind} />
      )}
      {section.passage && (
        <div className="mt-4 space-y-3 rounded-lg border-l-2 border-teal-300 bg-slate-50 p-4 font-serif text-sm leading-[1.8] text-slate-700">
          {section.passage.map((paragraph) => <p key={paragraph} className="whitespace-pre-line">{paragraph}</p>)}
        </div>
      )}
      <div className="mt-4 divide-y divide-slate-100">
        {section.questions.map((question, index) => (
          <StudentQuestion key={`${sectionIndex}-${index}`} question={question} number={firstQuestionNumber + index} />
        ))}
      </div>
    </section>
  );
}

function StudentCopy({ assignment }: { assignment: ClassroomAssignment }) {
  const sectionStarts = assignment.sections.map((_, index) =>
    assignment.sections.slice(0, index).reduce((sum, section) => sum + section.questions.length, 0) + 1
  );

  return (
    <article className="assignment-paper mx-auto max-w-3xl rounded-xl bg-white p-6 text-slate-900 shadow-sm sm:p-10">
      <div className="flex items-center justify-between gap-4 border-b-2 border-teal-700 pb-3">
        <span className="text-[10px] font-extrabold tracking-[0.18em] text-teal-800 uppercase">Creative Minds Network</span>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase">Classroom assignment</span>
      </div>
      <p className="mt-6 text-[10px] font-extrabold tracking-[0.18em] text-teal-700 uppercase">{assignment.subject}</p>
      <h3 className="mt-2 max-w-2xl font-[var(--font-display)] text-3xl leading-tight font-bold tracking-tight text-slate-950">{assignment.title}</h3>
      <p className="mt-2 max-w-2xl font-serif text-base leading-relaxed text-slate-600">{assignment.subtitle}</p>

      <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
        {[
          ['Grade / level', assignment.gradeBand],
          ['Suggested time', assignment.duration],
          ['Skill focus', assignment.skillFocus.slice(0, 2).join(' · ')],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-3">
            <span className="block text-[9px] font-bold tracking-[0.12em] text-slate-500 uppercase">{label}</span>
            <span className="mt-1 block text-xs leading-relaxed font-medium text-slate-800">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 text-xs sm:grid-cols-[1.4fr_1fr]">
        <div className="flex items-end gap-2"><strong className="shrink-0 text-slate-700">Name</strong><span className="h-5 flex-1 border-b border-slate-300" /></div>
        <div className="flex items-end gap-2"><strong className="shrink-0 text-slate-700">Date</strong><span className="h-5 flex-1 border-b border-slate-300" /></div>
      </div>

      <div className="mt-5 rounded-lg border-l-[3px] border-teal-500 bg-teal-50/70 p-4">
        <h4 className="text-[10px] font-extrabold tracking-[0.12em] text-teal-900 uppercase">Today, I will</h4>
        <ul className="mt-2 space-y-1.5">
          {assignment.objectives.map((objective) => <li key={objective} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden="true" />{objective}</li>)}
        </ul>
        <p className="mt-3 text-[10px] text-slate-600"><strong>Materials</strong> {assignment.materials.join(' · ')}</p>
      </div>

      <div className="mt-8 space-y-9">
        {assignment.sections.map((section, index) => <StudentSection key={section.title} assignment={assignment} section={section} sectionIndex={index} firstQuestionNumber={sectionStarts[index]} />)}
      </div>

      {assignment.rubric && (
        <section className="mt-8 rounded-lg border border-slate-200 p-4">
          <h4 className="text-[10px] font-extrabold tracking-[0.12em] text-slate-700 uppercase">How this work is assessed</h4>
          <p className="mt-1 text-xs font-semibold text-teal-800">{assignment.rubric.reduce((sum, row) => sum + row.points, 0)} points total</p>
          <ul className="mt-3 space-y-2">
            {assignment.rubric.map((row) => <li key={row.criterion} className="text-xs leading-relaxed text-slate-600"><strong className="text-slate-800">{row.criterion} · {row.points} pts.</strong> {row.description}</li>)}
          </ul>
        </section>
      )}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-3 text-[9px] text-slate-400">
        <span>Original classroom practice material</span><span>Creative Minds Network</span>
      </div>
    </article>
  );
}

function TeacherKey({ assignment }: { assignment: ClassroomAssignment }) {
  const sectionStarts = assignment.sections.map((_, index) =>
    assignment.sections.slice(0, index).reduce((sum, section) => sum + section.questions.length, 0) + 1
  );

  return (
    <article className="assignment-paper mx-auto max-w-3xl rounded-xl bg-white p-6 text-slate-900 shadow-sm sm:p-10">
      <div className="flex items-center justify-between gap-4 border-b-2 border-teal-700 pb-3">
        <span className="text-[10px] font-extrabold tracking-[0.18em] text-teal-800 uppercase">Creative Minds Network</span>
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] text-teal-800 uppercase">Teacher key</span>
      </div>
      <p className="mt-6 text-[10px] font-extrabold tracking-[0.18em] text-teal-700 uppercase">{assignment.subject} · Answer key</p>
      <h3 className="mt-2 font-[var(--font-display)] text-3xl leading-tight font-bold tracking-tight text-slate-950">{assignment.title}</h3>
      <p className="mt-2 font-serif text-base leading-relaxed text-slate-600">{assignment.subtitle}</p>

      <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-[10px] font-extrabold tracking-[0.12em] text-slate-800 uppercase">Teacher setup</h4>
        <ul className="mt-2 space-y-2">
          {assignment.teacherNotes.map((note) => <li key={note} className="flex gap-2 text-xs leading-relaxed text-slate-600"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-600" />{note}</li>)}
        </ul>
      </section>

      <div className="mt-8 space-y-8">
        {assignment.sections.map((section, sectionIndex) => {
          const firstQuestionNumber = sectionStarts[sectionIndex];
          return (
            <section key={section.title} className="break-before-page">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">{String(sectionIndex + 1).padStart(2, '0')}</span>
                <h4 className="font-[var(--font-display)] text-lg font-bold tracking-tight text-slate-900">{section.title}</h4>
              </div>
              <div className="mt-4 space-y-3">
                {section.audioScript && (
                  <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-4">
                    <p className="text-[10px] font-bold tracking-[0.12em] text-violet-800 uppercase">Teacher read-aloud script</p>
                    <div className="mt-2 space-y-2 font-serif text-sm leading-relaxed text-slate-700">
                      {section.audioScript.map((paragraph, index) => <p key={`${section.title}-audio-${index}`}>{paragraph}</p>)}
                    </div>
                  </div>
                )}
                {section.questions.map((question, index) => {
                  const questionNumber = firstQuestionNumber + index;
                  return (
                    <article key={`${sectionIndex}-key-${index}`} className="break-inside-avoid rounded-lg border border-slate-200 p-4">
                      <p className="text-xs leading-relaxed text-slate-800"><strong className="mr-1 text-teal-800">{questionNumber}.</strong>{question.prompt}</p>
                      <p className="mt-3 text-xs leading-relaxed text-slate-700"><strong className="text-teal-800">Suggested answer</strong> {question.answer}</p>
                      {question.rationale && <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500"><strong className="text-slate-700">Look for</strong> {question.rationale}</p>}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {assignment.rubric && (
        <section className="break-before-page mt-8">
          <h4 className="font-[var(--font-display)] text-xl font-bold text-slate-900">Scoring guide <span className="ml-2 text-sm font-semibold text-teal-800">{assignment.rubric.reduce((sum, row) => sum + row.points, 0)} points</span></h4>
          <div className="mt-3 space-y-2">
            {assignment.rubric.map((row) => <div key={row.criterion} className="rounded-lg border border-slate-200 p-4"><p className="text-xs font-bold text-slate-900">{row.criterion} · {row.points} pts</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{row.description}</p></div>)}
          </div>
        </section>
      )}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-3 text-[9px] text-slate-400">
        <span>Original classroom practice material</span><span>Creative Minds Network</span>
      </div>
    </article>
  );
}

export function AssignmentPreview({ assignment, onClose }: AssignmentPreviewProps) {
  const [copy, setCopy] = useState<AssignmentCopy>('student');
  const [status, setStatus] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeys);
      previousFocus?.focus();
    };
  }, [onClose]);

  const handleDownload = () => {
    downloadAssignment(assignment, copy);
    setStatus(`${copy === 'student' ? 'Student copy' : 'Teacher key'} downloaded as a printable HTML file.`);
  };

  const handlePrint = () => {
    const opened = openAssignmentPrintView(assignment, copy);
    setStatus(opened
      ? 'Print view opened in a new tab. Choose Print / Save as PDF there.'
      : 'The new tab was blocked. Allow pop-ups or download the printable file instead.');
  };

  const handleBackdropKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-sm sm:p-5" onClick={(event) => event.target === event.currentTarget && onClose()} onKeyDown={handleBackdropKeyDown}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-dialog-title"
        className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl sm:max-h-[92dvh] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-5 border-b border-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-teal-300 uppercase">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Ready-to-use assignment
            </p>
            <h2 id="assignment-dialog-title" className="mt-1.5 font-[var(--font-display)] text-lg font-bold tracking-tight text-white sm:text-2xl">{assignment.title}</h2>
            <p className="mt-1 hidden text-xs text-slate-400 sm:block">{assignment.gradeBand} <span aria-hidden="true">·</span> {assignment.duration}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close assignment preview" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex rounded-xl border border-white/10 bg-slate-950/70 p-1" role="tablist" aria-label="Assignment version">
            <button type="button" role="tab" id="assignment-student-tab" aria-selected={copy === 'student'} aria-controls="assignment-tab-panel" onClick={() => { setCopy('student'); setStatus(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${copy === 'student' ? 'bg-teal-300 text-slate-950' : 'text-slate-300 hover:text-white'}`}>
              Student copy
            </button>
            <button type="button" role="tab" id="assignment-teacher-tab" aria-selected={copy === 'teacher'} aria-controls="assignment-tab-panel" onClick={() => { setCopy('teacher'); setStatus(''); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${copy === 'teacher' ? 'bg-teal-300 text-slate-950' : 'text-slate-300 hover:text-white'}`}>
              Teacher key
            </button>
          </div>
          <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:inline-flex"><ClipboardList className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />{assignment.sections.reduce((sum, section) => sum + section.questions.length, 0)} original questions</span>
        </div>

        <div id="assignment-tab-panel" role="tabpanel" aria-labelledby={copy === 'student' ? 'assignment-student-tab' : 'assignment-teacher-tab'} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto bg-slate-950/70 p-3 sm:p-6">
          {copy === 'student' ? <StudentCopy assignment={assignment} /> : <TeacherKey assignment={assignment} />}
        </div>

        <footer className="flex flex-col gap-2 border-t border-white/10 bg-slate-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p role="status" aria-live="polite" className="min-h-4 text-[10px] leading-relaxed text-slate-400 sm:max-w-[45%]">{status || 'Download the selected copy, or open a print-ready view and save as PDF.'}</p>
          <div className="flex gap-2">
            <button type="button" onClick={handlePrint} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-teal-200/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 sm:flex-none">
              <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print / save PDF <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
            <button type="button" onClick={handleDownload} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-300 px-3 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-100 sm:flex-none">
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" /> Download {copy === 'student' ? 'student copy' : 'teacher key'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}