import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, ClipboardCheck, Gamepad2, GraduationCap, Play, Sparkles, PenLine } from 'lucide-react';

interface HeroProps {
  onExploreTools: () => void;
  onOpenStudentDemo: () => void;
  onOpenTeacherPass: () => void;
  onSelectFeatureCard: (feature: string) => void;
}

const shortcuts = [
  {
    id: 'toefl-ibt-mock',
    title: 'TOEFL iBT Full Mock Test',
    description: 'Complete 4-section exam with audio, recording, and timer. ~3 hours.',
    icon: GraduationCap,
  },
  {
    id: 'games',
    title: 'Learning Games',
    description: '8 playable games: grammar, vocabulary, reading, listening, and more.',
    icon: Gamepad2,
  },
  {
    id: 'resources',
    title: 'Assignment Packs',
    description: 'Ready-to-use classroom handouts with separate teacher keys and rubrics.',
    icon: BookOpen,
  },
  {
    id: 'kid-grades',
    title: 'Kid 5–12 Pathway',
    description: 'Grade-by-grade Reading Future worksheets. Kid 6 + Kid 11 live; other grades planned.',
    icon: ClipboardCheck,
  },
];

export const Hero = ({
  onExploreTools,
  onOpenStudentDemo,
  onOpenTeacherPass,
  onSelectFeatureCard,
}: HeroProps) => {
  const shortcutsRef = useRef<HTMLElement>(null);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);

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
        className="cmc-hero relative isolate overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
      >
        <div className="cmc-hero-photo-plane" aria-hidden="true">
          <img
            src="./images/classroom-hero-renaissance.png"
            alt=""
            className="cmc-hero-photo"
            fetchPriority="high"
            decoding="async"
            loading="eager"
          />
        </div>
        <div className="cmc-hero-veil" aria-hidden="true" />
        <div className="cmc-hero-light" aria-hidden="true" />

        <div className="cmc-hero-orbit" aria-hidden="true">
          <svg viewBox="0 0 620 620" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="310" cy="310" r="256" stroke="#8EE6E4" strokeOpacity=".29" strokeWidth="1" strokeDasharray="2 12" />
            <circle cx="310" cy="310" r="204" stroke="#BAF4F0" strokeOpacity=".24" strokeWidth="1" />
            <path d="M65 220A256 256 0 0 1 500 139" stroke="#AAFFED" strokeOpacity=".75" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="504" cy="144" r="4" fill="#A5F3EA" />
            <circle cx="504" cy="144" r="14" fill="#67E8F9" fillOpacity=".15" />
          </svg>
        </div>

        <div className="cmc-hero-content relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            {/* LEFT: existing text — unchanged */}
            <div className="max-w-[780px]">
              <div className="cmc-hero-enter cmc-hero-eyebrow mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200/90 sm:mb-8">
                <span className="h-px w-9 bg-cyan-300/80" aria-hidden="true" />
                Creative Minds Network
              </div>

              <h1 className="cmc-title" aria-label="Everything a teacher needs in one place.">
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
              <div className="cmc-hero-enter mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-300/90 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-base font-bold text-cyan-300">8</span> learning games
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-base font-bold text-violet-300">4-section</span> TOEFL mock
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-base font-bold text-teal-300">15</span> assessment packs
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

            {/* RIGHT: 3D teacher illustration + floating UI bubbles (LearnAI vibe) */}
            <div className="relative hidden lg:block" aria-hidden="true">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-[520px]">
                {/* Glow ring behind the illustration */}
                <div className="absolute inset-[-8%] rounded-2xl bg-gradient-to-br from-cyan-400/20 via-violet-500/15 to-transparent blur-3xl" />
                {/* The 3D illustration — rendered as a contained image (transparent background) */}
                <img
                  src="./images/upgrade/hero-3d-teacher.png"
                  alt="Teacher at a desk with a friendly robot assistant, surrounded by floating UI cards: Auto-Grader, Class Roster, TOEFL Drill"
                  className="relative z-10 h-full w-full object-contain drop-shadow-[0_30px_60px_rgba(56,189,248,0.25)]"
                  decoding="async"
                  loading="lazy"
                />
                {/* Floating UI bubbles — LearnAI-style */}
                <span className="cmc-bubble cmc-bubble--cyan" style={{ top: '8%', left: '-6%', animationDelay: '0s' }}>
                  <Sparkles className="h-3.5 w-3.5" /> Auto-Grader ready
                </span>
                <span className="cmc-bubble cmc-bubble--violet" style={{ top: '36%', right: '-8%', animationDelay: '1.2s' }}>
                  <GraduationCap className="h-3.5 w-3.5" /> TOEFL drill assigned
                </span>
                <span className="cmc-bubble cmc-bubble--emerald" style={{ bottom: '14%', left: '-4%', animationDelay: '2.4s' }}>
                  <ClipboardCheck className="h-3.5 w-3.5" /> Class roster synced
                </span>
                <span className="cmc-bubble cmc-bubble--amber" style={{ bottom: '-2%', right: '6%', animationDelay: '3.6s' }}>
                  <PenLine className="h-3.5 w-3.5" /> Worksheet generated
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="cmc-scroll-hint absolute bottom-9 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/55 md:flex">
          <span>See what's inside</span>
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      </section>

      <section ref={shortcutsRef} className="border-y border-white/10 bg-[#081622]/95 backdrop-blur" aria-label="Explore Creative Minds Network tools">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {shortcuts.map((shortcut, index) => {
            const Icon = shortcut.icon;
            const shortcutClass = `cmc-shortcut cmc-card group relative flex items-start gap-4 p-5 text-left sm:p-6 ${shortcutsVisible ? 'is-visible' : ''}`;
            const content = (
              <>
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300 transition-transform duration-300 group-hover:-translate-y-1" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                    {shortcut.title}
                    <ArrowUpRight className="h-3.5 w-3.5 text-cyan-300 opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-400">{shortcut.description}</span>
                </span>
              </>
            );

            return (
              shortcut.href ? (
                <a key={shortcut.id} href={shortcut.href} target="_blank" rel="noopener noreferrer" className={shortcutClass} style={{ transitionDelay: `${index * 85}ms` }}>
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
      </section>
    </>
  );
};