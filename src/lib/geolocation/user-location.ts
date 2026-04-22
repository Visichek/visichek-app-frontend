/**
 * Browser geolocation cache for the `X-User-Location` header.
 *
 * The backend treats every authenticated request that ships this header
 * as a "presence beacon" — it piggybacks a fire-and-forget write into
 * Redis with a 10-minute TTL so the geofencing service can answer
 * "which approvers are currently on-site?" without a dedicated endpoint.
 *
 * Design:
 *   - Reads are cached in-memory for 60s so we don't hammer
 *     `navigator.geolocation` on every API call. The backend TTL (10 min)
 *     is much wider, so 1 min is a safe sweet spot between accuracy and
 *     battery use.
 *   - Reads are *never* awaited inline — the interceptor always returns
 *     the most recent cached sample. A background refresh runs if the
 *     cache is stale. The very first request misses the cache and goes
 *     out without the header; the second call after the permission grant
 *     picks it up. This matches the contract ("missing header = no
 *     recent location") — a missing header is not an error.
 *   - Permission denial is sticky: once `getCurrentPosition` rejects with
 *     PERMISSION_DENIED we stop retrying until the page is reloaded. We
 *     must NOT spam the browser prompt.
 *   - SSR safe: all accesses are guarded by `typeof window`.
 */

interface CachedLocation {
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: number;
}

const CACHE_TTL_MS = 60_000;

let cached: CachedLocation | null = null;
let inflight: Promise<CachedLocation | null> | null = null;
let permissionDenied = false;
let disabled = false;

/**
 * Fire-and-forget refresh. Never throws. Marks `permissionDenied` so
 * subsequent calls bail out immediately until the page reloads.
 */
function refresh(): Promise<CachedLocation | null> {
  if (inflight) return inflight;
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return Promise.resolve(null);
  }
  if (disabled || permissionDenied) {
    return Promise.resolve(cached);
  }
  if (!navigator.geolocation) {
    disabled = true;
    return Promise.resolve(null);
  }

  inflight = new Promise<CachedLocation | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cached = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM:
            typeof pos.coords.accuracy === "number"
              ? Math.round(pos.coords.accuracy)
              : null,
          capturedAt: Date.now(),
        };
        resolve(cached);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          permissionDenied = true;
        }
        // For POSITION_UNAVAILABLE / TIMEOUT we keep whatever the last
        // good sample was; the 10-min Redis TTL on the server side will
        // eventually drop the stale presence if we really can't recover.
        resolve(cached);
      },
      {
        enableHighAccuracy: false,
        maximumAge: CACHE_TTL_MS,
        timeout: 5_000,
      }
    );
  }).finally(() => {
    inflight = null;
  });

  return inflight;
}

/**
 * Returns the most recent cached `<lat>,<lng>[,<accuracy>]` header value,
 * or `null` if nothing has ever been captured. Triggers a background
 * refresh if the cache has expired — the caller does NOT await it.
 *
 * Used by the axios request interceptor; a missing header is interpreted
 * by the backend as "no recent location" and is always valid.
 */
export function peekUserLocationHeader(): string | null {
  if (typeof window === "undefined") return null;
  if (disabled) return null;

  const now = Date.now();
  if (!cached || now - cached.capturedAt > CACHE_TTL_MS) {
    // Background refresh — swallow errors, don't block the caller.
    refresh().catch(() => {});
  }

  if (!cached) return null;

  const parts = [cached.lat.toFixed(6), cached.lng.toFixed(6)];
  if (typeof cached.accuracyM === "number") {
    parts.push(String(cached.accuracyM));
  }
  return parts.join(",");
}

/**
 * Await a fresh location sample. Used by the public kiosk flow, which
 * must attach `visitor_lat` / `visitor_lng` to the submit payload before
 * calling `/public/.../submit`. Returns `null` if the browser denies or
 * cannot satisfy the request.
 */
export async function requestUserLocation(): Promise<CachedLocation | null> {
  if (typeof window === "undefined") return null;
  if (disabled) return null;

  // If we have a recent sample, hand it back without re-prompting.
  if (cached && Date.now() - cached.capturedAt <= CACHE_TTL_MS) {
    return cached;
  }
  return refresh();
}

/**
 * Clears the cache. Call after logout to avoid leaking a coordinate
 * through to a different principal's session on the same tab.
 */
export function clearUserLocation(): void {
  cached = null;
  inflight = null;
  permissionDenied = false;
}

/**
 * Disable geolocation entirely for the rest of the page lifetime. Useful
 * for shells that must never capture staff location (e.g. platform-admin).
 */
export function disableUserLocation(): void {
  disabled = true;
  cached = null;
}

export function isUserLocationPermissionDenied(): boolean {
  return permissionDenied;
}
