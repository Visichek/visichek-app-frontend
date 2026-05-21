import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ── next/image: tenant logos and avatars live on the API origin, never
  // on the frontend host. We must allow that origin explicitly or the
  // Image component refuses to optimize them.
  images: {
    // Prefer AVIF when the browser supports it; fall back to WebP. Both
    // dramatically smaller than the PNGs tenants upload.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Allow any path on the API host — covers /v1/documents, /blog-uploads,
      // and any future bucket paths without needing a config change.
      {
        protocol: "https",
        hostname: "api.visichek.app",
        pathname: "/**",
      },
      // Presigned storage URLs. Since the presigned-upload migration, the
      // backend returns `download_url`s that point straight at the Cloudflare
      // R2 bucket (`<bucket>.<account>.r2.cloudflarestorage.com`), NOT the API
      // host — branding logos, visitor portraits, ID images, badges, etc. The
      // optimizer rejects any host not listed here with a 400
      // INVALID_IMAGE_OPTIMIZE_REQUEST, so the `**` wildcard covers every
      // bucket/account. The presigned query string is allowed (no `search`
      // restriction), and each fresh signature is just a new cache key.
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      // Local dev sometimes proxies through the frontend origin via
      // `next.config rewrites`. Allow that path so logos render in dev too.
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/api/**",
      },
    ],
  },

  // Tell Next.js to tree-shake these packages at the import level so only
  // the symbols actually used end up in each route's bundle. The biggest
  // lever is `lucide-react` (468+ icons) — without this, every route that
  // touches a single icon pulls in the whole icon set.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "sonner",
      "react-hook-form",
      "@hookform/resolvers",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tooltip",
    ],
  },

  async headers() {
    return [
      {
        // The service worker file must never be long-cached, otherwise users
        // can be stuck on a stale SW that keeps serving stale assets.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
        ],
      },
    ];
  },

  // Dev-only proxy so the browser sees same-origin API calls and the backend's
  // Set-Cookie is stored against localhost. Prod hits api.visichek.app directly
  // (same-site with client.visichek.app), so this rewrite is skipped.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const target =
      process.env.DEV_API_PROXY_TARGET ?? "https://api.visichek.app/v1";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

// Wrap with the bundle analyzer so `ANALYZE=true npm run build` (and the
// dedicated `analyze` script) emits the route-by-route treemap reports.
// When `ANALYZE` is unset, this is a no-op — production builds are not
// affected.
export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);
