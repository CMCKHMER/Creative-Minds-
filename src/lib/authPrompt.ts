// Global "open the account dialog" channel.
//
// Dozens of surfaces (games, downloads, teacher tools, dashboards, static
// links) need the same thing: when a visitor hits a locked action, open the
// CMC sign-in / sign-up dialog with context about WHY it opened. Prop-drilling
// an `onOpenAuth` through every page is brittle, so components publish an
// event and App (which renders the dialog globally) listens.

import type { AccountType } from './userProfile';
import type { AuthMode } from './authLinks';

export interface AuthPromptRequest {
  mode?: AuthMode;
  /** Preselect Student / Teacher / General user. */
  accountType?: AccountType | null;
  /** Relative URL to return to after a successful sign-in. */
  returnUrl?: string | null;
  /** Short reason shown at the top of the dialog, e.g. "Sign up to download
   *  this worksheet." Keep it to one sentence. */
  contextPrompt?: string | null;
  /** Optional title override for the dialog. */
  title?: string | null;
}

export const AUTH_PROMPT_EVENT = 'cmc-open-auth';

/** Open the global account dialog (sign-up by default). */
export function requestAuth(prompt: AuthPromptRequest = {}): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<AuthPromptRequest>(AUTH_PROMPT_EVENT, {
      detail: {
        mode: prompt.mode ?? 'sign-up',
        accountType: prompt.accountType ?? null,
        returnUrl: prompt.returnUrl ?? null,
        contextPrompt: prompt.contextPrompt ?? null,
        title: prompt.title ?? null,
      },
    }));
  } catch {
    /* non-DOM / older browsers — the caller still shows its locked card */
  }
}

/** Convenience: ask the visitor to create an account for a specific action. */
export function requestSignUp(contextPrompt: string, opts: { returnUrl?: string | null; accountType?: AccountType | null } = {}): void {
  requestAuth({ mode: 'sign-up', contextPrompt, ...opts });
}

/** Convenience: ask the visitor to sign in (e.g. "already have an account?"). */
export function requestSignIn(contextPrompt?: string, opts: { returnUrl?: string | null; accountType?: AccountType | null } = {}): void {
  requestAuth({ mode: 'sign-in', contextPrompt, ...opts });
}
