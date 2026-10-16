// Edge Function CORS Configuration
// Enforces an explicit origin allowlist with exact matching.
// Never uses wildcard reflection or arbitrary origin mirroring.

/**
 * Parses and returns the list of approved origins from the ALLOWED_ORIGIN environment variable.
 * Origins must be comma-separated, fully qualified (e.g. "https://domain.com", "http://localhost:3000").
 * Wildcards ('*') are strictly disallowed and discarded to prevent insecure reflections.
 */
export function getAllowedOrigins(): string[] {
  const envVal = Deno.env.get('ALLOWED_ORIGIN') || '';
  if (!envVal.trim()) {
    return [];
  }

  return envVal
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*');
}

/**
 * Checks if the request's Origin header strictly matches one of the configured allowed origins.
 */
export function isOriginAllowed(req: Request): boolean {
  const requestOrigin = req.headers.get('Origin');
  if (!requestOrigin) {
    return false;
  }

  const allowedList = getAllowedOrigins();
  return allowedList.includes(requestOrigin);
}

/**
 * Returns CORS response headers.
 * If the request origin is in the explicit allowlist, returns Access-Control-Allow-Origin: <origin>.
 * If the origin is unapproved or absent, Access-Control-Allow-Origin is omitted (fail-closed).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get('Origin');
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };

  if (requestOrigin && isOriginAllowed(req)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }

  return headers;
}

/**
 * Handles CORS preflight OPTIONS requests fail-closed.
 * Rejects unapproved origins with HTTP 403 Forbidden without permissive CORS headers.
 * Returns HTTP 204 No Content with appropriate headers only for approved origins.
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(req)) {
      return new Response(
        JSON.stringify({ error: 'CORS forbidden: Origin not allowed.' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Vary': 'Origin',
          },
        }
      );
    }

    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  return null;
}
