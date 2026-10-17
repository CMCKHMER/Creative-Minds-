import type { MiniMockQuestion } from '../data/miniMockTest';
import { parseMiniMockQuestions } from '../data/miniMockTest';
import { supabase } from './supabase';

/**
 * Fetch the member-only mini mock question bank.
 *
 * Two paths:
 *
 * 1. If Supabase is configured AND the `member-mini-mock` Edge Function
 *    is deployed, call it — the questions stay server-side and only
 *    verified members can fetch them. This is the "secure" path.
 *
 * 2. Otherwise (Supabase not configured, OR the Edge Function returns a
 *    404 / network error), fall back to fetching the bundled bank at
 *    `/data/mini-mock-bank.json` (which ships in the repo). The questions
 *    are the same; they're just bundled rather than fetched via a
 *    server-side gate.
 *
 * Either way, the parsed questions are validated by `parseMiniMockQuestions`
 * before being handed to the test runner.
 */
export async function fetchMemberMiniMock(): Promise<MiniMockQuestion[]> {
  // Try the Supabase Edge Function path first (if configured).
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke<{ questions?: unknown; error?: string }>('member-mini-mock', { body: {} });
      if (!error && data?.questions) {
        const parsed = parseMiniMockQuestions(data.questions);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch {
      // Fall through to the bundled-bank fallback below.
    }
  }

  // Fallback: fetch the bundled question bank. Same content, just no
  // server-side gate. The questions were already in the repo (and
  // visible in the JS bundle of any determined viewer), so this is no
  // loss of security — it just lets the practice room actually run
  // on deployments that don't have Supabase configured.
  const res = await fetch('./data/mini-mock-bank.json', { cache: 'force-cache' });
  if (!res.ok) {
    throw new Error(`Could not load the practice question bank (HTTP ${res.status}). Try again in a moment.`);
  }
  const data = await res.json().catch(() => null);
  const parsed = parseMiniMockQuestions(data);
  if (!parsed || parsed.length === 0) {
    throw new Error('The practice question bank is unavailable or invalid. Contact the site administrator.');
  }
  return parsed;
}
