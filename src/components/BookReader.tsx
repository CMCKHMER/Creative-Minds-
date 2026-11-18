import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ExternalLink, List, Maximize2, Minimize2, Minus, Moon, PenLine, Plus, Sun, X,
} from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  clampPage, ensurePromiseWithResolvers, placeKey, readPlace, spreadFor, turnPage, type LibraryBook,
} from '../lib/library';

/**
 * The reader: a book open over the page, one screen at a time.
 *
 * A PDF the site can fetch is drawn by pdf.js (the "legacy" build, which
 * still runs on older phones). It is loaded only when a book is opened, so
 * the rest of the site does not pay for it. A book shared from Box opens in
 * Box's own viewer inside the same frame.
 */

type Paper = 'white' | 'sepia' | 'night';
const PAPERS: readonly Paper[] = ['white', 'sepia', 'night'];
const PAPER_KEY = 'cmc-library-paper';
/** Steps of the zoom button, as multiples of the page fitted to the screen. */
const ZOOMS = [1.25, 1.5, 2, 2.5, 3] as const;

interface Chapter { title: string; page: number }

async function loadPdfJs() {
  ensurePromiseWithResolvers();
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** Top-level bookmarks of the PDF, as page numbers. A PDF without bookmarks gives []. */
async function readChapters(doc: PDFDocumentProxy): Promise<Chapter[]> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline) return [];
  const chapters: Chapter[] = [];
  for (const item of outline.slice(0, 200)) {
    try {
      const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
      const ref: unknown = Array.isArray(dest) ? dest[0] : null;
      if (ref && typeof ref === 'object') {
        const index = await doc.getPageIndex(ref as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
        chapters.push({ title: item.title.trim() || `Page ${index + 1}`, page: index + 1 });
      }
    } catch {
      /* a bookmark that points nowhere is left out */
    }
  }
  return chapters;
}

