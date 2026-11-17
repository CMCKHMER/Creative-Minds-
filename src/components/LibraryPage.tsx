import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { GlassFact, GlassPageBar, GlassPageHero } from './GlassPage';
import {
  bookIdFromHash, parseCatalog, percentRead, placeKey, readPlace, searchBooks,
  type LibraryBook, type LibraryCatalog, type ReadingPlace,
} from '../lib/library';

// The reader carries pdf.js (about 0.5 MB), so it is fetched when a book is opened.
const BookReader = lazy(() => import('./BookReader').then((m) => ({ default: m.BookReader })));

const CATALOG_URL = './library/catalog.json';

/** Cover colours, picked from the title so a book always wears the same one. */
const COVERS = [
  'from-[#1d5c72] to-[#0e2a3d]',
  'from-[#5a4a9a] to-[#1b1a3d]',
  'from-[#8a5a2b] to-[#2e1f12]',
  'from-[#1f6b5a] to-[#0c2a26]',
  'from-[#8a3b52] to-[#2c1220]',
  'from-[#2f5f9a] to-[#101f3d]',
] as const;
const coverFor = (id: string) => COVERS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COVERS.length] ?? COVERS[0];

function readPlaces(books: readonly LibraryBook[]): Record<string, ReadingPlace> {
  const places: Record<string, ReadingPlace> = {};
  for (const book of books) {
    try {
      const place = readPlace(window.localStorage.getItem(placeKey(book.id)));
      if (place) places[book.id] = place;
    } catch {
      /* private mode: nothing remembered */
    }
  }
  return places;
}

function BookCover({ book }: { book: LibraryBook }) {
  if (book.cover) {
    return <img src={book.cover} alt="" loading="lazy" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" />;
  }
  return (
    <div className={`relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br ${coverFor(book.id)} p-4 shadow-lg`} aria-hidden="true">
      <span className="absolute inset-y-0 left-0 w-2 bg-black/25" />
      <span className="pl-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">{book.shelf}</span>
      <span className="pl-2 font-[var(--font-display)] text-lg font-bold leading-tight text-white [overflow-wrap:anywhere]">{book.title}</span>
      <span className="pl-2 text-xs font-medium text-white/75">{book.author}</span>
    </div>
  );
}

