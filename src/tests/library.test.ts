import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bookIdFromHash, boxEmbedUrl, clampPage, parseBook, parseCatalog, pdfUrl, percentRead,
  readPlace, searchBooks, slugify, spreadFor, turnPage,
} from '../lib/library';
import { findPage, isInPageAnchor, resolveRoute } from '../lib/sitePages';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Reading room: the book list', () => {
  const good = { title: 'A Book', author: 'Someone', shelf: 'Fiction', rights: 'CMC original', file: 'library/books/a.pdf' };

  it('reads a book kept on the site', () => {
    const book = parseBook(good);
    expect(book).toMatchObject({ id: 'a-book', shelf: 'Fiction', source: { kind: 'pdf', url: './library/books/a.pdf' } });
  });

  it('reads a book shared from Box, as the address of Box’s viewer', () => {
    const book = parseBook({ ...good, file: undefined, box: 'https://app.box.com/s/izbnvr08d4vxmt1bp3np99oceowpywpf/file/1954866155294' });
    expect(book).toMatchObject({ source: { kind: 'box' } });
    expect(typeof book === 'object' && book.source.kind === 'box' && book.source.embedUrl)
      .toMatch(/^https:\/\/app\.box\.com\/embed\/s\/izbnvr08d4vxmt1bp3np99oceowpywpf\/file\/1954866155294\?/);
  });

  it('refuses a book with no statement of rights', () => {
    expect(parseBook({ ...good, rights: '' })).toMatch(/rights/);
  });

  it('refuses addresses that are not a PDF path or a Box share link', () => {
    for (const file of ['javascript:alert(1)', 'data:application/pdf;base64,AAAA', '../secrets.pdf', '//evil.example/x.pdf', 'http://plain.example/x.pdf', 'a b.pdf']) {
      expect(pdfUrl(file), file).toBeNull();
    }
    expect(pdfUrl('/library/books/a.pdf')).toBe('./library/books/a.pdf');
    expect(pdfUrl('https://files.example/a.pdf')).toBe('https://files.example/a.pdf');
    for (const link of ['https://evil.example/s/abcdefgh1234', 'https://box.com.evil.example/s/abcdefgh1234', 'http://app.box.com/s/abcdefgh1234', 'https://app.box.com/folder/123', 'not a link']) {
      expect(boxEmbedUrl(link), link).toBeNull();
    }
    expect(boxEmbedUrl('https://school.app.box.com/s/abcdefgh1234')).toMatch(/^https:\/\/school\.app\.box\.com\/embed\/s\/abcdefgh1234\?/);
  });

  it('skips a broken entry, reports it, and keeps the rest', () => {
    const catalog = parseCatalog({ books: [good, { title: 'No file', rights: 'x' }, { ...good, title: 'A book' }, { ...good, title: 'Second', shelf: 'Teachers' }] });
    expect(catalog.books.map((book) => book.id)).toEqual(['a-book', 'second']);
    expect(catalog.shelves).toEqual(['Fiction', 'Teachers']);
    expect(catalog.problems).toHaveLength(2);
    expect(parseCatalog(null).books).toEqual([]);
  });

  it('searches title, author, shelf and level', () => {
    const { books } = parseCatalog([good, { ...good, title: 'Grammar Notes', author: 'CMC', shelf: 'Teachers', level: 'Kid 9' }]);
    expect(searchBooks(books, 'grammar cmc').map((book) => book.id)).toEqual(['grammar-notes']);
    expect(searchBooks(books, '', 'Fiction').map((book) => book.id)).toEqual(['a-book']);
    expect(searchBooks(books, 'kid 9')).toHaveLength(1);
    expect(searchBooks(books, 'zebra')).toEqual([]);
  });

  it('makes ids that are safe in an address', () => {
    expect(slugify("Alice's Adventures in Wonderland!")).toBe('alice-s-adventures-in-wonderland');
    expect(bookIdFromHash('#library/alice-in-wonderland')).toBe('alice-in-wonderland');
    expect(bookIdFromHash('#library')).toBeNull();
    expect(bookIdFromHash('#library/<script>')).toBeNull();
  });
});

