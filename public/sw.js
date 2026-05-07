/* VisiChek service worker — runtime caching only.
 *
 * Strategy summary:
 *   - Next.js static build assets (/_next/static/*) → CacheFirst, long-lived
 *   - Google fonts / next-font CSS                  → StaleWhileRevalidate
 *   - Same-origin images & icons                    → StaleWhileRevalidate
 *   - HTML navigations                              → NetworkFirst, offline.html fallback
 *   - Everything else (incl. /v1/* API)             → not handled, goes straight to network
 *
 * IMPORTANT: API responses are never cached. Auth lives in httpOnly cookies and
 * tenant data must always be live. Caching API responses across logins would
 * leak data between users.
 */

importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js");

const VERSION = "v1";
const OFFLINE_URL = "/offline";

workbox.setConfig({ debug: false });
workbox.core.setCacheNameDetails({
  prefix: "visichek",
  suffix: VERSION,
});

// Take control of clients as soon as a new SW activates so users get fresh
// caching rules without a manual refresh.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(`visichek-offline-${VERSION}`)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch(() => {
        // Offline page may not exist yet during first install; the navigation
        // handler will retry on demand.
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Allow the page to ask the SW to activate immediately after an update.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const { registerRoute, setCatchHandler } = workbox.routing;
const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// ---------- Static build assets ----------
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
  new CacheFirst({
    cacheName: "visichek-next-static",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// ---------- Fonts (Google + next-font CSS) ----------
registerRoute(
  ({ url }) =>
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "visichek-google-fonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// ---------- Images ----------
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "visichek-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
      }),
    ],
  })
);

// ---------- Same-origin scripts & styles outside /_next/static ----------
registerRoute(
  ({ request, sameOrigin }) =>
    sameOrigin && (request.destination === "style" || request.destination === "script"),
  new StaleWhileRevalidate({
    cacheName: "visichek-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  })
);

// ---------- HTML navigations ----------
// NetworkFirst so users always get fresh pages when online; on failure we fall
// back to the offline shell. We deliberately scope this to navigation requests
// only — never API calls.
const navigationStrategy = new NetworkFirst({
  cacheName: "visichek-pages",
  networkTimeoutSeconds: 4,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({
      maxEntries: 30,
      maxAgeSeconds: 60 * 60 * 24, // 1 day
    }),
  ],
});

registerRoute(
  ({ request, url }) => {
    if (request.mode !== "navigate") return false;
    // Never intercept the API or auth endpoints.
    if (url.pathname.startsWith("/v1/")) return false;
    if (url.pathname.startsWith("/api/")) return false;
    return true;
  },
  navigationStrategy
);

// ---------- Offline fallback ----------
setCatchHandler(async ({ request }) => {
  if (request.destination === "document" || request.mode === "navigate") {
    const cache = await caches.open(`visichek-offline-${VERSION}`);
    const cached = await cache.match(OFFLINE_URL);
    if (cached) return cached;
  }
  return Response.error();
});
