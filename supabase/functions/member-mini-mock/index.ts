import { createClient } from 'npm:@supabase/supabase-js@2';
import { isAllowedOrigin, jsonResponse } from '../_shared/cors.ts';

const SKILLS = new Set(['Reading', 'Listening', 'Language Use']);

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
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Member test service key is unavailable.');
  return key;
}

function validateQuestionBank(value: unknown): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
    const question = item as Record<string, unknown>;
    const allowedKeys = new Set(['id', 'skill', 'prompt', 'choices', 'correctIndex', 'explanation', 'passage', 'audioScript']);
    if (Object.keys(question).some((key) => !allowedKeys.has(key))) return false;
    if (typeof question.id !== 'string' || question.id.length > 80 || ids.has(question.id)) return false;
    if (typeof question.skill !== 'string' || !SKILLS.has(question.skill)) return false;
    if (typeof question.prompt !== 'string' || question.prompt.length > 1200) return false;
    if (!Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 6) return false;
    if (!question.choices.every((choice) => typeof choice === 'string' && choice.length <= 1200)) return false;
    if (!Number.isInteger(question.correctIndex) || Number(question.correctIndex) < 0 || Number(question.correctIndex) >= question.choices.length) return false;
    if (typeof question.explanation !== 'string' || question.explanation.length > 1800) return false;
    if (question.passage !== undefined && (!Array.isArray(question.passage) || !question.passage.every((part) => typeof part === 'string' && part.length <= 6000))) return false;
    if (question.audioScript !== undefined && (typeof question.audioScript !== 'string' || question.audioScript.length > 6000)) return false;
    ids.add(question.id);
    return true;
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse(request, { ok: true });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  if (!isAllowedOrigin(request)) return jsonResponse(request, { error: 'Origin not allowed.' }, 403);

  const authorization = request.headers.get('authorization') ?? '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonResponse(request, { error: 'Sign in to access member practice.' }, 401);

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', getServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user) return jsonResponse(request, { error: 'Your session has expired. Please sign in again.' }, 401);
    if (!user.email_confirmed_at) return jsonResponse(request, { error: 'Verify your email before opening the member test.' }, 403);

    const { data: entitlement, error: entitlementError } = await supabase
      .from('member_entitlements')
      .select('status, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (entitlementError) {
      console.error('Member entitlement check failed:', entitlementError.message);
      return jsonResponse(request, { error: 'Member access could not be verified. Please try again.' }, 503);
    }
    if (!entitlement || (entitlement.expires_at && new Date(entitlement.expires_at).getTime() <= Date.now())) {
      return jsonResponse(request, { error: 'An active member entitlement is required.' }, 403);
    }

    const rawBank = Deno.env.get('MINI_MOCK_QUESTIONS_JSON');
    if (!rawBank) return jsonResponse(request, { error: 'The private practice bank has not been configured.' }, 503);

    let bank: unknown;
    try {
      bank = JSON.parse(rawBank);
    } catch {
      return jsonResponse(request, { error: 'The private practice bank is not valid JSON.' }, 503);
    }
    if (!validateQuestionBank(bank)) return jsonResponse(request, { error: 'The private practice bank failed validation.' }, 503);

    return jsonResponse(request, { questions: bank }, 200);
  } catch (error) {
    console.error('Member mini mock failed:', error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse(request, { error: 'Member practice is temporarily unavailable.' }, 503);
  }
});