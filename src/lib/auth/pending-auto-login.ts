/**
 * Bridge record that lets the /reset-password page log a user in
 * automatically right after they set a new password.
 *
 * Why this exists: the reset page is opened from an emailed link and only
 * carries an opaque `token` in the URL — it has no idea *who* is resetting
 * or which login endpoint to call. The forgot-password flow, however, knows
 * exactly which account the user picked. When the user selects a SINGLE
 * account, we stash the minimum routing info here so the reset page can
 * finish the login without asking the user to type their email again.
 *
 * What is stored: ONLY the account email and which shell it belongs to
 * (`platform` vs `tenant`). The password is NEVER written here — it is typed
 * fresh on the reset page and lives in component state for the one render it
 * is needed, exactly like the project's "no secrets in localStorage" rule
 * requires. The email is non-secret routing data, mirroring the existing
 * `auth-hint` pattern.
 *
 * The record is single-use: the reset page clears it the moment it attempts
 * the auto-login, success or fail. A short TTL covers the case where the
 * forgot-password flow was abandoned and the stale record would otherwise
 * sit around.
 */

const STORAGE_KEY = "visichek-pending-auto-login";

// Reset links live ~1 hour; give a little buffer so a record saved at the
// start of the flow is still valid when the email link is opened, then
// self-expire so an abandoned flow doesn't leave a record behind.
const TTL_MS = 2 * 60 * 60 * 1000;

export type AutoLoginAccountType = "platform" | "tenant";

export interface PendingAutoLogin {
  email: string;
  type: AutoLoginAccountType;
  savedAt: number;
}

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

/**
 * Persist the single-account auto-login hint. Call this only when the user
 * picked exactly one account in the forgot-password flow.
 */
export function savePendingAutoLogin(
  hint: Omit<PendingAutoLogin, "savedAt">,
): void {
  if (!isBrowser()) return;
  try {
    const payload: PendingAutoLogin = { ...hint, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota / disabled storage — auto-login just won't fire
    // and the user falls back to signing in manually. Not worth surfacing.
  }
}

/**
 * Read the auto-login hint, dropping it if it is malformed or expired.
 * Returns null when there is nothing usable (the common cross-device case,
 * where the reset link is opened in a browser that never ran the lookup).
 */
export function readPendingAutoLogin(): PendingAutoLogin | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingAutoLogin> | null;
    if (
      !parsed ||
      typeof parsed.email !== "string" ||
      typeof parsed.savedAt !== "number" ||
      (parsed.type !== "platform" && parsed.type !== "tenant")
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return { email: parsed.email, type: parsed.type, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

/**
 * Delete the auto-login hint. The reset page calls this the instant it
 * attempts the login (the record is single-use), and the forgot-password
 * flow calls it when the user picks more than one account.
 */
export function clearPendingAutoLogin(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
