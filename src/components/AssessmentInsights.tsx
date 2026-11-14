// AI Tutor tab — who is rising, who is falling, who needs attention — plus
// the tutor agent that can WRITE: the teacher keys stats in plain language,
// the agent parses them into record operations, shows a confirmation card,
// and applies them through the exact same Firestore data layer the tables
// use (same masks, same audit stamps). All parsing/analysis is on-device —
// nothing is uploaded, no model calls, no keys.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bot, Check, ClipboardList, Loader2, MessageSquareText, Send, Sparkles, Undo2, User } from 'lucide-react';
import type { AssessmentStudentDoc } from '../lib/assessmentDb';
import { formatWeekLabel } from '../lib/assessmentDb';
import {
  answerInsightQuestion,
  buildClassInsights,
  SUGGESTION_CHIPS,
  type ClassInsights,
  type StudentInsight,
} from '../lib/insightEngine';
import { auditMissedInputs, buildAssessmentFeedback, type MissedInputReport } from '../lib/assessmentAudit';
import { parseTutorCommand, TUTOR_HELP, type TutorIntent } from '../lib/tutorAgent';

/** Bridge from the workspace: everything the agent needs to actually
 *  maintain the records. execute() runs the intents through the same db
 *  layer + optimistic merge the tables use, and returns an undo closure
 *  for the just-applied writes. */
export interface TutorAgentBridge {
  /** Currently selected week — null = the Initial record. */
  weekKey: string | null;
  execute: (intents: TutorIntent[]) => Promise<{ ok: boolean; message: string; undo?: () => Promise<void> }>;
}

// ── Sparkline (pure SVG, 0–100 normalized) ───────────────────────────

function Sparkline({ values, tone }: { values: number[]; tone: 'good' | 'bad' | 'flat' }) {
  if (values.length < 2) {
    return <span className="text-[10px] font-semibold text-slate-600">not enough data</span>;
  }
  const w = 96;
  const h = 28;
  const pad = 2;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = tone === 'good' ? '#6ee7b7' : tone === 'bad' ? '#fda4af' : '#94a3b8';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Flag badges ──────────────────────────────────────────────────────

function FlagBadges({ i }: { i: StudentInsight }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {i.flags.urgent && (
        <span className="inline-flex items-center gap-1 rounded-md border border-rose-300/30 bg-rose-400/10 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.1em] text-rose-200 uppercase"><AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" /> Urgent</span>
      )}
      {i.flags.watch && !i.flags.urgent && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold tracking-[0.1em] text-amber-200 uppercase">Watch</span>
      )}
      {i.flags.engagementDrop && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.1em] text-amber-100/90 uppercase">Engagement dip</span>
      )}
      {i.volatility >= 12 && (
        <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.1em] text-slate-400 uppercase">σ {i.volatility}</span>
      )}
    </span>
  );
}

// ── Student card ─────────────────────────────────────────────────────

