"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, CircleSlash, RotateCcw, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { BulkActionsBar } from "@/components/recipes/bulk-actions-bar";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { useSession } from "@/hooks/use-session";
import type { TutorialStatus } from "@/types/tutorial";
import {
  TUTORIALS_BY_TYPE,
  groupByCategory,
  resolveTutorialsForSession,
  type TutorialDefinition,
} from "../lib/catalog";
import {
  useTutorials,
  useUpdateTutorialProgress,
  useTutorialStatusIndex,
} from "../hooks/use-tutorials";
import { TutorialRunner, type TutorialStep } from "../spotlight";
import { TutorialCard } from "./tutorial-card";

/**
 * The Tutorials hub — the central place where any user starts, resumes,
 * or replays the tutorials available to their role.
 *
 * The same component powers both shells: it reads the current session to
 * decide which tutorials to surface (platform-admin vs tenant role) and
 * persists each tutorial's lifecycle status server-side via
 * `PUT /v1/tutorials`. Each walkthrough runs inline as a centered
 * step-through (the spotlight falls back to a centered card when a step
 * has no on-page anchor).
 */
export function TutorialsHub() {
  const { sessionType, currentRole } = useSession();
  const { data: records, isLoading, isError, error, refetch } = useTutorials();
  const update = useUpdateTutorialProgress();

  const tutorials = useMemo(
    () => resolveTutorialsForSession(sessionType, currentRole),
    [sessionType, currentRole],
  );
  const groups = useMemo(() => groupByCategory(tutorials), [tutorials]);
  const statusIndex = useTutorialStatusIndex(records);

  // Multi-select keyed by tutorial type across every visible tutorial.
  const select = useMultiSelect(tutorials, (t) => t.type);

  // The currently-running walkthrough (null when nothing is open).
  const [active, setActive] = useState<TutorialDefinition | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const total = tutorials.length;
  const completed = tutorials.filter(
    (t) => statusIndex.statusFor(t.type, t.version) === "completed",
  ).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  /**
   * Fan a status write out across the current selection, aggregate the
   * results, and report partial failures rather than failing silently
   * (per the bulk-action UX rule).
   */
  async function applyBulkStatus(
    tutorialStatus: TutorialStatus,
    verbing: string,
  ) {
    const ids = select.selectedIds;
    if (ids.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      ids.map((type) => {
        const def = TUTORIALS_BY_TYPE[type as keyof typeof TUTORIALS_BY_TYPE];
        if (!def) return Promise.reject(new Error(`Unknown tutorial ${type}`));
        return update.mutateAsync({
          tutorialType: def.type,
          tutorialStatus,
          version: def.version,
        });
      }),
    );
    setBulkBusy(false);

    const failed = results.filter((r) => r.status === "rejected").length;
    select.clear();
    if (failed === 0) {
      toast.success(
        `${ids.length} tutorial${ids.length === 1 ? "" : "s"} ${verbing}.`,
      );
    } else {
      toast.error(
        `${ids.length - failed} of ${ids.length} ${verbing}; ${failed} failed. Try the failed ones again.`,
      );
    }
  }

  const runnerSteps: TutorialStep[] = active
    ? active.steps.map((s) => ({ id: s.id, title: s.title, body: s.body }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutorials"
        description="Step-by-step walkthroughs for the tools available to your role. Your progress is saved, so you can pause and pick up where you left off."
      />

      {/* Completion summary */}
      {total > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Your progress</p>
            <p className="text-sm text-muted-foreground">
              {completed} of {total} completed
            </p>
          </div>
          <Progress value={pct} className="mt-3" aria-label="Tutorials completed" />
        </div>
      )}

      <BulkActionsBar
        selectedCount={select.selectedCount}
        onClear={select.clear}
        itemNoun="tutorial"
        actions={[
          {
            label: "Mark completed",
            description:
              "Mark the selected tutorials as completed without running them",
            icon: <Check className="h-4 w-4" aria-hidden="true" />,
            isLoading: bulkBusy,
            onClick: () => void applyBulkStatus("completed", "marked completed"),
          },
          {
            label: "Skip",
            description:
              "Dismiss the selected tutorials so they no longer prompt you",
            icon: <CircleSlash className="h-4 w-4" aria-hidden="true" />,
            variant: "secondary",
            isLoading: bulkBusy,
            onClick: () => void applyBulkStatus("dismissed", "skipped"),
          },
          {
            label: "Reset progress",
            description:
              "Clear saved progress for the selected tutorials so they start fresh",
            icon: <RotateCcw className="h-4 w-4" aria-hidden="true" />,
            variant: "destructive",
            isLoading: bulkBusy,
            onClick: () => setResetOpen(true),
          },
        ]}
      />

      {total === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="No tutorials yet"
          description="There aren't any tutorials available for your role right now. Check back later."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.category} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {group.category}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.tutorials.map((def) => (
                  <TutorialCard
                    key={def.type}
                    definition={def}
                    status={statusIndex.statusFor(def.type, def.version)}
                    selected={select.isSelected(def.type)}
                    onToggleSelect={() => select.toggleOne(def.type)}
                    onStart={() => setActive(def)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Inline walkthrough overlay for the active tutorial. */}
      {active && (
        <TutorialRunner
          key={`${active.type}.v${active.version}`}
          name={active.type}
          version={active.version}
          steps={runnerSteps}
          open
          onClose={() => setActive(null)}
        />
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={`Reset ${select.selectedCount} tutorial${select.selectedCount === 1 ? "" : "s"}?`}
        description="Their saved progress will be cleared and they'll start fresh. This can't be undone."
        confirmLabel="Reset progress"
        isLoading={bulkBusy}
        onConfirm={() => {
          setResetOpen(false);
          void applyBulkStatus("idle", "reset");
        }}
      />
    </div>
  );
}
