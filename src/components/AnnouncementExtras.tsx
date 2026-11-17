// The parts of an announcement added in Nov 2026: a video player, links in
// the text, an attached link, and the Share menu. The rules for each (which
// addresses are allowed, how a video address becomes a player, the share
// links) live in src/lib/announcementMedia.ts and are unit-tested there.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Mail, MessageCircle, Play, Send, Share2 } from 'lucide-react';
import {
  hostLabel, linkify, parseVideo, postAppUrl, postSharePageUrl, safeHttpUrl, shareTargets, type ShareTarget,
} from '../lib/announcementMedia';

/** The site's address without `?…` and `#…` — the folder the app is served from. */
function siteBase(): string {
  if (typeof window === 'undefined') return '/';
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;
}

/** The text of a post, with every web address in it as a link. */
export function PostBody({ text, className = '' }: { text: string; className?: string }) {
  const parts = useMemo(() => linkify(text), [text]);
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) => part.url
        ? (
          <a key={i} href={part.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-medium text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 hover:decoration-cyan-300" data-testid="post-text-link">
            {part.text}
          </a>
        )
        : <span key={i}>{part.text}</span>)}
    </p>
  );
}

/** The link attached to a post, as a row that opens it in a new tab. */
export function PostLink({ url, label }: { url: string; label: string }) {
  const href = safeHttpUrl(url);
  if (!href) return null;
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer nofollow ugc"
      className="mt-4 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-3.5 py-2.5 transition hover:border-cyan-300/50 hover:bg-cyan-300/[0.09]"
      data-testid="post-link"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-300/15 text-cyan-200"><Link2 className="h-4 w-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{label.trim() || hostLabel(href)}</span>
        <span className="block truncate text-[11px] text-slate-500">{hostLabel(href)}</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
    </a>
  );
}

/**
 * The video of a post. A video file plays in the browser's own player. A video
 * on another site (YouTube, Facebook, TikTok…) is loaded only after the reader
 * presses play: until then nothing is requested from that site.
 */
