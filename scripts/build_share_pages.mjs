// Preview pages for shared announcements.
//
// Facebook, Telegram, WhatsApp, X and LinkedIn do not run the site's
// JavaScript: when a link is shared they read a few <meta> lines from the
// page at that address and build the preview card from them. The site is one
// page, so without this every shared announcement would show the same card
// (the site's) and Facebook would send readers to the home page.
//
// This script runs at deploy time, after the build. It reads the public
// announcements from the database and writes, for each post:
//   <out>/post/<id>/index.html   title, first lines and picture of the post
//                                as <meta>, then sends a person on to the post
//   <out>/post/<id>/cover.jpg    the post's picture, when it has one
//   <out>/post/<id>/share.json   a marker the Share menu looks for
//
// A post published after the last deploy has no page yet. The Share menu then
// shares the site's own address for the post (it opens the post, with the
// site's card as preview) until the next deploy — the site deploys every day.
//
//   node scripts/build_share_pages.mjs                 read the database, write into dist/
//   node scripts/build_share_pages.mjs --from f.json   read a saved REST response instead
//   node scripts/build_share_pages.mjs --out dir       write into another folder
//   SITE_URL=https://example.org/site/                 the public address of the site
//
// It never fails a deploy: when the database cannot be reached it says so
// and exits 0, and the Share menu falls back as described above.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const OUT = resolve(arg('--out') || join(HERE, '..', 'dist'));
const FROM = arg('--from');
const SITE = (process.env.SITE_URL || 'https://cmckhmer.github.io/Creative-Minds-/').replace(/\/?$/, '/');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'creative-minds-cambodia';
const LIST = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/announcements`;
const MAX_POSTS = 200;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const POST_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** First lines of a post on one line, cut at a word (same as excerpt() in src/lib/announcementMedia.ts). */
function excerpt(body, max = 200) {
  const flat = String(body ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:!?-]+$/, '')}…`;
}

/** The still picture YouTube publishes for a video address, or ''. */
function youtubePoster(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    let id = '';
    if (host === 'youtu.be') id = parts[0] || '';
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (parts[0] === 'watch') id = u.searchParams.get('v') || '';
      else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1] || '';
    }
    return /^[A-Za-z0-9_-]{6,64}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
  } catch {
    return '';
  }
}

/** A post's picture is stored as a data: URL. Returns the bytes and file ending, or null. */
function decodePicture(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  return { ext: m[1] === 'jpeg' ? 'jpg' : m[1], bytes: Buffer.from(m[2], 'base64') };
}

/**
 * Width and height of a JPEG, PNG or WebP picture, read from its first bytes
 * (null when they cannot be read). Facebook shows the picture on the very
 * first share only when the page states its size; without it the first person
 * to share a post gets a card with no picture.
 */
function pictureSize(bytes) {
  try {
    if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (bytes.length > 30 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
      const kind = bytes.toString('latin1', 12, 16);
      if (kind === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') {
        const n = bytes.readUInt32LE(21);
        return { width: 1 + (n & 0x3fff), height: 1 + ((n >> 14) & 0x3fff) };
      }
      return null;
    }
    if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let at = 2;
      while (at + 9 < bytes.length) {
        if (bytes[at] !== 0xff) return null;
        const marker = bytes[at + 1];
        if (marker === 0xff) { at += 1; continue; }
        // the "start of frame" blocks carry the size (C4, C8 and CC are other things)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
        }
        at += 2 + bytes.readUInt16BE(at + 2);
      }
    }
  } catch {
    /* cut-off file: no size */
  }
  return null;
}

function readPost(doc) {
  const id = typeof doc?.name === 'string' ? doc.name.split('/').pop() : '';
  const f = doc?.fields || {};
  const title = String(f.title?.stringValue || '').trim();
  if (!POST_ID.test(id || '') || !title) return null;
  return {
    id,
    title,
    body: String(f.body?.stringValue || ''),
    imageUrl: String(f.imageUrl?.stringValue || ''),
    videoUrl: String(f.videoUrl?.stringValue || ''),
    authorName: String(f.authorName?.stringValue || ''),
    createdAt: f.createdAt?.timestampValue || '',
    updatedAt: f.updatedAt?.timestampValue || f.createdAt?.timestampValue || '',
  };
}

