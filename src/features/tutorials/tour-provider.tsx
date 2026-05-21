"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useNavLoading } from "@/hooks/use-nav-loading";
import type { TutorialType } from "@/types/tutorial";
import { TUTORIALS_BY_TYPE } from "./lib/catalog";
import { TutorialSpotlight, type TutorialStep } from "./spotlight";
import { useTutorialProgress } from "./use-tutorial-progress";

/**
 * Global live-tour controller.
 *
 * The Tutorials hub runs each walkthrough as an in-page slideshow with
 * mock-page previews. When a step has a real `route`, the user can click
 * "Try it live" — this provider takes over: it navigates to the real page
 * and pins the spotlight to the actual UI (`data-tutorial-anchor`),
 * keeping the overlay mounted *across* page navigations as the tour
 * advances between routes.
 *
 * It is mounted once, high in the tree (inside `NavigationLoadingProvider`
 * so it can use the overlay-safe navigation helper, and above both
 * shells). It fetches nothing until a tour is active: all data hooks live
 * in `<LiveTourOverlay>`, which is only rendered while a tour runs — so an
 * idle provider costs nothing and never hits the API on public pages.
 */

interface ActiveTour {
  type: TutorialType;
  version: number;
  stepIndex: number;
}

interface TourContextValue {
  /** True while a live tour is running. */
  isActive: boolean;
  /**
   * Start (or jump into) a live tour for `type`, beginning at
   * `fromStepIndex` (default 0). Navigates to the step's page.
   */
  startLiveTour: (type: TutorialType, fromStepIndex?: number) => void;
  /** Stop the live tour and clear its overlay. */
  stopLiveTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = "visichek:tutorial-live-tour";

/** Survives a hard reload mid-tour (SPA nav keeps it in memory anyway). */
function persist(tour: ActiveTour | null): void {
  if (typeof window === "undefined") return;
  try {
    if (tour) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tour));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Private mode / quota — the in-memory state still drives the tour.
  }
}

function hydrate(): ActiveTour | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveTour>;
    if (
      typeof parsed?.type === "string" &&
      typeof parsed?.version === "number" &&
      typeof parsed?.stepIndex === "number" &&
      TUTORIALS_BY_TYPE[parsed.type as TutorialType]
    ) {
      return {
        type: parsed.type as TutorialType,
        version: parsed.version,
        stepIndex: parsed.stepIndex,
      };
    }
  } catch {
    // Corrupt payload — ignore and start clean.
  }
  return null;
}

export function TutorialTourProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<ActiveTour | null>(null);

  // Resume an in-flight tour after a hard reload.
  useEffect(() => {
    const resumed = hydrate();
    if (resumed) setTour(resumed);
  }, []);

  const startLiveTour = useCallback(
    (type: TutorialType, fromStepIndex = 0) => {
      const def = TUTORIALS_BY_TYPE[type];
      if (!def) return;
      const stepIndex = Math.min(
        Math.max(0, fromStepIndex),
        def.steps.length - 1,
      );
      const next: ActiveTour = { type, version: def.version, stepIndex };
      setTour(next);
      persist(next);
    },
    [],
  );

  const stopLiveTour = useCallback(() => {
    setTour(null);
    persist(null);
  }, []);

  const setStepIndex = useCallback((stepIndex: number) => {
    setTour((prev) => {
      if (!prev) return prev;
      const next = { ...prev, stepIndex };
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({ isActive: tour !== null, startLiveTour, stopLiveTour }),
    [tour, startLiveTour, stopLiveTour],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && (
        <LiveTourOverlay
          key={`${tour.type}.v${tour.version}`}
          tour={tour}
          onStepIndexChange={setStepIndex}
          onClose={stopLiveTour}
        />
      )}
    </TourContext.Provider>
  );
}

/** Access the live-tour controller. Must be under `TutorialTourProvider`. */
export function useTutorialTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error(
      "useTutorialTour must be used within a <TutorialTourProvider>",
    );
  }
  return ctx;
}

// ── Overlay (only mounted while a tour is active) ───────────────────────

function samePath(pathname: string, route: string): boolean {
  const a = pathname.replace(/\/$/, "") || "/";
  const b = route.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return a === b;
}

function LiveTourOverlay({
  tour,
  onStepIndexChange,
  onClose,
}: {
  tour: ActiveTour;
  onStepIndexChange: (stepIndex: number) => void;
  onClose: () => void;
}) {
  const def = TUTORIALS_BY_TYPE[tour.type];
  const pathname = usePathname() ?? "";
  const { navigateFromOverlay } = useNavLoading();
  const progress = useTutorialProgress(tour.type, tour.version);

  const steps = useMemo<TutorialStep[]>(
    () =>
      def.steps.map((s) => ({
        id: s.id,
        anchor: s.anchor,
        title: s.title,
        body: s.body,
        route: s.route,
      })),
    [def],
  );

  const step = steps[tour.stepIndex];
  const targetRoute = step?.route;

  // Mark the tutorial started once when the live tour mounts. (If the
  // user arrived via the slideshow's "Try it live", it's already
  // in_progress; calling start again is idempotent.)
  useEffect(() => {
    if (step) progress.start(step.id);
    // fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate to the step's page whenever the current step lives somewhere
  // other than where we are. Uses the overlay-safe push so the page-tree
  // swap doesn't race a portal teardown.
  useEffect(() => {
    if (targetRoute && !samePath(pathname, targetRoute)) {
      navigateFromOverlay(targetRoute);
    }
  }, [targetRoute, pathname, navigateFromOverlay]);

  const onNext = useCallback(() => {
    const current = steps[tour.stepIndex];
    if (current) progress.advance(current.id);
    if (tour.stepIndex >= steps.length - 1) {
      progress.complete();
      onClose();
      return;
    }
    onStepIndexChange(tour.stepIndex + 1);
  }, [steps, tour.stepIndex, progress, onStepIndexChange, onClose]);

  const onPrev = useCallback(() => {
    onStepIndexChange(Math.max(0, tour.stepIndex - 1));
  }, [tour.stepIndex, onStepIndexChange]);

  const handleClose = useCallback(() => {
    progress.dismiss();
    onClose();
  }, [progress, onClose]);

  if (!step) return null;

  return (
    <TutorialSpotlight
      steps={steps}
      stepIndex={tour.stepIndex}
      onPrev={onPrev}
      onNext={onNext}
      onClose={handleClose}
      isFinal={tour.stepIndex === steps.length - 1}
      mode="live"
    />
  );
}
