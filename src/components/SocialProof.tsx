import React from 'react';
import { ArrowUpRight, BookOpen, Check, ClipboardCheck, Feather, Gamepad2, GraduationCap, Headphones, Headset, Mic, PenLine, Shapes } from 'lucide-react';
import { CLASSROOM_ASSIGNMENTS } from '../data/assignments';
import { TOEFL_JUNIOR_ASSESSMENTS } from '../data/toeflJuniorAssessments';

const practiceAreas = [
  { label: 'Reading', icon: BookOpen },
  { label: 'Listening', icon: Headphones },
  { label: 'Language use', icon: Shapes },
  { label: 'Speaking', icon: Feather },
  { label: 'Writing', icon: ClipboardCheck },
];

const contentCards = [
  {
    stat: '06',
    statLabel: 'Classroom assignment packs',
    title: 'Ready-to-use assignments',
    description: 'Six original packs covering reading comprehension, vocabulary, grammar, and writing. Each includes a printable student copy and a separate teacher key with suggested answers.',
    icon: BookOpen,
    accent: 'cyan',
    link: '#resources',
    linkText: 'Browse assignments',
    features: ['Student + teacher editions', 'Printable HTML format', 'Answer keys included'],
  },
  {
    stat: '15',
    statLabel: 'TOEFL Junior assessments',
    title: 'TOEFL Junior practice studio',
    description: 'Five speaking, five listening, and five writing assessment packs. Every listening set ships with a full audio player — play, pause, replay at adjustable speed, with live sentence tracking.',
    icon: GraduationCap,
    accent: 'teal',
    link: '#toefl-junior-assessments',
    linkText: 'Explore assessments',
    features: ['Audio playback with speed control', 'Speaking + writing rubrics', 'Student and teacher keys'],
  },
  {
    stat: '04',
    statLabel: 'TOEFL iBT sections',
    title: 'TOEFL iBT full mock test',
    description: 'A complete four-section TOEFL iBT exam — Reading, Listening (with audio), Speaking (with microphone recording), and Writing. Includes a per-section timer, progress tracking, and a security-notice flow that simulates the real exam.',
    icon: GraduationCap,
    accent: 'violet',
    link: '#toefl-ibt-mock',
    linkText: 'Start the mock test',
    features: ['36 audio MP3 files', 'Microphone recording', 'Per-section timers'],
  },
  {
    stat: '08',
    statLabel: 'Learning games',
    title: 'Learning Games Play Lab',
    description: 'Eight browser-based mini-games for vocabulary, reading, grammar, listening, and early literacy. Includes Syntax Clash Pro (grammar arcade), Tense Master (verb tenses), WriteQuest (writing studio), and five in-page games.',
    icon: Gamepad2,
    accent: 'amber',
    link: '#games',
    linkText: 'Play games',
    features: ['No login required', 'Progress saved locally', 'Grammar + vocabulary + reading'],
  },
  {
    stat: '06',
    statLabel: 'OSW listening worksheets',
    title: 'Oxford Skills World · Listening 3',
    description: 'Six interactive listening worksheets from Oxford Skills World Level 3 — Angelo and the Musician, Showing Your Colors, How Big Is That Book?, and more. Each has Parts A/B/C with MCQ, ordering, and yes/no questions, plus an audio player and auto-scoring.',
    icon: Headset,
    accent: 'sky',
    link: 'https://cmckhmer.github.io/OSW-Listen-with-speaking/',
    linkText: 'Open worksheets',
    features: ['Audio player with speed control', 'Auto-scoring + progress', '6 topics · Parts A/B/C'],
  },
];

const accentMap: Record<string, { border: string; text: string; bg: string; stat: string }> = {
  cyan: { border: 'border-cyan-300/25', text: 'text-cyan-300', bg: 'bg-cyan-300/5', stat: 'text-cyan-200' },
  teal: { border: 'border-teal-300/25', text: 'text-teal-300', bg: 'bg-teal-300/5', stat: 'text-teal-200' },
  violet: { border: 'border-violet-300/25', text: 'text-violet-300', bg: 'bg-violet-300/5', stat: 'text-violet-200' },
  amber: { border: 'border-amber-300/25', text: 'text-amber-300', bg: 'bg-amber-300/5', stat: 'text-amber-200' },
  sky: { border: 'border-sky-300/25', text: 'text-sky-300', bg: 'bg-sky-300/5', stat: 'text-sky-200' },
};

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
              {classroomPackCount} classroom assignment packs, {assessmentCount} TOEFL Junior assessments, a full TOEFL iBT mock test, {`8`} learning games, and 6 Oxford Skills World listening worksheets — all free, all in the browser.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {contentCards.map((card, index) => {
              const accent = accentMap[card.accent] || accentMap.cyan;
              const Icon = card.icon;
              const isExternal = card.link.startsWith('http');
              return (
                <a
                  key={index}
                  href={card.link}
                  {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`cmc-glass group relative flex flex-col gap-3 p-5 ${accent.border}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`cmc-icon-glow grid h-10 w-10 place-items-center rounded-xl border ${accent.border} ${accent.bg} ${accent.text}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <span className={`cmc-stat-num text-2xl`}>{card.stat}</span>
                        <span className="ml-2 text-xs font-semibold text-slate-300">{card.statLabel}</span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-slate-500 opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{card.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{card.description}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {card.features.map((feat, fi) => (
                      <span key={fi} className={`inline-flex items-center gap-1 rounded-md border ${accent.border} px-2 py-0.5 text-[10px] font-medium ${accent.text}`}>
                        <Check className="h-2.5 w-2.5" aria-hidden="true" />
                        {feat}
                      </span>
                    ))}
                  </div>
                  <span className={`mt-1 text-xs font-bold ${accent.text} group-hover:underline`}>
                    {card.linkText} →
                  </span>
                </a>
              );
            })}
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
