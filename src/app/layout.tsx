import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import "./globals.css";

// Self-hosted local fonts matching the marketing website — no render-blocking
// external request. Files live in public/fonts (see design/02-typography-and-fonts.md).
const lausanne = localFont({
  src: "../../public/fonts/twk-lausanne.woff2",
  variable: "--font-sans",
  weight: "400",
  display: "swap",
});

const moderat = localFont({
  src: [
    { path: "../../public/fonts/moderat-serif-light.woff2", weight: "300" },
    { path: "../../public/fonts/moderat-serif-regular.woff2", weight: "400" },
  ],
  variable: "--font-display",
  display: "swap",
});

const sfMono = localFont({
  src: "../../public/fonts/sf-mono.woff2",
  variable: "--font-mono",
  weight: "400",
  display: "swap",
});

const rockSalt = localFont({
  src: "../../public/fonts/rock-salt.woff2",
  variable: "--font-handwritten",
  weight: "400",
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
    { media: "(prefers-color-scheme: light)", color: "#3A9615" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Last-resort defense against `Cannot read properties of null
// (reading 'removeChild')` from the React 19 DOM reconciler.
//
// The actual crash site is react-dom's `commitDeletionEffectsOnFiber`
// case 26 (HoistableHostInstance — <link>/<style>/<meta>/<title>/<script>
// that React hoisted to <head>). The compiled line is:
//
//   finishedRoot.parentNode.removeChild(finishedRoot)
//
// When a hoisted resource has been detached from <head> by something
// outside React's view — Turbopack HMR swapping fonts/CSS, a browser
// extension reordering head nodes, a service-worker update, or React's
// own hoisting bookkeeping racing the commit — `parentNode` is null and
// the property access on null throws before any patched removeChild can
// run. Case 26 has no try/catch around the call in React 19, so the
// commit phase explodes and every subsequent render fails.
//
// We can't intercept `null.removeChild` from JS, so we patch the
// `parentNode` getter on HTMLElement instead: for orphaned hoistable
// resource elements (link/style/meta/title/script), return a ghost
// parent whose removeChild is a no-op. React's call then succeeds
// silently and the commit continues. For everything else parentNode
// behaves exactly as before — code that does
// `if (node.parentNode) …` keeps working.
//
// We also keep the original mismatched-parent fallback for the
// browser-extension class of bug (Grammarly etc. wrapping text nodes
// in <body>), and the same for insertBefore.
//
// Do NOT lean on this as the primary fix for portal-driven navigation
// crashes — route those through the overlay-safe helpers instead.
const DOM_RECONCILER_GUARD = `(function(){if(typeof Node==="undefined"||!Node.prototype)return;var HOISTABLE=/^(LINK|STYLE|META|TITLE|SCRIPT)$/;var GHOST={removeChild:function(c){return c},insertBefore:function(n){return n},appendChild:function(n){return n},nodeType:1};var pnDesc=Object.getOwnPropertyDescriptor(Node.prototype,"parentNode");if(pnDesc&&typeof pnDesc.get==="function"){var origGet=pnDesc.get;Object.defineProperty(Node.prototype,"parentNode",{configurable:true,enumerable:pnDesc.enumerable,get:function(){var p=origGet.call(this);if(p===null&&this.nodeType===1&&this.tagName&&HOISTABLE.test(this.tagName))return GHOST;return p},set:pnDesc.set})}var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c&&c.parentNode!==this){if(c.parentNode&&c.parentNode!==GHOST){return c.parentNode.removeChild(c)}return c}return r.apply(this,arguments)};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this){return this.appendChild(n)}return i.apply(this,arguments)}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${lausanne.variable} ${moderat.variable} ${sfMono.variable} ${rockSalt.variable}`}
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
        <Analytics />
      </body>
    </html>
  );
}
