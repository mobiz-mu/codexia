import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
// Opt-in only — run `ANALYZE=true npm run build` to generate the report.
// No effect on a normal build/deploy.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

// script-src needs 'unsafe-inline' for the optional GA4/GTM/Meta Pixel
// bootstrap snippets. 'unsafe-eval' is allowed only in development for
// React Fast Refresh, HMR, and development source maps.
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://*.supabase.co https://www.paypalobjects.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com https://www.paypal.com https://www.sandbox.paypal.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net https://www.paypal.com https://www.paypalobjects.com`,
  "frame-src https://www.googletagmanager.com https://www.paypal.com https://www.sandbox.paypal.com",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  /*
   * Reduce build parallelism for Windows machines with limited available
   * worker threads. This prevents OS error 1450 during static generation.
   */
  experimental: {
    cpus: 4,
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 20,

    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));