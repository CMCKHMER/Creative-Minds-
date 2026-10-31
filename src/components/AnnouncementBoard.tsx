import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  CalendarDays, ImagePlus, Loader2, LockKeyhole, Megaphone, Pencil, Pin, PinOff,
  Plus, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';
import { FIREBASE_PROJECT_ID } from '../lib/firebaseAuth';
import { isAdminUid } from '../lib/firebaseAuth';
import { useSignedInSession } from '../hooks/useSignedInSession';

/**
 * Blog-style announcement board — replaces the old teacher_chat stream.
 *
 * WHO CAN READ: everyone. Announcements are public site news, like a blog.
 * WHO CAN POST: approved admins only — the site owner (isAdminUid, hardcoded
 * in firebaseAuth.ADMIN_UIDS and mirrored in firestore.rules isCmcAdmin())
 * plus any extra accounts the owner approves. Approval lives in the
 * `site_config/admins` Firestore doc ({uids: string[]}); the owner manages
 * that list right here in the board, so no rules redeploy is needed when a
 * new admin is approved.
 *
 * POSTS support a title, body text, an optional image (stored client-side
 * downscaled as a data URL inside the Firestore doc — no Storage bucket or
 * CORS setup needed; Firestore's 1 MiB doc limit is the guardrail) and a
 * "pin/highlight" flag that floats the post to the top of the feed with a
 * featured look.
 *
 * Firestore rules (see firestore.rules):
 *   match /announcements/{postId}  → public read, approved-admin write
 *   match /site_config/{configId}  → public read, owner-only write
 *
 * The retired `teacher_chat` collection is left untouched in Firestore; its
 * rules now deny writes.
 */

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// ── Data model ───────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  pinned: boolean;
  authorName: string;
  authorUid: string;
  authorEmail: string;
  createdAt: number;
  updatedAt: number;
}

const TITLE_MAX = 120;
const BODY_MAX = 5000;
const PAGE_SIZE = 50;
const IMAGE_DATAURL_LIMIT = 700_000; // chars — keeps the doc well under Firestore's 1 MiB

/** Parse one Firestore REST document into an Announcement (null if malformed). */
export function parseAnnouncementDoc(doc: any): Announcement | null {
  const f = doc?.fields || {};
  const id = typeof doc?.name === 'string' ? doc.name.split('/').pop() || '' : '';
  if (!id) return null;
  const createdAt = f.createdAt?.timestampValue ? Date.parse(f.createdAt.timestampValue) : 0;
  return {
    id,
    title: f.title?.stringValue ?? '',
    body: f.body?.stringValue ?? '',
    imageUrl: f.imageUrl?.stringValue ?? '',
    pinned: f.pinned?.booleanValue ?? false,
    authorName: f.authorName?.stringValue || 'Admin',
    authorUid: f.authorUid?.stringValue ?? '',
    authorEmail: f.authorEmail?.stringValue ?? '',
    createdAt,
    updatedAt: f.updatedAt?.timestampValue ? Date.parse(f.updatedAt.timestampValue) : createdAt,
  };
}

/** Blog ordering: pinned/highlighted posts first, then newest first. */
export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
}

/** Read the approved-admin allowlist out of the site_config/admins doc. */
export function parseApprovedUids(data: any): string[] {
  const values = data?.fields?.uids?.arrayValue?.values;
  if (!Array.isArray(values)) return [];
  return values
    .map((v: any) => (typeof v?.stringValue === 'string' ? v.stringValue : ''))
    .filter((u: string) => u.length > 0);
}

