import type { SessionType } from "@/types/auth";
import type { SystemUserRole } from "@/types/enums";

/**
 * Non-sensitive UI hint about the user's last-known login state.
 *
 * Why this exists: auth tokens live in `httpOnly` cookies that JS can't
 * read, so on cold load the client has no synchronous way to know "am I
 * probably logged in?" — that's only answered after `bootstrapSession()`
 * resolves, which can take ~500ms+. During that window auth-fork pages
 * (`/`, `/admin/login`, `/app/login`) would otherwise render their UI
 * and a logged-in user sees the login form flash before being redirected.
 *
 * The hint stores ONLY the session type and role — never tokens, never
 * personally identifying data. It exists purely so Providers can decide
 * whether to show a spinner or the public UI on first paint.
 *
 * Stale hints are harmless: bootstrap still runs, and if `/me` (and the
 * one refresh attempt) fail, Redux is cleared, the subscription clears
 * the hint, and the gate releases to show the login form.
 */

const STORAGE_KEY = "visichek-auth-hint";

// Self-expire so a hint left behind by a closed laptop a month ago doesn't
// keep gating the login page forever after the cookie has expired server
// side. The cookie itself is the authority — this is just optimistic UI.
const HINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthHint {
  sessionType: SessionType;
  role?: SystemUserRole;
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readAuthHint(): AuthHint | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthHint> | null;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      (parsed.sessionType !== "admin" && parsed.sessionType !== "system_user")
    ) {
      // Malformed — drop it so we don't keep tripping over it.
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.savedAt > HINT_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      sessionType: parsed.sessionType,
      role: parsed.role,
      savedAt: parsed.savedAt,
    };
  } catch {
    // Private mode / storage disabled / quota — treat as no hint.
    return null;
  }
}

export function writeAuthHint(hint: Omit<AuthHint, "savedAt">): void {
  if (!isBrowser()) return;
  try {
    const payload: AuthHint = { ...hint, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort — a missing hint just means a brief flash on next load.
  }
}

export function clearAuthHint(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
