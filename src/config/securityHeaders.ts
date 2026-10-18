/**
 * The single source of the HTTP security headers. `next.config.ts` serves them for the
 * Next.js builds, and `worker/index.ts` sets them on every Cloudflare Worker response, so both
 * hosting targets send the same policy.
 */

/**
 * The security headers by name. The CSP allows only same-origin connections; the `'unsafe-inline'`
 * script and style sources are a recorded exception (see `docs/SECURITY_AND_PRIVACY.md`).
 */
export const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "),
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

/**
 * Builds the headers in the `{ key, value }` list form that Next.js `headers()` expects.
 *
 * @param development - True to add `'unsafe-eval'` to `script-src` for the development server.
 * @returns The header list, in `SECURITY_HEADERS` order.
 */
export function createNextSecurityHeaders(development = false) {
  return Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
    key,
    value:
      development && key === "Content-Security-Policy"
        ? value.replace(
            "script-src 'self' 'unsafe-inline'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          )
        : value,
  }));
}

/**
 * The production header list for Next.js. Nothing imports it at present; `next.config.ts` calls
 * {@link createNextSecurityHeaders} itself.
 */
export const NEXT_SECURITY_HEADERS = createNextSecurityHeaders();
