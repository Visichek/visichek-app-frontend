import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VisiChek",
    short_name: "VisiChek",
    description: "Enterprise visitor management platform",
    // Query-param flag is read by app/page.tsx so the very first paint of a
    // PWA launch is the branded splash, not the dual-portal landing. The
    // app routes don't depend on the param, so navigation away keeps
    // working normally.
    start_url: "/?launch=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#359300",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Check in visitor",
        short_name: "Check in",
        description: "Open the visitor check-in flow",
        url: "/app/visitors/pending",
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open the dashboard",
        url: "/app/dashboard",
      },
    ],
  };
}
