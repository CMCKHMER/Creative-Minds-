import { useEffect, useRef } from 'react';
import { BookOpen, FileText, Sparkles, X } from 'lucide-react';

/**
 * "The bookshelf is opening" panel — the destination for the two hero
 * buttons that point at products still being uploaded (PDF packs and
 * interactive books).
 *
 * Why a panel instead of dead links: the buttons have to be visible now so
 * the hero's layout is final, but a link to a page that does not exist yet
 * is worse than no link at all. This says what is coming, in the site's own
 * voice, and promises the one thing we can actually deliver today — a note
 * when it opens.
 *
 * When the products land, the only edit needed is in Hero.tsx: point the two
 * button handlers at the real destinations. Until then this stays the
 * honest answer.
 */
export type BookshelfKind = 'pdf' | 'interactive';

interface BookshelfComingSoonModalProps {
  /** Which shelf the visitor asked about; null closes the panel. */
  kind: BookshelfKind | null;
  onClose: () => void;
  /** Optional: the real shop URL, if one already exists. */
  shopUrl?: string;
}

const COPY: Record<
  BookshelfKind,
  {
    icon: typeof FileText;
    kicker: string;
    title: string;
    body: string;
    items: string[];
    accent: string;
    ring: string;
  }
> = {
  pdf: {
    icon: FileText,
    kicker: 'PDF library',
    title: 'Printable packs, on the way',
    body:
      'Ready-to-print worksheets, answer keys and lesson packs — the same material our classrooms use, bundled as PDFs you can hand out the same day.',
    items: [
      'Grade-band worksheet bundles with answer keys',
      'TOEFL iBT practice sets, print-ready',
      'Classroom pack sets — one price, whole term',
    ],
    accent: 'from-amber-300/20 to-orange-500/10 text-amber-200',
    ring: 'border-amber-300/35',
  },
  interactive: {
    icon: BookOpen,
    kicker: 'Interactive books',
    title: 'Books your students can play',
    body:
      'Self-paced digital books where every chapter carries its own audio, exercises and instant feedback — built to be read on a phone as comfortably as a laptop.',
    items: [
      'Chapter-by-chapter audio with play-along exercises',
      'Progress that follows the student between devices',
      'Teacher view of who has read what',
    ],
    accent: 'from-cyan-300/20 to-violet-500/10 text-cyan-200',
    ring: 'border-cyan-300/35',
  },
};

export function BookshelfComingSoonModal({ kind, onClose, shopUrl }: BookshelfComingSoonModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!kind) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Freeze the page behind the panel, then restore whatever was there.
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prior;
    };
  }, [kind, onClose]);

  if (!kind) return null;
  const copy = COPY[kind];
  const Icon = copy.icon;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookshelf-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg overflow-hidden rounded-2xl border bg-slate-950/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ${copy.ring}`}
      >
        <div className="flex items-start gap-3 border-b border-white/10 p-5">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br ${copy.accent}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.19em] text-slate-400">{copy.kicker}</p>
            <h2 id="bookshelf-title" className="mt-1 text-lg font-bold leading-snug text-white">
              {copy.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-[13px] leading-relaxed text-slate-300">{copy.body}</p>

          <ul className="mt-4 space-y-2">
            {copy.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-slate-400">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[11.5px] leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-200">Not on sale yet.</span> This shelf opens once the
            first packs are finished. Everything already on the site — the games, worksheets, mock tests and
            planner — stays free while you wait.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {shopUrl && (
              <a
                href={shopUrl}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                Visit the shop
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Back to the site
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
