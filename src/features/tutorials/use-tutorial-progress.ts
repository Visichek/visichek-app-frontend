"use client";

import { useCallback, useMemo } from "react";
import {
  useUserPreferences,
  useUpdateUserPreference,
} from "@/features/settings/hooks";

/**
 * Tutorial progress hook (Issue 7).
 *
 * Each tutorial is identified by a stable key + version pair so a
 * redesigned tutorial in the future can intentionally reset progress
 * for everyone (bump the version, leave the key) without invalidating
 * unrelated tutorials. The value is persisted to the existing
 * user-preferences endpoint — no new backend route needed.
 *
 * Preference key scheme:
 *   `tutorial.<name>.v<version>`
 *
 * Stored value shape (kept narrow on purpose so we can extend later):
 *   {
 *     startedAt?: number;       // unix seconds
 *     lastStep?: string;        // most recent step id
 *     completedSteps?: string[];
 *     completedAt?: number;
 *     dismissedAt?: number;
 *   }
 *
 * Per the PDF: the tutorial MUST NOT auto-launch. Callers should
 * read `status` and only mount the spotlight UI when the user
 * explicitly starts it.
 */

export interface TutorialState {
  startedAt?: number;
  lastStep?: string;
  completedSteps?: string[];
  completedAt?: number;
  dismissedAt?: number;
}

export type TutorialStatus =
  | "idle" // user has never started this tutorial
  | "in_progress"
  | "completed"
  | "dismissed";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isTutorialState(value: unknown): value is TutorialState {
  return !!value && typeof value === "object";
}

export interface UseTutorialProgress {
  /** Coarse status — used to decide which UI button to render. */
  status: TutorialStatus;
  /** Most recently completed step id, if any. */
  lastStep: string | null;
  /** Full set of completed step ids. */
  completedSteps: Set<string>;
  /** Mark the tutorial as started — pass the first step id. */
  start: (firstStep: string) => void;
  /** Advance through a step (call as the user moves through). */
  advance: (stepId: string) => void;
  /** Mark the tutorial as fully completed. */
  complete: () => void;
  /** User clicked "skip" / "dismiss" — record it. */
  dismiss: () => void;
  /** Reset everything for this tutorial (used by "Restart tutorial"). */
  reset: () => void;
  /** True while we're still waiting for preferences to hydrate. */
  isLoading: boolean;
}

export function useTutorialProgress(
  name: string,
  version: number = 1,
): UseTutorialProgress {
  const key = `tutorial.${name}.v${version}`;
  const { data: prefs, isLoading } = useUserPreferences();
  const update = useUpdateUserPreference();

  const state = useMemo<TutorialState>(() => {
    const value = (prefs ?? {})[key];
    return isTutorialState(value) ? value : {};
  }, [prefs, key]);

  const completedSteps = useMemo(
    () => new Set(state.completedSteps ?? []),
    [state.completedSteps],
  );

  const status: TutorialStatus = useMemo(() => {
    if (state.completedAt) return "completed";
    if (state.dismissedAt) return "dismissed";
    if (state.startedAt) return "in_progress";
    return "idle";
  }, [state]);

  const write = useCallback(
    (next: TutorialState) => {
      update.mutate({ key, value: next });
    },
    [key, update],
  );

  const start = useCallback(
    (firstStep: string) => {
      // Reset prior completion/dismissal — a fresh "Start" is the user
      // explicitly asking to restart.
      write({
        startedAt: nowSeconds(),
        lastStep: firstStep,
        completedSteps: [],
      });
    },
    [write],
  );

  const advance = useCallback(
    (stepId: string) => {
      const previous = state.completedSteps ?? [];
      const completed = previous.includes(stepId)
        ? previous
        : [...previous, stepId];
      write({
        ...state,
        startedAt: state.startedAt ?? nowSeconds(),
        lastStep: stepId,
        completedSteps: completed,
      });
    },
    [state, write],
  );

  const complete = useCallback(() => {
    write({
      ...state,
      completedAt: nowSeconds(),
    });
  }, [state, write]);

  const dismiss = useCallback(() => {
    write({
      ...state,
      dismissedAt: nowSeconds(),
    });
  }, [state, write]);

  const reset = useCallback(() => {
    write({});
  }, [write]);

  return {
    status,
    lastStep: state.lastStep ?? null,
    completedSteps,
    start,
    advance,
    complete,
    dismiss,
    reset,
    isLoading,
  };
}
