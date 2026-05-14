import type { MetadataRoute } from "next";

// Some manifest fields are stable in the spec but not yet typed in
// `next`'s MetadataRoute. We cast at the end so we keep the strict
// MetadataRoute.Manifest baseline and only widen for the extras.
type ExtendedManifest = MetadataRoute.Manifest & {
  display_override?: Array<
    "window-controls-overlay" | "standalone" | "minimal-ui" | "browser" | "fullscreen"
  >;
  launch_handler?: { client_mode: "focus-existing" | "navigate-new" | "auto" };
  prefer_related_applications?: boolean;
  edge_side_panel?: { preferred_width?: number };
  handle_links?: "auto" | "preferred" | "not-preferred";
};

export default function manifest(): MetadataRoute.Manifest {
  const m: ExtendedManifest = {
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
    // Prefer the WCO surface on desktop (toolbar-less window with our own
    // titlebar drag region) and gracefully fall back to standalone where
    // the OS doesn't support it. Chromium honors the order; Safari/iOS
    // ignores the field and uses `display` directly.
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#359300",
    categories: ["business", "productivity"],
    // Tell the OS to re-focus an existing window instead of spawning a
    // second one when the app is launched via a shortcut or share target.
    // Avoids the "I have two VisiCheks open" papercut on macOS/Windows.
    launch_handler: { client_mode: "focus-existing" },
    // We do NOT ship a Play Store / App Store native shell. Telling the
    // browser this up front stops install banners from offering to
    // redirect to a related app that doesn't exist.
    prefer_related_applications: false,
    // Edge's side panel is a great surface for the kiosk-style scan UI
    // when receptionists run the app docked next to their main work.
    edge_side_panel: { preferred_width: 480 },
    // Capture deep links opened from email/chat into the installed PWA
    // instead of bouncing to the browser.
    handle_links: "preferred",
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
        url: "/app/visitors/pending?launch=pwa",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Today's appointments",
        short_name: "Appointments",
        description: "See and manage today's visitor appointments",
        url: "/app/appointments?launch=pwa",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open the dashboard",
        url: "/app/dashboard?launch=pwa",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Open a support case",
        short_name: "Support",
        description: "Open or follow up on a support case",
        url: "/app/support-cases?launch=pwa",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };

  return m as MetadataRoute.Manifest;
}
