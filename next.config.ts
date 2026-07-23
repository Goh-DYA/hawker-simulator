import type { NextConfig } from "next";
import { createNextSecurityHeaders } from "./src/config/securityHeaders";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // The fixed development badge sits over the compact bottom dock and creates
  // false-positive visual regressions at narrow and enlarged-text viewports.
  // In-game developer tools remain available through the explicit debug panel.
  devIndicators: false,
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
