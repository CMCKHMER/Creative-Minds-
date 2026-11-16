import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, ClipboardCheck, Gamepad2, GraduationCap, Play } from 'lucide-react';
import { useCountUp } from '../hooks/useReveal';
import { useTitleParticles } from '../hooks/useTitleParticles';
import { smallTitleSpacing } from '../lib/titleParticlesMath';

interface HeroProps {
  onExploreTools: () => void;
  onOpenStudentDemo: () => void;
  onOpenTeacherPass: () => void;
  onSelectFeatureCard: (feature: string) => void;
  /**
   * Optional side panel rendered on the right side of the hero on lg+
   * screens (mobile/tablet stacks it below the text). Used to host the
   * daily news side panel.
   */
  sidePanel?: ReactNode;
}

/** Inline animated stat number — counts up from 0 to `target` when scrolled into view. */
function AnimatedStat({ target, suffix = '', className = '' }: { target: number; suffix?: string; className?: string }) {
  const { ref, value } = useCountUp<HTMLSpanElement>(target, { duration: 1200 });
  return <span ref={ref} className={className}>{value}{suffix}</span>;
}

interface HeroShortcut {
  id: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  /** Accent hue for the icon chip + hover glow of the quick-launch card. */
  accent: 'cyan' | 'violet' | 'amber' | 'emerald';
  /** Optional external link — when present the card renders as an <a>
   *  instead of a button that triggers onSelectFeatureCard. */
  href?: string;
  /** Optional AI artwork rendered behind the card content (hidden in light
   *  theme via the .cmc-quick-bg rule — the light theme turns the strip
   *  white, so the dark-navy art would clash). */
  image?: string;
  /** Optional divided stat pair, like the reference board's
   *  "48 Premium · 14.2k Followers" block. Rendered by .cmc-stat-row. */
  stats?: { value: string; label: string }[];
}

const shortcuts: HeroShortcut[] = [
  {
    id: 'toefl-ibt-mock',
    title: 'TOEFL iBT Full Mock Test',
    description: 'Complete 4-section exam with audio, recording, and timer. ~3 hours.',
    icon: GraduationCap,
    accent: 'cyan',
    image: './images/quick-toefl.webp',
    stats: [
      { value: '4', label: 'Sections' },
      { value: '~3h', label: 'Full exam' },
    ],
  },
  {
    id: 'games',
    title: 'Learning Games',
    description: '8 playable games: grammar, vocabulary, reading, listening, and more.',
    icon: Gamepad2,
    accent: 'violet',
    image: './images/quick-games.webp',
    stats: [
      { value: '8', label: 'Games' },
      { value: '5', label: 'Skill areas' },
    ],
  },
  {
    id: 'resources',
    title: 'Assignment Packs',
    description: 'Ready-to-use classroom handouts with separate teacher keys and rubrics.',
    icon: BookOpen,
    accent: 'amber',
    image: './images/quick-assignments.webp',
    stats: [
      { value: '15', label: 'Packs' },
      { value: 'Keys', label: 'Included' },
    ],
  },
  {
    id: 'kid-grades',
    title: 'Kid 5–12 Pathway',
    description: 'Grade-by-grade Reading Future worksheets. Kid 6 + Kid 11 live; other grades planned.',
    icon: ClipboardCheck,
    accent: 'emerald',
    image: './images/quick-kids.png',
    stats: [
      { value: '5–12', label: 'Kid grades' },
      { value: '2', label: 'Live now' },
    ],
  },
];

