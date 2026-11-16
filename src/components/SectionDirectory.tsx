/*
 * The cards of the home page and the frame of a section page.
 *
 * Owner request (Nov 2026): the home page was one very long scroll; now each
 * part of it is a page of its own and the home page is the hero plus one card
 * per page. The map of pages is src/lib/sitePages.ts; this file only draws it.
 *
 *   <SectionDirectory />  — the grouped cards under the hero, with a filter box
 *   <PageBar />           — the strip at the top of a section page (back, name,
 *                           previous / next)
 *   <MoreInGroup />       — the neighbouring pages, at the foot of a section page
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Newspaper, GraduationCap, Timer, ClipboardCheck, CalendarDays, NotebookPen,
  Backpack, Languages, Library, Gamepad2, Brain, Dices, PenTool, Activity, Wand2,
  LayoutGrid, Package, ListChecks, Lightbulb, Calculator, Tag, CircleHelp, UserPlus,
  ArrowLeft, ArrowRight, ArrowUpRight, Search, Pin, X,
} from 'lucide-react';
import {
  DIRECTORY_HASH, PAGE_GROUPS, SITE_PAGES, neighbours, pagesInGroup,
  type PageIcon, type SitePage,
} from '../lib/sitePages';
import { fetchTeasers, teaserAge, type AnnouncementTeaser } from '../lib/announcementTeaser';

const ICONS: Record<PageIcon, typeof Megaphone> = {
  megaphone: Megaphone,
  newspaper: Newspaper,
  graduation: GraduationCap,
  timer: Timer,
  clipboard: ClipboardCheck,
  calendar: CalendarDays,
  notebook: NotebookPen,
  kids: Backpack,
  languages: Languages,
  library: Library,
  gamepad: Gamepad2,
  brain: Brain,
  dice: Dices,
  layout: PenTool,
  activity: Activity,
  wand: Wand2,
  grid: LayoutGrid,
  package: Package,
  list: ListChecks,
  lightbulb: Lightbulb,
  calculator: Calculator,
  tag: Tag,
  help: CircleHelp,
  mail: UserPlus,
};

/** One card = one page. A plain link to the page's hash, so it also works
 *  with "open in a new tab" and the browser's back button. */
