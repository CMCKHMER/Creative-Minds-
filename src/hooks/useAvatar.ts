import { useEffect, useState } from 'react';
import { AVATAR_EVENT, loadAvatar, readCachedAvatar, type Avatar } from '../lib/avatar';

// accounts whose stored picture was already fetched in this page view
const fetched = new Set<string>();

/**
 * The signed-in account's profile picture. Shows this device's copy at once,
 * then checks the database once per page view (so a picture chosen on another
 * device arrives), and re-renders whenever the picture is changed.
 * `canFetch` is false for an account that cannot read the database yet
 * (email not confirmed).
 */
export function useAvatar(uid: string | null | undefined, canFetch = true): Avatar | null {
  const id = uid || '';
  const [avatar, setAvatar] = useState<Avatar | null>(() => readCachedAvatar(id));

  useEffect(() => {
    const sync = () => setAvatar(readCachedAvatar(id));
    sync();
    window.addEventListener(AVATAR_EVENT, sync);
    window.addEventListener('storage', sync);
    if (id && canFetch && !fetched.has(id)) {
      fetched.add(id);
      // a failure here only means the cached picture stays
      loadAvatar(id).catch(() => { fetched.delete(id); });
    }
    return () => {
      window.removeEventListener(AVATAR_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [id, canFetch]);

  return avatar;
}
