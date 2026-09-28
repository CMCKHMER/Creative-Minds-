import { createClient } from 'npm:@supabase/supabase-js@2';
import { isAllowedOrigin, jsonResponse } from '../_shared/cors.ts';

function serviceKey(): string {
  const keyMap = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keyMap) {
    try {
      const keys = JSON.parse(keyMap) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Fall through to the legacy service-role secret below.
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse(request, { ok: true });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  if (!isAllowedOrigin(request)) return jsonResponse(request, { error: 'Origin not allowed.' }, 403);

  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonResponse(request, { error: 'Sign in again to delete your account.' }, 401);

  const secret = serviceKey();
  const url = Deno.env.get('SUPABASE_URL');
  if (!url || !secret) return jsonResponse(request, { error: 'Account deletion is not configured.' }, 503);

  const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  const user = authData.user;
  if (authError || !user || !user.email_confirmed_at) {
    return jsonResponse(request, { error: 'A verified, active session is required.' }, 401);
  }

  const { error: leadError } = await supabase
    .from('contact_leads')
    .delete()
    .eq('email_normalized', (user.email ?? '').trim().toLowerCase());
  if (leadError) {
    console.error('Member lead deletion failed:', leadError.message);
    return jsonResponse(request, { error: 'We could not complete account deletion. Please contact the site administrator.' }, 503);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('Member account deletion failed:', deleteError.message);
    return jsonResponse(request, { error: 'We could not complete account deletion. Please contact the site administrator.' }, 503);
  }

  return jsonResponse(request, { ok: true });
});