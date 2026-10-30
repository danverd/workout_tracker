import type { NextConfig } from "next";

const scriptSrc = ["'self'", "'unsafe-inline'"];
// React dev tooling needs eval; never allowed in production.
if (process.env.NODE_ENV === "development") scriptSrc.push("'unsafe-eval'");

const csp: Record<string, string[]> = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
  "script-src": scriptSrc,
  "style-src": ["'self'", "'unsafe-inline'"],
};
const contentSecurityPolicy = Object.entries(csp)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the dev badge from covering the tab bar when previewing on a phone.
  devIndicators: false,
  // PGlite loads its wasm/data files from disk and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // `npm run dev:phone` sets DEV_LAN_HOST so the phone can load dev assets.
  allowedDevOrigins: process.env.DEV_LAN_HOST ? [process.env.DEV_LAN_HOST] : [],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "same-origin" },
        {
          key: "Content-Security-Policy",
          value: contentSecurityPolicy,
        },
      ],
    },
  ],
};

export default nextConfig;
