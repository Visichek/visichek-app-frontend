/* VisiChek service worker — runtime caching only.
 *
 * Strategy summary:
 *   - Next.js static build assets (/_next/static/*) → CacheFirst, long-lived
 *   - Google fonts / next-font CSS                  → StaleWhileRevalidate
 *   - Same-origin images & icons                    → StaleWhileRevalidate
 *   - Public HTML navigations                       → NetworkFirst, /offline fallback
 *   - Everything else (incl. /v1/* API)             → not handled, goes straight to network
 *
 * IMPORTANT: API responses are never cached. Auth lives in httpOnly cookies and
 * tenant data must always be live. Caching protected pages or API responses
 * across logins would leak data between users.
 */

importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js");

const VERSION = "v2";
const OFFLINE_URL = "/offline";
const PUBLIC_NAVIGATION_PREFIXES = [
  "/admin/login",
  "/app/login",
  "/app/scan",
  "/app/select-tenant",
  "/register",
  "/checkout",
  "/rights",
  "/support",
  "/offline",
];

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
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.includes("visichek-pages"))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to ask the SW to activate immediately after an update.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const { registerRoute, setCatchHandler } = workbox.routing;
const { CacheFirst, StaleWhileRevalidate, NetworkFirst, NetworkOnly } =
  workbox.strategies;
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
  networkTimeoutSeconds: 8,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({
      maxEntries: 30,
      maxAgeSeconds: 60 * 60 * 24, // 1 day
    }),
  ],
});

function isNextRouterRequest(request, url) {
  const accept = request.headers.get("accept") || "";

  return (
    url.searchParams.has("_rsc") ||
    request.headers.get("rsc") === "1" ||
    request.headers.has("next-router-prefetch") ||
    request.headers.has("next-router-state-tree") ||
    accept.includes("text/x-component")
  );
}

function isPublicNavigationPath(pathname) {
  if (pathname === "/") return true;
  return PUBLIC_NAVIGATION_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// App Router client transitions fetch RSC payloads. Never cache or fall back
// those requests; stale RSC responses can leave the URL changed while the new
// tenant page tree never commits.
registerRoute(
  ({ request, url, sameOrigin }) =>
    sameOrigin && isNextRouterRequest(request, url),
  new NetworkOnly()
);

registerRoute(
  ({ request, url }) => {
    if (request.mode !== "navigate") return false;
    // Never intercept the API or auth endpoints.
    if (url.pathname.startsWith("/v1/")) return false;
    if (url.pathname.startsWith("/api/")) return false;
    // Protected shells depend on fresh httpOnly-cookie auth and tenant state.
    // Let the browser/Next handle them directly instead of serving cached HTML.
    return isPublicNavigationPath(url.pathname);
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
