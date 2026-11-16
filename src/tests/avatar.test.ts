// Profile picture (Nov 2026).
//
// Owner request: "give signed in users an option panel that allows them to
// upload a photo or avatar." A photo is shrunk in the browser and kept in one
// small private document per account; these tests pin what may be stored,
// the crop arithmetic, and that the database rules keep a picture private
// and small.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_MAX_CHARS, AVATAR_PRESETS, AVATAR_SIZE, cropSquare, fileProblem, isAvatarDataUrl, parseAvatar, presetById,
} from '../lib/avatar';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

describe('built-in avatars', () => {
  it('offers a set to choose from, each with its own id', () => {
    expect(AVATAR_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(AVATAR_PRESETS.map((p) => p.id)).size).toBe(AVATAR_PRESETS.length);
    for (const p of AVATAR_PRESETS) {
      // the rules accept exactly this shape of id
      expect(p.id, p.id).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(p.label.length, p.id).toBeGreaterThan(0);
      expect(p.from, p.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.to, p.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has a drawing for every one (not an emoji, which some devices cannot show)', () => {
    const badge = read('src/components/AvatarBadge.tsx');
    const map = badge.slice(badge.indexOf('AVATAR_ICONS'), badge.indexOf('};', badge.indexOf('AVATAR_ICONS')));
    for (const p of AVATAR_PRESETS) expect(map, p.id).toMatch(new RegExp(`\\b${p.id}: [A-Z]`));
    expect(read('src/lib/avatar.ts')).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('finds one by id and nothing for an unknown id', () => {
    expect(presetById('cat')?.label).toBe('Cat');
    expect(presetById('dragon')).toBeNull();
    expect(presetById(null)).toBeNull();
  });
});

describe('what may be stored', () => {
  it('accepts a small base64 picture and nothing else', () => {
    expect(isAvatarDataUrl(JPEG)).toBe(true);
    expect(isAvatarDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    // not a picture, a link, a script, an SVG (which can carry script)
    expect(isAvatarDataUrl('https://example.com/me.jpg')).toBe(false);
    expect(isAvatarDataUrl('javascript:alert(1)')).toBe(false);
    expect(isAvatarDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isAvatarDataUrl('data:text/html;base64,PGI+')).toBe(false);
    expect(isAvatarDataUrl('data:image/jpeg;base64,/9j/" onerror="x')).toBe(false);
    expect(isAvatarDataUrl('')).toBe(false);
    expect(isAvatarDataUrl(null)).toBe(false);
  });

  it('refuses a picture larger than the database accepts', () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(AVATAR_MAX_CHARS);
    expect(isAvatarDataUrl(big)).toBe(false);
    expect(isAvatarDataUrl(big.slice(0, AVATAR_MAX_CHARS))).toBe(true);
  });

  it('reads a stored record, and drops one it does not understand', () => {
    expect(parseAvatar({ kind: 'photo', photo: JPEG, preset: '' })).toEqual({ kind: 'photo', photo: JPEG });
    expect(parseAvatar({ kind: 'preset', preset: 'bird', photo: '' })).toEqual({ kind: 'preset', preset: 'bird' });
    expect(parseAvatar({ kind: 'preset', preset: 'dragon' })).toBeNull();
    expect(parseAvatar({ kind: 'photo', photo: 'https://example.com/a.jpg' })).toBeNull();
    expect(parseAvatar({ kind: 'video' })).toBeNull();
    expect(parseAvatar(null)).toBeNull();
    expect(parseAvatar('cat')).toBeNull();
  });

  it('says why a file cannot be used', () => {
    expect(fileProblem({ type: 'image/jpeg', size: 3_000_000 })).toBeNull();
    expect(fileProblem({ type: 'image/heic', size: 3_000_000 })).toBeNull();
    expect(fileProblem({ type: 'application/pdf', size: 1000 })).toMatch(/not a picture/);
    expect(fileProblem({ type: 'image/jpeg', size: 40_000_000 })).toMatch(/too large/);
  });
});

describe('cutting the square', () => {
  it('takes the middle of a wide or a tall picture, never stretching it', () => {
    expect(cropSquare(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(cropSquare(200, 400)).toEqual({ sx: 0, sy: 100, side: 200 });
    expect(cropSquare(300, 300)).toEqual({ sx: 0, sy: 0, side: 300 });
  });

  it('zooms into the middle', () => {
    expect(cropSquare(400, 400, 2)).toEqual({ sx: 100, sy: 100, side: 200 });
  });

  it('slides to an edge and no further', () => {
    expect(cropSquare(400, 200, 1, -1, 0)).toEqual({ sx: 0, sy: 0, side: 200 });
    expect(cropSquare(400, 200, 1, 1, 0)).toEqual({ sx: 200, sy: 0, side: 200 });
    expect(cropSquare(400, 200, 1, 9, 9)).toEqual({ sx: 200, sy: 0, side: 200 });
    for (const [z, dx, dy] of [[1, 1, 1], [3, -1, 1], [4, 1, -1], [99, 5, 5]]) {
      const c = cropSquare(640, 480, z, dx, dy);
      expect(c.sx).toBeGreaterThanOrEqual(0);
      expect(c.sy).toBeGreaterThanOrEqual(0);
      expect(c.sx + c.side).toBeLessThanOrEqual(640);
      expect(c.sy + c.side).toBeLessThanOrEqual(480);
    }
  });

  it('stores a small square', () => {
    expect(AVATAR_SIZE).toBeLessThanOrEqual(256);
  });
});

describe('the database rules for a profile picture', () => {
  const rules = read('firestore.rules');
  const block = rules.slice(rules.indexOf('match /user_avatars/{uid}'), rules.indexOf('match /students/{uid}'));

  it('keeps the picture private to its account', () => {
    expect(block).toContain('allow get: if isVerifiedUser() && (request.auth.uid == uid || isCmcAdmin());');
    expect(block).toContain('allow list: if isCmcAdmin();');
    expect(block).not.toMatch(/allow (read|get|list): if (true|isVerifiedUser\(\)|isCmcTeacher\(\));/);
  });

  it('lets only the account itself write it, and only as a small picture or a preset id', () => {
    expect(block).toMatch(/allow create, update: if isVerifiedUser\(\)\s+&& request\.auth\.uid == uid/);
    expect(block).toContain(`request.resource.data.photo.size() <= ${AVATAR_MAX_CHARS}`);
    expect(block).toContain("request.resource.data.photo.matches('^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')");
    expect(block).toContain("request.resource.data.keys().hasOnly(['uid', 'kind', 'photo', 'preset', 'updatedAt'])");
  });

  it('writes exactly the fields the rules allow', () => {
    const lib = read('src/lib/avatar.ts');
    for (const field of ['uid', 'kind', 'photo', 'preset', 'updatedAt']) expect(lib).toContain(`${field}: {`);
  });
});

describe('where the panel is offered', () => {
  const nav = read('src/components/Navbar.tsx');

  it('is in the account menu on a laptop and on a phone', () => {
    expect(nav).toContain('data-testid="profile-photo-open"');
    expect(nav).toContain('data-testid="profile-photo-open-mobile"');
    expect(nav).toContain('<ProfilePhotoModal');
  });

  it('shows the picture in the account button', () => {
    expect(nav).toContain('<AvatarBadge avatar={avatar} initial={firstName} size={24}');
  });
});
