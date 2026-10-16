import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Clock3, ExternalLink, Globe2, Loader2, Newspaper, RefreshCw, Search, Sparkles } from 'lucide-react';

/* =========================================================================
   CMC — Cambodia Education News components
   =========================================================================

   Two exports:

   1. NewsSidePanel — slim right-side widget for the hero on the homepage.
      Shows the 4 latest headlines + a "See all news →" link to the
      dedicated #news page.

   2. NewsPage — full-page route at #news with all 30 headlines,
      a source filter, and a search box. Same sticky-top-bar pattern
      as LearningGamesPage (#games) and TeacherToolsPage (#teacher-tools).

   Both load /news/headlines.json at runtime (not bundled) so the
   daily cron updates show up on the live site without rebuilding
   the app.
*/

interface NewsHeadline {
  title: string;
  link: string;
  source: string;
  published: string;
  published_relative: string;
  snippet: string;
}

interface NewsFile {
  generated_at: string;
  source: string;
  count: number;
  headlines: NewsHeadline[];
}

const HEADLINES_URL = './news/headlines.json';

const SOURCE_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  'Khmer Times':       { label: 'Khmer Times',  bg: 'bg-rose-300/10',    text: 'text-rose-200',    border: 'border-rose-300/25' },
  'Phnom Penh Post':   { label: 'PPP',           bg: 'bg-cyan-300/10',    text: 'text-cyan-200',    border: 'border-cyan-300/25' },
  'Cambodianess':      { label: 'Cambodianess',  bg: 'bg-violet-300/10',  text: 'text-violet-200',  border: 'border-violet-300/25' },
  'Kiripost':          { label: 'Kiripost',      bg: 'bg-amber-300/10',    text: 'text-amber-200',   border: 'border-amber-300/25' },
  'Fresh News':        { label: 'Fresh News',    bg: 'bg-emerald-300/10', text: 'text-emerald-200', border: 'border-emerald-300/25' },
  'UNESCO':            { label: 'UNESCO',        bg: 'bg-sky-300/10',     text: 'text-sky-200',     border: 'border-sky-300/25' },
  'UNICEF':            { label: 'UNICEF',        bg: 'bg-cyan-300/10',    text: 'text-cyan-200',    border: 'border-cyan-300/25' },
  'VOD':               { label: 'VOD',           bg: 'bg-orange-300/10',  text: 'text-orange-200',  border: 'border-orange-300/25' },
};

function sourcePill(source: string): { label: string; bg: string; text: string; border: string } {
  return SOURCE_STYLE[source] ?? {
    label: source || 'Source',
    bg: 'bg-slate-300/10',
    text: 'text-slate-200',
    border: 'border-slate-300/25',
  };
}

function relativeTimeRefresh(publishedIso: string): string {
  if (!publishedIso) return '';
  try {
    const pub = new Date(publishedIso);
    const now = new Date();
    const seconds = Math.max(0, Math.floor((now.getTime() - pub.getTime()) / 1000));
    if (seconds < 60) return 'just now';
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      return `${m} minute${m === 1 ? '' : 's'} ago`;
    }
    if (seconds < 86400) {
      const h = Math.floor(seconds / 3600);
      return `${h} hour${h === 1 ? '' : 's'} ago`;
    }
    const d = Math.floor(seconds / 86400);
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d} days ago`;
    const w = Math.floor(d / 7);
    return `${w} week${w === 1 ? '' : 's'} ago`;
  } catch {
    return '';
  }
}

/* =========================================================================
   Shared data hook — loads headlines once, both components can use it
   ========================================================================= */

function useHeadlines(refreshKey = 0) {
  const [data, setData] = useState<NewsFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(HEADLINES_URL, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: NewsFile) => {
        if (cancelled) return;
        setData(json);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn('[news] could not load headlines:', err);
        setError('Could not load headlines right now.');
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { data, isLoading, error };
}

/* =========================================================================
   1. NewsSidePanel — slim right-side widget for the hero
   ========================================================================= */

export function NewsSidePanel({ onSeeAll }: { onSeeAll: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error } = useHeadlines(refreshKey);

  const headlines = useMemo(() => data?.headlines.slice(0, 4) ?? [], [data]);
  const generatedLabel = useMemo(() => {
    if (!data?.generated_at) return '';
    try {
      return new Date(data.generated_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [data?.generated_at]);

  return (
    <aside
      aria-labelledby="news-side-panel-title"
      className="cmc-glass relative flex max-h-[640px] flex-col overflow-hidden rounded-2xl"
      style={{ width: '100%', maxWidth: '340px' }}
    >
      {/* Header row — compact */}
      <div className="flex items-center justify-between gap-2 border-b border-white/8 bg-slate-950/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-200">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="news-side-panel-title" className="truncate text-[13px] font-bold tracking-tight text-white">
              Cambodia · Education
            </h2>
            <p className="truncate text-[9px] text-slate-500">
              {generatedLabel ? `Updated ${generatedLabel}` : 'Loading…'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={isLoading}
          aria-label="Refresh headlines"
          className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-slate-300 transition hover:border-cyan-200/30 hover:bg-cyan-200/10 hover:text-cyan-100 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </button>
      </div>

      {/* Body — list of 4 latest headlines */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[11px] text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" /> Loading…
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-[11px] text-slate-400">
            <p className="mb-2">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-200/10"
            >
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          </div>
        ) : headlines.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-slate-500">No headlines yet.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {headlines.map((h, i) => {
              const pill = sourcePill(h.source);
              return (
                <li key={`sp-${i}`}>
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block px-4 py-3 transition hover:bg-cyan-200/[0.05]"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border ${pill.border} ${pill.bg} px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] uppercase ${pill.text}`}>
                        {pill.label}
                      </span>
                      <span className="text-[8px] text-slate-500">{relativeTimeRefresh(h.published) || h.published_relative}</span>
                    </div>
                    <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-100 transition group-hover:text-cyan-100">
                      {h.title}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer — "See all news →" link to dedicated #news page */}
      <div className="border-t border-white/8 bg-slate-950/40 px-4 py-2.5">
        <button
          type="button"
          onClick={onSeeAll}
          className="group flex w-full items-center justify-between gap-2 rounded-md text-[11px] font-semibold text-cyan-200 transition hover:text-cyan-100"
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            See all {data?.count ?? ''} news
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

