/**
 * Tutorials feature.
 *
 * Public surface:
 *   - `TutorialRunner` — drop-in overlay that owns step state and
 *     persists progress to the server (`PUT /v1/tutorials`).
 *   - `TutorialSpotlight` — lower-level renderer for callers that need
 *     to own step state themselves (rare).
 *   - `useTutorialProgress` — read/write a single tutorial's status.
 *   - `useTutorials` / `useUpdateTutorialProgress` — the raw list query
 *     and upsert mutation behind the Tutorials hub.
 *   - `TutorialsHub` — the per-shell Tutorials page body.
 *   - catalog helpers — the static tutorial definitions + role/shell
 *     resolution used to decide which entry-points to show.
 *
 * Per product: nothing here auto-launches. Pages mount the runner with
 * `open={true}` only after a user click on the entry-point button.
 */

export {
  TutorialRunner,
  TutorialSpotlight,
  type TutorialStep,
  type TutorialRunnerProps,
} from "./spotlight";

export { useTutorialProgress } from "./use-tutorial-progress";
export type {
  TutorialStatus,
  UseTutorialProgress,
} from "./use-tutorial-progress";

export {
  useTutorials,
  useUpdateTutorialProgress,
  useTutorialStatusIndex,
  type TutorialStatusIndex,
} from "./hooks/use-tutorials";

export { tutorialKeys } from "./lib/query-keys";

export {
  TUTORIALS,
  TUTORIALS_BY_TYPE,
  resolveTutorialsForSession,
  groupByCategory,
  type TutorialDefinition,
  type TutorialShell,
  type TutorialStepContent,
} from "./lib/catalog";

export { TutorialsHub } from "./components/tutorials-hub";
