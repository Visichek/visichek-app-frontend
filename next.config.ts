import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
};

export default nextConfig;
