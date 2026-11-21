import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TickerBanner } from '../components/TickerBanner';
import { TICKER_HIGHLIGHTS } from '../data/tickerHighlights';
import { findPage } from '../lib/sitePages';

const publicDir = resolve(process.cwd(), 'public');
const libraryCatalog = JSON.parse(
  readFileSync(resolve(publicDir, 'library/catalog.json'), 'utf8'),
) as { books: Array<{ id: string }> };
const libraryIds = new Set(libraryCatalog.books.map((b) => b.id));

describe('Homepage ticker feature promotions', () => {
  it('lists unique, valid promoted features whose links all resolve to real pages or assets', () => {
    expect(TICKER_HIGHLIGHTS.length).toBeGreaterThanOrEqual(6);
    const ids = new Set<string>();
    for (const item of TICKER_HIGHLIGHTS) {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(item.title.trim().length).toBeGreaterThan(2);
      expect(item.summary.trim().length).toBeGreaterThan(5);
      if (item.href.startsWith('./')) {
        const rel = item.href.slice(2).split(/[?#]/)[0];
        expect(existsSync(resolve(publicDir, rel))).toBe(true);
      } else if (item.href.startsWith('#library/')) {
        const bookId = item.href.slice('#library/'.length).split('/')[0];
        expect(libraryIds.has(bookId)).toBe(true);
      } else if (item.href.startsWith('#')) {
        expect(findPage(item.href.slice(1))).toBeDefined();
      } else {
        throw new Error(`Unexpected highlight href format: ${item.href}`);
      }
    }
  });

  it('renders the What’s New spotlight and clickable promoted items inside TickerBanner ahead of live stats', () => {
    const markup = renderToStaticMarkup(createElement(TickerBanner));
    const whatsNewIdx = markup.indexOf("What&#x27;s New");
    const drillsTodayIdx = markup.indexOf('Drills today');
    expect(whatsNewIdx).toBeGreaterThan(-1);
    expect(drillsTodayIdx).toBeGreaterThan(whatsNewIdx);

    for (const item of TICKER_HIGHLIGHTS) {
      expect(markup).toContain(item.title);
      expect(markup).toContain(`href="${item.href}"`);
    }
  });
});
