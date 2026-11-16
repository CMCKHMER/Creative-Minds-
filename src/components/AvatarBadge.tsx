import {
  Bird, BookOpen, Bot, Cat, Dog, Fish, Flower2, Music, Palette, Panda, Rabbit, Rocket, Squirrel, Star, Trophy, Turtle,
  type LucideIcon,
} from 'lucide-react';
import { presetById, type Avatar } from '../lib/avatar';

// The drawing for each built-in avatar id (src/lib/avatar.ts → AVATAR_PRESETS).
export const AVATAR_ICONS: Record<string, LucideIcon> = {
  cat: Cat, dog: Dog, rabbit: Rabbit, bird: Bird, fish: Fish, turtle: Turtle, squirrel: Squirrel, panda: Panda,
  rocket: Rocket, star: Star, book: BookOpen, palette: Palette, music: Music, robot: Bot, flower: Flower2, trophy: Trophy,
};

/**
 * The round profile picture: the uploaded photo, a built-in avatar, or — when
 * the account has neither — its initial on the tone the caller passes.
 * `size` is the diameter in pixels.
 */
export function AvatarBadge({ avatar, initial, size, toneClass = 'bg-cyan-400/20 text-cyan-200', className = '' }: {
  avatar: Avatar | null;
  initial: string;
  size: number;
  toneClass?: string;
  className?: string;
}) {
  const box = { width: size, height: size };
  const preset = avatar?.kind === 'preset' ? presetById(avatar.preset) : null;
  const Icon = preset ? AVATAR_ICONS[preset.id] : null;

  if (avatar?.kind === 'photo') {
    return (
      <img
        src={avatar.photo}
        alt=""
        width={size}
        height={size}
        style={box}
        className={`shrink-0 rounded-full object-cover ring-1 ring-white/25 ${className}`}
        data-avatar="photo"
        draggable={false}
      />
    );
  }
  if (preset && Icon) {
    const glyph = Math.round(size * 0.58);
    return (
      <span
        aria-hidden="true"
        // colours are set inline so the light theme does not repaint the disc
        style={{ ...box, background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`, color: '#ffffff' }}
        className={`grid shrink-0 place-items-center rounded-full ring-1 ring-white/25 ${className}`}
        data-avatar={`preset:${preset.id}`}
      >
        <Icon style={{ width: glyph, height: glyph, color: '#ffffff' }} strokeWidth={size >= 64 ? 1.6 : 2} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.4)) }}
      className={`grid shrink-0 place-items-center rounded-full font-bold ${toneClass} ${className}`}
      data-avatar="initial"
    >
      {(initial || 'U').slice(0, 1).toUpperCase()}
    </span>
  );
}