export const Hero = ({
  onExploreTools,
  onOpenStudentDemo,
  onOpenTeacherPass,
  onSelectFeatureCard,
  sidePanel,
}: HeroProps) => {
  const shortcutsRef = useRef<HTMLElement>(null);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleCanvasRef = useRef<HTMLCanvasElement>(null);
  // The title drawn as particles (three.js). The <h1> below stays the real
  // text; the effect is fetched only when the browser is idle and only where
  // it is welcome — see useTitleParticles.
  const titleParticles = useTitleParticles({ section: heroRef, title: titleRef, canvas: titleCanvasRef, spacing: smallTitleSpacing });

  useEffect(() => {
    const target = shortcutsRef.current;
    if (!target) return;

    if (!('IntersectionObserver' in window)) {
      setShortcutsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShortcutsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);


  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    event.currentTarget.style.setProperty('--cmc-photo-x', `${(-x * 12).toFixed(2)}px`);
    event.currentTarget.style.setProperty('--cmc-photo-y', `${(-y * 9).toFixed(2)}px`);
    event.currentTarget.style.setProperty('--cmc-echo-x', `${(7 + x * 4).toFixed(2)}px`);
    event.currentTarget.style.setProperty('--cmc-echo-y', `${(7 + y * 4).toFixed(2)}px`);
  };

  const resetPointer = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--cmc-photo-x', '0px');
    event.currentTarget.style.setProperty('--cmc-photo-y', '0px');
    event.currentTarget.style.setProperty('--cmc-echo-x', '7px');
    event.currentTarget.style.setProperty('--cmc-echo-y', '7px');
  };

  return (
    <>
      <section
        id="top"
        ref={heroRef}
        className="cmc-hero relative isolate overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
      >
        {/* The scene: soft studio backdrop with glass spheres (one picture per
            theme, set in glass.css so only the one in use is downloaded) and a
            few glass discs drawn in CSS that drift over it. */}
        <div className="cmc-hero-art" aria-hidden="true">
          <div className="cmc-hero-art-img" />
          <span className="cmc-hero-disc cmc-hero-disc--a" />
          <span className="cmc-hero-disc cmc-hero-disc--b" />
          <span className="cmc-hero-disc cmc-hero-disc--c" />
        </div>
        {/* The frosted pane the title and the buttons sit on. */}
        <div className="cmc-hero-pane" aria-hidden="true" />

        <div className="cmc-hero-content relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className={sidePanel ? 'grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start' : ''}>
            <div className="max-w-[780px]">
            <div className="cmc-hero-enter cmc-hero-eyebrow mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200/90 sm:mb-8">
              <span className="h-px w-9 bg-cyan-300/80" aria-hidden="true" />
              Creative Minds Network
            </div>

              <h1
                ref={titleRef}
                className={`cmc-title${titleParticles ? ' cmc-title-as-particles' : ''}`}
                aria-label="Everything a teacher needs in one place."
              >
                <span className="cmc-title-row cmc-title-row-first">
                  <span className="cmc-title-outline" aria-hidden="true">EVERYTHING A TEACHER</span>
                  <span className="cmc-title-solid">EVERYTHING A TEACHER</span>
                </span>
                <span className="cmc-title-row cmc-title-row-second">
                  <span className="cmc-title-outline" aria-hidden="true">NEEDS IN ONE PLACE.</span>
                  <span className="cmc-title-solid">NEEDS IN ONE PLACE.</span>
                </span>
              </h1>

              <div className="cmc-hero-enter cmc-hero-after-title mt-8 sm:mt-10">
                <p className="font-[var(--font-display)] text-xl font-medium tracking-tight text-white sm:text-2xl lg:text-[1.75rem]">
                  Resources, games, and <span className="text-cyan-200">TOEFL practice</span> for the modern classroom.
                </p>
                <p className="mt-4 max-w-[550px] text-sm leading-[1.8] text-slate-200/90 sm:text-base">
                  From full TOEFL iBT mock tests to learning games and ready-to-use assignment packs — built for teachers, free for classrooms.
                </p>
              </div>

              {/* Stats row */}
              <div className="cmc-hero-enter cmc-hero-stats mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-300/90 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <AnimatedStat target={8} className="text-base font-bold text-cyan-300" /> learning games
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-base font-bold text-violet-300">4-section</span> TOEFL mock
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <AnimatedStat target={15} className="text-base font-bold text-teal-300" /> assessment packs
                </span>
              </div>

              <div className="cmc-hero-enter cmc-hero-actions mt-8 flex flex-wrap items-center gap-3 sm:mt-10">
                <button type="button" onClick={onExploreTools} className="cmc-btn-primary group">
                  Explore teacher tools
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
                <button type="button" onClick={onOpenTeacherPass} className="cmc-btn-ghost group">
                  Create a teacher account
                  <ArrowRight className="h-4 w-4 text-cyan-200 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenStudentDemo}
                className="cmc-hero-enter cmc-hero-demo mt-6 inline-flex items-center gap-2 text-xs font-medium text-slate-200/80 transition-colors hover:text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/10 transition-colors group-hover:bg-white/20">
                  <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                </span>
                Or take a look at the student experience
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {/* RIGHT: side panel (news) — only on lg+ screens, nudged down so it
                aligns with the H1 (after the eyebrow) instead of butting against
                the very top of the hero. */}
            {sidePanel && (
              <div className="cmc-hero-enter hidden lg:mt-12 lg:block lg:pt-2">
                {sidePanel}
              </div>
            )}
          </div>
        </div>

        {/* Lower edge of the scene: a large thin numeral and one line about
            the site, as on a magazine spread. */}
        <div className="cmc-hero-foot">
          <span className="cmc-hero-num" aria-hidden="true">01</span>
          <p className="cmc-hero-caption"><strong>CMC</strong> is where teachers find tests, games and ready lessons — and the whole classroom is the canvas</p>
        </div>

        {/* Dots on the right edge: this screen, and the cards under it (one
            card per page — src/components/SectionDirectory.tsx). */}
        <nav className="cmc-hero-dots" aria-label="On this page">
          <a href="#top" aria-current="true" title="Top"><span className="sr-only">Top</span></a>
          <a href="#sections" title="All pages"><span className="sr-only">All pages</span></a>
        </nav>

        {/* The title's particles are drawn here (src/lib/titleParticles.ts). */}
        <canvas ref={titleCanvasRef} className="cmc-title-canvas" aria-hidden="true" />
      </section>

      <section ref={shortcutsRef} className="cmc-quickstrip border-y border-white/10 bg-[#081622]/95 backdrop-blur" aria-label="Explore Creative Minds Network tools">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8 sm:py-6 lg:px-12 lg:py-7">
          {/* Strip header — labels the row as an intentional quick-launch dock */}
          <div className={`cmc-shortcut mb-4 flex items-center gap-3 sm:mb-5 ${shortcutsVisible ? 'is-visible' : ''}`}>
            <span className="cmc-quick-label text-[10px] font-bold uppercase tracking-[0.26em]">Quick launch</span>
            <span className="cmc-quick-rule h-px flex-1" aria-hidden="true" />
            <span className="cmc-quick-hint hidden text-[10px] font-semibold uppercase tracking-[0.18em] sm:inline">Free for classrooms</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((shortcut, index) => {
              const Icon = shortcut.icon;
              const shortcutClass = `cmc-shortcut cmc-card cmc-quick cmc-quick--${shortcut.accent} group relative flex flex-col items-start gap-2.5 overflow-hidden p-5 text-left ${shortcutsVisible ? 'is-visible' : ''}`;
              const content = (
                <>
                  {shortcut.image && (
                    <>
                      {/* AI artwork behind the card — decorative, pointer-transparent. */}
                      <img
                        src={shortcut.image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="cmc-quick-bg pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity duration-300 group-hover:opacity-60"
                      />
                      {/* Left-to-right veil keeps title/description readable. */}
                      <span className="cmc-quick-bg pointer-events-none absolute inset-0 bg-gradient-to-r from-[#081622] via-[#081622]/55 to-[#081622]/5" aria-hidden="true" />
                    </>
                  )}
                  <span className="cmc-quick-chip relative flex h-10 w-10 items-center justify-center rounded-xl border">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="relative flex w-full items-start justify-between gap-2">
                    <span className="text-sm font-bold leading-snug text-white">{shortcut.title}</span>
                    <ArrowUpRight className="cmc-quick-arrow relative mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
                  </span>
                  <span className="relative text-xs leading-relaxed text-slate-400">{shortcut.description}</span>
                  {shortcut.stats && shortcut.stats.length > 0 && (
                    <span className="cmc-stat-row relative w-full">
                      {shortcut.stats.map((stat) => (
                        <span key={stat.label} className="cmc-stat">
                          <span className="cmc-stat-num">{stat.value}</span>
                          <span className="cmc-stat-label">{stat.label}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </>
              );

              return (
                shortcut.href ? (
                  <a key={shortcut.id} href={shortcut.href} className={shortcutClass} style={{ transitionDelay: `${index * 85}ms` }}>
                    {content}
                  </a>
                ) : (
                  <button
                    key={shortcut.id}
                    type="button"
                    onClick={() => onSelectFeatureCard(shortcut.id)}
                    className={shortcutClass}
                    style={{ transitionDelay: `${index * 85}ms` }}
                  >
                    {content}
                  </button>
                )
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};