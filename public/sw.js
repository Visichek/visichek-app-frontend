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

const VERSION = "v4";
const OFFLINE_URL = "/offline";
// Bundled assets that the app needs the first time it boots offline: the
// fallback shell, app icons referenced by the manifest, and the platform
// logo used by the sidebar when a tenant has not uploaded one. Anything
// here is fetched on `install` so a first-launch-offline still paints.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/visichek_logo.svg",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];
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

// ── Install ─────────────────────────────────────────────────────────
// Prefetch the offline shell + bundled icons/logo so first-launch-offline
// has something to paint. `cache: "reload"` skips the HTTP cache so we
// don't pick up a stale prior copy from a previous SW generation.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(`visichek-precache-${VERSION}`);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            // Best-effort: a missing asset must not block install or the
            // SW will retry forever and the page will never get a fresh
            // controller.
          }
        }),
      );
    })(),
  );
  self.skipWaiting();
});

// Turn on Navigation Preload as early as possible. The browser then starts
// fetching the navigated-to URL in parallel with SW startup, and Workbox's
// strategies consume that response via `event.preloadResponse` instead of
// issuing a second `fetch`. Typical savings: 100–300 ms on cold navigations.
if (workbox.navigationPreload && workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// ── Activate ────────────────────────────────────────────────────────
// On every version bump, drop the previous page/precache caches so we
// never serve a Next.js HTML shell that points at chunks that no longer
// exist. Static `_next/static/*` content-addressed assets are kept; they
// time out via the ExpirationPlugin.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => {
            // Sweep page/precache caches from older SW versions but keep
            // the current ones and the immutable build-asset cache.
            const isStalePages =
              name.includes("visichek-pages") && !name.endsWith(VERSION);
            const isStalePrecache =
              name.includes("visichek-precache-") &&
              !name.endsWith(VERSION);
            const isStaleOffline =
              name.includes("visichek-offline-") &&
              !name.endsWith(VERSION);
            return isStalePages || isStalePrecache || isStaleOffline;
          })
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

// Allow the page to ask the SW to activate immediately after an update.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Web Push ────────────────────────────────────────────────────────
// Backend (Web Push / VAPID) delivers a JSON payload built server-side:
//   { title, body, url, id, type }
// The payload is already plain (no snake/camel conversion) — read keys
// as-is. `url` is the deep-link the notification points at, e.g.
// "/app/visitors/{id}". `id` is the notification id; we use it as the
// `tag` so the OS collapses repeat pushes for the same notification.
self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      // Some providers send a bare string body with no JSON envelope.
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "VisiChek";
  const options = {
    body: payload.body || "",
    // Bundled app icon (referenced by the manifest); always present.
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Carry the deep-link + id through to the click handler.
    data: { url: payload.url || "/", id: payload.id, type: payload.type },
    // Collapse repeat pushes for the same notification id.
    tag: payload.id || undefined,
    // Re-alert when a same-tag push arrives with new info.
    renotify: payload.id ? true : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an already-open VisiChek tab and route it to the deep-link; open
// a fresh window only when no client is available. `client.navigate`
// keeps the user's existing SPA session/cookies instead of cold-loading.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        // Prefer a window already on our origin so we don't spawn duplicates.
        if ("focus" in client) {
          try {
            if ("navigate" in client && typeof client.navigate === "function") {
              await client.navigate(targetUrl);
            }
          } catch {
            // navigate() can reject cross-origin / mid-unload — focus anyway.
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })(),
  );
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
// NetworkFirst so users always get fresh pages when online; on failure we
// fall back to the offline shell. Workbox's NetworkFirst automatically
// honors `event.preloadResponse` when Navigation Preload is enabled, so
// the preloaded response (kicked off by the browser before the SW even
// woke up) is what gets returned — no duplicate fetch.
const navigationStrategy = new NetworkFirst({
  cacheName: `visichek-pages-${VERSION}`,
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
// The precache (populated on install) is the source of truth for the
// offline shell. We also fall back to the older `visichek-offline-*`
// cache name for one version so users mid-upgrade don't see a blank
// page during the activate sweep.
setCatchHandler(async ({ request }) => {
  if (request.destination === "document" || request.mode === "navigate") {
    const precache = await caches.open(`visichek-precache-${VERSION}`);
    const cached = await precache.match(OFFLINE_URL);
    if (cached) return cached;
  }
  return Response.error();
});