/* =========================================================================
   2. NewsPage — full dedicated #news route
   ========================================================================= */

export function NewsPage({ onBackHome }: { onBackHome: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error } = useHeadlines(refreshKey);

  const [activeSource, setActiveSource] = useState<string>('All sources');
  const [search, setSearch] = useState('');

  const headlines = useMemo(() => data?.headlines ?? [], [data]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    headlines.forEach((h) => set.add(h.source));
    return ['All sources', ...Array.from(set).sort()];
  }, [headlines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return headlines.filter((h) => {
      if (activeSource !== 'All sources' && h.source !== activeSource) return false;
      if (!q) return true;
      return (
        h.title.toLowerCase().includes(q) ||
        h.snippet.toLowerCase().includes(q) ||
        h.source.toLowerCase().includes(q)
      );
    });
  }, [headlines, activeSource, search]);

  const generatedLabel = useMemo(() => {
    if (!data?.generated_at) return '';
    try {
      return new Date(data.generated_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [data?.generated_at]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070d17] text-slate-100">
      {/* Sticky top bar — matches LearningGamesPage + TeacherToolsPage */}
      <div className="sticky top-0 z-40 border-b border-white/8 bg-[#070d17]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="#news" className="flex items-center gap-3" aria-label="Creative Minds Cambodia Education News">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-amber-300 text-slate-950">
              <Newspaper className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold tracking-tight text-white">
              Creative Minds <span className="text-cyan-200">Cambodia News</span>
            </span>
          </a>
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to CMC
          </button>
        </div>
      </div>

      {/* Hero band — uses the AI-generated Cambodia education scene */}
      <section className="relative isolate overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 -z-20">
          <img
            src="./images/news/news-hero.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-30"
            decoding="async"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070d17] via-[#070d17]/85 to-[#070d17]/50" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070d17]/70 via-transparent to-[#070d17]/70" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(90deg,black,transparent_90%)]"
        />
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.17em] text-cyan-100 uppercase">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" /> Daily Cambodia education news
            </span>
            <h1 className="mt-5 font-[var(--font-display)] text-4xl leading-[1.04] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              What's happening in<br />
              <span className="bg-gradient-to-r from-cyan-200 via-teal-200 to-amber-200 bg-clip-text text-transparent">Cambodia education.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Headlines indexed daily from Khmer Times, UNICEF, UNESCO, Cambodianess, Kiripost, and other
              sources covering Cambodian schools, universities, scholarships, MoEYS policy, students, and
              teachers. Refreshed every morning at 8 am Phnom Penh time.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">{data?.count ?? 0} headlines</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">{sources.length - 1} sources</span>
              {generatedLabel && (
                <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5">
                  <Clock3 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                  Updated {generatedLabel}
                </span>
              )}
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5 text-cyan-200 transition hover:bg-cyan-200/10 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Filter + search bar */}
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[9px] font-bold tracking-[0.17em] text-cyan-300 uppercase">All headlines</p>
            <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Browse every story
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search headlines…"
                className="w-full min-w-[200px] rounded-lg border border-white/10 bg-slate-900/60 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-300 focus:outline-none sm:w-64"
              />
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 p-1" role="tablist" aria-label="Filter by source">
              {sources.map((src) => (
                <button
                  key={src}
                  type="button"
                  role="tab"
                  aria-selected={activeSource === src}
                  onClick={() => setActiveSource(src)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                    activeSource === src ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Headlines list — full grid */}
        <div className="mt-7">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
              Loading Cambodia education headlines…
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-slate-400">
              <p className="mb-3">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-200/10"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No headlines match <strong className="text-slate-300">"{search}"</strong> in <strong className="text-slate-300">{activeSource}</strong>.
              <button
                type="button"
                onClick={() => { setSearch(''); setActiveSource('All sources'); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-200/10"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((h, i) => {
                const pill = sourcePill(h.source);
                return (
                  <a
                    key={`pg-${i}`}
                    href={h.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-2 rounded-xl border border-white/8 bg-slate-950/40 p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/30 hover:bg-cyan-200/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md border ${pill.border} ${pill.bg} px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase ${pill.text}`}>
                        {pill.label}
                      </span>
                      <span className="text-[9px] text-slate-500">{relativeTimeRefresh(h.published) || h.published_relative}</span>
                    </div>
                    <p className="line-clamp-3 text-[13px] font-semibold leading-snug text-slate-100 transition group-hover:text-cyan-100">
                      {h.title}
                    </p>
                    {h.snippet && (
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500">{h.snippet}</p>
                    )}
                    <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[10px] font-semibold text-cyan-200/80">
                      Read story <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] leading-relaxed text-slate-600">
          Headlines via Google News RSS (Cambodia + education keywords). Sources retain their own
          copyright — click any headline to read the full story on the original site. CMC does not
          store or republish article content.
        </p>
      </section>
    </main>
  );
}
