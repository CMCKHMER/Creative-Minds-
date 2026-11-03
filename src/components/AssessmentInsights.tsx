// Insight AI tab — who is rising, who is falling, who needs attention.
//
// Renders the deterministic on-device analysis from src/lib/insightEngine.ts:
// a class pulse grid, rising/falling/steady/needs-data lists with sparklines,
// and a keyword assistant thread. All computation happens from the RAW roster
// already in memory — nothing is sent anywhere.

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bot, Send, Sparkles, User } from 'lucide-react';
import type { AssessmentStudentDoc } from '../lib/assessmentDb';
import {
  answerInsightQuestion,
  buildClassInsights,
  SUGGESTION_CHIPS,
  type ClassInsights,
  type StudentInsight,
} from '../lib/insightEngine';

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

// ── Assistant thread ─────────────────────────────────────────────────

interface ChatMsg { role: 'teacher' | 'ai'; text: string }

function AssistantThread({ insights }: { insights: ClassInsights }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'ai', text: 'Ask me about your class — try a suggestion below, or type a student\'s name.' },
  ]);
  const [input, setInput] = useState('');

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const { text } = answerInsightQuestion(q, insights);
    setMessages((prev) => [...prev, { role: 'teacher', text: q }, { role: 'ai', text }]);
    setInput('');
  };

  return (
    <div className="rounded-xl border border-cyan-300/15 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><Bot className="h-3.5 w-3.5" aria-hidden="true" /></span>
        <div>
          <p className="text-xs font-bold text-white">Insight assistant</p>
          <p className="text-[9px] font-semibold tracking-[0.1em] text-slate-500 uppercase">On-device · no data leaves this browser</p>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex items-start gap-2 ${m.role === 'teacher' ? 'flex-row-reverse' : ''}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${m.role === 'teacher' ? 'border-white/10 bg-white/[0.05] text-slate-300' : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200'}`}>
              {m.role === 'teacher' ? <User className="h-3 w-3" aria-hidden="true" /> : <Bot className="h-3 w-3" aria-hidden="true" />}
            </span>
            <p className={`max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-[11px] leading-relaxed ${m.role === 'teacher' ? 'bg-cyan-300/10 text-cyan-50' : 'border border-white/8 bg-white/[0.03] text-slate-200'}`}>
              {m.text}
            </p>
          </div>
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
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a student or the class…"
          aria-label="Ask the insight assistant"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-3 py-2 text-[11px] font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Ask
        </button>
      </form>
    </div>
  );
}

// ── Tab root ─────────────────────────────────────────────────────────

export function AssessmentInsights({ students }: { students: AssessmentStudentDoc[] }) {
  const insights = useMemo(() => buildClassInsights(students), [students]);
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
          <span className="font-bold text-slate-200">AI Insights.</span> Computed on-device from the recorded history — who is rising, who is falling, and what to do next. Nothing is uploaded.
        </p>
      </div>

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

      <AssistantThread insights={insights} />
    </div>
  );
}
