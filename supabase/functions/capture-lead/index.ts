import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isAllowedOrigin, jsonResponse } from '../_shared/cors.ts';

type LeadKind = 'teacher_interest' | 'newsletter';

interface LeadPayload {
  kind?: LeadKind;
  email?: string;
  name?: string;
  school?: string;
  role?: string;
  consent?: boolean;
  website?: string;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function getServiceKey(): string {
  const keyMap = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keyMap) {
    try {
      const keys = JSON.parse(keyMap) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Fall through to the legacy service-role secret below.
    }
  }
  return requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
}

async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getClientFingerprint(request: Request): string {
  const address = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  return address.slice(0, 128);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse(request, { ok: true });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  if (!isAllowedOrigin(request)) return jsonResponse(request, { error: 'Origin not allowed.' }, 403);

  const size = Number(request.headers.get('content-length') ?? 0);
  if (size > 10_000) return jsonResponse(request, { error: 'Request is too large.' }, 413);

  let payload: LeadPayload;
  try {
    payload = await request.json() as LeadPayload;
  } catch {
    return jsonResponse(request, { error: 'Please submit a valid request.' }, 400);
  }

  // Quietly absorb bot-form submissions without storing them.
  if (cleanText(payload.website, 200)) return jsonResponse(request, { ok: true });

  const kind = payload.kind;
  const email = cleanText(payload.email, 254).toLowerCase();
  if (kind !== 'newsletter' && kind !== 'teacher_interest') {
    return jsonResponse(request, { error: 'Choose a valid request type.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(request, { error: 'Enter a valid email address.' }, 400);
  }
  if (payload.consent !== true) {
    return jsonResponse(request, { error: 'Please confirm the consent checkbox to continue.' }, 400);
  }

  let supabase: SupabaseClient;
  try {
    supabase = createClient(requiredEnv('SUPABASE_URL'), getServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch {
    return jsonResponse(request, { error: 'Lead capture is not configured yet. Please try again later.' }, 503);
  }

  try {
    const now = Date.now();
    const bucketStart = new Date(Math.floor(now / 900_000) * 900_000).toISOString();
    const fingerprintSalt = Deno.env.get('LEAD_RATE_LIMIT_SALT');
    if (!fingerprintSalt || fingerprintSalt.length < 32) {
      console.error('Lead capture rate-limit salt is missing or too short.');
      return jsonResponse(request, { error: 'Lead capture is temporarily unavailable.' }, 503);
    }
    const fingerprint = await sha256(`${fingerprintSalt}:${getClientFingerprint(request)}`);
    const { data: permitted, error: rateError } = await supabase.rpc('consume_lead_rate_limit', {
      p_fingerprint: fingerprint,
      p_window_started_at: bucketStart,
      p_max_requests: 5,
    });

    if (rateError) {
      console.error('Lead capture rate limit unavailable:', rateError.message);
      return jsonResponse(request, { error: 'Lead capture is temporarily unavailable.' }, 503);
    }
    if (!permitted) return jsonResponse(request, { error: 'Please wait a few minutes before trying again.' }, 429);

    const timestamp = new Date().toISOString();
    const record = {
      kind,
      email,
      display_name: cleanText(payload.name, 80),
      school_name: cleanText(payload.school, 120),
      role: cleanText(payload.role, 80),
      contact_consent_at: kind === 'teacher_interest' ? timestamp : null,
      newsletter_consent_at: kind === 'newsletter' ? timestamp : null,
      expires_at: new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { error: leadError } = await supabase
      .from('contact_leads')
      .upsert(record, { onConflict: 'email_normalized,kind' });

    if (leadError) {
      console.error('Lead capture storage failed:', leadError.message);
      return jsonResponse(request, { error: 'We could not save this request. Please try again later.' }, 503);
    }

    // Expired rows are removed as part of successful submissions; schedule the same
    // server function from Supabase Cron to enforce the retention window when idle.
    await supabase.rpc('purge_expired_contact_leads');
    return jsonResponse(request, { ok: true });
  } catch (error) {
    console.error('Lead capture failed:', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse(request, { error: 'Lead capture is temporarily unavailable.' }, 503);
  }
});