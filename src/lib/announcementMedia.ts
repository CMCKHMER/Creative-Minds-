// Links, video and sharing for the announcement board.
//
// Owner request (Nov 2026): "allow sharing to facebook and other popular
// sites. allow links and video to be uploaded and shared."
//
// Everything here is pure (no DOM, no network), so it is unit-tested:
//   - which web addresses a post may carry (http and https only),
//   - how a pasted video address becomes a player (YouTube, Facebook, TikTok,
//     Vimeo, Google Drive, or a video file),
//   - how addresses typed in the text become links,
//   - the address of one post, and the share links for each site.

/** Longest address a post stores (the database rules check the same number). */
export const URL_MAX = 2000;
export const LINK_LABEL_MAX = 80;

/**
 * A web address a post may carry, tidied — or '' when it is not one.
 * Only http and https are accepted: a `javascript:` or `data:` address would
 * run or load whatever the writer chose in the reader's browser.
 * "www.example.com" is completed to https.
 */
export function safeHttpUrl(raw: string | null | undefined): string {
  let text = String(raw ?? '').trim();
  if (!text || text.length > URL_MAX || /\s/.test(text)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#:]|$)/i.test(text)) return '';
    text = `https://${text}`;
  }
  let url: URL;
  try { url = new URL(text); } catch { return ''; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  if (!url.hostname.includes('.') || url.username || url.password) return '';
  return url.href.length <= URL_MAX ? url.href : '';
}

/** "www.youtube.com" → "youtube.com", for showing where a link goes. */
export function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./i, ''); } catch { return ''; }
}

// ── video ───────────────────────────────────────────────────────────────

export type VideoProvider = 'youtube' | 'vimeo' | 'facebook' | 'tiktok' | 'drive' | 'file';

export interface VideoEmbed {
  provider: VideoProvider;
  /** Name shown to readers: "YouTube", "Facebook", "Video". */
  label: string;
  /** `frame` plays in the site's player page inside a frame; `file` is a video file the browser plays itself. */
  mode: 'frame' | 'file';
  /** The frame address, or the file address. */
  src: string;
  /** Tall (phone-shaped) videos get a tall box. */
  portrait: boolean;
  /** A still picture for previews, when the site offers one without asking. */
  poster: string;
}

const ID = /^[A-Za-z0-9_-]{6,64}$/;
const VIDEO_FILE = /\.(mp4|m4v|webm|mov|ogv|ogg)$/i;
const host = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, '');

/** Storage bucket the site uploads announcement videos to (src/lib/firebase.ts). */
export const VIDEO_BUCKET_PATH = '/o/announcements%2F';

/**
 * Turn a video address into something the board can play — null when it is
 * not a video the board knows how to show (it can still be attached as a link).
 */
