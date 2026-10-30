import type { NextConfig } from "next";

const developmentScriptSource =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
          value:
            "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'" +
            developmentScriptSource +
            "; style-src 'self' 'unsafe-inline'",
        },
      ],
    },
  ],
};

export default nextConfig;
