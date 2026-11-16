// "Profile picture" — the panel a signed-in user opens from the account menu
// to upload a photo or pick a built-in avatar. See src/lib/avatar.ts for what
// is stored and who can see it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, Loader2, LockKeyhole, Trash2, X } from 'lucide-react';
import { AvatarBadge } from './AvatarBadge';
import {
  AVATAR_PRESETS, AvatarError, fileProblem, loadPicture, removeAvatar, renderAvatar, saveAvatar, type Avatar,
} from '../lib/avatar';

interface Picture { source: CanvasImageSource; width: number; height: number; release: () => void }

export function ProfilePhotoModal({ uid, name, current, toneClass, onClose }: {
  uid: string;
  /** Shown under the preview; its first letter is the fallback picture. */
  name: string;
  current: Avatar | null;
  toneClass?: string;
  onClose: () => void;
}) {
  // what Save would store: a preset, the stored picture, or (with `picture`) a new photo
  const [draft, setDraft] = useState<Avatar | null>(current);
  const [picture, setPicture] = useState<Picture | null>(null);
  const [crop, setCrop] = useState({ zoom: 1, dx: 0, dy: 0 });
  const [busy, setBusy] = useState<'save' | 'remove' | 'open' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  useEffect(() => () => { picture?.release(); }, [picture]);

  // the new photo as it will be stored, redrawn while the user adjusts it
  const photo = useMemo(() => {
    if (!picture) return null;
    try { return renderAvatar(picture, crop); } catch { return null; }
  }, [picture, crop]);
  const shown: Avatar | null = picture ? (photo ? { kind: 'photo', photo } : null) : draft;
  const changed = picture ? Boolean(photo) : JSON.stringify(draft) !== JSON.stringify(current);
  const canSlide = picture ? picture.width !== picture.height || crop.zoom > 1 : false;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) { setError(problem); return; }
    setBusy('open'); setError(null);
    try {
      const next = await loadPicture(file);
      setPicture(next);
      setCrop({ zoom: 1, dx: 0, dy: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This picture could not be opened. Try another one.');
    }
    setBusy(null);
  };

  const choosePreset = (id: string) => {
    setPicture(null);
    setDraft({ kind: 'preset', preset: id });
    setError(null);
  };

  const save = async () => {
    const next = shown;
    if (!next || busy) return;
    setBusy('save'); setError(null);
    try { await saveAvatar(uid, next); onClose(); }
    catch (e) { setError(e instanceof AvatarError ? e.message : 'The picture could not be saved just now. Try again.'); setBusy(null); }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove'); setError(null);
    try { await removeAvatar(uid); onClose(); }
    catch (e) { setError(e instanceof AvatarError ? e.message : 'The picture could not be removed just now. Try again.'); setBusy(null); }
  };

  // drag the preview to slide the photo inside the circle
  const onPointerDown = (e: React.PointerEvent) => {
    if (!canSlide) return;
    drag.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const stepX = (e.clientX - drag.current.x) / 60;
    const stepY = (e.clientY - drag.current.y) / 60;
    drag.current = { x: e.clientX, y: e.clientY };
    const clamp = (v: number) => Math.min(1, Math.max(-1, v));
    setCrop((c) => ({ ...c, dx: clamp(c.dx - stepX), dy: clamp(c.dy - stepY) }));
  };
  const onPointerUp = () => { drag.current = null; };

  const btnGhost = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40';

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-labelledby="profile-photo-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      data-testid="profile-photo-modal"
    >
      <div className="w-full max-w-md rounded-2xl border border-cyan-300/20 bg-[#0b1724] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">Your account</p>
            <h3 id="profile-photo-title" className="mt-1 text-base font-bold text-white">Profile picture</h3>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div
            className={`relative shrink-0 rounded-full ${canSlide ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            data-testid="profile-photo-preview"
          >
            <AvatarBadge avatar={shown} initial={name} size={104} toneClass={toneClass} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{name || 'Your name'}</p>
            <input
              ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1}
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }}
              data-testid="profile-photo-file"
            />
            <button type="button" className={`${btnGhost} mt-2`} disabled={!!busy} onClick={() => fileRef.current?.click()} data-testid="profile-photo-upload">
              {busy === 'open' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Camera className="h-3.5 w-3.5" aria-hidden="true" />}
              {picture ? 'Choose another photo' : 'Upload a photo'}
            </button>
            {picture && (
              <label className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Zoom
                <input
                  type="range" min={1} max={3} step={0.05} value={crop.zoom}
                  onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))}
                  className="h-1 w-full accent-cyan-300" aria-label="Zoom the photo"
                />
              </label>
            )}
            {picture && canSlide && <p className="mt-1 text-[10px] text-slate-500">Drag the picture to move it.</p>}
          </div>
        </div>

        <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Or pick an avatar</p>
        <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Built-in avatars" data-testid="profile-photo-presets">
          {AVATAR_PRESETS.map((p) => {
            const on = !picture && draft?.kind === 'preset' && draft.preset === p.id;
            return (
              <button
                key={p.id} type="button" role="radio" aria-checked={on} aria-label={p.label} title={p.label}
                disabled={!!busy} onClick={() => choosePreset(p.id)}
                className={`relative grid place-items-center rounded-full p-0.5 transition hover:-translate-y-0.5 ${on ? 'ring-2 ring-cyan-300' : 'ring-1 ring-transparent'}`}
                data-preset={p.id}
              >
                <AvatarBadge avatar={{ kind: 'preset', preset: p.id }} initial="" size={38} />
                {on && <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-cyan-300 text-slate-950"><Check className="h-3 w-3" aria-hidden="true" /></span>}
              </button>
            );
          })}
        </div>

        <p className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/70" aria-hidden="true" />
          <span>Only you see your picture when you are signed in. A photo is made small before it is saved; the original never leaves this device.</span>
        </p>

        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100" data-testid="profile-photo-error">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button" disabled={!!busy || !changed || !shown} onClick={() => void save()}
            className="cmc-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="profile-photo-save"
          >
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            Save picture
          </button>
          {current && (
            <button type="button" className={btnGhost} disabled={!!busy} onClick={() => void remove()} data-testid="profile-photo-remove">
              {busy === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
