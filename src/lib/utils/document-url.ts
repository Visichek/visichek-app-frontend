/**
 * Resolve a backend-issued document/asset path into a fully qualified URL
 * that points at the API backend — not the frontend origin.
 *
 * The backend returns paths like `/v1/documents/local/<key>.png` in branding,
 * visitor profiles, badges, etc. If those are handed straight to an `<img>`,
 * the browser resolves them against the current page origin (the frontend
 * domain) and 404s. This helper forces them onto the API origin.
 *
 * Behavior:
 *  - Full `http(s)://...` URLs → returned as-is
 *  - Leading-slash paths (`/v1/documents/...`) → joined to the API origin
 *    (scheme + host only, without the API_BASE_URL's own path segment)
 *  - Bare relative paths (`documents/xyz.png`) → joined to the API base
 *  - `data:` / `blob:` URLs → returned as-is
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.visichek.app/v1";

function apiOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "https://api.visichek.app";
  }
}

export function resolveDocumentUrl(
  path?: string | null
): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${apiOrigin()}${trimmed}`;
  }

  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return `${apiOrigin()}/${trimmed}`;
  }
}
