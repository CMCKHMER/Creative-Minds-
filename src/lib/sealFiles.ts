// The sealed-answer files ship with the site (public, safe: ciphertext and
// the PUBLIC key only). Loaded once per page view and shared by the
// Bi-Weekly Tests panel and the score sheet.

import type { SealBundle, SealPublicKey } from './answerSeal';

let sealFilesPromise: Promise<{ pub: SealPublicKey; bundle: SealBundle }> | null = null;

export function loadSealFiles(): Promise<{ pub: SealPublicKey; bundle: SealBundle }> {
  if (!sealFilesPromise) {
    const base = window.location.pathname.replace(/index\.html$/, '') + 'biweek-planner/';
    const get = async <T,>(name: string): Promise<T> => {
      const res = await fetch(base + name, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Could not load ${name}`);
      return res.json() as Promise<T>;
    };
    sealFilesPromise = Promise.all([get<SealPublicKey>('answer-seal.pub.json'), get<SealBundle>('answer-seals.json')])
      .then(([pub, bundle]) => ({ pub, bundle }))
      .catch((err: unknown) => { sealFilesPromise = null; throw err; });
  }
  return sealFilesPromise;
}
