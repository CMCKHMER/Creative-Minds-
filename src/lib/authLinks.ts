// Deep-link helpers for the sign-in / sign-up flow.
//
// The whole site is behind an account now, so locked surfaces link back into
// the app with a URL that both opens the right auth screen and remembers where
// the visitor was going:
//
//   /?auth=signup&next=%23games          → sign-up modal, then back to #games
//   /?auth=teacher&next=%23teacher-tools → teacher sign-in, then Teacher Tools
//   /toefl-ibt/index.html?auth=signin&next=…   (standalone pages, via cmc-auth-gate.js)
//
// `next` is ALWAYS validated before use: only same-origin, relative URLs are
// accepted (hash routes, paths, query strings) — never absolute or
// protocol-relative URLs, and never a `javascript:` payload.

import type { AccountType } from './userProfile';

export type AuthMode = 'sign-up' | 'sign-in';

export interface AuthLinkRequest {
  /** Which auth screen to open, if the URL asks for one. */
  mode: AuthMode | null;
  /** Preselected Student / Teacher / General-user choice. */
  accountType: AccountType | null;
  /** Validated relative URL to return to after a successful sign-in. */
  returnUrl: string | null;
  /** Human-readable reason shown at the top of the modal (e.g. "Sign up to download"). */
  contextPrompt: string | null;
}

const EMPTY: AuthLinkRequest = { mode: null, accountType: null, returnUrl: null, contextPrompt: null };

/** Only same-origin relative targets are allowed as a post-auth return URL. */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  // Reject absolute URLs, protocol-relative URLs, and anything with a scheme
  // or backslash tricks (`javascript:`, `\\evil.com`, `https://…`).
  if (value.length > 500) return null;
  if (/[\s\\]/.test(value)) return null;
  if (value.startsWith('//')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null;
  if (!/^[#/]/.test(value)) return null;
  // Path characters we accept — enough for hash routes, query strings, and
  // static page paths, nothing exotic.
  if (!/^[#/?][A-Za-z0-9._~%!#$&'()*+,;=:@/?-]*$/.test(value)) return null;
  return value;
}

/** Current page, stripped of any stray `auth` / `next` params — the default
 *  return target for a modal the visitor opened themselves. */
export function currentRelativeUrl(): string {
  if (typeof window === 'undefined') return '';
  const { pathname, search, hash } = window.location;
  const params = new URLSearchParams(search);
  params.delete('auth');
  params.delete('next');
  params.delete('context');
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ''}${hash}`;
}

/** Parse `?auth=…&next=…&context=…` from a location search string. */
export function parseAuthSearch(search: string): AuthLinkRequest {
  if (!search) return EMPTY;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const authRaw = (params.get('auth') || '').trim().toLowerCase();
  const next = safeReturnUrl(params.get('next'));
  const context = params.get('context');
  const contextPrompt = context ? decodeURIComponent(context).slice(0, 180) : null;

  switch (authRaw) {
    case 'signup':
    case 'sign-up':
    case 'register':
      return { mode: 'sign-up', accountType: null, returnUrl: next, contextPrompt };
    case 'signin':
    case 'sign-in':
    case 'login':
      return { mode: 'sign-in', accountType: null, returnUrl: next, contextPrompt };
    case 'student':
      return { mode: 'sign-up', accountType: 'student', returnUrl: next, contextPrompt };
    case 'teacher':
      return { mode: 'sign-in', accountType: 'teacher', returnUrl: next, contextPrompt };
    case 'user':
    case 'general':
      return { mode: 'sign-up', accountType: 'user', returnUrl: next, contextPrompt };
    default:
      // A `next` on its own is still useful when someone opens the site from a
      // shared link while signed out.
      return next ? { ...EMPTY, returnUrl: next, contextPrompt } : EMPTY;
  }
}

/** Search string with `auth`/`next`/`context` removed, keeping everything else. */
export function stripAuthParams(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  params.delete('auth');
  params.delete('next');
  params.delete('context');
  return params.toString();
}

/** Build a same-origin sign-in URL for a given page path + intent. */
export function buildAuthUrl(opts: {
  path?: string;
  mode?: AuthMode;
  accountType?: AccountType | null;
  next?: string | null;
  context?: string | null;
}): string {
  const base = opts.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const params = new URLSearchParams();
  const mode = opts.mode ?? 'sign-in';
  const authValue = opts.accountType ?? (mode === 'sign-up' ? 'signup' : 'signin');
  params.set('auth', authValue);
  const next = safeReturnUrl(opts.next);
  if (next) params.set('next', next);
  if (opts.context) params.set('context', encodeURIComponent(opts.context.slice(0, 180)));
  return `${base}?${params.toString()}`;
}

/**
 * Go to a validated relative return URL. Hash links stay inside the SPA
 * (`#games` scrolls/opens the page); paths reload onto the static page the
 * visitor originally asked for.
 */
export function navigateToReturnUrl(url: string | null | undefined): boolean {
  const target = safeReturnUrl(url);
  if (!target || typeof window === 'undefined') return false;
  if (target.startsWith('#')) {
    window.location.hash = target.slice(1);
    return true;
  }
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (here === target) return false;
  window.location.assign(target);
  return true;
}