describe('Reading room: turning pages', () => {
  it('keeps the page inside the book', () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(99, 10)).toBe(10);
    expect(clampPage(Number.NaN, 10)).toBe(1);
  });

  it('shows one page on a narrow screen and a pair on a wide one, cover alone', () => {
    expect(spreadFor(5, 10, false)).toEqual([5]);
    expect(spreadFor(1, 10, true)).toEqual([1]);
    expect(spreadFor(2, 10, true)).toEqual([2, 3]);
    expect(spreadFor(3, 10, true)).toEqual([2, 3]);
    expect(spreadFor(10, 10, true)).toEqual([10]);
  });

  it('walks the whole book forwards and back without skipping a page', () => {
    for (const twoUp of [false, true]) {
      const seen = new Set<number>();
      let page = 1;
      for (let step = 0; step < 40; step += 1) {
        for (const shown of spreadFor(page, 11, twoUp)) seen.add(shown);
        const next = turnPage(page, 11, twoUp, 1);
        if (next === page || spreadFor(next, 11, twoUp).includes(page)) break;
        page = next;
      }
      expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      while (page > 1) {
        const back = turnPage(page, 11, twoUp, -1);
        expect(back).toBeLessThan(page);
        page = back;
      }
      expect(page).toBe(1);
    }
  });

  it('remembers the place and reports how far the reader is', () => {
    expect(readPlace('{"page":5,"pages":9,"at":1}')).toEqual({ page: 5, pages: 9, at: 1 });
    expect(readPlace('{"page":50,"pages":9}')?.page).toBe(9);
    expect(readPlace('nonsense')).toBeNull();
    expect(readPlace(null)).toBeNull();
    expect(percentRead({ page: 1, pages: 9, at: 0 })).toBe(0);
    expect(percentRead({ page: 9, pages: 9, at: 0 })).toBe(100);
    expect(percentRead(null)).toBe(0);
  });
});

describe('Reading room: on the site', () => {
  it('is a page of its own, and a book address opens it', () => {
    expect(findPage('library')).toMatchObject({ kind: 'standalone', group: 'programs' });
    expect(resolveRoute('#library')).toBe('library');
    expect(resolveRoute('#library/alice-in-wonderland', 'home')).toBe('library');
    expect(resolveRoute('#ebooks')).toBe('library');
    expect(isInPageAnchor('#library/alice-in-wonderland')).toBe(false);
  });

  it('is wired into the app and loads the reader only when a book is opened', () => {
    const app = read('src/App.tsx');
    const page = read('src/components/LibraryPage.tsx');
    const reader = read('src/components/BookReader.tsx');
    expect(app).toContain("import('./components/LibraryPage')");
    expect(app).toContain("if (route === 'library') return (");
    expect(page).toContain("lazy(() => import('./BookReader')");
    expect(reader).toContain("import('pdfjs-dist/legacy/build/pdf.mjs')");
    expect(reader).not.toMatch(/^import \* as pdfjs/m);
    // a framed Box viewer cannot navigate the site or run with its powers
    expect(reader).toContain('sandbox="allow-scripts allow-same-origin allow-popups allow-forms"');
  });

  it('keeps book files out of the service worker cache', () => {
    const worker = read('public/sw.js');
    const version = Number(/const CACHE_VERSION = 'cmc-v(\d+)'/.exec(worker)?.[1]);
    expect(version).toBeGreaterThanOrEqual(94);
    const rule = worker.indexOf("if (/\\.pdf$/i.test(url.pathname)) return;");
    expect(rule).toBeGreaterThan(-1);
    // the rule must come before any strategy that would cache the response
    expect(rule).toBeLessThan(worker.indexOf('event.respondWith('));
  });

  it('ships a catalogue in which every book loads and every file exists', () => {
    const data: unknown = JSON.parse(read('public/library/catalog.json'));
    const catalog = parseCatalog(data);
    expect(catalog.problems).toEqual([]);
    expect(catalog.books.length).toBeGreaterThan(0);
    for (const book of catalog.books) {
      expect(book.rights.length, book.title).toBeGreaterThan(3);
      if (book.source.kind === 'pdf' && book.source.url.startsWith('./')) {
        const file = resolve(root, 'public', book.source.url.slice(2));
        expect(existsSync(file), book.source.url).toBe(true);
        expect(readFileSync(file).subarray(0, 5).toString('latin1'), book.source.url).toBe('%PDF-');
      }
    }
  });
});