function pageHtml(post, pageUrl, appUrl, image) {
  const title = esc(post.title);
  const text = esc(excerpt(post.body) || 'An announcement from Creative Minds Network.');
  const time = /^\d{4}-\d\d-\d\dT/.test(post.createdAt) ? `\n<meta property="article:published_time" content="${esc(post.createdAt)}" />` : '';
  const size = (image.type ? `\n<meta property="og:image:type" content="${esc(image.type)}" />` : '')
    + (image.width > 0 && image.height > 0 ? `\n<meta property="og:image:width" content="${image.width}" />\n<meta property="og:image:height" content="${image.height}" />` : '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} | Creative Minds Network</title>
<meta name="description" content="${text}" />
<link rel="canonical" href="${esc(pageUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Creative Minds Network" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${text}" />
<meta property="og:url" content="${esc(pageUrl)}" />
<meta property="og:image" content="${esc(image.url)}" />${size}
<meta property="og:image:alt" content="${title}" />${time}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${text}" />
<meta name="twitter:image" content="${esc(image.url)}" />
<script>location.replace(${JSON.stringify(appUrl).replace(/</g, '\\u003c')});</script>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:12vh auto;padding:0 1.25rem;color:#0f172a}a{color:#0e7490}</style>
</head>
<body>
<h1>${title}</h1>
<p>${text}</p>
<p><a href="${esc(appUrl)}">Open this announcement on Creative Minds Network</a></p>
</body>
</html>
`;
}

async function fetchDocs() {
  const docs = [];
  let token = '';
  for (let page = 0; page < 4 && docs.length < MAX_POSTS; page++) {
    const url = `${LIST}?pageSize=50&orderBy=createdAt%20desc${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`the database answered ${res.status}`);
    const data = await res.json();
    docs.push(...(data.documents || []));
    token = data.nextPageToken || '';
    if (!token) break;
  }
  return docs;
}

/** On GitHub, also put the outcome on the run's summary page, where the owner can read it without opening the log. */
function note(text, level = 'notice') {
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::${level} title=Announcement preview pages::${text.replace(/\r?\n/g, ' ')}`);
}

let docs;
try {
  docs = FROM ? JSON.parse(readFileSync(resolve(FROM), 'utf8')).documents || [] : await fetchDocs();
} catch (e) {
  console.log(`share pages: skipped — ${e.message || e}. Shared links use the site address until the next deploy.`);
  note(`Not written: ${e.message || e}. Shared posts show the site's general card until the next deploy.`, 'warning');
  process.exit(0);
}
if (!existsSync(OUT)) {
  console.log(`share pages: skipped — no build in ${OUT}.`);
  process.exit(0);
}

// The pages live in their own folder, post/. (Not news/: that folder holds
// the site's headlines feed.) Last deploy's pages are cleared first, so a
// deleted post loses its page — but only a folder this script wrote is ever
// removed: anything else found in post/ stops the run.
const root = join(OUT, 'post');
if (existsSync(root)) {
  const foreign = readdirSync(root, { withFileTypes: true }).filter((e) => !e.isDirectory() || !existsSync(join(root, e.name, 'share.json')));
  if (foreign.length) {
    console.log(`share pages: skipped — ${root} holds files this script did not write (${foreign[0].name}).`);
    note(`Not written: the build's post/ folder holds a file this step did not write (${foreign[0].name}).`, 'warning');
    process.exit(0);
  }
  rmSync(root, { recursive: true, force: true });
}
let written = 0;
let withPicture = 0;
for (const doc of docs.slice(0, MAX_POSTS)) {
  const post = readPost(doc);
  if (!post) continue;
  const dir = join(root, post.id);
  mkdirSync(dir, { recursive: true });
  const pageUrl = `${SITE}post/${post.id}/`;
  const appUrl = `${SITE}?post=${encodeURIComponent(post.id)}#announcements`;
  // the picture Facebook shows: the post's own, else the video's still, else the site's card
  let image = { url: `${SITE}images/og-card.jpg`, type: 'image/jpeg', width: 1200, height: 630 };
  const picture = decodePicture(post.imageUrl);
  if (picture) {
    writeFileSync(join(dir, `cover.${picture.ext}`), picture.bytes);
    image = { url: `${pageUrl}cover.${picture.ext}`, type: `image/${picture.ext === 'jpg' ? 'jpeg' : picture.ext}`, ...(pictureSize(picture.bytes) || {}) };
    withPicture++;
  } else if (youtubePoster(post.videoUrl)) {
    image = { url: youtubePoster(post.videoUrl), type: 'image/jpeg', width: 480, height: 360 };
  }
  writeFileSync(join(dir, 'index.html'), pageHtml(post, pageUrl, appUrl, image));
  writeFileSync(join(dir, 'share.json'), `${JSON.stringify({ id: post.id, title: post.title, updatedAt: post.updatedAt })}\n`);
  written++;
}
console.log(`share pages: wrote ${written} page${written === 1 ? '' : 's'} under ${root}`);
note(`Wrote ${written} preview page${written === 1 ? '' : 's'} (${withPicture} with the post's own picture) for ${SITE}post/<id>/`);
