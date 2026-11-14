#!/usr/bin/env python3
"""Refresh the generated JSON feeds right before a site build.

Run by .github/workflows/static.yml (the Pages build) on every deploy and on
its daily schedule:

    public/news/headlines.json   <- scripts/news_scraper.py
    public/blog/posts.json       <- scripts/blog_sync.py

Why this lives in the build instead of in separate "scrape and commit"
workflows: those workflows pushed the regenerated file to main, but main is
protected by a ruleset that rejects pushes from the Actions bot, so every
scheduled run failed and the site's news went stale. Even a successful bot
push would not have redeployed the site (pushes made with GITHUB_TOKEN do
not trigger other workflows). Regenerating inside the build needs no push
at all — the fresh files go straight into the deployed artifact.

Safety: each feed is regenerated independently and then validated. If a
generator crashes, times out, or produces an empty / inconsistent file, the
committed copy is restored, so a feed outage can never ship an empty news
panel or break the deploy. The script always exits 0.

Stdlib only.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (output file, key holding the item list, generator command)
FEEDS = [
    (
        ROOT / 'public' / 'news' / 'headlines.json',
        'headlines',
        [sys.executable, str(ROOT / 'scripts' / 'news_scraper.py'), '--indent', '--total-keep', '30'],
    ),
    (
        ROOT / 'public' / 'blog' / 'posts.json',
        'posts',
        [sys.executable, str(ROOT / 'scripts' / 'blog_sync.py'), '--indent'],
    ),
]

TIMEOUT_SECONDS = 240


def validate(path: Path, key: str) -> int:
    """Return the item count, or raise if the file is not a usable feed."""
    data = json.loads(path.read_text(encoding='utf-8'))
    items = data.get(key)
    if not isinstance(items, list) or not items:
        raise ValueError(f'"{key}" is empty')
    if data.get('count') != len(items):
        raise ValueError(f'count={data.get("count")!r} does not match {len(items)} {key}')
    if not data.get('generated_at'):
        raise ValueError('generated_at is missing')
    return len(items)


def refresh(path: Path, key: str, command: list[str]) -> bool:
    label = path.relative_to(ROOT).as_posix()
    backup = path.read_bytes() if path.exists() else None
    try:
        subprocess.run(command, cwd=ROOT, check=True, timeout=TIMEOUT_SECONDS)
        count = validate(path, key)
    except Exception as error:  # noqa: BLE001 — any failure means "keep the old file"
        if backup is not None:
            path.write_bytes(backup)
        elif path.exists():
            path.unlink()
        print(f'::warning::{label} was NOT refreshed ({error}); keeping the committed copy.')
        return False
    print(f'{label}: refreshed, {count} {key}.')
    return True


def main() -> int:
    results = [refresh(*feed) for feed in FEEDS]
    print(f'Feeds refreshed: {sum(results)}/{len(results)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
