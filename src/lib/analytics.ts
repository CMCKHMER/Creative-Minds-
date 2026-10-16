// Google Analytics 4 helper for the CMC React app.
// The gtag snippet is loaded in index.html. Replace the placeholder
// Measurement ID below (and in index.html) with your real GA4 ID, e.g. G-ABC12345.
//
// All functions are safe to call even before gtag loads — they no-op silently.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // <-- replace with your real ID

export const ga4Configured = (): boolean =>
  typeof window !== 'undefined' && typeof window.gtag === 'function';

export function gtag(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', event, params);
  } catch {
    // ignore — analytics must never throw in the user's app
  }
}

export function trackPageView(path: string, title?: string): void {
  gtag('page_view', { page_path: path, page_title: title });
}

// --- Named event helpers used across the app ------------------------------

export function trackDrillComplete(input: {
  drillSlug: string;
  drillTitle: string;
  source: 'biweek-planner' | 'toefl-ibt' | 'learning-games';
  scorePct: number;
  correct: number;
  total: number;
  durationSeconds?: number;
}): void {
  gtag('drill_complete', {
    drill_slug: input.drillSlug,
    drill_title: input.drillTitle,
    drill_source: input.source,
    score_pct: input.scorePct,
    correct_count: input.correct,
    total_count: input.total,
    duration_seconds: input.durationSeconds ?? 0,
  });
}

export function trackDiceRoll(input: { diceCount: number; total: number; values: number[] }): void {
  gtag('dice_roll', {
    dice_count: input.diceCount,
    total: input.total,
    values: input.values.join(','),
  });
}

export function trackWheelSpin(input: { namesCount: number; winner: string }): void {
  gtag('wheel_spin', {
    names_count: input.namesCount,
    winner: input.winner,
  });
}

export function trackShareClick(input: { service: string; url: string }): void {
  gtag('share_click', {
    service: input.service,
    page_url: input.url,
  });
}

export function trackThemeToggle(input: { theme: 'light' | 'dark' }): void {
  gtag('theme_toggle', { theme: input.theme });
}

export { GA4_MEASUREMENT_ID };