function StudentCard({ i, tone }: { i: StudentInsight; tone: 'good' | 'bad' | 'flat' }) {
  const delta = i.latest - i.first;
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">{i.student.name || 'Unnamed student'}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
            {i.first}% → {i.latest}% ({delta > 0 ? '+' : ''}{delta} pts · {i.slope > 0 ? '+' : ''}{i.slope}/step)
          </p>
        </div>
        <Sparkline values={i.series.map((p) => p.overall)} tone={tone} />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{i.narrative}</p>
      {(i.flags.urgent || i.flags.watch || i.flags.engagementDrop || i.volatility >= 12) && (
        <div className="mt-2"><FlagBadges i={i} /></div>
      )}
      {i.actions.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {i.actions.slice(0, 2).map((a) => (
            <li key={a} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/60" aria-hidden="true" />{a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Tutor agent thread ──────────────────────────────────────────────

interface ChatMsg {
  /** Stable per-message id — card updates key on it, never on object
   *  identity: the first status change replaces the object, so an
   *  identity-based second update would silently miss (card stuck at
   *  "applying" even though the save landed). */
  id: number;
  role: 'teacher' | 'ai';
  text: string;
  card?: {
    intents: TutorIntent[];
    summary: string[];
    status: 'draft' | 'applying' | 'applied' | 'failed' | 'undone';
    message?: string;
    undo?: () => Promise<void>;
  };
}

/** Render **bold** segments in a summary line (agent cards use them). */
function bold(line: string): ReactNode[] {
  return line.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    (i % 2 === 1 ? <strong key={i} className="font-bold text-white">{part}</strong> : part));
}

function IntentCard({ msg, onApply, onUndo }: { msg: ChatMsg; onApply: (id: number) => void; onUndo: (id: number) => void }) {
  const card = msg.card!;
  return (
    <div className={`w-[88%] rounded-xl border p-3 ${card.status === 'failed' ? 'border-rose-300/25 bg-rose-400/[0.06]' : card.status === 'applied' ? 'border-emerald-300/25 bg-emerald-400/[0.06]' : 'border-cyan-300/25 bg-cyan-300/[0.05]'}`}>
      <div className="space-y-0.5 text-[11px] leading-relaxed text-slate-200">
        {card.summary.map((line, i) => <p key={i}>{bold(line)}</p>)}
      </div>
      {card.status === 'draft' && (
        <div className="mt-2.5 flex items-center gap-2">
          <button type="button" onClick={() => onApply(msg.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 transition hover:-translate-y-0.5">
            <Check className="h-3 w-3" aria-hidden="true" /> Apply to records
          </button>
          <span className="text-[9px] font-semibold text-slate-500">Nothing is saved until you apply.</span>
        </div>
      )}
      {card.status === 'applying' && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-200"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Saving to the records…</p>
      )}
      {card.status === 'applied' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-200"><Check className="h-3 w-3" aria-hidden="true" /> {card.message || 'Saved to the records.'}</p>
          {card.undo && (
            <button type="button" onClick={() => onUndo(msg.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[0.09]">
              <Undo2 className="h-3 w-3" aria-hidden="true" /> Undo
            </button>
          )}
        </div>
      )}
      {card.status === 'undone' && (
        <p className="mt-2.5 text-[10px] font-bold text-slate-400">Undone — the previous values were written back.</p>
      )}
      {card.status === 'failed' && (
        <p className="mt-2.5 inline-flex items-start gap-1.5 text-[10px] font-semibold leading-relaxed text-rose-200"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> {card.message}</p>
      )}
    </div>
  );
}

function TutorThread({ insights, agent, students, audit }: { insights: ClassInsights; agent: TutorAgentBridge | null; students: AssessmentStudentDoc[]; audit: MissedInputReport }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 0, role: 'ai', text: 'I keep your records. Key stats in plain language — "Dara listening 4 speaking 3" — and I file them after you apply. Or ask about the class: try a suggestion below.' },
  ]);
  const [input, setInput] = useState('');
  const nextId = useRef(1);
  const newMsg = (m: Omit<ChatMsg, 'id'>): ChatMsg => ({ ...m, id: nextId.current++ });

  // The agent actively LOOKS for missed inputs: it speaks up in the thread
  // once per distinct scan result (open, week change, record change) —
  // owner: "Ai needs to be working looking for missed input and assessment
  // feedback".
  const scanWeek = agent?.weekKey ?? null;
  const lastScan = useRef<string>('');
  useEffect(() => {
    const findings = audit.week.length + audit.initial.length;
    const key = `${scanWeek ?? 'base'}|${students.length}|${findings}|${audit.week.map((f) => f.studentId + f.kind).join(',')}`;
    if (lastScan.current === key) return;
    lastScan.current = key;
    if (findings === 0) return; // quiet when there is nothing to fix
    const lines = [...audit.week, ...audit.initial].map((f) => `• ${f.detail}`);
    setMessages((prev) => [...prev, {
      id: nextId.current++,
      role: 'ai',
      text: `I scanned the records for missed inputs.\n${audit.headline}\n${lines.join('\n')}\nSay "assessment feedback" and I will draft a per-student comment you can read out or save as a note.`,
    }]);
  }, [audit, scanWeek, students.length]);

  /** The missed-input report as a thread message. */
  const missedText = (report: MissedInputReport): string => {
    const findings = report.week.length + report.initial.length;
    if (findings === 0) return report.headline;
    const lines = [...report.week, ...report.initial].map((f) => `• ${f.detail}`);
    return `I scanned the records for missed inputs.\n${report.headline}\n${lines.join('\n')}`;
  };
  const feedbackText = (): string => {
    const lines = buildAssessmentFeedback(students, scanWeek);
    return `Assessment feedback — ${scanWeek ? formatWeekLabel(scanWeek) : 'initial record'}:\n${lines.map((l) => `• ${l.text}`).join('\n')}\nSave any line with "note for <student>: …" and I will file it.`;
  };

  /** Patch one message's card BY ID — safe across repeated updates. */
  const setCard = (id: number, patch: (card: NonNullable<ChatMsg['card']>) => NonNullable<ChatMsg['card']>) => {
    setMessages((prev) => prev.map((m) => (m.id === id && m.card ? { ...m, card: patch(m.card) } : m)));
  };

  const apply = async (id: number) => {
    const msg = messages.find((m) => m.id === id);
    if (!agent || !msg?.card) return;
    const intents = msg.card.intents;
    setCard(id, (card) => ({ ...card, status: 'applying' }));
    try {
      const res = await agent.execute(intents);
      setCard(id, (card) => ({ ...card, status: res.ok ? 'applied' : 'failed', message: res.message, undo: res.undo }));
    } catch (e) {
      setCard(id, (card) => ({ ...card, status: 'failed', message: String((e as Error)?.message ?? e) }));
    }
  };

  const undo = async (id: number) => {
    const fn = messages.find((m) => m.id === id)?.card?.undo;
    if (!fn) return;
    try { await fn(); } finally {
      setCard(id, (card) => ({ ...card, status: 'undone', undo: undefined }));
    }
  };

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setInput('');
    if (/^(help|what can you (do|record)|how (do|to) (i )?record)/i.test(q)) {
      setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: q }), newMsg({ role: 'ai', text: TUTOR_HELP })]);
      return;
    }
    const parsed = parseTutorCommand(q, { students, weekKey: agent?.weekKey ?? null });
    if (parsed.problem) {
      setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: q }), newMsg({ role: 'ai', text: parsed.problem! })]);
      return;
    }
    if (parsed.intents.length > 0) {
      setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: q }), newMsg({ role: 'ai', text: 'Ready to write — check this card:', card: { intents: parsed.intents, summary: parsed.summary, status: 'draft' } })]);
      return;
    }
    // Question routing — the agent's own scans before the generic Q&A.
    if (/\b(missed|missing|incomplete|not recorded|gaps?)\b/i.test(q)) {
      setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: q }), newMsg({ role: 'ai', text: missedText(audit) })]);
      return;
    }
    if (/\bfeedback\b/i.test(q)) {
      setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: q }), newMsg({ role: 'ai', text: feedbackText() })]);
      return;
    }
    const { text } = answerInsightQuestion(q, insights);
    setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: q }), newMsg({ role: 'ai', text })]);
  };

  return (
    <div className="rounded-xl border border-cyan-300/15 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><Bot className="h-3.5 w-3.5" aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-bold text-white">Tutor agent</p>
          <p className="text-[9px] font-semibold tracking-[0.1em] text-slate-500 uppercase">On-device · records keyed-in stats · nothing leaves this browser</p>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {messages.map((m, idx) => (
          m.card
            ? <div key={m.id} className="flex justify-start"><IntentCard msg={m} onApply={(id) => void apply(id)} onUndo={(id) => void undo(id)} /></div>
            : (
              <div key={idx} className={`flex items-start gap-2 ${m.role === 'teacher' ? 'flex-row-reverse' : ''}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${m.role === 'teacher' ? 'border-white/10 bg-white/[0.05] text-slate-300' : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200'}`}>
                  {m.role === 'teacher' ? <User className="h-3 w-3" aria-hidden="true" /> : <Bot className="h-3 w-3" aria-hidden="true" />}
                </span>
                <p className={`max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-[11px] leading-relaxed ${m.role === 'teacher' ? 'bg-cyan-300/10 text-cyan-50' : 'border border-white/8 bg-white/[0.03] text-slate-200'}`}>
                  {m.text}
                </p>
              </div>
            )
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => ask(chip)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
          >
            {chip}
          </button>
        ))}
        <button
          type="button"
          onClick={() => ask('help')}
          className="rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] px-2.5 py-1 text-[10px] font-semibold text-cyan-100 transition hover:border-cyan-300/50"
        >
          How to record scores
        </button>
        <button
          type="button"
          onClick={() => setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: 'Any missed inputs?' }), newMsg({ role: 'ai', text: missedText(audit) })])}
          className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/[0.06] px-2.5 py-1 text-[10px] font-semibold text-amber-100 transition hover:border-amber-300/50"
        >
          <ClipboardList className="h-3 w-3" aria-hidden="true" /> Find missed inputs
        </button>
        <button
          type="button"
          onClick={() => setMessages((prev) => [...prev, newMsg({ role: 'teacher', text: 'Assessment feedback' }), newMsg({ role: 'ai', text: feedbackText() })])}
          className="inline-flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] px-2.5 py-1 text-[10px] font-semibold text-cyan-100 transition hover:border-cyan-300/50"
        >
          <MessageSquareText className="h-3 w-3" aria-hidden="true" /> Assessment feedback
        </button>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={agent ? 'e.g. Dara listening 4 speaking 3 · or ask who is falling…' : 'Ask about a student or the class…'}
          aria-label="Ask the tutor agent"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-3 py-2 text-[11px] font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> {agent ? 'Record / Ask' : 'Ask'}
        </button>
      </form>
    </div>
  );
}

