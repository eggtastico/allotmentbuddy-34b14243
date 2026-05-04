/**
 * CORS utility for Supabase Edge Functions
 * Restricts access to specific origins instead of allowing "*"
 */

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost',
  'http://127.0.0.1',
  // Production origins
  'https://appsabaloo.com',
  'https://www.appsabaloo.com',
];

/**
 * Get CORS headers based on request origin
 * Only allows requests from whitelisted origins
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';

  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  const allowedOrigin = isAllowed ? origin : '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '3600',
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(req: Request): Response {
  const headers = getCorsHeaders(req);

  // Only return CORS headers if origin is allowed
  if (!headers['Access-Control-Allow-Origin']) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}
