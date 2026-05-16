/**
 * Visitor / staff tutorials (Issue 7).
 *
 * Public surface:
 *   - `TutorialRunner` — drop-in overlay that owns step state and
 *     persists progress to user preferences.
 *   - `TutorialSpotlight` — lower-level renderer for callers that
 *     need to own step state themselves (rare).
 *   - `useTutorialProgress` — read/write tutorial state from the
 *     backend preferences store.
 *
 * Per the PDF: nothing in this module auto-launches. Pages must
 * mount the runner with `open={true}` only after a user click on
 * the entry-point button.
 */

export {
  TutorialRunner,
  TutorialSpotlight,
  type TutorialStep,
  type TutorialRunnerProps,
} from "./spotlight";

export { useTutorialProgress } from "./use-tutorial-progress";
export type {
  TutorialState,
  TutorialStatus,
  UseTutorialProgress,
} from "./use-tutorial-progress";
