/*
 * The Reading Room: the list of books and the rules for opening one.
 *
 * The list lives in public/library/catalog.json, so a book is added by
 * editing that file and uploading the PDF — no code change. Everything here
 * is pure (no React, no DOM) and covered by src/tests/library.test.ts.
 *
 * A book is read in one of two ways:
 *  - 'pdf': a PDF the site can fetch itself (a file in public/library/books/
 *    or any address that allows cross-site reading). It opens in the built-in
 *    reader: page turns, zoom, chapter list, and the place is remembered.
 *  - 'box': a file shared from Box. Box does not let another site fetch the
 *    bytes, so the book opens in Box's own viewer, framed inside the reader.
 */

export type BookSource =
  | { kind: 'pdf'; url: string }
  | { kind: 'box'; embedUrl: string };

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  /** Shelf name, e.g. "Fiction". */
  shelf: string;
  /** One or two sentences for the card. */
  about: string;
  /** Reading level or audience, e.g. "Kid 9–11", "Teachers". Optional. */
  level: string;
  pages: number | null;
  /** Why the school may publish it: "Public domain", "CMC original", "Licensed from …". */
  rights: string;
  /** Optional cover picture; without one the card draws a cover from the title. */
  cover: string | null;
  source: BookSource;
}

export interface LibraryCatalog {
  books: LibraryBook[];
  shelves: string[];
  /** One line per entry that was left out, for the person editing the file. */
  problems: string[];
}

const text = (value: unknown, max = 400): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/** Letters, digits and dashes only: the id is used in the address and in storage keys. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Turns a Box share address into the address of Box's embeddable viewer.
 *   https://app.box.com/s/<share>                → https://app.box.com/embed/s/<share>
 *   https://app.box.com/s/<share>/file/<id>      → https://app.box.com/embed/s/<share>/file/<id>
 * Sub-domains (school.app.box.com, school.box.com) are kept. Anything that is
 * not a Box share address returns null, so no other site can be framed.
 */
export function boxEmbedUrl(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!/(^|\.)box\.com$/i.test(url.hostname)) return null;
  const match = /^\/(?:embed\/)?s\/([a-z0-9]{8,64})(?:\/file\/(\d{3,20}))?\/?$/i.exec(url.pathname);
  if (!match) return null;
  const file = match[2] ? `/file/${match[2]}` : '';
  return `https://${url.hostname}/embed/s/${match[1]}${file}?view=list&sortColumn=name&showParentPath=0`;
}

/**
 * The address of a PDF the reader may fetch: a file inside the site
 * ("library/books/x.pdf") or a full https address. Scripts, data: addresses
 * and paths that climb out of the site are refused.
 */
export function pdfUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw || /[\s<>"'`\\]/.test(raw)) return null;
  if (/^https:\/\//i.test(raw)) {
    try {
      return new URL(raw).href;
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null;
  const path = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  if (!path || path.split('/').includes('..')) return null;
  return `./${path}`;
}

/** Same rule for cover pictures. */
export function coverUrl(value: unknown): string | null {
  const raw = text(value, 500);
  if (!raw) return null;
  const url = pdfUrl(raw);
  return url && /\.(?:png|jpe?g|webp|avif|svg)(?:\?.*)?$/i.test(url) ? url : null;
}

/** Reads one entry of catalog.json. Returns the book, or the reason it was left out. */
export function parseBook(entry: unknown): LibraryBook | string {
  if (!entry || typeof entry !== 'object') return 'An entry is not an object.';
  const raw = entry as Record<string, unknown>;
  const title = text(raw.title, 140);
  if (!title) return 'An entry has no title.';
  const id = slugify(text(raw.id, 80) || title);
  if (!id) return `"${title}": the id has no letters or digits.`;

  const file = text(raw.file, 600);
  const box = text(raw.box, 600);
  let source: BookSource | null = null;
  if (file) {
    const url = pdfUrl(file);
    if (!url) return `"${title}": "file" is not an address the reader can open.`;
    source = { kind: 'pdf', url };
  } else if (box) {
    const embedUrl = boxEmbedUrl(box);
    if (!embedUrl) return `"${title}": "box" is not a Box share link.`;
    source = { kind: 'box', embedUrl };
  }
  if (!source) return `"${title}": add "file" (a PDF) or "box" (a Box share link).`;

  const rights = text(raw.rights, 160);
  if (!rights) return `"${title}": say why the school may publish it in "rights" (for example "Public domain" or "CMC original").`;

  const pages = typeof raw.pages === 'number' && Number.isFinite(raw.pages) && raw.pages > 0 ? Math.floor(raw.pages) : null;
  return {
    id,
    title,
    author: text(raw.author, 120),
    shelf: text(raw.shelf, 40) || 'General',
    about: text(raw.about, 400),
    level: text(raw.level, 40),
    pages,
    rights,
    cover: coverUrl(raw.cover),
    source,
  };
}

/** Reads catalog.json. A broken entry is skipped and reported; the rest still load. */
export function parseCatalog(data: unknown): LibraryCatalog {
  const list: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { books?: unknown }).books)
      ? (data as { books: unknown[] }).books
      : [];
  const books: LibraryBook[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    const book = parseBook(entry);
    if (typeof book === 'string') {
      problems.push(book);
    } else if (seen.has(book.id)) {
      problems.push(`"${book.title}": another book already uses the id "${book.id}".`);
    } else {
      seen.add(book.id);
      books.push(book);
    }
  }
  const shelves = [...new Set(books.map((book) => book.shelf))];
  return { books, shelves, problems };
}

