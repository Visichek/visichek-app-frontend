"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  useTutorialProgress,
  type UseTutorialProgress,
} from "./use-tutorial-progress";

/**
 * Lightweight spotlight overlay used for the visitor tutorial
 * (Issue 7).
 *
 * Design choices:
 *   - Each step targets a stable DOM anchor via
 *     `[data-tutorial-anchor="..."]`, NOT a CSS selector or text
 *     match. Pages tag the anchor; the spotlight never depends on
 *     class names that could rename.
 *   - When the anchor isn't on the page (e.g., the user navigated
 *     away mid-tutorial) the step renders without a highlight cutout
 *     so the user still sees the step copy and can continue or
 *     dismiss.
 *   - Progress is persisted via `useTutorialProgress` after every
 *     step, so a navigation away + return resumes at the right step
 *     (when the caller opts in).
 *   - prefers-reduced-motion is respected by skipping the entry
 *     animation; the overlay layout is otherwise the same.
 *
 * The component renders to `document.body` via a portal so it sits
 * above the app shell, dropdowns, and modals.
 */

export interface TutorialStep {
  /** Stable id stored in `completedSteps`. */
  id: string;
  /** `data-tutorial-anchor` value to highlight. Optional. */
  anchor?: string;
  title: string;
  body: ReactNode;
  /**
   * Optional callback fired when the user finishes this step. Use
   * for side effects like opening a panel before the next step.
   */
  onAdvance?: () => void;
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getAnchorRect(anchor: string | undefined): AnchorRect | null {
  if (!anchor || typeof window === "undefined") return null;
  const el = document.querySelector<HTMLElement>(
    `[data-tutorial-anchor="${anchor}"]`,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top + window.scrollY,
    left: r.left + window.scrollX,
    width: r.width,
    height: r.height,
  };
}

interface TutorialSpotlightProps {
  steps: TutorialStep[];
  /** Current step index. Caller owns the state. */
  stepIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** True when on the final step — relabels "Next" → "Finish". */
  isFinal: boolean;
}

/**
 * Visual overlay only. State management (progress, persistence,
 * resume) belongs to the caller via `useTutorialProgress`.
 */
export function TutorialSpotlight({
  steps,
  stepIndex,
  onPrev,
  onNext,
  onClose,
  isFinal,
}: TutorialSpotlightProps) {
  const step = steps[stepIndex];
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
  }, []);

  // Re-measure on step change, scroll, and resize so the cutout
  // follows the anchor when the page reflows.
  useEffect(() => {
    if (!mounted) return;
    function measure() {
      setRect(getAnchorRect(step?.anchor));
    }
    measure();
    const t = window.setTimeout(measure, 50); // catch late layout
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [mounted, step?.anchor, stepIndex]);

  // Keyboard: ← / →, Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" && stepIndex > 0) {
        e.preventDefault();
        onPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev, stepIndex]);

  if (!mounted || !step) return null;

  // Card position: place near the anchor when we have one, fall back
  // to centered when we don't.
  const cardStyle = rect
    ? cardStyleNearRect(rect)
    : ({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      } as const);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      className="fixed inset-0 z-[60]"
    >
      {/* Backdrop. SVG mask cuts a rounded rect out of the dim layer
          when an anchor is visible so the highlighted UI shows
          through. */}
      <Backdrop rect={rect} />

      <div
        style={cardStyle}
        className={cn(
          "absolute max-w-sm w-[min(92vw,22rem)] rounded-xl border bg-popover text-popover-foreground p-4 shadow-2xl",
          !reducedMotion.current && "animate-in fade-in zoom-in-95",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h3 className="text-sm font-semibold mt-1">{step.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close tutorial"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {step.body}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={stepIndex === 0}
            className="h-8"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              step.onAdvance?.();
              onNext();
            }}
            className="h-8"
          >
            {isFinal ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Finish
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function cardStyleNearRect(rect: AnchorRect): React.CSSProperties {
  const PAD = 12;
  const cardWidth = 360; // matches max-w above
  const cardHeight = 200; // approximate
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;

  // Prefer below the anchor; fall back to above if there's not
  // enough room.
  let top = rect.top + rect.height + PAD;
  if (top + cardHeight > window.scrollY + viewportHeight) {
    top = Math.max(rect.top - cardHeight - PAD, window.scrollY + PAD);
  }
  let left = rect.left;
  if (left + cardWidth > window.scrollX + viewportWidth) {
    left = window.scrollX + viewportWidth - cardWidth - PAD;
  }
  if (left < window.scrollX + PAD) left = window.scrollX + PAD;

  return { position: "absolute", top, left };
}

function Backdrop({ rect }: { rect: AnchorRect | null }) {
  // SVG-based mask gives us a precise cutout. When no anchor, we
  // just render a uniformly dimmed layer.
  if (!rect) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/60"
        style={{ position: "absolute" }}
      />
    );
  }

  const RADIUS = 8;
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full pointer-events-none"
      style={{ position: "absolute" }}
    >
      <defs>
        <mask id="tutorial-cutout">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - 8 - (typeof window !== "undefined" ? window.scrollX : 0)}
            y={rect.top - 8 - (typeof window !== "undefined" ? window.scrollY : 0)}
            width={rect.width + 16}
            height={rect.height + 16}
            rx={RADIUS}
            ry={RADIUS}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgb(0 0 0 / 0.55)"
        mask="url(#tutorial-cutout)"
      />
    </svg>
  );
}