export function BookReader({
  book,
  initialPage = null,
  onOpenWorkbook,
  onClose,
}: {
  book: LibraryBook;
  initialPage?: number | null;
  onOpenWorkbook?: () => void;
  onClose: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(0);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pageText, setPageText] = useState('');
  const [paper, setPaper] = useState<Paper>(() => {
    try {
      const saved = window.localStorage.getItem(PAPER_KEY);
      return PAPERS.includes(saved as Paper) ? (saved as Paper) : 'white';
    } catch {
      return 'white';
    }
  });

  const isPdf = book.source.kind === 'pdf';
  const pages = doc?.numPages ?? 0;
  // Two pages side by side when the screen is wide enough to read them.
  const twoUp = stage.width >= 980 && stage.width > stage.height * 1.15 && zoom === 0;
  const spread = useMemo(() => (pages ? spreadFor(page, pages, twoUp) : []), [page, pages, twoUp]);

  // Open the book.
  useEffect(() => {
    if (book.source.kind !== 'pdf') return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    const url = book.source.url;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({ url });
        stop = () => { void task.destroy(); };
        task.onProgress = ({ loaded: got, total }: { loaded: number; total: number }) => {
          if (!cancelled && total > 0) setLoaded(Math.min(99, Math.round((got / total) * 100)));
        };
        const opened = await task.promise;
        if (cancelled) return;
        let saved = null;
        try { saved = readPlace(window.localStorage.getItem(placeKey(book.id))); } catch { /* private mode */ }
        const startPage = typeof initialPage === 'number' && initialPage >= 1 ? initialPage : (saved?.page ?? 1);
        setPage(clampPage(startPage, opened.numPages));
        setDoc(opened);
        setChapters(await readChapters(opened));
      } catch {
        if (!cancelled) setError('This book could not be opened. Check the connection and try again.');
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [book, initialPage]);

  // Remember the place.
  useEffect(() => {
    if (!pages) return;
    try {
      window.localStorage.setItem(placeKey(book.id), JSON.stringify({ page, pages, at: Date.now() }));
    } catch {
      /* private mode: the book still reads, the place is not kept */
    }
  }, [book.id, page, pages]);

  useEffect(() => {
    try { window.localStorage.setItem(PAPER_KEY, paper); } catch { /* not kept */ }
  }, [paper]);

  // The room the pages have.
  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const measure = () => setStage({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Draw the pages on screen.
  useEffect(() => {
    if (!doc || !spread.length || stage.width < 40 || stage.height < 40) return;
    let cancelled = false;
    const tasks: RenderTask[] = [];
    (async () => {
      const texts: string[] = [];
      for (let slot = 0; slot < spread.length; slot += 1) {
        const number = spread[slot];
        const canvas = canvasRefs.current[slot];
        if (number === undefined || !canvas) continue;
        const pdfPage = await doc.getPage(number);
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const room = { width: (stage.width - 24 - (spread.length - 1) * 6) / spread.length, height: stage.height - 24 };
        const fit = Math.min(room.width / base.width, room.height / base.height);
        // Zoom 0 fits the whole page on the screen; each step enlarges from there.
        const scale = zoom === 0 ? fit : fit * zoom;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pdfPage.getViewport({ scale: scale * ratio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
        const task = pdfPage.render({ canvas, viewport });
        tasks.push(task);
        delete canvas.dataset.painted;
        const done = await task.promise.then(() => true, () => false);
        if (cancelled) return;
        // Marks the page as drawn (used by the browser check; harmless otherwise).
        if (done) canvas.dataset.painted = String(number);
        const content = await pdfPage.getTextContent().catch(() => null);
        texts.push(content ? content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim() : '');
      }
      if (!cancelled) setPageText(texts.join(' '));
    })();
    return () => {
      cancelled = true;
      for (const task of tasks) task.cancel();
    };
  }, [doc, spread, stage.width, stage.height, zoom]);

  const go = useCallback((target: number) => {
    setPage((current) => (pages ? clampPage(target, pages) : current));
    stageRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pages]);
  const turn = useCallback((direction: 1 | -1) => {
    setPage((current) => (pages ? turnPage(current, pages, twoUp, direction) : current));
    stageRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pages, twoUp]);
  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      const index = current === 0 ? -1 : ZOOMS.indexOf(current as (typeof ZOOMS)[number]);
      const next = index + direction;
      return next < 0 ? 0 : (ZOOMS[Math.min(next, ZOOMS.length - 1)] ?? 0);
    });
  }, []);

  // Keys: arrows turn the page, Esc closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === 'Escape') {
        if (showChapters) setShowChapters(false);
        else if (!document.fullscreenElement) onClose();
        return;
      }
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); turn(1); }
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); turn(-1); }
      else if (event.key === 'Home') go(1);
      else if (event.key === 'End') go(pages);
      else if (event.key === '+' || event.key === '=') zoomBy(1);
      else if (event.key === '-') zoomBy(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose, pages, showChapters, turn, zoomBy]);

  // The page behind does not scroll while a book is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  // A sideways swipe turns the page (only when the page is not zoomed in).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    swipe.current = touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = swipe.current;
    const touch = event.changedTouches[0];
    swipe.current = null;
    if (!start || !touch || zoom !== 0) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) turn(dx < 0 ? 1 : -1);
  };

  const last = spread[spread.length - 1] ?? page;
  const first = spread[0] ?? page;
  const pageLabel = spread.length > 1 ? `${first}–${last}` : `${first}`;
  const tool = 'grid h-10 w-10 flex-none place-items-center rounded-xl border border-white/15 bg-white/5 text-slate-100 transition hover:bg-white/12 disabled:opacity-35 disabled:hover:bg-white/5';
  const paperFilter = paper === 'sepia' ? 'sepia(0.55) brightness(0.96)' : paper === 'night' ? 'invert(0.9) hue-rotate(180deg)' : 'none';

  return (
    <div
      ref={shellRef}
      data-keep-dark
      role="dialog"
      aria-modal="true"
      aria-label={`Reading ${book.title}`}
      data-book-reader={book.id}
      className="fixed inset-0 z-[90] flex flex-col bg-[#07111d] text-slate-100"
    >
      <header className="flex flex-none items-center gap-2 border-b border-white/10 bg-[#0b1928]/95 px-3 py-2 sm:px-4">
        <button ref={closeRef} type="button" onClick={onClose} className={tool} aria-label="Close the book" title="Close (Esc)">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate font-[var(--font-display)] text-sm font-bold text-white sm:text-base">{book.title}</p>
          {book.author && <p className="truncate text-xs text-slate-400">{book.author}</p>}
        </div>
        {onOpenWorkbook && (
          <button
            type="button"
            onClick={onOpenWorkbook}
            data-open-workbook={book.id}
            className="inline-flex h-10 flex-none items-center gap-1.5 rounded-xl border border-cyan-300/45 bg-cyan-300/15 px-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/25"
            title="Switch to interactive auto-graded workbook"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            <span>Workbook</span>
          </button>
        )}
        {isPdf && (
          <>
            {chapters.length > 0 && (
              <button type="button" onClick={() => setShowChapters((open) => !open)} className={tool} aria-label="Chapters" aria-expanded={showChapters} title="Chapters">
                <List className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={() => setPaper(PAPERS[(PAPERS.indexOf(paper) + 1) % PAPERS.length] ?? 'white')} className={tool} aria-label={`Paper: ${paper}. Change`} title={`Paper: ${paper}`} data-paper={paper}>
              {paper === 'night' ? <Moon className="h-5 w-5" aria-hidden="true" /> : <Sun className={`h-5 w-5 ${paper === 'sepia' ? 'text-amber-200' : ''}`} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => zoomBy(-1)} disabled={zoom === 0} className={`${tool} hidden sm:grid`} aria-label="Zoom out" title="Zoom out (-)">
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => zoomBy(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} className={tool} aria-label="Zoom in" title="Zoom in (+)">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
        <button type="button" onClick={toggleFullscreen} className={`${tool} hidden sm:grid`} aria-label={fullscreen ? 'Leave full screen' : 'Full screen'} title="Full screen">
          {fullscreen ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {showChapters && (
          <nav aria-label="Chapters" className="absolute inset-y-0 left-0 z-10 w-[min(20rem,86vw)] overflow-y-auto border-r border-white/10 bg-[#0b1928] p-3 shadow-2xl">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">Chapters</p>
            <ul className="space-y-1">
              {chapters.map((chapter) => (
                <li key={`${chapter.page}-${chapter.title}`}>
                  <button
                    type="button"
                    onClick={() => { go(chapter.page); setShowChapters(false); }}
                    className={`flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/8 ${chapter.page <= last && chapter.page >= first ? 'bg-cyan-300/10 text-cyan-100' : 'text-slate-200'}`}
                  >
                    <span>{chapter.title}</span>
                    <span className="flex-none text-xs tabular-nums text-slate-400">{chapter.page}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {book.source.kind === 'box' ? (
          <div ref={stageRef} className="flex min-h-0 flex-1 flex-col">
            <iframe
              src={book.source.embedUrl}
              title={book.title}
              className="min-h-0 w-full flex-1 border-0 bg-white"
              allow="fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            <p className="flex-none border-t border-white/10 bg-[#0b1928] px-4 py-2 text-xs text-slate-400">
              This book is kept on Box and opens in Box&rsquo;s viewer.{' '}
              <a href={book.source.embedUrl.replace('/embed/s/', '/s/').split('?')[0]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cyan-200 underline-offset-2 hover:underline">
                Open it on Box <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </p>
          </div>
        ) : (
          <div
            ref={stageRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className={`relative min-h-0 flex-1 ${zoom === 0 ? 'overflow-hidden' : 'overflow-auto'}`}
            data-reader-stage
          >
            {error ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <p role="alert" className="text-base font-semibold text-rose-200">{error}</p>
                  <button type="button" onClick={onClose} className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold">Back to the shelves</button>
                </div>
              </div>
            ) : !doc ? (
              <div className="grid h-full place-items-center p-6 text-center" role="status">
                <div className="w-56">
                  <p className="text-sm font-semibold text-slate-200">Opening the book…</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-300 transition-[width]" style={{ width: `${Math.max(6, loaded)}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className={`flex min-h-full min-w-full items-center justify-center gap-1.5 p-3 ${zoom === 0 ? '' : 'w-max'}`}>
                {spread.map((number, slot) => (
                  <canvas
                    key={slot}
                    ref={(element) => { canvasRefs.current[slot] = element; }}
                    data-page={number}
                    aria-hidden="true"
                    className="flex-none rounded-sm bg-white shadow-[0_18px_50px_-18px_rgba(0,0,0,.8)]"
                    style={{ filter: paperFilter }}
                  />
                ))}
              </div>
            )}
            {doc && zoom === 0 && (
              <>
                <button type="button" onClick={() => turn(-1)} disabled={first <= 1} aria-label="Previous page" className="absolute inset-y-0 left-0 w-[18%] cursor-w-resize opacity-0 disabled:cursor-default" tabIndex={-1} />
                <button type="button" onClick={() => turn(1)} disabled={last >= pages} aria-label="Next page" className="absolute inset-y-0 right-0 w-[18%] cursor-e-resize opacity-0 disabled:cursor-default" tabIndex={-1} />
              </>
            )}
            {/* The words of the page, for screen readers: the page itself is a picture. */}
            <p className="sr-only" aria-live="polite" data-page-text>{pageText}</p>
          </div>
        )}
      </div>

      {isPdf && doc && (
        <footer className="flex flex-none items-center gap-2 border-t border-white/10 bg-[#0b1928]/95 px-3 py-2 sm:gap-3 sm:px-4">
          <button type="button" onClick={() => turn(-1)} disabled={first <= 1} className={tool} aria-label="Previous page" data-reader-prev>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <input
            type="range"
            min={1}
            max={pages}
            value={first}
            onChange={(event) => go(Number(event.target.value))}
            aria-label="Go to page"
            className="h-2 min-w-0 flex-1 accent-cyan-300"
          />
          <label className="flex flex-none items-center gap-1.5 text-sm tabular-nums text-slate-300">
            <span className="sr-only">Page</span>
            <input
              key={pageLabel}
              type="text"
              inputMode="numeric"
              defaultValue={pageLabel}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                const wanted = Number.parseInt(event.currentTarget.value, 10);
                if (Number.isFinite(wanted)) go(wanted);
                event.currentTarget.blur();
              }}
              onBlur={(event) => { event.currentTarget.value = pageLabel; }}
              className="w-14 rounded-lg border border-white/15 bg-white/5 px-1 py-1.5 text-center text-sm text-white"
              aria-label={`Page ${pageLabel} of ${pages}. Type a page number and press Enter`}
              data-reader-page
            />
            <span aria-hidden="true">/ {pages}</span>
          </label>
          <button type="button" onClick={() => turn(1)} disabled={last >= pages} className={tool} aria-label="Next page" data-reader-next>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </footer>
      )}
    </div>
  );
}
