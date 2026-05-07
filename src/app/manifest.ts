import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VisiChek",
    short_name: "VisiChek",
    description: "Enterprise visitor management platform",
    start_url: "/",
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
        url: "/app/visitors",
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
