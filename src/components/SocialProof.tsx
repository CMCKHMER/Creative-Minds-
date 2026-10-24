import React from 'react';
import { ArrowUpRight, Blocks, BookOpen, Check, ClipboardCheck, Feather, Gamepad2, GraduationCap, Headphones, Headset, Shapes } from 'lucide-react';
import { CLASSROOM_ASSIGNMENTS } from '../data/assignments';
import { TOEFL_JUNIOR_ASSESSMENTS } from '../data/toeflJuniorAssessments';
import { Reveal } from './Reveal';

const practiceAreas = [
  { label: 'Reading', icon: BookOpen },
  { label: 'Listening', icon: Headphones },
  { label: 'Language use', icon: Shapes },
  { label: 'Speaking', icon: Feather },
  { label: 'Writing', icon: ClipboardCheck },
];

type ContentCard = {
  stat: string;
  statLabel: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  link: string;
  linkText: string;
  features: string[];
  /** Optional full-bleed AI artwork rendered behind the card content. */
  image?: string;
  /** object-position for the artwork, e.g. "32% center". */
  imagePosition?: string;
};

const contentCards: ContentCard[] = [
  {
    stat: '06',
    statLabel: 'Classroom assignment packs',
    title: 'Ready-to-use assignments',
    description: 'Six original packs covering reading comprehension, vocabulary, grammar, and writing. Each includes a printable student copy and a separate teacher key with suggested answers.',
    icon: BookOpen,
    accent: 'cyan',
    image: './images/card-assignments.jpg',
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
    image: './images/card-junior-studio.jpg',
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
    image: './images/card-mock-test.jpg',
    imagePosition: '72% center',
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
    image: './images/card-play-lab.jpg',
    imagePosition: '42% center',
    link: '#games',
    linkText: 'Play games',
    features: ['No login required', 'Progress saved locally', 'Grammar + vocabulary + reading'],
  },
  {
    stat: '3D',
    statLabel: 'Voxel build studio',
    title: 'Brick Forge',
    description: 'A 3D voxel building studio where students forge worlds block by block — guided Campaign challenges, Free Build, shared Class Projects, and Team Build. Runs in the browser and saves progress on the device.',
    icon: Blocks,
    accent: 'emerald',
    image: './images/card-brick-forge.jpg',
    imagePosition: '32% center',
    link: 'https://cmckhmer.github.io/Project-Build/',
    linkText: 'Enter Brick Forge',
    features: ['4 build modes', 'No install · runs offline', 'Class + team projects'],
  },
  {
    stat: '06',
    statLabel: 'OSW listening worksheets',
    title: 'Oxford Skills World · Listening 3',
    description: 'Six interactive listening worksheets from Oxford Skills World Level 3 — Angelo and the Musician, Showing Your Colors, How Big Is That Book?, and more. Each has Parts A/B/C with MCQ, ordering, and yes/no questions, plus an audio player and auto-scoring.',
    icon: Headset,
    accent: 'sky',
    image: './images/card-osw-listening.jpg',
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
  emerald: { border: 'border-emerald-300/25', text: 'text-emerald-300', bg: 'bg-emerald-300/5', stat: 'text-emerald-200' },
};

export const SocialProof: React.FC = () => {
  const classroomPackCount = Object.keys(CLASSROOM_ASSIGNMENTS).length;
  const assessmentCount = TOEFL_JUNIOR_ASSESSMENTS.length;

  return (
    <section
      aria-labelledby="preview-materials-title"
      className="cmc-section cmc-toolkit-band scroll-mt-24 border-y border-slate-800/80 bg-slate-900/35 py-20 sm:py-24 lg:py-28"
    >
      {/* AI-generated toolkit backdrop — headphones (listening), bricks (Brick
          Forge), dice (Dice & Wheel), pencils + worksheets (classroom packs) —
          faint under a dark scrim so the glass cards stay readable in dark
          mode. Light mode hides both photo layers (.cmc-toolkit-backdrop and
          .cmc-card-art rules in index.css) so the section falls back to the
          global light palette and matches the rest of the light page. */}
      <div aria-hidden="true" className="cmc-toolkit-backdrop pointer-events-none absolute inset-0">
        <img src="./images/toolkit-bg.jpg" alt="" loading="lazy" className="cmc-toolkit-bg-img h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-b from-slate-950/88 via-slate-950/60 to-slate-950/90" />
      </div>
      {/* Animated gradient orbs — soft cyan + violet atmosphere */}
      <div aria-hidden="true" className="cmc-orb cmc-orb--cyan" style={{ width: 360, height: 360, top: '-8rem', left: '-6rem' }} />
      <div aria-hidden="true" className="cmc-orb cmc-orb--violet" style={{ width: 320, height: 320, bottom: '-8rem', right: '-4rem' }} />
      <div className="mx-auto max-w-7xl px-5 sm:px-8 relative">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <Reveal>
            <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-cyan-300 uppercase">A look inside</p>
            <h2 id="preview-materials-title" className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">
              A practical toolkit, ready to explore.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              {classroomPackCount} classroom assignment packs, {assessmentCount} TOEFL Junior assessments, a full TOEFL iBT mock test, {`8`} learning games, the Brick Forge 3D voxel build studio, and 6 Oxford Skills World listening worksheets — all free, all in the browser.
            </p>
            </div>
          </Reveal>

          <Reveal stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {contentCards.map((card, index) => {
              const accent = accentMap[card.accent] || accentMap.cyan;
              const Icon = card.icon;
              const isExternal = card.link.startsWith('http');
              return (
                <a
                  key={index}
                  href={card.link}
                  {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`cmc-glass group relative flex flex-col gap-3 overflow-hidden p-5 ${accent.border}`}
                >
                  {card.image && (
                    <span aria-hidden="true" className="cmc-card-art pointer-events-none absolute inset-0">
                      <img
                        src={card.image}
                        alt=""
                        loading="lazy"
                        style={card.imagePosition ? { objectPosition: card.imagePosition } : undefined}
                        className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-[1.05]"
                      />
                      <span className="absolute inset-0 bg-gradient-to-br from-slate-950/92 via-slate-950/62 to-slate-950/82" />
                    </span>
                  )}
                  <div className="relative flex items-start justify-between">
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
                  <div className="relative">
                    <h3 className="text-sm font-bold text-white">{card.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{card.description}</p>
                  </div>
                  <div className="relative mt-auto flex flex-wrap gap-1.5 pt-2">
                    {card.features.map((feat, fi) => (
                      <span key={fi} className={`inline-flex items-center gap-1 rounded-md border ${accent.border} px-2 py-0.5 text-[10px] font-medium ${accent.text}`}>
                        <Check className="h-2.5 w-2.5" aria-hidden="true" />
                        {feat}
                      </span>
                    ))}
                  </div>
                  <span className={`relative mt-1 text-xs font-bold ${accent.text} group-hover:underline`}>
                    {card.linkText} →
                  </span>
                </a>
              );
            })}
          </Reveal>
        </div>

        <Reveal className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/8 pt-5">
          <span className="text-[9px] font-bold tracking-[0.15em] text-slate-500 uppercase">Practice areas</span>
          {practiceAreas.map(({ label, icon: Icon }) => (
            <span key={label} className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Icon className="h-3.5 w-3.5 text-cyan-300/80" aria-hidden="true" />
              {label}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-2 text-[10px] text-slate-500"><Check className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" /> Original practice material</span>
        </Reveal>
      </div>
    </section>
  );
};
