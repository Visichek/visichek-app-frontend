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
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { TutorialType } from "@/types/tutorial";
import type { PreviewSpec } from "./lib/preview-types";
import { TutorialPreview } from "./components/tutorial-preview";
import { useTutorialProgress } from "./use-tutorial-progress";

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
   * Mock-page preview shown in slideshow mode so the user sees the
   * screen the step describes. Ignored in live mode (the real page is
   * the preview).
   */
  preview?: PreviewSpec;
  /**
   * Real page this step describes. When present in slideshow mode, the
   * step offers a "Try it live" jump that opens the actual page.
   */
  route?: string;
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
  /**
   * - `"slideshow"` (default): a centered card that shows the step's
   *   mock-page `preview` and (when the step has a `route`) a
   *   "Try it live" jump. Real on-page anchors are ignored.
   * - `"live"`: pins the card to the step's real `data-tutorial-anchor`
   *   with a cutout. No preview — the page underneath is the preview.
   */
  mode?: "slideshow" | "live";
  /**
   * Slideshow only — invoked when the user clicks "Try it live" on a
   * step that has a `route`. Receives the current step index so the
   * live tour can resume from here.
   */
  onTryLive?: (stepIndex: number) => void;
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
  mode = "slideshow",
  onTryLive,
}: TutorialSpotlightProps) {
  const step = steps[stepIndex];
  const isLive = mode === "live";
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [launching, setLaunching] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
  }, []);

  // Re-measure on step change, scroll, and resize so the cutout follows
  // the anchor when the page reflows. Only live mode tracks real anchors;
  // slideshow mode is always a centered "slide" that shows the preview.
  // After a live-mode navigation the anchor can mount a few frames late,
  // so we retry a handful of times until it appears.
  useEffect(() => {
    if (!mounted || !isLive) {
      setRect(null);
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    function measure() {
      if (cancelled) return;
      setRect(getAnchorRect(step?.anchor));
    }
    measure();
    // Catch late layout / post-navigation mounting — the destination
    // page (and its anchor) can take a moment to render after a jump.
    for (const delay of [50, 150, 350, 700, 1200, 2000, 3000]) {
      timers.push(window.setTimeout(measure, delay));
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [mounted, isLive, step?.anchor, stepIndex]);

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

  const showPreview = !isLive && !!step.preview;
  const canTryLive = !isLive && !!step.route && !!onTryLive;

  // Card position: pin near the anchor in live mode when we have a rect,
  // otherwise center it.
  const cardStyle =
    isLive && rect
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
          when an anchor is visible (live mode) so the highlighted UI
          shows through. */}
      <Backdrop rect={isLive ? rect : null} />

      <div
        style={cardStyle}
        className={cn(
          "absolute max-h-[90vh] overflow-y-auto rounded-xl border bg-popover text-popover-foreground p-4 shadow-2xl",
          showPreview
            ? "w-[min(94vw,30rem)] max-w-lg"
            : "w-[min(92vw,22rem)] max-w-sm",
          !reducedMotion.current && "animate-in fade-in zoom-in-95",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close tutorial"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mock-page preview (slideshow only). The page the step
            describes, rendered with the relevant region highlighted. */}
        {showPreview && step.preview && (
          <div className="mt-3">
            <TutorialPreview spec={step.preview} />
          </div>
        )}

        <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </div>

        {/* "Try it live" jump — opens the real page with the spotlight. */}
        {canTryLive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={launching}
            onClick={() => {
              setLaunching(true);
              onTryLive?.(stepIndex);
            }}
            className="mt-3 h-8 w-full gap-1.5"
          >
            {launching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {launching ? "Opening the page…" : "Try it live on the real page"}
          </Button>
        )}

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
  name: TutorialType;
  /** Bump when the step list changes meaningfully. */
  version?: number;
  steps: TutorialStep[];
  /** Caller controls visibility — true only after a "Start" click. */
  open: boolean;
  /** Called when the runner closes (Esc, X, or after Finish). */
  onClose: () => void;
  /**
   * Slideshow mode of the spotlight. Defaults to `"slideshow"`, which is
   * what the Tutorials hub mounts. The cross-page live tour does not use
   * the runner — it owns step state itself via the tour provider.
   */
  mode?: "slideshow" | "live";
  /**
   * Invoked when the user clicks "Try it live" on a step that has a
   * `route`. The caller should hand off to the live tour and let the
   * runner unmount (do NOT treat this as a dismissal).
   */
  onTryLive?: (stepIndex: number) => void;
}

export function TutorialRunner({
  name,
  version = 1,
  steps,
  open,
  onClose,
  mode = "slideshow",
  onTryLive,
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
      mode={mode}
      onTryLive={onTryLive}
    />
  );
}

// Convenience re-export so call sites can grab everything from one
// module.
export { useTutorialProgress } from "./use-tutorial-progress";
export type {
  TutorialStatus,
  UseTutorialProgress,
} from "./use-tutorial-progress";
