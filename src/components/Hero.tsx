import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart2, BookOpen, ClipboardCheck, GraduationCap, Play, Sparkles, Users } from 'lucide-react';

interface HeroProps {
  onExploreTools: () => void;
  onOpenStudentDemo: () => void;
  onOpenTeacherPass: () => void;
  onSelectFeatureCard: (feature: string) => void;
}

const shortcuts = [
  {
    id: 'auto-grading',
    title: 'Feedback preview',
    description: 'Try an example of local, word-count-based feedback.',
    icon: Sparkles,
  },
  {
    id: 'class-mgmt',
    title: 'Roster sample',
    description: 'See the demo layout; it is not connected to real student records.',
    icon: Users,
  },
  {
    id: 'analytics',
    title: 'Insight preview',
    description: 'Explore sample indicators that are not linked to learners.',
    icon: BarChart2,
  },
  {
    id: 'resources',
    title: 'Ready-to-use resources',
    description: 'From first phonics to original TOEFL Junior-style practice.',
    icon: BookOpen,
  },
  {
    id: 'daily-assessment',
    title: 'Daily student assessment',
    description: 'Open the separate student-record workspace.',
    icon: ClipboardCheck,
    href: 'https://cmckhmer.github.io/Student-Assesment-Records/',
  },
  {
    id: 'kid-grades',
    title: 'Kid Program · Grades 5–12',
    description: 'See the grade-by-grade resource pathway; Kid 6 has a live worksheet link.',
    icon: GraduationCap,
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
            src="./images/classroom-hero.jpg"
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
          <div className="max-w-[780px]">
            <div className="cmc-hero-enter cmc-hero-eyebrow mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200/90 sm:mb-8">
              <span className="h-px w-9 bg-cyan-300/80" aria-hidden="true" />
              A brighter way to teach
            </div>

            <h1 className="cmc-title" aria-label="Creative Minds Network">
              <span className="cmc-title-row cmc-title-row-first">
                <span className="cmc-title-outline" aria-hidden="true">CREATIVE MINDS</span>
                <span className="cmc-title-solid">CREATIVE MINDS</span>
              </span>
              <span className="cmc-title-row cmc-title-row-second">
                <span className="cmc-title-outline" aria-hidden="true">NETWORK</span>
                <span className="cmc-title-solid">NETWORK</span>
              </span>
            </h1>

            <div className="cmc-hero-enter cmc-hero-after-title mt-8 sm:mt-10">
              <p className="font-[var(--font-display)] text-xl font-medium tracking-tight text-white sm:text-2xl lg:text-[1.75rem]">
                Empowering educators. <span className="text-cyan-200">Engaging students.</span>
              </p>
              <p className="mt-4 max-w-[550px] text-sm leading-[1.8] text-slate-200/90 sm:text-base">
                Original classroom resources and TOEFL Junior-style practice, with meaningful explanations and more room for the teaching moments that matter.
              </p>
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
        </div>

        <div className="cmc-scroll-hint absolute bottom-9 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/55 md:flex">
          <span>Scroll to explore</span>
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