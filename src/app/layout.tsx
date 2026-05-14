import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { Providers } from "./providers";
import "./globals.css";

// Self-hosted via next/font — no render-blocking external request
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VisiChek: Secure Digital Visitor Management System",
  description:
    "Replace your paper logbooks with fast, secure visitor check-in. ID verification, badge printing, and real-time records for your facility.",
  applicationName: "VisiChek",
  appleWebApp: {
    capable: true,
    title: "VisiChek",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#359300" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Last-resort defense against `Cannot read properties of null
// (reading 'removeChild')` from the React 19 DOM reconciler.
//
// The real, app-level fix for in-app navigation is overlay-safe routing:
// dropdowns/dialogs/sheets/popovers must close before the page tree
// swaps — see `DropdownMenuNavItem` (components/recipes) and
// `navigateFromOverlay()` on the navigation-loading context. Routing
// during the same commit as a Radix portal teardown was the original
// repro path and is the bug class this guard *shouldn't* be papering
// over for our own code.
//
// What this guard exists for is the orthogonal failure mode: browser
// extensions (Google Translate, Grammarly, Honey, etc.) wrap text
// nodes mid-render; when React tries to unmount one of those wrapped
// nodes the reconciler reads a null `parentNode` and the renderer
// dies — every subsequent state update fails silently and navigation
// freezes until a hard refresh. Patching `removeChild` / `insertBefore`
// to no-op on a parent mismatch lets React continue cleanly.
//
// Do NOT lean on this as the primary fix for new portal-driven
// navigation crashes; route those through the overlay-safe helpers
// instead.
const DOM_RECONCILER_GUARD = `(function(){if(typeof Node==="undefined"||!Node.prototype)return;var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c&&c.parentNode!==this){if(c.parentNode){return c.parentNode.removeChild(c)}return c}return r.apply(this,arguments)};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this){return this.appendChild(n)}return i.apply(this,arguments)}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${plusJakartaSans.variable} ${ibmPlexMono.variable}`}
    >
      <body
        className="min-h-screen bg-background font-sans antialiased"
        suppressHydrationWarning
      >
        <Script id="dom-reconciler-guard" strategy="beforeInteractive">
          {DOM_RECONCILER_GUARD}
        </Script>
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
