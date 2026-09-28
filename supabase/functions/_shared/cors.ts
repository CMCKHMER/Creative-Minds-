const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://cmckhmer.github.io',
];

export function allowedOrigins(): Set<string> {
  const configured = Deno.env.get('APP_ALLOWED_ORIGINS');
  const values = configured
    ? configured.split(',').map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  return new Set(values);
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || allowedOrigins().has(origin);
}

export function corsHeaders(request: Request): Headers {
  const origin = request.headers.get('origin');
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  });
  if (origin && allowedOrigins().has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return new Response(JSON.stringify(body), { status, headers });
}