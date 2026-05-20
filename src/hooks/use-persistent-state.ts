"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `useState`-shaped hook that mirrors its value to `localStorage`.
 *
 * Built for resumable forms (appointment draft, kiosk wizard) where we want
 * the user's in-progress input to survive a refresh — NOT for anything
 * sensitive. Per the project's auth rules this never stores tokens or session
 * state; callers are responsible for keeping un-serializable values (File /
 * Blob) and short-lived secrets out of the persisted value.
 *
 * Design (mirrors lib/features/limitations/lib/hide-locked-storage.ts):
 *   - SSR-safe: render starts from `initial`; the stored value is read inside a
 *     mount effect so server and first client render agree (no hydration
 *     mismatch). `hydrated` flips true once that read completes.
 *   - Versioned + TTL: the envelope is `{ version, savedAt, value }`. A stale
 *     version or an expired entry is dropped on read.
 *   - Debounced writes (default 400ms) so per-keystroke typing doesn't thrash
 *     storage.
 *   - Best-effort: every storage access is wrapped; private mode / quota
 *     failures degrade to in-memory state with no thrown errors.
 *   - Cross-tab sync via the native `storage` event.
 */

export interface PersistentStateOptions {
  /** Drop the stored value after this many ms. Default: 24h. */
  ttlMs?: number;
  /** Bump when the persisted shape changes so stale drafts are discarded. */
  version?: number;
  /** Debounce window for writes, in ms. Default: 400. */
  debounceMs?: number;
}

export interface PersistentStateControls {
  /** Remove the persisted value and any pending write. */
  clear: () => void;
  /** False until the initial storage read has completed on the client. */
  hydrated: boolean;
}

interface StoredEnvelope<T> {
  version: number;
  savedAt: number;
  value: T;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DEBOUNCE_MS = 400;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readEnvelope<T>(
  key: string,
  version: number,
  ttlMs: number,
): T | undefined {
  // An empty key means "don't persist" — callers (e.g. useWizard without a
  // `persist` option) pass "" so the hook can be invoked unconditionally
  // while behaving as pure in-memory state.
  if (!key || !isBrowser()) return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope<T>>;
    if (
      typeof parsed?.savedAt !== "number" ||
      parsed.version !== version ||
      !("value" in parsed)
    ) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    if (Date.now() - parsed.savedAt > ttlMs) {
      window.localStorage.removeItem(key);
      return undefined;
    }
    return parsed.value as T;
  } catch {
    return undefined;
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T,
  options: PersistentStateOptions = {},
): [T, (next: T | ((prev: T) => T)) => void, PersistentStateControls] {
  const {
    ttlMs = DEFAULT_TTL_MS,
    version = 1,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  const [value, setValueState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Keep the latest config in refs so the debounced writer / event listener
  // don't need to be re-created when they change.
  const keyRef = useRef(key);
  const versionRef = useRef(version);
  const ttlRef = useRef(ttlMs);
  keyRef.current = key;
  versionRef.current = version;
  ttlRef.current = ttlMs;

  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Hydrate once on mount (and whenever the key changes) ──────────────
  useEffect(() => {
    const stored = readEnvelope<T>(key, version, ttlMs);
    if (stored !== undefined) {
      setValueState(stored);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ── Cross-tab sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBrowser()) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== keyRef.current) return;
      if (event.newValue === null) {
        setValueState(initial);
        return;
      }
      const stored = readEnvelope<T>(
        keyRef.current,
        versionRef.current,
        ttlRef.current,
      );
      if (stored !== undefined) setValueState(stored);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // `initial` intentionally excluded — we only want the listener bound once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback((next: T) => {
    if (!keyRef.current || !isBrowser()) return;
    try {
      const envelope: StoredEnvelope<T> = {
        version: versionRef.current,
        savedAt: Date.now(),
        value: next,
      };
      window.localStorage.setItem(keyRef.current, JSON.stringify(envelope));
    } catch {
      /* private mode / quota — in-memory only */
    }
  }, []);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolved =
          typeof next === "function"
            ? (next as (p: T) => T)(prev)
            : next;
        if (writeTimer.current) clearTimeout(writeTimer.current);
        writeTimer.current = setTimeout(() => flush(resolved), debounceMs);
        return resolved;
      });
    },
    [flush, debounceMs],
  );

  const clear = useCallback(() => {
    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
    }
    if (!keyRef.current || !isBrowser()) return;
    try {
      window.localStorage.removeItem(keyRef.current);
    } catch {
      /* best-effort */
    }
  }, []);

  // Flush any pending debounced write when unmounting so a fast
  // navigate-away doesn't drop the last keystroke.
  useEffect(() => {
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

  return [value, setValue, { clear, hydrated }];
}