// ── Container that owns the state and pairs the overlay with progress ──
//
// Most callers should use `<TutorialRunner>` rather than mounting
// `<TutorialSpotlight>` directly. The runner wires
// `useTutorialProgress` to the spotlight so step navigation is
// persisted automatically and the tutorial only appears when the user
// explicitly starts it.

export interface TutorialRunnerProps {
  /** Stable tutorial id (e.g. "visitor_workflow"). */
  name: string;
  /** Bump when the step list changes meaningfully. */
  version?: number;
  steps: TutorialStep[];
  /** Caller controls visibility — true only after a "Start" click. */
  open: boolean;
  /** Called when the runner closes (Esc, X, or after Finish). */
  onClose: () => void;
}

export function TutorialRunner({
  name,
  version = 1,
  steps,
  open,
  onClose,
}: TutorialRunnerProps) {
  const progress = useTutorialProgress(name, version);
  const [stepIndex, setStepIndex] = useState(0);

  // Reset the step index when the runner is opened so a "Start"
  // click always begins at step 0. The user-preferences hook
  // already carries the long-term progress; resuming from the last
  // visited step is a follow-up that we can add by reading
  // `progress.lastStep` here.
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // Mark "started" on first open so progress.status flips to
  // "in_progress" and the entry-point button can switch copy from
  // "Start" to "Resume".
  useEffect(() => {
    if (open && steps[0]) progress.start(steps[0].id);
    // intentionally fire-once per open transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onNext = useCallback(() => {
    const current = steps[stepIndex];
    if (current) progress.advance(current.id);
    if (stepIndex === steps.length - 1) {
      progress.complete();
      onClose();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [progress, steps, stepIndex, onClose]);

  const onPrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleClose = useCallback(() => {
    progress.dismiss();
    onClose();
  }, [progress, onClose]);

  const isFinal = useMemo(
    () => stepIndex === steps.length - 1,
    [stepIndex, steps.length],
  );

  if (!open) return null;
  return (
    <TutorialSpotlight
      steps={steps}
      stepIndex={stepIndex}
      onPrev={onPrev}
      onNext={onNext}
      onClose={handleClose}
      isFinal={isFinal}
    />
  );
}

// Convenience re-export so call sites can grab everything from one
// module.
export { useTutorialProgress } from "./use-tutorial-progress";
export type {
  TutorialState,
  TutorialStatus,
  UseTutorialProgress,
} from "./use-tutorial-progress";
