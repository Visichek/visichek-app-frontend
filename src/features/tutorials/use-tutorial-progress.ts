"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { TutorialStatus, TutorialType } from "@/types/tutorial";
import {
  useTutorials,
  useUpdateTutorialProgress,
} from "./hooks/use-tutorials";

/**
 * Tutorial progress hook.
 *
 * Progress is persisted server-side via `PUT /v1/tutorials`, keyed by
 * `(tutorialType, version)` — the same identity the engine's
 * `tutorial.<name>.v<version>` key has always carried. The backend
 * derives the owning user from the auth token; we only send the type,
 * status, and version.
 *
 * Coarse `status` (idle / in_progress / completed / dismissed) is what
 * persists. Step-level detail (`lastStep` / `completedSteps`) is tracked
 * locally for the current session only — the backend deliberately stores
 * just the lifecycle status, not per-step progress.
 *
 * Per product: the tutorial MUST NOT auto-launch. Callers should read
 * `status` and only mount the spotlight UI when the user explicitly
 * starts it.
 */

export type { TutorialStatus } from "@/types/tutorial";

export interface UseTutorialProgress {
  /** Coarse status — used to decide which UI button to render. */
  status: TutorialStatus;
  /** Most recently visited step id this session, if any. */
  lastStep: string | null;
  /** Step ids visited this session. */
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
  /** True while we're still waiting for progress to hydrate. */
  isLoading: boolean;
  /** True while a status write is in flight. */
  isSaving: boolean;
}

export function useTutorialProgress(
  name: TutorialType,
  version: number = 1,
): UseTutorialProgress {
  const { data: records, isLoading } = useTutorials();
  const update = useUpdateTutorialProgress();

  // Step-level state is session-local; the backend stores coarse status.
  const [lastStep, setLastStep] = useState<string | null>(null);
  const [steps, setSteps] = useState<Set<string>>(() => new Set());

  const status: TutorialStatus = useMemo(() => {
    const record = (records ?? []).find(
      (r) => r.tutorialType === name && r.version === version,
    );
    return record?.tutorialStatus ?? "idle";
  }, [records, name, version]);

  const write = useCallback(
    (tutorialStatus: TutorialStatus) => {
      update.mutate(
        { tutorialType: name, tutorialStatus, version },
        {
          onError: () => {
            // Shell-gating (403) or a transient failure shouldn't break
            // the in-page experience — surface it, keep the UI usable.
            toast.error("Couldn't save tutorial progress. Please try again.");
          },
        },
      );
    },
    [name, version, update],
  );

  const start = useCallback(
    (firstStep: string) => {
      setLastStep(firstStep);
      setSteps(new Set());
      write("in_progress");
    },
    [write],
  );

  const advance = useCallback((stepId: string) => {
    setLastStep(stepId);
    setSteps((prev) => {
      if (prev.has(stepId)) return prev;
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);

  const complete = useCallback(() => write("completed"), [write]);
  const dismiss = useCallback(() => write("dismissed"), [write]);

  const reset = useCallback(() => {
    setLastStep(null);
    setSteps(new Set());
    write("idle");
  }, [write]);

  return {
    status,
    lastStep,
    completedSteps: steps,
    start,
    advance,
    complete,
    dismiss,
    reset,
    isLoading,
    isSaving: update.isPending,
  };
}
