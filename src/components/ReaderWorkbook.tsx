import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  Trophy,
  X,
} from 'lucide-react';
import type {
  CrosswordClue,
  MultiBlankSlot,
  ReaderWorkbookMeta,
  UnscrambleItem,
  WordSearchWord,
  WorkbookActivity,
} from '../data/readerWorkbooks';
import { useSignedInSession } from '../hooks/useSignedInSession';
import { requestAuth } from '../lib/authPrompt';
import { scoreWhen } from '../lib/kidHomework';
import {
  buildCrosswordGrid,
  cleanSubmitName,
  flushWorkbookOutbox,
  gradeWorkbook,
  isTeacherLocalSession,
  loadWorkbookState,
  normalizeWord,
  readWorkbookOutbox,
  saveWorkbookState,
  submitWorkbookToTeacher,
  wordSearchLine,
  type GradedEntry,
  type SavedWorkbookState,
} from '../lib/readerWorkbook';
import { KidHomeworkScores } from './KidHomeworkScores';
import { KidMyHomeworkScore } from './KidMyHomeworkScore';
import './reader-workbook.css';

export interface ReaderWorkbookProps {
  workbook: ReaderWorkbookMeta;
  onClose: () => void;
  /** Opens the matching PDF book, optionally landing directly on `pdfPage`. */
  onOpenPdf: (pdfPage?: number) => void;
}

