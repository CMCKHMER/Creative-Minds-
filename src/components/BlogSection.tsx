import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Feather, Sparkles } from 'lucide-react';

/*
 * "From the Blog" — the personal side of Creative Minds.
 *
 * The announcement board above carries the educational stream; this section
 * carries the personal writings, music and video releases from the director's
 * Blogger page (creativemindscambodia.blogspot.com).
 *
 * Data comes from ./blog/posts.json — a static file regenerated from the
 * Blogger feed by scripts/blog_sync.py on a scheduled GitHub Action
 * (.github/workflows/blog-sync.yml), the same pattern as
 * public/news/headlines.json: fresh posts land on the site without
 * touching the app bundle, and the page never depends on Blogger's
 * availability or CORS behaviour at view time.
 *
 * Resilience: if the feed file is missing or empty the section renders
 * nothing, so the homepage never shows a broken panel.
 */

interface BlogPost {
  id: string;
  title: string;
  url: string;
  published: string;
  date_label: string;
  snippet: string;
  thumbnail: string;
  media: string;
  tags: string[];
}

interface BlogFeed {
  generated_at: string;
  blog_url: string;
  blog_title: string;
  count: number;
  posts: BlogPost[];
}

const FEED_URL = './blog/posts.json';
const MAX_CARDS = 6;

const MEDIA_LABEL: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  post: 'Writing',
};

function MediaChip({ kind }: { kind: string }) {
  const label = MEDIA_LABEL[kind];
  if (!label) return null;
  const cls =
    kind === 'video'
      ? 'border-rose-300/25 bg-rose-300/10 text-rose-200'
      : kind === 'audio'
        ? 'border-violet-300/25 bg-violet-300/10 text-violet-200'
        : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${cls}`}>
      {label}
    </span>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <a
      href={post.url}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.06] hover:shadow-[0_18px_44px_-18px_rgba(34,211,238,0.35)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
    >
      <div className="relative h-44 shrink-0 overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
        {post.thumbnail ? (
          <img
            src={post.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
            <BookOpen className="h-9 w-9 text-cyan-300/40" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600">CREATIVEMINDS</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <MediaChip kind={post.media} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <CalendarDays className="h-3 w-3 text-cyan-300/70" aria-hidden="true" />
          <span>{post.date_label || post.published.slice(0, 10)}</span>
        </div>
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-100 transition group-hover:text-cyan-300">
          {post.title}
        </h3>
        {post.snippet && (
          <p className="line-clamp-3 text-sm leading-relaxed text-slate-400">{post.snippet}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-xs font-bold text-cyan-300">
          Read on the blog
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

export default function BlogSection() {
  const [feed, setFeed] = useState<BlogFeed | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(FEED_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: BlogFeed) => {
        if (!cancelled && Array.isArray(data?.posts)) setFeed(data);
      })
      .catch(() => {
        /* feed unavailable — the section stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const posts = feed?.posts.slice(0, MAX_CARDS) ?? [];
  if (!feed || posts.length === 0) return null;

  return (
    <section
      id="blog"
      aria-labelledby="blog-title"
      className="cmc-section relative scroll-mt-24 overflow-hidden border-y border-cyan-100/10 bg-[#07131f] py-20 sm:py-24 lg:py-28"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/55" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-500/[0.10] blur-[125px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] h-[35rem] w-[35rem] rounded-full bg-cyan-400/[0.09] blur-[135px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:44px_44px]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="cmc-eyebrow">
              <Feather className="h-3 w-3" aria-hidden="true" />
              From the blog · personal writings
            </span>
            <h2 id="blog-title" className="cmc-h2 mt-4">
              Thoughts, songs &amp; <span className="cmc-gradient-text">stories.</span>
            </h2>
            <p className="cmc-lead mt-4">
              The announcement board above is the educational stream. This is the personal side —
              writings, music and videos from the Creative Minds journey, mirrored from{' '}
              <span className="text-slate-200">{feed.blog_title.trim() || 'the blog'}</span> on Blogger.
            </p>
          </div>
          <a
            href={feed.blog_url}
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-bold text-cyan-200 transition hover:-translate-y-0.5 hover:bg-cyan-300/15"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Visit the blog
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id || post.url} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