export function LibraryPage({ onBackHome }: { onBackHome: () => void }) {
  const [catalog, setCatalog] = useState<LibraryCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => bookIdFromHash(window.location.hash));
  const [places, setPlaces] = useState<Record<string, ReadingPlace>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(CATALOG_URL, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: unknown) => {
        if (cancelled) return;
        const parsed = parseCatalog(data);
        // Shown in the console for whoever edits catalog.json.
        for (const problem of parsed.problems) console.warn(`[library] ${problem}`);
        setCatalog(parsed);
        setPlaces(readPlaces(parsed.books));
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const books = useMemo(() => catalog?.books ?? [], [catalog]);
  const shown = useMemo(() => searchBooks(books, query, shelf), [books, query, shelf]);
  const openBook = useMemo(() => books.find((book) => book.id === openId) ?? null, [books, openId]);
  const started = useMemo(
    () => books.filter((book) => places[book.id]).sort((a, b) => (places[b.id]?.at ?? 0) - (places[a.id]?.at ?? 0)).slice(0, 4),
    [books, places],
  );

  // The address names the open book, so a book can be linked to. replaceState
  // (not a new hash) keeps the shelves where they were scrolled.
  const setAddress = (id: string | null) => {
    try {
      window.history.replaceState(window.history.state, '', id ? `#library/${id}` : '#library');
    } catch {
      /* the book still opens */
    }
  };
  const open = (id: string) => { setOpenId(id); setAddress(id); };
  const close = useCallback(() => {
    setOpenId(null);
    setAddress(null);
    setPlaces(readPlaces(books));
  }, [books]);

  return (
    <main className="cmc-app cmc-subpage min-h-screen overflow-hidden text-slate-100">
      <GlassPageBar href="#library" label="Reading room home" icon={BookOpen} name="Reading" accent="Room" onBack={onBackHome} />

      <GlassPageHero
        view="c"
        eyebrow="Creative Minds · Reading room"
        eyebrowIcon={BookOpen}
        title={<>Open a book. <em>Read it here.</em></>}
        lead="Books you can read on the site, on a phone or a laptop. Turn pages, jump to a chapter, zoom in, and come back later to the page you left."
      >
        <GlassFact>{catalog ? `${books.length} ${books.length === 1 ? 'book' : 'books'}` : 'Loading the shelves'}</GlassFact>
        <GlassFact>Nothing to download</GlassFact>
        <GlassFact>Your page is remembered</GlassFact>
      </GlassPageHero>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16" aria-labelledby="library-shelves">
        {started.length > 0 && (
          <div className="mb-12">
            <h2 className="font-[var(--font-display)] text-xl font-bold tracking-tight text-white">Continue reading</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {started.map((book) => {
                const place = places[book.id] ?? null;
                return (
                  <li key={book.id}>
                    <button type="button" onClick={() => open(book.id)} data-continue={book.id} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-300/50 hover:bg-white/[0.07]">
                      <span className="block truncate text-sm font-bold text-white">{book.title}</span>
                      <span className="mt-1 block text-xs text-slate-400">Page {place?.page} of {place?.pages}</span>
                      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-cyan-300" style={{ width: `${percentRead(place)}%` }} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-cyan-200">The shelves</p>
            <h2 id="library-shelves" className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">Pick a book</h2>
          </div>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search the books</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or author"
              className="h-11 w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none"
            />
          </label>
        </div>

        {catalog && catalog.shelves.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Shelves">
            {[null, ...catalog.shelves].map((name) => (
              <button
                key={name ?? 'all'}
                type="button"
                onClick={() => setShelf(name)}
                aria-pressed={shelf === name}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${shelf === name ? 'border-cyan-300 bg-cyan-300 text-[#071522]' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}
              >
                {name ?? 'All shelves'}
              </button>
            ))}
          </div>
        )}

        {failed && <p role="alert" className="mt-10 text-sm font-semibold text-rose-200">The book list could not be loaded. Check the connection and reload the page.</p>}
        {!failed && !catalog && <p role="status" className="mt-10 text-sm text-slate-300">Loading the shelves…</p>}
        {catalog && shown.length === 0 && (
          <p className="mt-10 text-sm text-slate-300">{books.length === 0 ? 'No books are on the shelves yet.' : 'No book matches that search.'}</p>
        )}

        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((book) => {
            const place = places[book.id] ?? null;
            return (
              <li key={book.id} className="flex flex-col" data-book={book.id}>
                <button type="button" onClick={() => open(book.id)} className="group text-left" aria-label={`Read ${book.title}${book.author ? ` by ${book.author}` : ''}`}>
                  <span className="block transition group-hover:-translate-y-1"><BookCover book={book} /></span>
                  <span className="mt-3 block text-sm font-bold leading-snug text-white">{book.title}</span>
                </button>
                {book.author && <p className="mt-0.5 text-xs text-slate-400">{book.author}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {[book.level, book.pages ? `${book.pages} pages` : '', book.source.kind === 'box' ? 'Opens in Box viewer' : ''].filter(Boolean).join(' · ')}
                </p>
                {book.about && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-300">{book.about}</p>}
                {place && (
                  <p className="mt-2 text-xs font-semibold text-cyan-200">{percentRead(place)}% read</p>
                )}
                <p className="mt-2 text-[11px] text-slate-500">{book.rights}</p>
              </li>
            );
          })}
        </ul>

        <p className="mt-14 max-w-2xl border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-400">
          Every book here is in the public domain, written by Creative Minds, or published with the owner&rsquo;s permission. If you hold the rights to something on these shelves and want it removed, write to us and we will take it down.
        </p>
      </section>

      {openBook && (
        <Suspense fallback={<div className="fixed inset-0 z-[90] grid place-items-center bg-[#07111d] text-sm text-slate-200" role="status">Opening the book…</div>}>
          <BookReader book={openBook} onClose={close} />
        </Suspense>
      )}
    </main>
  );
}