// ── Tab root ─────────────────────────────────────────────────────────

export function AssessmentInsights({ students, agent }: { students: AssessmentStudentDoc[]; agent?: TutorAgentBridge | null }) {
  const insights = useMemo(() => buildClassInsights(students), [students]);
  const audit = useMemo(() => auditMissedInputs(students, agent?.weekKey ?? null), [students, agent?.weekKey]);
  const { pulse, rising, falling, steady, needsData } = insights;

  const chips: Array<{ label: string; value: number; cls: string }> = [
    { label: 'Rising', value: pulse.rising, cls: 'text-emerald-300 border-emerald-300/25 bg-emerald-300/[0.07]' },
    { label: 'Falling', value: pulse.falling, cls: 'text-rose-300 border-rose-300/25 bg-rose-300/[0.07]' },
    { label: 'Steady', value: pulse.steady, cls: 'text-slate-300 border-white/10 bg-white/[0.03]' },
    { label: 'Needs data', value: pulse.needsData, cls: 'text-amber-200 border-amber-300/20 bg-amber-300/[0.05]' },
  ];

  return (
    <div className="space-y-5 px-2" data-testid="insights-tab">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-cyan-200" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          <span className="font-bold text-slate-200">AI Tutor.</span> Key stats in plain language and the agent files them into your records after you apply — it also reads the saved history for who is rising, who is falling, and what to do next. Computed on-device; nothing is uploaded.
        </p>
      </div>

      {/* Missed inputs — the agent's active scan, quiet when everything is in. */}
      {audit.week.length + audit.initial.length > 0 ? (
        <section className="rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-4" data-testid="missed-inputs">
          <h3 className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-amber-200 uppercase">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Missed inputs ({audit.week.length + audit.initial.length}){agent?.weekKey ? ` — ${formatWeekLabel(agent.weekKey)}` : ''}
          </h3>
          <ul className="mt-2 space-y-1">
            {[...audit.week, ...audit.initial].map((f) => (
              <li key={f.studentId + f.kind} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-200">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-300/70" aria-hidden="true" />{f.detail}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-slate-500">The tutor agent re-scans whenever the records or the week change — key the missing scores in the AI Tutor thread and this list clears itself.</p>
        </section>
      ) : !audit.started ? (
        <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5 text-[11px] font-semibold text-slate-400" data-testid="missed-inputs-quiet">
          {audit.headline}
        </p>
      ) : (
        <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.04] px-3.5 py-2.5 text-[11px] font-semibold text-emerald-200" data-testid="missed-inputs-clear">
          No missed inputs{agent?.weekKey ? ` for ${formatWeekLabel(agent.weekKey)}` : ''} — every student has the areas the class recorded.
        </p>
      )}

      {/* Pulse grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chips.map((c) => (
          <div key={c.label} className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 ${c.cls}`}>
            <span className="cmc-stat-num text-2xl">{c.value}</span>
            <span className="text-[9px] font-bold tracking-[0.12em] uppercase">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Falling list — highest priority */}
        <section className="space-y-2.5">
          <h3 className="flex items-center gap-1.5 px-1 text-[10px] font-bold tracking-[0.14em] text-rose-200 uppercase">
            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" /> Falling ({falling.length})
          </h3>
          {falling.length === 0
            ? <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3 text-[11px] text-slate-500">No falling students — the whole tracked roster is holding or improving.</p>
            : [...falling].sort((a, b) => a.slope - b.slope).map((i) => <StudentCard key={i.student.id} i={i} tone="bad" />)}
        </section>

        {/* Rising list */}
        <section className="space-y-2.5">
          <h3 className="flex items-center gap-1.5 px-1 text-[10px] font-bold tracking-[0.14em] text-emerald-200 uppercase">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> Rising ({rising.length})
          </h3>
          {rising.length === 0
            ? <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3 text-[11px] text-slate-500">No rising students yet — record another week so trends can form.</p>
            : [...rising].sort((a, b) => b.slope - a.slope).map((i) => <StudentCard key={i.student.id} i={i} tone="good" />)}
        </section>
      </div>

      {/* Steady + needs-data compact lists */}
      {(steady.length > 0 || needsData.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
            <h3 className="text-[10px] font-bold tracking-[0.14em] text-slate-300 uppercase">Steady ({steady.length})</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              {steady.length === 0 ? '—' : steady.map((i) => `${i.student.name || 'Unnamed'} (${i.latest}%)`).join(' · ')}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
            <h3 className="text-[10px] font-bold tracking-[0.14em] text-amber-200/90 uppercase">Needs data ({needsData.length})</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              {needsData.length === 0 ? '—' : needsData.map((i) => `${i.student.name || 'Unnamed'} (${i.series.length === 0 ? 'no scores' : '1 recording'})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Class-level movements + recommendations */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
          <h3 className="text-[10px] font-bold tracking-[0.14em] text-slate-300 uppercase">Area movements (class level)</h3>
          <ul className="mt-2 space-y-1">
            {insights.areaMovements.map((a) => (
              <li key={a.label} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-300">{a.label}</span>
                <span className={`font-bold ${(a.delta > 0) ? 'text-emerald-300' : a.delta < 0 ? 'text-rose-300' : 'text-slate-500'}`}>
                  {a.delta > 0 ? '+' : ''}{a.delta} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3.5">
          <h3 className="text-[10px] font-bold tracking-[0.14em] text-cyan-200 uppercase">What to do next</h3>
          <ul className="mt-2 space-y-1.5">
            {insights.recommendations.map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-200">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-300/70" aria-hidden="true" />{r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <TutorThread insights={insights} agent={agent ?? null} students={students} audit={audit} />
    </div>
  );
}
