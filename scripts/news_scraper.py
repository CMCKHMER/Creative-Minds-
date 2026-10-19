#!/usr/bin/env python3
"""Daily Cambodia education news scraper for the CMC site.

Fetches Cambodia-education Google News RSS queries, dedupes and ranks the
items, and writes public/news/headlines.json so the static GitHub Pages site
serves fresh headlines. The React side loads ./news/headlines.json at
runtime (see src/components/NewsWindow.tsx).

Stdlib only — no pip installs — because the news-scraper GitHub Action runs
this on a bare python 3.12 runner image.

Usage (as invoked by .github/workflows/news-scraper.yml):
    python3 scripts/news_scraper.py --indent --total-keep 30
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

FEED_BASE = 'https://news.google.com/rss/search?q='
OUTPUT_DEFAULT = Path(__file__).resolve().parents[1] / 'public' / 'news' / 'headlines.json'
SOURCE_LABEL = 'Google News RSS — Cambodia education (CMC scraper)'

# Same query set the original feed was built from: English education terms
# plus Khmer-script education keywords so local-language outlets appear too.
QUERIES = [
    'Cambodia education OR school OR university OR MoEYS',
    'Cambodia student OR teacher OR scholarship OR exam',
    'Phnom Penh education OR school OR university',
    'Cambodia រៀន OR សិស្ស OR គ្រូ OR ការអប់រំ',
]

USER_AGENT = (
    'Mozilla/5.0 (compatible; CMCNewsScraper/1.0; '
    '+https://cmckhmer.github.io/Creative-Minds-/)'
)
FETCH_TIMEOUT = 20


def parse_feed(payload: bytes, query: str) -> list[dict]:
    """Parse one Google News RSS payload into raw headline dicts."""
    root = ET.fromstring(payload)
    items: list[dict] = []
    for item in root.iter('item'):
        title = html.unescape((item.findtext('title') or '').strip())
        link = (item.findtext('link') or '').strip()
        source_el = item.find('source')
        source = html.unescape((source_el.text or '').strip()) if source_el is not None and source_el.text else ''
        published_raw = (item.findtext('pubDate') or '').strip()
        description = html.unescape((item.findtext('description') or '').strip())
        try:
            published_dt = parsedate_to_datetime(published_raw) if published_raw else None
        except (TypeError, ValueError):
            published_dt = None
        if not title or not link:
            continue
        items.append({
            'title': title,
            'link': link,
            'source': source or 'Google News',
            'published': published_dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if published_dt else None,
            'query': query,
            'description': description,
        })
    return items


_TAG_RE = re.compile(r'<[^>]+>')


def clean_snippet(description: str) -> str:
    """Google News descriptions arrive as mini-HTML; strip tags and shorten."""
    text = html.unescape(_TAG_RE.sub(' ', description or ''))
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:200].rsplit(' ', 1)[0] + '…' if len(text) > 200 else text


def relative_time(published: str | None, now: datetime) -> str:
    """Human-friendly age like '3 h ago' matching the original feed format."""
    if not published:
        return ''
    try:
        then = datetime.fromisoformat(published.replace('Z', '+00:00'))
    except ValueError:
        return ''
    seconds = max(0, int((now - then).total_seconds()))
    if seconds < 60:
        return 'just now'
    minutes, hours, days = seconds // 60, seconds // 3600, seconds // 86400
    if hours < 1:
        return f'{minutes} min ago'
    if days < 1:
        return f'{hours} h ago'
    return f'{days} d ago'


def fetch_all(queries: list[str]) -> list[dict]:
    """Fetch every query with per-feed failure isolation."""
    collected: list[dict] = []
    failures: list[str] = []
    for query in queries:
        url = FEED_BASE + urllib.parse.quote(query) + '&hl=en-US&gl=US&ceid=US:en'
        request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT) as response:
                payload = response.read()
            feed_items = parse_feed(payload, query)
            collected.extend(feed_items)
            print(f'  {len(feed_items):3d} items  <- {query}')
        except Exception as exc:  # noqa: BLE001 — one dead feed must not kill the run
            failures.append(query)
            print(f'  FAIL      <- {query} ({exc})', file=sys.stderr)
    if failures and not collected:
        raise RuntimeError(f'all feeds failed: {failures}')
    if failures:
        print(f'warning: {len(failures)} feed(s) failed: {failures}', file=sys.stderr)
    return collected


def dedupe_and_rank(items: list[dict], total_keep: int) -> list[dict]:
    """Drop repeat headlines/links, then keep the newest `total_keep`."""
    seen_links: set[str] = set()
    seen_titles: set[str] = set()
    unique: list[dict] = []
    for item in items:
        title_key = re.sub(r'\s+', ' ', item['title'].casefold())
        if item['link'] in seen_links or title_key in seen_titles:
            continue
        seen_links.add(item['link'])
        seen_titles.add(title_key)
        unique.append(item)
    unique.sort(key=lambda item: item.get('published') or '', reverse=True)
    return unique[:total_keep]


def main() -> int:
    parser = argparse.ArgumentParser(description='Scrape Cambodia education news into public/news/headlines.json')
    parser.add_argument('--output', default=str(OUTPUT_DEFAULT), help='output JSON path')
    parser.add_argument('--indent', action='store_true', help='pretty-print the JSON')
    parser.add_argument('--total-keep', type=int, default=30, help='how many headlines to keep')
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    print(f'Fetching {len(QUERIES)} Google News RSS feeds…')
    items = fetch_all(QUERIES)
    print(f'Collected {len(items)} raw items; deduping/ranking to {args.total_keep}…')

    headlines = [
        {
            'title': item['title'],
            'link': item['link'],
            'source': item['source'],
            'published': item['published'] or '',
            'published_relative': relative_time(item['published'], now),
            'snippet': clean_snippet(item['description']),
        }
        for item in dedupe_and_rank(items, args.total_keep)
    ]

    output = {
        'generated_at': now.isoformat().replace('+00:00', 'Z'),
        'source': SOURCE_LABEL,
        'queries': QUERIES,
        'count': len(headlines),
        'headlines': headlines,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, indent=2 if args.indent else None, ensure_ascii=False) + '\n',
        encoding='utf-8',
    )
    print(f'Wrote {output_path} ({len(headlines)} headlines).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