/** Title, author, shelf and level, matched word by word. */
export function searchBooks(books: readonly LibraryBook[], query: string, shelf: string | null = null): LibraryBook[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return books.filter((book) => {
    if (shelf && book.shelf !== shelf) return false;
    const hay = `${book.title} ${book.author} ${book.shelf} ${book.level}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

// ── Where the reader was ────────────────────────────────────────────────

export interface ReadingPlace {
  page: number;
  pages: number;
  /** When it was saved, in milliseconds. */
  at: number;
}

export const placeKey = (bookId: string): string => `cmc-library-place:${bookId}`;

export function clampPage(page: number, pages: number): number {
  if (!Number.isFinite(page) || pages < 1) return 1;
  return Math.min(Math.max(1, Math.round(page)), pages);
}

export function readPlace(stored: string | null): ReadingPlace | null {
  if (!stored) return null;
  try {
    const raw = JSON.parse(stored) as Partial<ReadingPlace>;
    if (typeof raw.page !== 'number' || typeof raw.pages !== 'number' || raw.pages < 1) return null;
    return { page: clampPage(raw.page, raw.pages), pages: Math.floor(raw.pages), at: typeof raw.at === 'number' ? raw.at : 0 };
  } catch {
    return null;
  }
}

/** 0–100, for the progress line on a card. */
export function percentRead(place: ReadingPlace | null): number {
  if (!place || place.pages < 1) return 0;
  if (place.pages === 1) return 100;
  return Math.round(((place.page - 1) / (place.pages - 1)) * 100);
}

/**
 * Which pages share the screen. On a wide screen a book opens like a book:
 * the cover alone, then pairs (2–3, 4–5, …). On a narrow one, a page at a time.
 */
export function spreadFor(page: number, pages: number, twoUp: boolean): number[] {
  const current = clampPage(page, pages);
  if (!twoUp || pages < 3 || current === 1) return [current];
  const left = current % 2 === 0 ? current : current - 1;
  return left + 1 <= pages ? [left, left + 1] : [left];
}

/** The page to land on after "next" or "back". */
export function turnPage(page: number, pages: number, twoUp: boolean, direction: 1 | -1): number {
  const spread = spreadFor(page, pages, twoUp);
  const first = spread[0] ?? 1;
  const last = spread[spread.length - 1] ?? first;
  if (direction === 1) return clampPage(last + 1, pages);
  const target = clampPage(first - 1, pages);
  return spreadFor(target, pages, twoUp)[0] ?? target;
}

/** `#library/alice-in-wonderland` → "alice-in-wonderland"; anything else → null. */
export function bookIdFromHash(hash: string): string | null {
  const match = /^#?library\/([a-z0-9-]{1,60})$/i.exec(hash.trim());
  return match?.[1] ? match[1].toLowerCase() : null;
}