function shareWorkbookUrl(workbook: ReaderWorkbookMeta): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${workbook.workbookHref}`;
}

function todayIso(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** Word bank strip that gently ticks off words already used in an activity. */
function WordBank({ words, usedValues }: { words: readonly string[]; usedValues: readonly string[] }) {
  const remaining = new Map<string, number>();
  for (const val of usedValues) {
    const k = normalizeWord(val);
    if (k) remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }
  return (
    <div className="cmc-rwb-card-alt mb-4" aria-label="Word bank">
      <p className="cmc-rwb-soft-text mb-2 text-[11px] font-bold uppercase tracking-[0.14em]">Word Bank</p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word, idx) => {
          const k = normalizeWord(word);
          const count = remaining.get(k) ?? 0;
          const used = count > 0;
          if (used) remaining.set(k, count - 1);
          return (
            <span key={`${word}-${idx}`} className="cmc-rwb-wordchip" data-used={used ? 'true' : 'false'}>
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Inline word-bank `<select>` slot with check feedback. */
function BankSelect({
  id,
  options,
  value,
  onChange,
  graded,
  ariaLabel,
}: {
  id: string;
  options: readonly string[];
  value: string;
  onChange: (id: string, value: string) => void;
  graded: GradedEntry | undefined;
  ariaLabel: string;
}) {
  const state = graded ? (graded.correct ? 'ok' : 'bad') : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      <select
        aria-label={ariaLabel}
        data-wb-input={id}
        data-grade={state}
        value={value}
        onChange={(event) => onChange(id, event.target.value)}
        className="cmc-rwb-select"
      >
        <option value="">Choose…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {graded && (
        graded.correct ? (
          <span className="cmc-rwb-ok-text text-xs font-extrabold" aria-label="Correct">✓</span>
        ) : (
          <span className="cmc-rwb-bad-text text-xs font-bold">
            ✗ <span className="underline">{graded.expected}</span>
          </span>
        )
      )}
    </span>
  );
}

function renderSlotParts(
  parts: ReadonlyArray<string | MultiBlankSlot>,
  wordBank: readonly string[],
  answers: Record<string, string>,
  onAnswer: (id: string, value: string) => void,
  revealed: Record<string, GradedEntry>,
  labelPrefix: string,
) {
  let blankNo = 0;
  return parts.map((part, idx) => {
    if (typeof part === 'string') return <Fragment key={idx}>{part}</Fragment>;
    blankNo += 1;
    return (
      <BankSelect
        key={part.id}
        id={part.id}
        options={wordBank}
        value={answers[part.id] ?? ''}
        onChange={onAnswer}
        graded={revealed[part.id]}
        ariaLabel={`${labelPrefix} blank ${blankNo}`}
      />
    );
  });
}

/** Interactive word-tile + direct-text sentence unscramble row. */
function UnscrambleRow({
  index,
  item,
  value,
  onChange,
  graded,
}: {
  index: number;
  item: UnscrambleItem;
  value: string;
  onChange: (id: string, value: string) => void;
  graded: GradedEntry | undefined;
}) {
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);

  // Reset tile selection if answer was cleared externally (e.g. Reset button).
  useEffect(() => {
    if (!value && pickedIndices.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPickedIndices([]);
    }
  }, [value, pickedIndices.length]);

  const toggleChunk = (chunkIdx: number) => {
    const exists = pickedIndices.indexOf(chunkIdx);
    const next = exists >= 0
      ? pickedIndices.filter((_, pos) => pos !== exists)
      : [...pickedIndices, chunkIdx];
    setPickedIndices(next);
    onChange(item.id, next.map((i) => item.chunks[i]).join(' '));
  };

  const clearRow = () => {
    setPickedIndices([]);
    onChange(item.id, '');
  };

  const state = graded ? (graded.correct ? 'ok' : 'bad') : undefined;

  return (
    <div className="cmc-rwb-card" data-grade={state}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wider cmc-rwb-accent-text">
          Sentence {index + 1}
        </span>
        {value && (
          <button
            type="button"
            onClick={clearRow}
            className="cmc-rwb-soft-text text-xs font-semibold underline hover:opacity-80"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Word tiles for sentence ${index + 1}`}>
        {item.chunks.map((chunk, chunkIdx) => {
          const used = pickedIndices.includes(chunkIdx);
          return (
            <button
              key={`${item.id}-${chunkIdx}`}
              type="button"
              aria-pressed={used}
              onClick={() => toggleChunk(chunkIdx)}
              className="cmc-rwb-choice"
            >
              {chunk}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5">
        <input
          type="text"
          data-wb-input={item.id}
          data-grade={state}
          aria-label={`Sentence ${index + 1} answer`}
          value={value}
          onChange={(event) => {
            setPickedIndices([]);
            onChange(item.id, event.target.value);
          }}
          placeholder="Tap the tiles above in order, or type the sentence here…"
          className="cmc-rwb-input w-full"
        />
      </div>

      {graded && (
        <p className={`mt-1.5 text-xs font-bold ${graded.correct ? 'cmc-rwb-ok-text' : 'cmc-rwb-bad-text'}`}>
          {graded.correct ? '✓ Correct sentence!' : `✗ Answer: ${graded.expected}`}
        </p>
      )}
    </div>
  );
}

/** Interactive 8×8 Word Search puzzle (Kid 2 Vocabulary Preview A). */
function WordSearchBlock({
  grid,
  words,
  answers,
  onAnswer,
  revealed,
}: {
  grid: readonly string[];
  words: readonly WordSearchWord[];
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  revealed: Record<string, GradedEntry>;
}) {
  const [startCell, setStartCell] = useState<readonly [number, number] | null>(null);
  const [gridHint, setGridHint] = useState<string>('');

  const foundCells = useMemo(() => {
    const set = new Set<string>();
    for (const word of words) {
      if (normalizeWord(answers[word.id]) === normalizeWord(word.answer)) {
        const line = wordSearchLine(grid, word.start, word.end);
        if (line) {
          for (const [r, c] of line.cells) set.add(`${r},${c}`);
        }
      }
    }
    return set;
  }, [answers, grid, words]);

  const onCellClick = (r: number, c: number) => {
    if (!startCell) {
      setStartCell([r, c]);
      setGridHint(`Start letter "${grid[r]?.[c]}" picked — now tap the last letter of the word.`);
      return;
    }
    if (startCell[0] === r && startCell[1] === c) {
      setStartCell(null);
      setGridHint('');
      return;
    }
    const line = wordSearchLine(grid, startCell, [r, c]);
    setStartCell(null);
    if (!line) {
      setGridHint('Pick two letters in the same row, column, or diagonal.');
      return;
    }
    const match = words.find(
      (w) => w.answer.toLowerCase() === line.word || w.answer.toLowerCase() === line.reversed,
    );
    if (match) {
      onAnswer(match.id, match.answer);
      setGridHint(`Found "${match.answer}" for clue #${match.number}!`);
    } else {
      setGridHint(`"${line.word}" isn't one of the six words — try again!`);
    }
  };

  const cols = grid[0]?.length ?? 8;
  const gridStyle = {
    '--ws-cols': String(cols),
    '--ws-cell': cols > 8 ? '2.05rem' : '2.35rem',
  } as CSSProperties;

  return (
    <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center overflow-x-auto">
        <div
          className="cmc-rwb-ws-grid"
          style={gridStyle}
          role="group"
          aria-label={`${grid.length} by ${cols} word search letter grid`}
        >
          {grid.map((row, r) =>
            [...row].map((ch, c) => {
              const key = `${r},${c}`;
              const isStart = startCell?.[0] === r && startCell?.[1] === c;
              const isFound = foundCells.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCellClick(r, c)}
                  data-start={isStart ? 'true' : 'false'}
                  data-found={isFound ? 'true' : 'false'}
                  aria-label={`Row ${r + 1} column ${c + 1}, letter ${ch}`}
                  className="cmc-rwb-ws-cell"
                >
                  {ch}
                </button>
              );
            }),
          )}
        </div>
        <p className="cmc-rwb-soft-text mt-2 max-w-[19rem] text-center text-xs" aria-live="polite">
          {gridHint || 'Tap the first letter, then the last letter of a word.'}
        </p>
      </div>

      <div className="space-y-2.5">
        {words.map((word) => {
          const graded = revealed[word.id];
          const val = answers[word.id] ?? '';
          const matched = normalizeWord(val) === normalizeWord(word.answer);
          const state = graded ? (graded.correct ? 'ok' : 'bad') : matched ? 'ok' : undefined;
          return (
            <div key={word.id} className="cmc-rwb-card" data-grade={state}>
              <label className="block text-sm font-semibold">
                <span className="cmc-rwb-accent-text mr-1.5 font-extrabold">{word.number}.</span>
                {word.clue}
                <input
                  type="text"
                  data-wb-input={word.id}
                  data-grade={state}
                  value={val}
                  onChange={(event) => onAnswer(word.id, event.target.value)}
                  placeholder={`${word.answer.length} letters…`}
                  className="cmc-rwb-input mt-2 block w-full sm:w-56"
                />
              </label>
              {graded && (
                <p className={`mt-1 text-xs font-bold ${graded.correct ? 'cmc-rwb-ok-text' : 'cmc-rwb-bad-text'}`}>
                  {graded.correct ? '✓ Found!' : `✗ Word: ${graded.expected}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Interactive Crossword puzzle (Kid 3 Vocabulary Preview B). */
function CrosswordBlock({
  rows,
  cols,
  clues,
  answers,
  onAnswer,
  revealed,
}: {
  rows: number;
  cols: number;
  clues: readonly CrosswordClue[];
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  revealed: Record<string, GradedEntry>;
}) {
  const [activeClueId, setActiveClueId] = useState<string>(clues[0]?.id ?? '');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const matrix = useMemo(() => buildCrosswordGrid(rows, cols, clues), [rows, cols, clues]);
  const across = useMemo(() => clues.filter((c) => c.direction === 'across'), [clues]);
  const down = useMemo(() => clues.filter((c) => c.direction === 'down'), [clues]);

  // Compute displayed letter at each cell from typed clue answers.
  const cellLetters = useMemo(() => {
    const out = new Map<string, string>();
    for (const clue of clues) {
      const typed = (answers[clue.id] ?? '').trim().toUpperCase();
      for (let i = 0; i < clue.answer.length; i += 1) {
        const ch = typed[i];
        if (!ch || ch === ' ') continue;
        const r = clue.direction === 'down' ? clue.row + i : clue.row;
        const c = clue.direction === 'across' ? clue.col + i : clue.col;
        // Let the active clue override at crossing squares while typing.
        if (!out.has(`${r},${c}`) || clue.id === activeClueId) {
          out.set(`${r},${c}`, ch);
        }
      }
    }
    return out;
  }, [activeClueId, answers, clues]);

  const focusClue = (clueId: string) => {
    setActiveClueId(clueId);
    inputRefs.current[clueId]?.focus();
  };

  const renderClueColumn = (heading: string, list: readonly CrosswordClue[]) => (
    <div className="space-y-2.5">
      <h4 className="cmc-rwb-accent-text text-xs font-extrabold uppercase tracking-[0.14em]">{heading}</h4>
      {list.map((clue) => {
        const graded = revealed[clue.id];
        const state = graded ? (graded.correct ? 'ok' : 'bad') : undefined;
        return (
          <div key={clue.id} className="cmc-rwb-card" data-grade={state}>
            <label className="block text-sm font-semibold">
              <span className="cmc-rwb-accent-text mr-1.5 font-extrabold">{clue.number}.</span>
              {clue.clue}
              <input
                ref={(el) => { inputRefs.current[clue.id] = el; }}
                type="text"
                maxLength={clue.answer.length + 2}
                data-wb-input={clue.id}
                data-grade={state}
                value={answers[clue.id] ?? ''}
                onFocus={() => setActiveClueId(clue.id)}
                onChange={(event) => onAnswer(clue.id, event.target.value)}
                placeholder={`${clue.answer.length} letters`}
                className="cmc-rwb-input mt-2 block w-full uppercase tracking-wider sm:w-48"
              />
            </label>
            {graded && (
              <p className={`mt-1 text-xs font-bold ${graded.correct ? 'cmc-rwb-ok-text' : 'cmc-rwb-bad-text'}`}>
                {graded.correct ? '✓ Correct!' : `✗ Word: ${graded.expected}`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto pb-2">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, 2.05rem)` }}
          aria-label="Crossword puzzle grid"
        >
          {matrix.map((row, r) =>
            row.map((cell, c) => {
              if (!cell) {
                return <span key={`${r}-${c}`} className="h-[2.05rem] w-[2.05rem]" aria-hidden="true" />;
              }
              const letter = cellLetters.get(`${r},${c}`) ?? '';
              const isActive = cell.acrossId === activeClueId || cell.downId === activeClueId;
              const clueGrade = (cell.acrossId && revealed[cell.acrossId]) || (cell.downId && revealed[cell.downId]);
              const cellGrade = clueGrade
                ? letter.toLowerCase() === cell.solution ? 'ok' : 'bad'
                : undefined;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  data-active={isActive ? 'true' : 'false'}
                  data-grade={cellGrade}
                  onClick={() => {
                    const nextId =
                      activeClueId === cell.acrossId && cell.downId
                        ? cell.downId
                        : cell.acrossId ?? cell.downId;
                    if (nextId) focusClue(nextId);
                  }}
                  aria-label={`Crossword square row ${r + 1} column ${c + 1}${cell.number ? `, clue ${cell.number}` : ''}`}
                  className="cmc-rwb-cw-cell"
                >
                  {cell.number !== null && <span className="cmc-rwb-cw-num">{cell.number}</span>}
                  <span>{letter}</span>
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {renderClueColumn('Across →', across)}
        {renderClueColumn('Down ↓', down)}
      </div>
    </div>
  );
}

export function ReaderWorkbook({ workbook, onClose, onOpenPdf }: ReaderWorkbookProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const session = useSignedInSession();

  const [state, setState] = useState<SavedWorkbookState>(() => loadWorkbookState(workbook.id));
  const [sectionIdx, setSectionIdx] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, GradedEntry>>({});
  const [banner, setBanner] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [pendingCount, setPendingCount] = useState(() =>
    readWorkbookOutbox().filter((item) => item.drillSlug === workbook.drillSlug).length,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isTeacher, setIsTeacher] = useState(() => isTeacherLocalSession());
  const [showTeacherScores, setShowTeacherScores] = useState(false);
  const [showMyScore, setShowMyScore] = useState(false);

  // Sync teacher status when the user signs in/out while the workbook is open.
  useEffect(() => {
    const sync = () => setIsTeacher(isTeacherLocalSession());
    sync();
    window.addEventListener('cmc-auth-changed', sync);
    return () => window.removeEventListener('cmc-auth-changed', sync);
  }, []);

  // Pre-fill name if the student signs in after opening an unnamed sheet.
  useEffect(() => {
    const sessionName = cleanSubmitName(session?.displayName || '');
    if (!sessionName) return;
    setState((prev) => (prev.studentName ? prev : { ...prev, studentName: sessionName }));
  }, [session?.displayName]);

  // Persist every change locally.
  useEffect(() => {
    saveWorkbookState(workbook.id, state);
  }, [workbook.id, state]);

  // Flush any previously unsent submissions on open and whenever connectivity returns.
  const runFlush = useCallback(async () => {
    setFlushing(true);
    try {
      const result = await flushWorkbookOutbox(workbook.drillSlug);
      setPendingCount(result.remaining);
      if (result.sent > 0) {
        const refreshed = loadWorkbookState(workbook.id);
        setState((prev) => ({ ...prev, lastSubmitted: refreshed.lastSubmitted ?? prev.lastSubmitted }));
        setBanner({
          tone: 'ok',
          text: 'Saved score sent to your teacher now that the connection is back!',
        });
      }
    } finally {
      setFlushing(false);
    }
  }, [workbook.drillSlug, workbook.id]);

  useEffect(() => {
    if (readWorkbookOutbox().length > 0) void runFlush();
    const onOnline = () => { void runFlush(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [runFlush]);

  // Lock background scroll and allow Escape to close (unless a score modal is open).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showTeacherScores && !showMyScore) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showMyScore, showTeacherScores]);

  const grade = useMemo(() => gradeWorkbook(workbook, state.answers), [workbook, state.answers]);
  const section = workbook.sections[sectionIdx] ?? workbook.sections[0]!;
  const hasRevealed = Object.keys(revealed).length > 0;

  const setAnswer = useCallback((id: string, value: string) => {
    setConfirmReset(false);
    setState((prev) => {
      const nextAnswers = { ...prev.answers };
      if (value === '') delete nextAnswers[id];
      else nextAnswers[id] = value;
      return { ...prev, answers: nextAnswers };
    });
    // Clear stale feedback on the item the student is actively editing.
    setRevealed((prev) => {
      if (!(id in prev)) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const setNote = useCallback((id: string, value: string) => {
    setState((prev) => ({
      ...prev,
      notes: { ...prev.notes, [id]: value },
    }));
  }, []);

  const goSection = (idx: number) => {
    const clamped = Math.max(0, Math.min(workbook.sections.length - 1, idx));
    setSectionIdx(clamped);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckAnswers = () => {
    setConfirmReset(false);
    const current = gradeWorkbook(workbook, state.answers);
    setRevealed(current.byItem);
    setState((prev) => ({
      ...prev,
      firstCheck: prev.firstCheck ?? {
        correct: current.correct,
        answered: current.answered,
        total: current.total,
      },
      checkCount: prev.checkCount + 1,
    }));
    const secGrade = current.bySection[section.id];
    const secLine = secGrade ? `This tab: ${secGrade.correct}/${secGrade.total} right. ` : '';
    setBanner({
      tone: current.pct >= 80 ? 'ok' : current.pct >= 50 ? 'warn' : 'bad',
      text: `${secLine}Whole workbook: ${current.correct}/${current.total} (${current.pct}%) · ${current.answered}/${current.total} answered.`,
    });
  };

  const handleSubmitToTeacher = async () => {
    if (submitting) return;
    setConfirmReset(false);
    const cleanedName = cleanSubmitName(state.studentName);
    if (!cleanedName) {
      setBanner({
        tone: 'bad',
        text: 'Please write your name in the Student Name box before submitting to your teacher.',
      });
      nameInputRef.current?.focus();
      return;
    }

    const current = gradeWorkbook(workbook, state.answers);
    const firstCheck = state.firstCheck ?? {
      correct: current.correct,
      answered: current.answered,
      total: current.total,
    };
    setSubmitting(true);
    try {
      const res = await submitWorkbookToTeacher({
        bookId: workbook.id,
        drillSlug: workbook.drillSlug,
        drillTitle: workbook.drillTitle,
        studentName: cleanedName,
        correctCount: current.correct,
        totalCount: current.total,
        scorePct: current.pct,
        firstCorrectCount: firstCheck.correct,
        firstAnsweredCount: firstCheck.answered,
        checkCount: state.checkCount,
        queuedAt: Date.now(),
      });
      setPendingCount(
        readWorkbookOutbox().filter((item) => item.drillSlug === workbook.drillSlug).length,
      );
      if (res.ok && res.receipt) {
        setState((prev) => ({
          ...prev,
          studentName: cleanedName,
          firstCheck: prev.firstCheck ?? firstCheck,
          lastSubmitted: res.receipt,
        }));
        setBanner({ tone: 'ok', text: `✓ ${res.message}` });
      } else {
        setState((prev) => ({
          ...prev,
          studentName: cleanedName,
          firstCheck: prev.firstCheck ?? firstCheck,
        }));
        setBanner({ tone: res.queued ? 'warn' : 'bad', text: `⚠ ${res.message}` });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setRevealed({});
    setBanner({ tone: 'warn', text: 'Answers cleared so you can practise again.' });
    setState((prev) => ({
      ...prev,
      answers: {},
    }));
  };

  const handleShare = async () => {
    const url = shareWorkbookUrl(workbook);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `${workbook.gradeLabel} · ${workbook.title} — Workbook`,
          text: `Read ${workbook.title} and complete the ${workbook.gradeLabel} workbook on Creative Minds:`,
          url,
        });
        return;
      }
    } catch {
      /* cancelled or unsupported — copy link below */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 2200);
    } catch {
      setBanner({ tone: 'ok', text: `Direct link: ${url}` });
    }
  };

  const renderActivity = (activity: WorkbookActivity) => {
    switch (activity.kind) {
      case 'bank-fill': {
        const used = activity.items.map((item) => state.answers[item.id] ?? '');
        return (
          <>
            <WordBank words={activity.wordBank} usedValues={used} />
            <ol className="space-y-2.5">
              {activity.items.map((item, idx) => {
                const graded = revealed[item.id];
                return (
                  <li
                    key={item.id}
                    className="cmc-rwb-card text-sm leading-relaxed"
                    data-grade={graded ? (graded.correct ? 'ok' : 'bad') : undefined}
                  >
                    <span className="cmc-rwb-accent-text mr-1.5 font-extrabold">{idx + 1}.</span>
                    {item.label && (
                      <span className="mr-2 inline-block rounded-md border border-current/25 px-2 py-0.5 text-xs font-extrabold cmc-rwb-accent-text">
                        {item.label}
                      </span>
                    )}
                    <span className="font-medium">{item.prefix} </span>
                    <BankSelect
                      id={item.id}
                      options={activity.wordBank}
                      value={state.answers[item.id] ?? ''}
                      onChange={setAnswer}
                      graded={graded}
                      ariaLabel={`${activity.title} item ${idx + 1}`}
                    />
                    {item.suffix && <span className="font-medium"> {item.suffix}</span>}
                  </li>
                );
              })}
            </ol>
          </>
        );
      }

      case 'multi-blank': {
        const used = activity.sentences.flatMap((s) =>
          s.parts
            .filter((p): p is MultiBlankSlot => typeof p === 'object')
            .map((slot) => state.answers[slot.id] ?? ''),
        );
        return (
          <>
            <WordBank words={activity.wordBank} usedValues={used} />
            <div className="space-y-3">
              {activity.sentences.map((sentence, idx) => (
                <div key={sentence.id} className="cmc-rwb-card">
                  <p className="cmc-rwb-soft-text mb-2 text-xs font-semibold">{sentence.scene}</p>
                  <p className="text-sm font-medium leading-9">
                    <span className="cmc-rwb-accent-text mr-1.5 font-extrabold">{idx + 1}.</span>
                    {renderSlotParts(
                      sentence.parts,
                      activity.wordBank,
                      state.answers,
                      setAnswer,
                      revealed,
                      `Sentence ${idx + 1}`,
                    )}
                  </p>
                </div>
              ))}
            </div>
          </>
        );
      }

      case 'cause-effect': {
        const leftHeading = activity.leftLabel ?? 'Cause';
        const rightHeading = activity.rightLabel ?? 'Effect';
        const used = activity.rows.flatMap((row) =>
          [...row.cause, ...row.effect]
            .filter((p): p is MultiBlankSlot => typeof p === 'object')
            .map((slot) => state.answers[slot.id] ?? ''),
        );
        return (
          <>
            <WordBank words={activity.wordBank} usedValues={used} />
            <div className="space-y-3">
              {activity.rows.map((row, idx) => (
                <div
                  key={row.id}
                  className="cmc-rwb-card grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]"
                >
                  <div>
                    <span className="cmc-rwb-soft-text block text-[11px] font-bold uppercase tracking-wider">
                      {leftHeading} {idx + 1}
                    </span>
                    <p className="mt-1 text-sm font-medium leading-9">
                      {renderSlotParts(
                        row.cause,
                        activity.wordBank,
                        state.answers,
                        setAnswer,
                        revealed,
                        `${leftHeading} ${idx + 1}`,
                      )}
                    </p>
                  </div>
                  <div className="hidden justify-center md:flex" aria-hidden="true">
                    <ArrowRight className="h-5 w-5 cmc-rwb-accent-text" />
                  </div>
                  <div>
                    <span className="cmc-rwb-soft-text block text-[11px] font-bold uppercase tracking-wider">
                      {rightHeading} {idx + 1}
                    </span>
                    <p className="mt-1 text-sm font-medium leading-9">
                      {renderSlotParts(
                        row.effect,
                        activity.wordBank,
                        state.answers,
                        setAnswer,
                        revealed,
                        `${rightHeading} ${idx + 1}`,
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      }

      case 'binary-choice':
        return (
          <ol className="space-y-2.5">
            {activity.items.map((item, idx) => {
              const current = state.answers[item.id] ?? '';
              const graded = revealed[item.id];
              return (
                <li
                  key={item.id}
                  className="cmc-rwb-card"
                  data-grade={graded ? (graded.correct ? 'ok' : 'bad') : undefined}
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium leading-relaxed">
                    <span className="cmc-rwb-accent-text font-extrabold">{idx + 1}.</span>
                    <span>{item.prefix}</span>
                    {item.options.map((opt) => {
                      const pressed = normalizeWord(current) === normalizeWord(opt);
                      const chipState = graded
                        ? normalizeWord(opt) === normalizeWord(item.answer)
                          ? 'correct'
                          : pressed
                            ? 'wrong'
                            : undefined
                        : undefined;
                      return (
                        <button
                          key={opt}
                          type="button"
                          aria-pressed={pressed}
                          data-state={chipState}
                          onClick={() => setAnswer(item.id, opt)}
                          className="cmc-rwb-choice"
                        >
                          {opt}
                        </button>
                      );
                    })}
                    <span>{item.suffix}</span>
                  </div>
                  <p className="cmc-rwb-soft-text mt-1.5 text-xs">Clue: {item.hint}</p>
                </li>
              );
            })}
          </ol>
        );

      case 'true-false':
        return (
          <ol className="space-y-2.5">
            {activity.items.map((item, idx) => {
              const current = state.answers[item.id] ?? '';
              const graded = revealed[item.id];
              return (
                <li
                  key={item.id}
                  className="cmc-rwb-card flex flex-wrap items-center justify-between gap-3"
                  data-grade={graded ? (graded.correct ? 'ok' : 'bad') : undefined}
                >
                  <p className="min-w-0 flex-1 text-sm font-medium">
                    <span className="cmc-rwb-accent-text mr-1.5 font-extrabold">{idx + 1}.</span>
                    {item.statement}
                  </p>
                  <div className="flex items-center gap-1.5" role="group" aria-label={`Statement ${idx + 1} True or False`}>
                    {(['T', 'F'] as const).map((tf) => {
                      const pressed = current === tf;
                      const chipState = graded
                        ? item.answer === tf
                          ? 'correct'
                          : pressed
                            ? 'wrong'
                            : undefined
                        : undefined;
                      return (
                        <button
                          key={tf}
                          type="button"
                          aria-pressed={pressed}
                          data-state={chipState}
                          onClick={() => setAnswer(item.id, tf)}
                          className="cmc-rwb-choice min-w-[3rem]"
                        >
                          {tf === 'T' ? 'T · True' : 'F · False'}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        );

      case 'match-qa':
        return (
          <>
            <div className="cmc-rwb-card-alt mb-4 space-y-2">
              <p className="cmc-rwb-accent-text text-xs font-bold">{activity.scene}</p>
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {activity.options.map((opt) => (
                  <li key={opt.key} className="font-medium">
                    <span className="cmc-rwb-accent-text mr-1.5 font-extrabold">{opt.key}.</span>
                    {opt.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2.5">
              {activity.items.map((item) => {
                const current = state.answers[item.id] ?? '';
                const graded = revealed[item.id];
                return (
                  <div
                    key={item.id}
                    className="cmc-rwb-card flex flex-wrap items-center justify-between gap-3"
                    data-grade={graded ? (graded.correct ? 'ok' : 'bad') : undefined}
                  >
                    <p className="text-sm font-medium">{item.question}</p>
                    <div className="flex items-center gap-1.5" role="group" aria-label={item.question}>
                      {activity.options.map((opt) => {
                        const pressed = current === opt.key;
                        const chipState = graded
                          ? item.answer === opt.key
                            ? 'correct'
                            : pressed
                              ? 'wrong'
                              : undefined
                          : undefined;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            aria-pressed={pressed}
                            data-state={chipState}
                            onClick={() => setAnswer(item.id, opt.key)}
                            className="cmc-rwb-choice min-w-[2.4rem]"
                            title={opt.text}
                          >
                            {opt.key}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );

      case 'mcq':
        return (
          <div className="space-y-3">
            {activity.items.map((item) => {
              const current = state.answers[item.id] ?? '';
              const graded = revealed[item.id];
              return (
                <div
                  key={item.id}
                  className="cmc-rwb-card"
                  data-grade={graded ? (graded.correct ? 'ok' : 'bad') : undefined}
                >
                  <p className="text-sm font-bold">{item.prompt}</p>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2" role="group" aria-label={item.prompt}>
                    {item.options.map((opt) => {
                      const pressed = current === opt.key;
                      const chipState = graded
                        ? item.answer === opt.key
                          ? 'correct'
                          : pressed
                            ? 'wrong'
                            : undefined
                        : undefined;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          aria-pressed={pressed}
                          data-state={chipState}
                          onClick={() => setAnswer(item.id, opt.key)}
                          className="cmc-rwb-choice !justify-start !rounded-xl !px-3.5 !py-2.5 text-left"
                        >
                          <span className="font-extrabold uppercase">{opt.key}.</span>
                          <span className="font-semibold">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'unscramble':
        return (
          <div className="space-y-3">
            {activity.items.map((item, idx) => (
              <UnscrambleRow
                key={item.id}
                index={idx}
                item={item}
                value={state.answers[item.id] ?? ''}
                onChange={setAnswer}
                graded={revealed[item.id]}
              />
            ))}
          </div>
        );

      case 'word-search':
        return (
          <WordSearchBlock
            grid={activity.grid}
            words={activity.words}
            answers={state.answers}
            onAnswer={setAnswer}
            revealed={revealed}
          />
        );

      case 'crossword':
        return (
          <CrosswordBlock
            rows={activity.rows}
            cols={activity.cols}
            clues={activity.clues}
            answers={state.answers}
            onAnswer={setAnswer}
            revealed={revealed}
          />
        );

      case 'sequence': {
        const numbers = Array.from({ length: activity.count }, (_, idx) => String(idx + 1));
        return (
          <div className="space-y-2.5">
            {activity.leadSentence && (
              <div className="cmc-rwb-card-alt text-sm font-semibold">
                <span className="cmc-rwb-accent-text mr-2 text-xs font-extrabold uppercase tracking-wider">Start:</span>
                {activity.leadSentence}
              </div>
            )}
            {activity.items.map((item) => {
              const current = state.answers[item.id] ?? '';
              const graded = revealed[item.id];
              return (
                <div
                  key={item.id}
                  className="cmc-rwb-card flex flex-wrap items-center justify-between gap-3"
                  data-grade={graded ? (graded.correct ? 'ok' : 'bad') : undefined}
                >
                  <p className="min-w-0 flex-1 text-sm font-medium">
                    <span className="cmc-rwb-accent-text mr-2 inline-block rounded-md border border-current/25 px-2 py-0.5 text-xs font-extrabold">
                      {item.badge}
                    </span>
                    {item.text}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Order for ${item.badge}`}>
                    {numbers.map((num) => {
                      const pressed = current === num;
                      const chipState = graded
                        ? String(item.answer) === num
                          ? 'correct'
                          : pressed
                            ? 'wrong'
                            : undefined
                        : undefined;
                      return (
                        <button
                          key={num}
                          type="button"
                          aria-pressed={pressed}
                          data-state={chipState}
                          onClick={() => setAnswer(item.id, num)}
                          className="cmc-rwb-choice min-w-[2.25rem]"
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {activity.trailSentence && (
              <div className="cmc-rwb-card-alt text-sm font-semibold">
                <span className="cmc-rwb-accent-text mr-2 text-xs font-extrabold uppercase tracking-wider">End:</span>
                {activity.trailSentence}
              </div>
            )}
          </div>
        );
      }

      case 'open-prompts':
        return (
          <div className="space-y-3">
            {activity.prompts.map((prompt) => (
              <div key={prompt.id} className="cmc-rwb-card">
                <label className="block text-sm font-semibold">
                  {prompt.label}
                  <textarea
                    rows={2}
                    value={state.notes[prompt.id] ?? ''}
                    onChange={(event) => setNote(prompt.id, event.target.value)}
                    placeholder={prompt.placeholder}
                    className="cmc-rwb-textarea mt-2 block w-full"
                  />
                </label>
              </div>
            ))}
          </div>
        );

      case 'book-report': {
        const reportDate = state.notes.reportDate ?? todayIso();
        const favChar = state.notes.reportCharacter ?? '';
        const favWhy = state.notes.reportWhy ?? '';
        const review = state.notes.reportReview ?? '';
        return (
          <div className="cmc-rwb-card space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider cmc-rwb-soft-text">
                Title
                <input
                  type="text"
                  readOnly
                  value={activity.defaultTitle}
                  className="cmc-rwb-input mt-1 block w-full opacity-85"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider cmc-rwb-soft-text">
                Author
                <input
                  type="text"
                  readOnly
                  value={activity.defaultAuthor}
                  className="cmc-rwb-input mt-1 block w-full opacity-85"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider cmc-rwb-soft-text">
                Date
                <input
                  type="date"
                  value={reportDate}
                  onChange={(event) => setNote('reportDate', event.target.value)}
                  className="cmc-rwb-input mt-1 block w-full"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider cmc-rwb-soft-text">
                Interesting Character
                <input
                  type="text"
                  value={favChar}
                  onChange={(event) => setNote('reportCharacter', event.target.value)}
                  placeholder="Pick below or type a character…"
                  className="cmc-rwb-input mt-1 block w-full"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Story characters">
              {activity.characterChoices.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={favChar === name}
                  onClick={() => setNote('reportCharacter', name)}
                  className="cmc-rwb-choice"
                >
                  {name}
                </button>
              ))}
            </div>

            <label className="block text-sm font-semibold">
              I like this character because…
              <textarea
                rows={2}
                value={favWhy}
                onChange={(event) => setNote('reportWhy', event.target.value)}
                placeholder="Write why this character was interesting, brave, clever, or funny…"
                className="cmc-rwb-textarea mt-1.5 block w-full"
              />
            </label>

            <label className="block text-sm font-semibold">
              My Review of the Book
              <textarea
                rows={3}
                value={review}
                onChange={(event) => setNote('reportReview', event.target.value)}
                placeholder="Did you enjoy this story? What was your favorite moment?"
                className="cmc-rwb-textarea mt-1.5 block w-full"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="cmc-rwb-soft-text text-xs">
                Saved automatically on this device. Print to hand in a paper Book Report.
              </p>
              <button
                type="button"
                onClick={() => window.print()}
                className="cmc-rwb-btn"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print Book Report
              </button>
            </div>
          </div>
        );
      }
    }
  };

  const pctAnswered = grade.total > 0 ? Math.round((grade.answered / grade.total) * 100) : 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${workbook.gradeLabel} Interactive Workbook: ${workbook.title}`}
      data-reader-workbook={workbook.id}
      className="cmc-rwb"
    >
      <header className="cmc-rwb-header">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="cmc-rwb-btn cmc-rwb-btn-icon"
          aria-label="Close workbook"
          title="Back to the shelves (Esc)"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <img
          src={workbook.cover}
          alt=""
          className="hidden h-10 w-8 flex-none rounded object-cover shadow sm:block"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate font-[var(--font-display)] text-sm font-bold sm:text-base">
            <span className="cmc-rwb-accent-text mr-1.5">{workbook.gradeLabel}</span>
            {workbook.title}
          </p>
          <p className="cmc-rwb-soft-text truncate text-xs">
            Interactive Workbook · {workbook.author}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenPdf(section.pdfPage)}
          className="cmc-rwb-btn"
          title={`Open PDF workbook at page ${section.pdfPage}`}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Read PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>

        {isTeacher ? (
          <button
            type="button"
            onClick={() => setShowTeacherScores(true)}
            data-wb-teacher-scores
            className="cmc-rwb-btn"
            title="View class submissions for this workbook"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Scores</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowMyScore(true)}
            data-wb-my-score
            className="cmc-rwb-btn"
            title="See your submitted score"
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">My score</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => { void handleShare(); }}
          className="cmc-rwb-btn hidden md:inline-flex"
          title="Copy or share link to this workbook"
        >
          {copiedShare ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
          <span>{copiedShare ? 'Copied' : 'Share'}</span>
        </button>
      </header>

      <div ref={bodyRef} className="cmc-rwb-body">
        <div className="cmc-rwb-screen-only mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
          {/* Student identity + progress strip */}
          <div className="cmc-rwb-sheet space-y-3">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block text-xs font-bold uppercase tracking-[0.12em] cmc-rwb-soft-text">
                Student Name (sent to your teacher)
                <input
                  ref={nameInputRef}
                  type="text"
                  maxLength={40}
                  data-wb-student-name
                  value={state.studentName}
                  onChange={(event) => setState((prev) => ({ ...prev, studentName: event.target.value }))}
                  placeholder="Write your full name (e.g. Dara Kid 1A)…"
                  className="cmc-rwb-input mt-1.5 block w-full"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="cmc-rwb-card-alt inline-flex items-center gap-1.5 !py-2 !px-3">
                  <span>Answered:</span>
                  <span className="cmc-rwb-accent-text tabular-nums" data-wb-answered>
                    {grade.answered}/{grade.total}
                  </span>
                </span>
                {hasRevealed && (
                  <span className="cmc-rwb-card-alt inline-flex items-center gap-1.5 !py-2 !px-3" data-wb-score>
                    <span>Score:</span>
                    <span className={`tabular-nums ${grade.pct >= 80 ? 'cmc-rwb-ok-text' : 'cmc-rwb-warn-text'}`}>
                      {grade.correct}/{grade.total} ({grade.pct}%)
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-black/15" aria-hidden="true">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pctAnswered}%`, background: 'var(--rwb-accent)' }}
              />
            </div>

            {state.lastSubmitted && (
              <p className="cmc-rwb-ok-text flex flex-wrap items-center gap-1.5 text-xs font-semibold" data-wb-receipt>
                <CheckCircle2 className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                <span>
                  Last handed in: {state.lastSubmitted.correct}/{state.lastSubmitted.total} ({state.lastSubmitted.pct}%) as {state.lastSubmitted.name} · {scoreWhen(state.lastSubmitted.at)}
                </span>
              </p>
            )}

            {pendingCount > 0 && (
              <div className="cmc-rwb-banner flex flex-wrap items-center justify-between gap-2" data-tone="warn" data-wb-outbox role="status">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
                  <span>
                    Score NOT sent yet — kept safely on this device. Sends automatically when online.
                  </span>
                </span>
                <button
                  type="button"
                  disabled={flushing}
                  onClick={() => { void runFlush(); }}
                  className="cmc-rwb-btn !py-1.5 !px-3 !text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${flushing ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {flushing ? 'Sending…' : 'Retry now'}
                </button>
              </div>
            )}

            {banner && (
              <div className="cmc-rwb-banner" data-tone={banner.tone} data-wb-banner role="status" aria-live="polite">
                {banner.text}
              </div>
            )}
          </div>

          {/* 7 Section Tabs */}
          <div
            role="tablist"
            aria-label="Workbook sections"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {workbook.sections.map((sec, idx) => {
              const secGrade = grade.bySection[sec.id] ?? { answered: 0, correct: 0, total: 0 };
              const done = secGrade.total > 0 && secGrade.answered === secGrade.total;
              return (
                <button
                  key={sec.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === sectionIdx}
                  data-wb-tab={sec.id}
                  onClick={() => goSection(idx)}
                  className="cmc-rwb-tab"
                >
                  <span>{idx + 1}. {sec.shortTitle}</span>
                  <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] tabular-nums">
                    {done ? '✓' : `${secGrade.answered}/${secGrade.total}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Section Sheet */}
          <div className="cmc-rwb-sheet space-y-7" role="tabpanel" aria-label={section.title}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--rwb-border)' }}>
              <div>
                <h2 className="font-[var(--font-display)] text-xl font-bold sm:text-2xl">{section.title}</h2>
                <p className="cmc-rwb-mid-text mt-1 text-xs sm:text-sm">{section.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenPdf(section.pdfPage)}
                className="cmc-rwb-btn !text-xs"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                View PDF p. {section.pdfPage}
              </button>
            </div>

            {section.activities.map((activity) => (
              <section key={activity.id} className="space-y-3" aria-labelledby={`act-${activity.id}`}>
                <div>
                  <span className="cmc-rwb-accent-text text-[11px] font-extrabold uppercase tracking-[0.15em]">
                    {activity.badge}
                  </span>
                  <h3 id={`act-${activity.id}`} className="mt-0.5 font-[var(--font-display)] text-lg font-bold">
                    {activity.title}
                  </h3>
                  <p className="cmc-rwb-mid-text mt-0.5 text-xs sm:text-sm">{activity.instruction}</p>
                </div>
                {renderActivity(activity)}
              </section>
            ))}
          </div>
        </div>

        {/* Printable one-page Book Report & Workbook Summary */}
        <div className="cmc-rwb-print-only">
          <h1 style={{ fontSize: '20pt', fontWeight: 800, margin: 0 }}>
            {workbook.gradeLabel} Book Report — {workbook.title}
          </h1>
          <p style={{ fontSize: '10pt', color: '#475569', marginTop: '4pt' }}>
            Creative Minds Reading Room · {workbook.author} ({workbook.seriesLabel})
          </p>
          <hr style={{ margin: '10pt 0', borderColor: '#cbd5e1' }} />
          <p style={{ fontSize: '11pt', margin: '6pt 0' }}>
            <strong>Student:</strong> {state.studentName || '________________________'}{' '}
            &nbsp;&nbsp; <strong>Date:</strong> {state.notes.reportDate || todayIso()}{' '}
            &nbsp;&nbsp; <strong>Workbook Score:</strong> {grade.correct}/{grade.total} ({grade.pct}%)
          </p>
          <h2 style={{ fontSize: '13pt', fontWeight: 700, marginTop: '14pt' }}>Interesting Character</h2>
          <p style={{ fontSize: '11pt', minHeight: '20pt' }}>
            <strong>{state.notes.reportCharacter || '—'}</strong>
          </p>
          <p style={{ fontSize: '11pt', minHeight: '42pt', whiteSpace: 'pre-wrap' }}>
            {state.notes.reportWhy || ''}
          </p>
          <h2 style={{ fontSize: '13pt', fontWeight: 700, marginTop: '14pt' }}>My Review of the Book</h2>
          <p style={{ fontSize: '11pt', minHeight: '60pt', whiteSpace: 'pre-wrap' }}>
            {state.notes.reportReview || ''}
          </p>
        </div>
      </div>

      {/* Bottom toolbar: Prev/Next + Check answers + Submit to Teacher + Reset */}
      <footer className="cmc-rwb-footer">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={sectionIdx === 0}
              onClick={() => goSection(sectionIdx - 1)}
              className="cmc-rwb-btn"
              aria-label="Previous section"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <button
              type="button"
              disabled={sectionIdx >= workbook.sections.length - 1}
              onClick={() => goSection(sectionIdx + 1)}
              className="cmc-rwb-btn"
              aria-label="Next section"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="cmc-rwb-btn"
              title="Clear answers and try again"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{confirmReset ? 'Confirm reset?' : 'Reset'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckAnswers}
              data-wb-check
              className="cmc-rwb-btn cmc-rwb-btn-accent"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Check answers</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => { void handleSubmitToTeacher(); }}
              data-wb-submit
              className="cmc-rwb-btn cmc-rwb-btn-submit"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>{submitting ? 'Sending…' : 'Submit to Teacher'}</span>
            </button>
          </div>
        </div>
      </footer>

      {showTeacherScores && (
        <KidHomeworkScores
          title={`${workbook.title} — Interactive Workbook`}
          href={workbook.workbookHref}
          drillSlug={workbook.drillSlug}
          wholePage
          gradeLabel={workbook.gradeLabel}
          kindLabel="Reader workbook scores"
          submitHint="Students open the workbook in the Reading Room and press Submit to Teacher."
          onClose={() => setShowTeacherScores(false)}
        />
      )}

      {showMyScore && (
        <KidMyHomeworkScore
          title={`${workbook.title} — Interactive Workbook`}
          href={workbook.workbookHref}
          drillSlug={workbook.drillSlug}
          wholePage
          gradeLabel={workbook.gradeLabel}
          uid={session?.localId ?? ''}
          name={session?.displayName || state.studentName}
          onOpenAuth={() => {
            setShowMyScore(false);
            requestAuth({ mode: 'sign-in', returnUrl: workbook.workbookHref });
          }}
          onClose={() => setShowMyScore(false)}
        />
      )}
    </div>,
    document.body,
  );
}
