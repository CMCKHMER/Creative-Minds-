#!/usr/bin/env python3
"""Blogger feed -> public/blog/posts.json sync for the CMC homepage.

Fetches the Atom-in-JSON feed of creativemindscambodia.blogspot.com and
writes a compact static JSON the homepage's "From the Blog" section loads
at runtime (./blog/posts.json), mirroring the public/news/headlines.json
pattern: a scheduled GitHub Action re-runs this script, and the site picks
the new file up on the next Pages deploy without touching the app bundle.

Stdlib only — no pip dependencies.
"""

import argparse
import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BLOG_URL = "https://creativemindscambodia.blogspot.com/"
FEED_URL = "https://creativemindscambodia.blogspot.com/feeds/posts/default?alt=json&max-results={max}"
OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "blog" / "posts.json"
SNIPPET_LEN = 180

UA = {"User-Agent": "cmc-blog-sync/1.0 (GitHub Action; site feed mirror)"}

TAG_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.I | re.S)
ANY_TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
BLOGGER_SIZE_RE = re.compile(r"/s\d+(?:-c)?/")
YT_DEFAULT_RE = re.compile(r"(img\.youtube\.com/vi/[\w-]+/)default\.jpg")
YT_ID_RE = re.compile(r"(?:youtube(?:-nocookie)?\.com/(?:embed/|v/|shorts/)|youtu\.be/)([\w-]{6,20})")
SOUNDCLOUD_RE = re.compile(r"w\.soundcloud\.com/player", re.I)


def clean_text(raw: str, limit: int = SNIPPET_LEN) -> str:
    """HTML blob -> trimmed single-line plain text."""
    text = ANY_TAG_RE.sub(" ", TAG_RE.sub(" ", raw or ""))
    text = html.unescape(text)
    text = WS_RE.sub(" ", text).strip()
    return text[: limit - 1].rstrip() + "…" if len(text) > limit else text


def upgrade_thumbnail(url: str) -> str:
    """Ask Blogger's image CDN for a card-sized crop instead of the 72px stub."""
    if not url:
        return ""
    url = YT_DEFAULT_RE.sub(r"\1hqdefault.jpg", url)
    return BLOGGER_SIZE_RE.sub("/s320-c/", url)


def first_content_image(content_html: str) -> str:
    """Posts without media$thumbnail usually embed an <img> in the body."""
    for match in re.finditer(r"<img[^>]+src=[\"']([^\"']+)[\"']", content_html or "", re.I):
        url = html.unescape(match.group(1))
        if url.startswith("http"):
            return upgrade_thumbnail(url)
    return ""


def youtube_id(content_html: str) -> str:
    """Embeds are how these posts carry video — grab the ID for a thumbnail."""
    for match in re.finditer(r"<iframe[^>]+src=[\"']([^\"']+)[\"']", content_html or "", re.I):
        found = YT_ID_RE.search(html.unescape(match.group(1)))
        if found:
            return found.group(1)
    found = YT_ID_RE.search(content_html or "")
    return found.group(1) if found else ""


def pick_thumbnail(entry: dict, content_html: str) -> str:
    thumb = entry.get("media$thumbnail", {}).get("url", "")
    if thumb:
        return upgrade_thumbnail(thumb)
    vid = youtube_id(content_html)
    if vid:
        return f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
    return first_content_image(content_html)


def post_url(entry: dict) -> str:
    for link in entry.get("link", []):
        if link.get("rel") == "alternate" and link.get("type") == "text/html":
            return link.get("href", "")
    return ""


def build_post(entry: dict) -> dict:
    content_html = entry.get("content", {}).get("$t", "") or entry.get("summary", {}).get("$t", "")
    snippet = clean_text(content_html)
    title = (entry.get("title", {}).get("$t") or "").strip()
    derived_title = False
    if not title:
        # Auto-shared posts (YouTube/social) publish with an empty title.
        title = snippet[:60].rstrip() or "Untitled post"
        if len(snippet) > 60:
            title += "…"
        derived_title = True
    published_iso = entry.get("published", {}).get("$t", "")
    date_label = ""
    if published_iso:
        try:
            date_label = datetime.fromisoformat(published_iso).strftime("%b %d, %Y")
        except ValueError:
            date_label = published_iso[:10]
    tags = [c.get("term", "") for c in entry.get("category", []) if c.get("term")]
    if youtube_id(content_html):
        media = "video"
    elif SOUNDCLOUD_RE.search(content_html or ""):
        media = "audio"
    else:
        media = "post"
    if derived_title:
        snippet = ""  # the card already shows this text as its title
    return {
        "id": entry.get("id", {}).get("$t", ""),
        "title": title,
        "url": post_url(entry),
        "published": published_iso,
        "date_label": date_label,
        "snippet": snippet,
        "thumbnail": pick_thumbnail(entry, content_html),
        "media": media,
        "tags": tags[:4],
    }


def fetch_feed(max_posts: int) -> dict:
    req = urllib.request.Request(FEED_URL.format(max=max_posts), headers=UA)
    with urllib.request.urlopen(req, timeout=45) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--indent", action="store_true", help="pretty-print the JSON")
    parser.add_argument("--max", type=int, default=8, help="posts to keep (default 8)")
    args = parser.parse_args()

    feed = fetch_feed(args.max)
    entries = feed.get("feed", {}).get("entry", []) or []
    posts = [p for p in (build_post(e) for e in entries) if p["url"]]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "blog_url": BLOG_URL,
        "blog_title": feed.get("feed", {}).get("title", {}).get("$t", "Creative Minds Blog"),
        "count": len(posts),
        "posts": posts,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2 if args.indent else None)
        fh.write("\n")

    print(f"Wrote {OUT_PATH.relative_to(OUT_PATH.parent.parent)}: {len(posts)} posts")
    for p in posts:
        print(f"  - [{p['date_label']}] {p['title'][:60]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
