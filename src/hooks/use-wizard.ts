"use client";

import { useCallback, useMemo } from "react";
import { usePersistentState } from "./use-persistent-state";

/**
 * Generic multi-step wizard controller.
 *
 * Unlike `useStepForm` (in components/recipes/step-indicator), this is not
 * coupled to react-hook-form and supports non-linear navigation via
 * `resolveNext` / `resolvePrev` (e.g. the kiosk skips the Verify step when
 * KYC is unavailable; the appointment wizard skips the Details step when the
 * tenant published no fields).
 *
 * Per-step validation stays with the caller — `advance()` should only be
 * called once the current step passes its own gate.
 *
 * When `persist` is supplied, the `{ step, completed }` cursor is mirrored to
 * `localStorage` (via {@link usePersistentState}) so a refresh resumes where
 * the user left off. Without it, the wizard is pure in-memory state.
 */
export interface UseWizardOptions {
  /** Ordered step ids, e.g. [1, 2, 3, 4]. */
  steps: number[];
  /** First step to show. Defaults to `steps[0]`. */
  initialStep?: number;
  /** Override the next-step target (for skip logic). Falls back to the next id in `steps`. */
  resolveNext?: (current: number) => number;
  /** Override the previous-step target. Falls back to the previous id in `steps`. */
  resolvePrev?: (current: number) => number;
  /** Persist the cursor across refreshes. Omit for in-memory only. */
  persist?: { key: string; ttlMs?: number; version?: number };
}

interface WizardCursor {
  step: number;
  completed: number[];
}

export interface WizardController {
  step: number;
  completed: number[];
  /** Mark the current step complete and move to the next (respecting `resolveNext`). */
  advance: () => void;
  /** Move to the previous step (respecting `resolvePrev`). */
  retreat: () => void;
  /** Jump to an arbitrary step id. */
  goTo: (step: number) => void;
  /** Reset to the initial step, clear completed, and wipe any persisted cursor. */
  reset: () => void;
  isFirst: boolean;
  isLast: boolean;
  /** False until the persisted cursor (if any) has hydrated on the client. */
  hydrated: boolean;
}

export function useWizard(options: UseWizardOptions): WizardController {
  const { steps, resolveNext, resolvePrev, persist } = options;
  const initialStep = options.initialStep ?? steps[0] ?? 1;

  const [cursor, setCursor, controls] = usePersistentState<WizardCursor>(
    persist?.key ?? "",
    { step: initialStep, completed: [] },
    { ttlMs: persist?.ttlMs, version: persist?.version },
  );

  const { step, completed } = cursor;

  const indexOf = useCallback(
    (id: number) => steps.indexOf(id),
    [steps],
  );

  const advance = useCallback(() => {
    setCursor((prev) => {
      const next = resolveNext
        ? resolveNext(prev.step)
        : steps[Math.min(indexOf(prev.step) + 1, steps.length - 1)] ?? prev.step;
      const completedNext = prev.completed.includes(prev.step)
        ? prev.completed
        : [...prev.completed, prev.step];
      return { step: next, completed: completedNext };
    });
  }, [resolveNext, steps, indexOf, setCursor]);

  const retreat = useCallback(() => {
    setCursor((prev) => {
      const target = resolvePrev
        ? resolvePrev(prev.step)
        : steps[Math.max(indexOf(prev.step) - 1, 0)] ?? prev.step;
      return { ...prev, step: target };
    });
  }, [resolvePrev, steps, indexOf, setCursor]);

  const goTo = useCallback(
    (target: number) => {
      setCursor((prev) => ({ ...prev, step: target }));
    },
    [setCursor],
  );

  const reset = useCallback(() => {
    controls.clear();
    setCursor({ step: initialStep, completed: [] });
  }, [controls, setCursor, initialStep]);

  const isFirst = step === steps[0];
  const isLast = step === steps[steps.length - 1];

  return useMemo(
    () => ({
      step,
      completed,
      advance,
      retreat,
      goTo,
      reset,
      isFirst,
      isLast,
      hydrated: controls.hydrated,
    }),
    [step, completed, advance, retreat, goTo, reset, isFirst, isLast, controls.hydrated],
  );
}