export function timeAgo(epochMs: number): string {
  if (!epochMs) return '';
  const sec = Math.round((Date.now() - epochMs) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(epochMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dateLabel(epochMs: number): string {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** Blob-less full-replace write body for create/update of a post. */
function announcementFields(input: {
  title: string; body: string; imageUrl: string; pinned: boolean;
  authorName: string; authorUid: string; authorEmail: string;
  createdAtIso: string; updatedAtIso: string;
}) {
  return {
    fields: {
      title: { stringValue: input.title },
      body: { stringValue: input.body },
      imageUrl: { stringValue: input.imageUrl },
      pinned: { booleanValue: input.pinned },
      authorName: { stringValue: input.authorName },
      authorUid: { stringValue: input.authorUid },
      authorEmail: { stringValue: input.authorEmail },
      createdAt: { timestampValue: input.createdAtIso },
      updatedAt: { timestampValue: input.updatedAtIso },
    },
  };
}

async function requireOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const err = await res.json().catch(() => ({}));
  throw new Error(err?.error?.message || `${fallback} (HTTP ${res.status})`);
}

// ── API calls ────────────────────────────────────────────────────────

async function fetchAnnouncements(): Promise<Announcement[]> {
  const url = `${FIRESTORE_BASE}/announcements?pageSize=${PAGE_SIZE}&orderBy=createdAt%20desc`;
  const res = await fetch(url);
  await requireOk(res, 'Could not load announcements');
  const data = await res.json().catch(() => ({}));
  const docs: Announcement[] = (data.documents || [])
    .map(parseAnnouncementDoc)
    .filter((a: Announcement | null): a is Announcement => a !== null);
  return sortAnnouncements(docs);
}

async function createAnnouncement(
  idToken: string,
  input: { title: string; body: string; imageUrl: string; pinned: boolean;
           authorName: string; authorUid: string; authorEmail: string },
): Promise<void> {
  const now = new Date().toISOString();
  const res = await fetch(`${FIRESTORE_BASE}/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(announcementFields({ ...input, createdAtIso: now, updatedAtIso: now })),
  });
  await requireOk(res, 'Could not publish the announcement');
}

/** Full-replace PATCH (no update mask) — the caller sends every field. */
async function updateAnnouncement(
  idToken: string,
  post: Announcement,
  edits: { title: string; body: string; imageUrl: string; pinned: boolean },
): Promise<void> {
  const res = await fetch(`${FIRESTORE_BASE}/announcements/${post.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(announcementFields({
      ...edits,
      authorName: post.authorName,
      authorUid: post.authorUid,
      authorEmail: post.authorEmail,
      createdAtIso: new Date(post.createdAt || Date.now()).toISOString(),
      updatedAtIso: new Date().toISOString(),
    })),
  });
  await requireOk(res, 'Could not update the announcement');
}

async function deleteAnnouncement(idToken: string, id: string): Promise<void> {
  const res = await fetch(`${FIRESTORE_BASE}/announcements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  await requireOk(res, 'Could not delete the announcement');
}

/** Approved admins = owner UID (hardcoded) + site_config/admins.uids. */
async function fetchApprovedUids(): Promise<string[]> {
  const res = await fetch(`${FIRESTORE_BASE}/site_config/admins`);
  if (res.status === 404) return []; // no doc yet → owner-only (rules agree)
  await requireOk(res, 'Could not load the admin list');
  const data = await res.json().catch(() => ({}));
  return parseApprovedUids(data);
}

/** Merge-write the allowlist doc (upsert via update mask on uids). */
async function writeApprovedUids(idToken: string, uids: string[]): Promise<void> {
  const mask = 'updateMask.fieldPaths=uids';
  const res = await fetch(`${FIRESTORE_BASE}/site_config/admins?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      fields: { uids: { arrayValue: { values: uids.map((u) => ({ stringValue: u })) } } },
    }),
  });
  await requireOk(res, 'Could not save the admin list');
}

// ── Image helper ─────────────────────────────────────────────────────

/**
 * Read an image file and downscale it to a JPEG data URL that fits
 * comfortably inside a Firestore document (1 MiB hard limit per doc).
 * No Firebase Storage needed — zero console setup, works from GitHub Pages.
 */
export async function fileToPostImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, WebP…).');
  if (file.size > 12 * 1024 * 1024) throw new Error('That image is too large — please pick one under 12 MB.');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode that image.'));
    image.src = dataUrl;
  });

  const attempts: Array<{ maxEdge: number; quality: number }> = [
    { maxEdge: 1280, quality: 0.72 },
    { maxEdge: 960, quality: 0.6 },
    { maxEdge: 720, quality: 0.5 },
  ];
  for (const { maxEdge, quality } of attempts) {
    const scale = Math.min(1, maxEdge / Math.max(img.width || maxEdge, img.height || maxEdge));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.width || maxEdge) * scale));
    canvas.height = Math.max(1, Math.round((img.height || maxEdge) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', quality);
    if (out.length <= IMAGE_DATAURL_LIMIT) return out;
  }
  throw new Error('That image is too large to attach — try a smaller one.');
}

