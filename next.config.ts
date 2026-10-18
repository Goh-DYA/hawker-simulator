/**
 * The Next.js configuration.
 *
 * It only sets the response headers: the shared security headers from
 * `src/config/securityHeaders.ts` on every path, with the Content-Security-Policy also
 * allowing `'unsafe-eval'` in development builds.
 */
import type { NextConfig } from "next";
import { IS_DEVELOPMENT_BUILD } from "./src/config/env";
import { createNextSecurityHeaders } from "./src/config/securityHeaders";

const isDevelopment = IS_DEVELOPMENT_BUILD;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: createNextSecurityHeaders(isDevelopment),
      },
    ];
  },
};

export default nextConfig;