function PageCard({ page }: { page: SitePage }) {
  const Icon = ICONS[page.icon];
  return (
    <a href={`#${page.id}`} className="cmc-page-card group" data-page={page.id}>
      <span className="cmc-page-card-top">
        <span className="cmc-page-card-icon" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <span className="cmc-page-card-title">
          {page.title}
          {page.badge && <span className="cmc-page-card-badge">{page.badge}</span>}
        </span>
      </span>
      <span className="cmc-page-card-blurb">{page.blurb}</span>
      <ArrowUpRight className="cmc-page-card-arrow h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

/** The first card of the home page: the newest announcements, read live.
 *  It keeps the news where a visitor sees it first even though the board
 *  itself is a page of its own now. Falls back to a plain card when the
 *  titles cannot be loaded or there are none. */
function AnnouncementsCard({ page }: { page: SitePage }) {
  const [posts, setPosts] = useState<AnnouncementTeaser[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchTeasers(3, controller.signal)
      .then((list) => setPosts(list))
      .catch(() => { if (!controller.signal.aborted) setPosts([]); });
    return () => controller.abort();
  }, []);

  const Icon = ICONS[page.icon];
  return (
    <a href={`#${page.id}`} className="cmc-page-card cmc-page-card--news group" data-page={page.id}>
      <span className="cmc-page-card-top">
        <span className="cmc-page-card-icon" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <span className="cmc-page-card-title">
          {page.title}
          <span className="cmc-page-card-badge cmc-page-card-badge--live">Latest</span>
        </span>
      </span>
      {posts && posts.length > 0 ? (
        <span className="cmc-page-card-posts">
          {posts.map((post) => (
            <span key={post.id} className="cmc-page-card-post">
              {post.pinned && <Pin className="h-3 w-3 shrink-0" aria-label="Pinned" />}
              <span className="truncate">{post.title}</span>
              <span className="cmc-page-card-age">{post.pinned ? 'pinned' : teaserAge(post.createdAt)}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="cmc-page-card-blurb">{posts === null ? 'Loading the latest posts…' : page.blurb}</span>
      )}
      <ArrowUpRight className="cmc-page-card-arrow h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

function matches(page: SitePage, words: string[]): boolean {
  if (words.length === 0) return true;
  const group = PAGE_GROUPS.find((g) => g.id === page.group)?.title ?? '';
  const text = `${page.title} ${page.blurb} ${group} ${page.id.replace(/-/g, ' ')} ${page.badge ?? ''}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

export function SectionDirectory() {
  const [query, setQuery] = useState('');
  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const shown = useMemo(() => SITE_PAGES.filter((page) => matches(page, words)), [words]);

  return (
    <section id={DIRECTORY_HASH} className="cmc-directory" aria-labelledby="cmc-directory-title">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="cmc-directory-head">
          <div>
            <p className="cmc-directory-eyebrow">Everything on CMC</p>
            <h2 id="cmc-directory-title" className="cmc-directory-title">Pick a card — each one opens its own page.</h2>
          </div>
          <label className="cmc-directory-search">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Find a page</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a page…"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear the search">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </label>
        </div>

        {shown.length === 0 && (
          <p className="cmc-directory-empty" role="status">
            Nothing matches “{query}”. <button type="button" onClick={() => setQuery('')}>Show every page</button>
          </p>
        )}

        {PAGE_GROUPS.map((group) => {
          const pages = shown.filter((page) => page.group === group.id);
          if (pages.length === 0) return null;
          return (
            <div key={group.id} className="cmc-directory-group" data-group={group.id}>
              <div className="cmc-directory-group-head">
                <h3>{group.title}</h3>
                <span className="cmc-directory-rule" aria-hidden="true" />
                <span className="cmc-directory-hint">{group.hint}</span>
              </div>
              <div className="cmc-directory-grid">
                {pages.map((page) => (
                  page.id === 'announcements'
                    ? <AnnouncementsCard key={page.id} page={page} />
                    : <PageCard key={page.id} page={page} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The strip at the top of a section page: back to the cards, where you are,
 *  and the page before / after. */
export function PageBar({ page }: { page: SitePage }) {
  const group = PAGE_GROUPS.find((g) => g.id === page.group);
  const around = neighbours(page.id);
  return (
    <nav className="cmc-page-bar" aria-label="This page">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-5 sm:px-8 lg:px-12">
        <a href={`#${DIRECTORY_HASH}`} className="cmc-page-bar-back">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All pages
        </a>
        <p className="cmc-page-bar-crumb">
          {group && <span>{group.title}</span>}
          <span aria-hidden="true">/</span>
          <strong aria-current="page">{page.title}</strong>
        </p>
        {around && (
          <span className="cmc-page-bar-steps">
            <a href={`#${around.previous.id}`} title={`Previous: ${around.previous.title}`} aria-label={`Previous page: ${around.previous.title}`}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href={`#${around.next.id}`} title={`Next: ${around.next.title}`} aria-label={`Next page: ${around.next.title}`}>
              <span className="hidden sm:inline">{around.next.title}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </span>
        )}
      </div>
    </nav>
  );
}

/** The other pages of the same group, at the foot of a section page. */
export function MoreInGroup({ page }: { page: SitePage }) {
  const group = PAGE_GROUPS.find((g) => g.id === page.group);
  const others = pagesInGroup(page.group).filter((other) => other.id !== page.id);
  if (!group || others.length === 0) return null;
  return (
    <aside className="cmc-page-more" aria-label={`More in ${group.title}`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="cmc-directory-group-head">
          <h3>More in {group.title}</h3>
          <span className="cmc-directory-rule" aria-hidden="true" />
          <a href={`#${DIRECTORY_HASH}`} className="cmc-page-more-all">All pages <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
        </div>
        <div className="cmc-directory-grid">
          {others.map((other) => <PageCard key={other.id} page={other} />)}
        </div>
      </div>
    </aside>
  );
}