export function PostVideo({ url, title }: { url: string; title: string }) {
  const video = useMemo(() => parseVideo(url), [url]);
  // the address that was started: a different address starts unplayed again
  const [started, setStarted] = useState('');
  const playing = started === url;
  if (!video) return null;
  const box = video.portrait ? 'mx-auto aspect-[9/16] w-full max-w-[320px]' : 'aspect-video w-full';

  if (video.mode === 'file') {
    return (
      <div className="border-b border-white/10 bg-black" data-testid="post-video" data-provider="file">
        <video src={video.src} controls preload="metadata" playsInline className="max-h-[32rem] w-full" aria-label={`Video: ${title}`} />
      </div>
    );
  }
  return (
    <div className="border-b border-white/10 bg-black" data-testid="post-video" data-provider={video.provider}>
      <div className={`relative ${box}`}>
        {playing ? (
          <iframe
            src={video.src + (video.provider === 'youtube' ? '&autoplay=1' : '')}
            title={`${video.label} video: ${title}`}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button" onClick={() => setStarted(url)}
            className="group absolute inset-0 grid h-full w-full place-items-center overflow-hidden bg-slate-900"
            aria-label={`Play the ${video.label} video: ${title}`}
            data-testid="post-video-play"
          >
            {video.poster && <img src={video.poster} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />}
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/95 text-slate-950 shadow-2xl transition group-hover:scale-105" style={{ color: '#0f172a', background: 'rgba(255,255,255,0.95)' }}>
              <Play className="ml-1 h-7 w-7" fill="currentColor" aria-hidden="true" />
            </span>
            <span className="absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#ffffff', background: 'rgba(2,6,23,0.75)' }}>
              {video.label}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── share ───────────────────────────────────────────────────────────────

function Glyph({ id }: { id: ShareTarget['id'] }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  if (id === 'facebook') return <svg {...common}><path fill="currentColor" d="M13.6 21.5v-8h2.7l.4-3.2h-3.1v-2c0-.9.3-1.6 1.6-1.6h1.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.4H7.8v3.2h2.7v8z" /></svg>;
  if (id === 'telegram') return <Send style={{ width: 17, height: 17, marginLeft: -2, marginTop: 1 }} aria-hidden="true" />;
  if (id === 'whatsapp') return <MessageCircle style={{ width: 18, height: 18 }} aria-hidden="true" />;
  if (id === 'x') return <svg {...common}><path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M5 4.5l14 15M19 4.5l-14 15" /></svg>;
  if (id === 'linkedin') return <svg {...common}><path fill="currentColor" d="M4.2 9h3.3v10.5H4.2zM5.85 3.9a1.9 1.9 0 110 3.8 1.9 1.9 0 010-3.8zM9.6 9h3.1v1.5c.5-.9 1.6-1.8 3.3-1.8 3.3 0 3.9 2.2 3.9 5v5.8h-3.3v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7v5.2H9.6z" /></svg>;
  return <Mail style={{ width: 17, height: 17 }} aria-hidden="true" />;
}

/**
 * "Share" under a post: Facebook, Telegram, WhatsApp, X, LinkedIn, email, copy
 * the link, and on a phone the device's own share sheet (Messenger, TikTok,
 * anything installed).
 *
 * The address shared is the post's preview page when the last deploy wrote one
 * (so Facebook shows the post's own title and picture), otherwise the site's
 * address for the post, which always works.
 */
export function ShareMenu({ postId, title }: { postId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // the menu opens upward, or downward when the button is near the top of the screen
  const [below, setBelow] = useState(false);
  const base = siteBase();
  const [url, setUrl] = useState(() => postAppUrl(base, postId));
  const wrap = useRef<HTMLDivElement>(null);
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // is there a preview page for this post? (a small file written next to it)
  useEffect(() => {
    if (!open) return;
    let live = true;
    const page = postSharePageUrl(base, postId);
    fetch(`${page}share.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((meta) => { if (live && meta && meta.id === postId) setUrl(page); })
      .catch(() => { /* no preview page yet: the site address is used */ });
    return () => { live = false; };
  }, [open, base, postId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const targets = useMemo(() => shareTargets(url, title), [url, title]);

  const copy = async () => {
    try {
      // some browsers leave this waiting on a permission question: give it a second
      await Promise.race([
        navigator.clipboard.writeText(url),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('slow')), 1000)),
      ]);
    } catch {
      // older browsers, or a page without clipboard permission
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try { document.execCommand('copy'); } catch { /* nothing more to try */ }
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const native = async () => {
    try { await navigator.share({ title, text: title, url }); setOpen(false); } catch { /* the visitor closed the sheet */ }
  };

  return (
    <div ref={wrap} className="relative" data-testid="post-share">
      <button
        type="button" aria-expanded={open} aria-haspopup="true"
        onClick={() => {
          setBelow((wrap.current?.getBoundingClientRect().top ?? 999) < 380);
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
        data-testid="post-share-open"
      >
        <Share2 className="h-3 w-3" aria-hidden="true" /> Share
      </button>
      {open && (
        <div
          className={`absolute left-0 z-30 w-[17.5rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/10 bg-[#0b1724] p-3 shadow-2xl ${below ? 'top-full mt-2' : 'bottom-full mb-2'}`}
          data-side={below ? 'below' : 'above'}
          role="group" aria-label={`Share “${title}”`} data-testid="post-share-menu"
        >
          <p className="px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Share this announcement</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {targets.map((t) => (
              <a
                key={t.id} href={t.href} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                data-share={t.id}
              >
                {/* brand colours are set inline so the light theme keeps them */}
                <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: t.color, color: '#ffffff' }}><Glyph id={t.id} /></span>
                {t.label}
              </a>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link to this announcement" className="min-w-0 flex-1 bg-transparent px-1.5 text-[11px] text-slate-300 outline-none" data-testid="post-share-url" />
            <button type="button" onClick={() => void copy()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-cyan-300/15 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100 transition hover:bg-cyan-300/25" data-testid="post-share-copy">
              {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {canNative && (
            <button type="button" onClick={() => void native()} className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white" data-testid="post-share-native">
              <Share2 className="h-3 w-3" aria-hidden="true" /> More apps…
            </button>
          )}
          <span role="status" className="sr-only">{copied ? 'Link copied' : ''}</span>
        </div>
      )}
    </div>
  );
}