// ── UI ───────────────────────────────────────────────────────────────

interface DraftState {
  title: string;
  body: string;
  imageUrl: string;
  pinned: boolean;
}

const EMPTY_DRAFT: DraftState = { title: '', body: '', imageUrl: '', pinned: false };

export function AnnouncementBoard() {
  const session = useSignedInSession();
  const localId = session?.localId || null;
  const isOwner = !!localId && isAdminUid(localId);
  const idToken = session?.idToken || '';

  const [posts, setPosts] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedUids, setApprovedUids] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [adminListBusy, setAdminListBusy] = useState(false);
  const [adminListError, setAdminListError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canPost = !!localId && (isOwner || approvedUids.includes(localId));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAnnouncements();
      setPosts(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAdmins = useCallback(async () => {
    try {
      setApprovedUids(await fetchApprovedUids());
    } catch { /* non-fatal — falls back to owner-only posting */ }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (localId) void refreshAdmins();
  }, [localId, refreshAdmins]);

  const openComposer = (post?: Announcement) => {
    setFormError(null);
    if (post) {
      setEditingId(post.id);
      setDraft({ title: post.title, body: post.body, imageUrl: post.imageUrl, pinned: post.pinned });
    } else {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    }
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
  };

  const handleImagePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setImageBusy(true);
    setFormError(null);
    try {
      const dataUrl = await fileToPostImage(file);
      setDraft((d) => ({ ...d, imageUrl: dataUrl }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not attach that image.');
    } finally {
      setImageBusy(false);
    }
  };

  const handleSubmit = async () => {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body || !session || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        const post = posts.find((p) => p.id === editingId);
        if (!post) throw new Error('That announcement no longer exists — refresh and try again.');
        await updateAnnouncement(idToken, post, { ...draft, title, body });
      } else {
        await createAnnouncement(idToken, {
          title, body, imageUrl: draft.imageUrl, pinned: draft.pinned,
          authorName: session.displayName || session.email,
          authorUid: session.localId,
          authorEmail: session.email,
        });
      }
      closeComposer();
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save the announcement.');
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (post: Announcement) => {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateAnnouncement(idToken, post, {
        title: post.title, body: post.body, imageUrl: post.imageUrl, pinned: !post.pinned,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the announcement.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (post: Announcement) => {
    if (!session || busy) return;
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAnnouncement(idToken, post.id);
      if (editingId === post.id) closeComposer();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the announcement.');
    } finally {
      setBusy(false);
    }
  };

  // ── Owner-only: approve additional admins ──
  const approveAdmin = async () => {
    const uid = newAdminUid.trim();
    if (!uid || adminListBusy) return;
    setAdminListBusy(true);
    setAdminListError(null);
    try {
      const next = approvedUids.includes(uid) ? approvedUids : [...approvedUids, uid];
      await writeApprovedUids(idToken, next);
      setApprovedUids(next);
      setNewAdminUid('');
    } catch (e) {
      setAdminListError(e instanceof Error ? e.message : 'Could not save the admin list.');
    } finally {
      setAdminListBusy(false);
    }
  };

  const revokeAdmin = async (uid: string) => {
    if (adminListBusy) return;
    if (!window.confirm('Remove this admin\'s posting access?')) return;
    setAdminListBusy(true);
    setAdminListError(null);
    try {
      const next = approvedUids.filter((u) => u !== uid);
      await writeApprovedUids(idToken, next);
      setApprovedUids(next);
    } catch (e) {
      setAdminListError(e instanceof Error ? e.message : 'Could not save the admin list.');
    } finally {
      setAdminListBusy(false);
    }
  };

  const feed = useMemo(() => posts, [posts]);
  const featured = feed.filter((p) => p.pinned);
  const regular = feed.filter((p) => !p.pinned);

  const renderPost = (post: Announcement, featuredCard: boolean) => {
    const edited = post.updatedAt - post.createdAt > 60_000;
    return (
      <article
        key={post.id}
        className={`overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl transition ${
          featuredCard
            ? 'border-amber-200/30 bg-amber-100/[0.04] shadow-amber-900/10'
            : 'border-white/10 bg-slate-950/60'
        }`}
      >
        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt={post.title}
            loading="lazy"
            className="max-h-96 w-full border-b border-white/10 object-cover"
          />
        )}
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {featuredCard && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-200">
                <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-slate-500">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              <time dateTime={new Date(post.createdAt).toISOString()} title={timeAgo(post.updatedAt)}>
                {dateLabel(post.createdAt)}
              </time>
            </span>
            {edited && <span className="text-slate-600">(edited)</span>}
            <span className="ml-auto flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-300/10 text-[9px] font-bold text-cyan-200">
                {post.authorName.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-slate-300">{post.authorName}</span>
              <span className="rounded-full bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">
                Admin
              </span>
            </span>
          </div>

          <h3 className={`mt-3 font-bold leading-snug text-white ${featuredCard ? 'text-xl sm:text-2xl' : 'text-lg'}`}>
            {post.title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{post.body}</p>

          {canPost && (
            <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => openComposer(post)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
              </button>
              <button
                type="button"
                onClick={() => togglePin(post)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-amber-300/40 hover:text-amber-200"
              >
                {post.pinned
                  ? <><PinOff className="h-3 w-3" aria-hidden="true" /> Unpin</>
                  : <><Pin className="h-3 w-3" aria-hidden="true" /> Pin to top</>}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(post)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-300/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300/80 transition hover:border-rose-300/40 hover:text-rose-200"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
              </button>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <section id="announcements" aria-labelledby="announcements-title" className="cmc-section relative scroll-mt-24 border-y border-white/10 bg-[#081522] py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-13rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-cyan-500/[0.08] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-indigo-500/[0.10] blur-[135px]" />

      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <div className="mb-8">
          <span className="cmc-eyebrow">
            <Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> CMC Bulletin
          </span>
          <h2 id="announcements-title" className="cmc-h2 mt-4">
            News &<br />
            <span className="cmc-gradient-text">announcements.</span>
          </h2>
          <p className="cmc-lead mt-4">
            Official updates from the Creative Minds team — new features, test schedules, events and
            resources. Pinned posts stay highlighted at the top.
          </p>
        </div>

        {/* Composer + admin tools (approved admins only) */}
        {canPost && (
          <div className="mb-8 space-y-3">
            {!composerOpen && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openComposer()}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> New announcement
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setAdminPanelOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
                  >
                    <Users className="h-4 w-4" aria-hidden="true" /> Approve admins
                  </button>
                )}
              </div>
            )}

            {isOwner && adminPanelOpen && !composerOpen && (
              <div className="rounded-2xl border border-cyan-200/15 bg-cyan-100/[0.03] p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" aria-hidden="true" /> Approved admins
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Paste the Firebase UID of a signed-in account to let it publish announcements. The
                  site owner always has access. You (owner) are <code className="rounded bg-white/5 px-1">{localId}</code>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={newAdminUid}
                    onChange={(e) => setNewAdminUid(e.target.value)}
                    placeholder="Firebase UID to approve…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60"
                  />
                  <button
                    type="button"
                    onClick={() => void approveAdmin()}
                    disabled={!newAdminUid.trim() || adminListBusy}
                    className="rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-3.5 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
                  >
                    {adminListBusy ? 'Saving…' : 'Approve'}
                  </button>
                </div>
                {adminListError && <p className="mt-2 text-[11px] text-rose-300">{adminListError}</p>}
                <ul className="mt-3 space-y-1.5">
                  <li className="flex items-center gap-2 text-[11px] text-slate-300">
                    <code className="rounded bg-white/5 px-1.5 py-0.5">{localId}</code>
                    <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">Owner</span>
                  </li>
                  {approvedUids.filter((u) => u !== localId).map((uid) => (
                    <li key={uid} className="flex items-center gap-2 text-[11px] text-slate-300">
                      <code className="rounded bg-white/5 px-1.5 py-0.5">{uid}</code>
                      <span className="rounded-full bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-200">Approved</span>
                      <button
                        type="button"
                        onClick={() => void revokeAdmin(uid)}
                        className="ml-auto inline-flex items-center gap-1 text-rose-300/70 hover:text-rose-200"
                      >
                        <X className="h-3 w-3" aria-hidden="true" /> Revoke
                      </button>
                    </li>
                  ))}
                  {approvedUids.filter((u) => u !== localId).length === 0 && (
                    <li className="text-[11px] text-slate-500">No extra admins approved yet.</li>
                  )}
                </ul>
              </div>
            )}

            {composerOpen && (
              <div className="rounded-2xl border border-cyan-200/20 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">
                    {editingId ? 'Edit announcement' : 'New announcement'}
                  </p>
                  <button type="button" onClick={closeComposer} aria-label="Close composer" className="text-slate-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    maxLength={TITLE_MAX}
                    placeholder="Announcement title…"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
                  />
                  <textarea
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    maxLength={BODY_MAX}
                    rows={6}
                    placeholder="Write the announcement… (line breaks are kept)"
                    className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
                  />
                  {draft.imageUrl ? (
                    <div className="relative overflow-hidden rounded-xl border border-white/10">
                      <img src={draft.imageUrl} alt="Attachment preview" className="max-h-56 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, imageUrl: '' }))}
                        aria-label="Remove image"
                        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-950/80 text-slate-300 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePicked} className="hidden" />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imageBusy}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-white disabled:opacity-50"
                      >
                        {imageBusy
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
                        {imageBusy ? 'Optimizing image…' : 'Attach an image'}
                      </button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={draft.pinned}
                      onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
                      className="accent-amber-300"
                    />
                    <Pin className="h-3 w-3 text-amber-300" aria-hidden="true" />
                    Highlight this post (pin to the top of the board)
                  </label>
                  {formError && (
                    <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/5 px-3 py-2 text-[11px] text-rose-200">
                      {formError}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-slate-600">
                      {draft.title.length}/{TITLE_MAX} · {draft.body.length}/{BODY_MAX}
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={closeComposer} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={!draft.title.trim() || !draft.body.trim() || busy || imageBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Megaphone className="h-3 w-3" aria-hidden="true" />}
                        {busy ? 'Publishing…' : editingId ? 'Save changes' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Owner tools shortcut when not an approved poster (impossible today, future-proof) */}
        {!canPost && isOwner && (
          <p className="mb-8 rounded-xl border border-amber-200/20 bg-amber-100/[0.04] px-4 py-3 text-xs text-amber-100/80">
            Your account is the site owner but posting failed to unlock — make sure you are signed in
            with a verified email, then reload the page.
          </p>
        )}

        {/* Feed */}
        {loading && feed.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading announcements…
          </div>
        )}
        {error && feed.length === 0 && !loading && (
          <div className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-center text-xs text-rose-100">
            {error}
            <p className="mt-1 text-[10px] text-slate-500">
              Make sure the Firestore rule for <code className="rounded bg-white/5 px-1 py-0.5">announcements</code> allows public read.
            </p>
          </div>
        )}
        {feed.length === 0 && !error && !loading && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-10 text-center">
            <Megaphone className="mx-auto h-6 w-6 text-slate-600" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-500">No announcements yet — check back soon!</p>
          </div>
        )}
        {feed.length > 0 && (
          <div className="space-y-5">
            {featured.map((p) => renderPost(p, true))}
            {regular.map((p) => renderPost(p, false))}
          </div>
        )}

        {/* Readers who can't post get a quiet note, not a lock wall */}
        {session && !canPost && (
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
            <LockKeyhole className="h-3 w-3" aria-hidden="true" />
            Only approved admins can publish announcements — everyone is welcome to read.
          </p>
        )}
        {!session && (
          <p className="mt-8 text-center text-[11px] text-slate-500">
            Signed in as a member? Approved admins can publish here from any device.
          </p>
        )}
      </div>
    </section>
  );
}