export function parseVideo(raw: string | null | undefined): VideoEmbed | null {
  const href = safeHttpUrl(raw);
  if (!href) return null;
  const url = new URL(href);
  const h = host(url);
  const parts = url.pathname.split('/').filter(Boolean);

  if (h === 'youtu.be' || h === 'youtube.com' || h === 'music.youtube.com' || h === 'youtube-nocookie.com') {
    let id = '';
    let portrait = false;
    if (h === 'youtu.be') id = parts[0] ?? '';
    else if (parts[0] === 'watch') id = url.searchParams.get('v') ?? '';
    else if (parts[0] === 'shorts') { id = parts[1] ?? ''; portrait = true; }
    else if (parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'v') id = parts[1] ?? '';
    if (!ID.test(id)) return null;
    return {
      provider: 'youtube', label: 'YouTube', mode: 'frame', portrait,
      // the "nocookie" player sets no tracking cookie until the reader presses play
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const id = [...parts].reverse().find((p) => /^\d{5,}$/.test(p));
    if (!id) return null;
    return { provider: 'vimeo', label: 'Vimeo', mode: 'frame', portrait: false, src: `https://player.vimeo.com/video/${id}`, poster: '' };
  }

  if (h === 'facebook.com' || h === 'fb.watch' || h === 'fb.com') {
    const isVideo = h === 'fb.watch'
      || parts.includes('videos') || parts[0] === 'watch' || parts[0] === 'reel' || parts[0] === 'reels'
      || (parts[0] === 'share' && (parts[1] === 'v' || parts[1] === 'r'))
      || url.pathname === '/video.php';
    if (!isVideo) return null;
    const portrait = parts[0] === 'reel' || parts[0] === 'reels' || (parts[0] === 'share' && parts[1] === 'r');
    return {
      provider: 'facebook', label: 'Facebook', mode: 'frame', portrait,
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false`,
      poster: '',
    };
  }

  if (h === 'tiktok.com') {
    const at = parts.indexOf('video');
    const id = at >= 0 ? parts[at + 1] ?? '' : '';
    // a short "vm.tiktok.com" address does not carry the video number
    if (!/^\d{8,32}$/.test(id)) return null;
    return { provider: 'tiktok', label: 'TikTok', mode: 'frame', portrait: true, src: `https://www.tiktok.com/embed/v2/${id}`, poster: '' };
  }

  if (h === 'drive.google.com') {
    const at = parts.indexOf('d');
    const id = parts[0] === 'file' && at >= 0 ? parts[at + 1] ?? '' : url.searchParams.get('id') ?? '';
    if (!ID.test(id)) return null;
    return { provider: 'drive', label: 'Google Drive', mode: 'frame', portrait: false, src: `https://drive.google.com/file/d/${id}/preview`, poster: '' };
  }

  // a video file: by its ending, or one the board uploaded itself
  const uploaded = h === 'firebasestorage.googleapis.com' && url.pathname.includes(VIDEO_BUCKET_PATH);
  if (uploaded || VIDEO_FILE.test(url.pathname)) {
    return { provider: 'file', label: 'Video', mode: 'file', portrait: false, src: href, poster: '' };
  }
  return null;
}

// ── addresses typed in the text ─────────────────────────────────────────

export type TextPart = { text: string; url?: string };

const IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/** Split a post's text so each web address in it can be shown as a link. */
export function linkify(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of String(text ?? '').matchAll(IN_TEXT)) {
    let found = m[0];
    // a full stop, comma or closing bracket after an address belongs to the sentence
    let tail = '';
    for (;;) {
      const end = found.slice(-1);
      const unbalanced = end === ')' && (found.match(/\(/g)?.length ?? 0) < (found.match(/\)/g)?.length ?? 0);
      if (/[.,;:!?]/.test(end) || unbalanced || end === ']' || end === '}') { tail = end + tail; found = found.slice(0, -1); } else break;
    }
    const url = safeHttpUrl(found);
    const at = m.index ?? 0;
    if (!url) continue;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: found, url });
    last = at + found.length;
    if (tail) { out.push({ text: tail }); last += tail.length; }
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  // neighbours without a link are one run of text
  return out.reduce<TextPart[]>((acc, part) => {
    const prev = acc[acc.length - 1];
    if (prev && !prev.url && !part.url) prev.text += part.text;
    else acc.push({ ...part });
    return acc;
  }, []);
}

// ── the address of one post ─────────────────────────────────────────────

const POST_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The post a visitor asked for in the address (`?post=…`), or ''. */
export function postIdFromSearch(search: string): string {
  const id = new URLSearchParams(search || '').get('post') ?? '';
  return POST_ID.test(id) ? id : '';
}

/** The site's own address for one post: opens the board at that post. */
export function postAppUrl(siteBase: string, id: string): string {
  return `${siteBase.replace(/[#?].*$/, '').replace(/\/?$/, '/')}?post=${encodeURIComponent(id)}#announcements`;
}

/** The preview page of one post (written at deploy time by scripts/build_share_pages.mjs).
 *  Facebook and the other sites read the post's title and picture from it. */
export function postSharePageUrl(siteBase: string, id: string): string {
  return `${siteBase.replace(/[#?].*$/, '').replace(/\/?$/, '/')}post/${encodeURIComponent(id)}/`;
}

// ── share links ─────────────────────────────────────────────────────────

export interface ShareTarget {
  id: 'facebook' | 'telegram' | 'whatsapp' | 'x' | 'linkedin' | 'email';
  label: string;
  href: string;
  /** Brand colour of the round button. */
  color: string;
}

/** One share link per site. Each opens that site's own "share this" page with
 *  the post's address filled in; nothing is posted until the visitor confirms there. */
export function shareTargets(url: string, title: string): ShareTarget[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title.trim());
  const both = encodeURIComponent(`${title.trim()}\n${url}`);
  return [
    { id: 'facebook', label: 'Facebook', color: '#1877f2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'telegram', label: 'Telegram', color: '#229ed9', href: `https://t.me/share/url?url=${u}&text=${t}` },
    { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', href: `https://wa.me/?text=${both}` },
    { id: 'x', label: 'X', color: '#0f1419', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'email', label: 'Email', color: '#64748b', href: `mailto:?subject=${t}&body=${both}` },
  ];
}

/** First lines of a post, for a preview: one line, cut at a word. */
export function excerpt(body: string, max = 200): string {
  const flat = String(body ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:!?-]+$/, '')}…`;
}
