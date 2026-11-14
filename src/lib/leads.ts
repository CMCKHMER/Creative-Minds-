import { supabase, supabaseConfigured } from './supabase';

/**
 * Whether this build can store lead / newsletter opt-ins at all. The lead
 * forms post to a Supabase edge function, so a build made without the
 * VITE_SUPABASE_* variables (the current GitHub Pages deployment) has
 * nowhere to send them. Forms must check this and not render an email
 * field that can only ever answer "not configured".
 */
export const leadCaptureConfigured = supabaseConfigured;

export type CapturableLead =
  | { kind: 'newsletter'; email: string; consent: true; website?: string }
  | { kind: 'teacher_interest'; email: string; consent: true; website?: string };

export async function captureLead(lead: CapturableLead): Promise<void> {
  if (!supabase) throw new Error('Account and lead capture is not configured for this deployment.');
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>('capture-lead', { body: lead });
  if (error) throw new Error(error.message || 'We could not save your request. Please try again later.');
  if (!data?.ok) throw new Error(data?.error || 'We could not save your request. Please try again later.');
}