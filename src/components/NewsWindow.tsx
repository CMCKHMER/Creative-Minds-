import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Clock3, ExternalLink, Globe2, Loader2, Newspaper, RefreshCw } from 'lucide-react';

/* =========================================================================
   CMC — Daily Cambodia Education News Window
   =========================================================================

   A small glass card that lives in the hero area of the CMC homepage.
   Fetches public/news/headlines.json (written by scripts/news_scraper.py
   and refreshed daily by the .github/workflows/news-scraper.yml cron).

   Behavior:
   - Loads /news/headlines.json at runtime (not bundled, so daily cron
     updates show up on the live site without rebuilding the app)
   - Shows a scrolling "ticker" of top headlines + a stacked list of
     all headlines with source pills, time-ago, and external links
   - Refresh button re-fetches the JSON (useful if user keeps the page
     open across the 8am scrape boundary)
   - Falls back to a graceful "Loading…" then "No headlines yet" state
   - All headline links open in a new tab with rel=noopener
   - Mobile-responsive: ticker scroll area shrinks, list stacks
*/

interface NewsHeadline {
  title: string;
  link: string;
  source: string;
  published: string;          // ISO 8601 UTC, e.g. '2026-10-16T09:56:39Z'
  published_relative: string; // pre-computed by the scraper, e.g. '8 hours ago'
  snippet: string;
}

interface NewsFile {
  generated_at: string;
  source: string;
  count: number;
  headlines: NewsHeadline[];
}

const HEADLINES_URL = './news/headlines.json';

// Map known Cambodian source names to a short label + accent color.
// Unknown sources fall back to a generic style.
const SOURCE_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  'Khmer Times': { label: 'Khmer Times', bg: 'bg-rose-300/10', text: 'text-rose-200' },
  'Phnom Penh Post': { label: 'PPP', bg: 'bg-cyan-300/10', text: 'text-cyan-200' },
  'Cambodianess': { label: 'Cambodianess', bg: 'bg-violet-300/10', text: 'text-violet-200' },
  'Kiripost': { label: 'Kiripost', bg: 'bg-amber-300/10', text: 'text-amber-200' },
  'Fresh News': { label: 'Fresh News', bg: 'bg-emerald-300/10', text: 'text-emerald-200' },
  'UNESCO': { label: 'UNESCO', bg: 'bg-sky-300/10', text: 'text-sky-200' },
  'UNICEF': { label: 'UNICEF', bg: 'bg-cyan-300/10', text: 'text-cyan-200' },
  'VOD': { label: 'VOD', bg: 'bg-orange-300/10', text: 'text-orange-200' },
};

function sourcePill(source: string): { label: string; bg: string; text: string } {
  return SOURCE_STYLE[source] ?? { label: source || 'Source', bg: 'bg-slate-300/10', text: 'text-slate-200' };
}

function relativeTimeRefresh(publishedIso: string): string {
  // Re-compute "x ago" client-side so the page stays fresh even when the
  // user keeps the tab open across the scrape boundary.
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

export function NewsWindow() {
  const [data, setData] = useState<NewsFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
        console.warn('[NewsWindow] could not load headlines:', err);
        setError('Could not load headlines right now.');
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const headlines = useMemo(() => data?.headlines ?? [], [data]);
  const generatedAt = data?.generated_at;
  const generatedLabel = useMemo(() => {
    if (!generatedAt) return '';
    try {
      return new Date(generatedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [generatedAt]);

  return (
    <section
      id="news-window"
      aria-labelledby="news-window-title"
      className="scroll-mt-24 border-y border-white/10 bg-[#0a1827] py-12 sm:py-14"
    >
      {/* Soft cyan + amber glows behind the card */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-10rem] -z-10 h-[28rem] w-[28rem] rounded-full bg-cyan-500/[0.10] blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-10rem] -z-10 h-[28rem] w-[28rem] rounded-full bg-amber-500/[0.08] blur-[120px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="cmc-glass relative overflow-hidden rounded-2xl p-5 sm:p-7">
          {/* Header row */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-200">
                <Newspaper className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <span className="cmc-eyebrow text-[10px]">
                  <Globe2 className="h-3 w-3" aria-hidden="true" /> Cambodia · Education
                </span>
                <h2 id="news-window-title" className="mt-1 font-[var(--font-display)] text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Daily local education news
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Headlines indexed from Khmer Times, UNICEF, UNESCO, Cambodianess &amp; more — refreshed every morning at 8&nbsp;am Phnom Penh time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              {generatedLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">
                  <Clock3 className="h-3 w-3" aria-hidden="true" /> Updated {generatedLabel}
                </span>
              )}
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={isLoading}
                aria-label="Refresh headlines"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-slate-300 transition hover:border-cyan-200/30 hover:bg-cyan-200/10 hover:text-cyan-100 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </button>
            </div>
          </div>

          {/* Body — ticker + list */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
              Loading Cambodia education headlines…
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <p className="mb-2">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-200/10"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          ) : headlines.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No education headlines available right now. Try refreshing later.
            </div>
          ) : (
            <>
              {/* Top 3 headlines — featured row */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {headlines.slice(0, 3).map((h, i) => {
                  const pill = sourcePill(h.source);
                  return (
                    <a
                      key={`feat-${i}`}
                      href={h.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col gap-2 rounded-xl border border-white/8 bg-slate-950/40 p-3.5 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-md border border-white/10 ${pill.bg} px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase ${pill.text}`}>
                          {pill.label}
                        </span>
                        <span className="text-[9px] text-slate-500">{relativeTimeRefresh(h.published) || h.published_relative}</span>
                      </div>
                      <p className="line-clamp-3 text-[13px] font-semibold leading-snug text-slate-100 transition group-hover:text-cyan-100">
                        {h.title}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-200/80">
                        Read story <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    </a>
                  );
                })}
              </div>

              {/* Remaining headlines — compact list */}
              {headlines.length > 3 && (
                <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/8 bg-slate-950/30">
                  {headlines.slice(3).map((h, i) => {
                    const pill = sourcePill(h.source);
                    return (
                      <li key={`row-${i}`}>
                        <a
                          href={h.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-3 px-3.5 py-2.5 transition hover:bg-cyan-200/[0.04]"
                        >
                          <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 ${pill.bg} px-1.5 py-0.5 text-[8px] font-bold tracking-[0.12em] uppercase ${pill.text}`}>
                            {pill.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-medium text-slate-200 transition group-hover:text-cyan-100">
                              {h.title}
                            </span>
                            <span className="mt-0.5 block text-[9px] text-slate-500">
                              {relativeTimeRefresh(h.published) || h.published_relative}
                            </span>
                          </span>
                          <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-slate-600 opacity-0 transition group-hover:text-cyan-300 group-hover:opacity-100" aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-600">
                <Globe2 className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300/60" aria-hidden="true" />
                <span>
                  Headlines via Google News RSS (Cambodia + education keywords). Sources retain their own
                  copyright — click any headline to read the full story on the original site. CMC does not
                  store or republish article content.
                </span>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
