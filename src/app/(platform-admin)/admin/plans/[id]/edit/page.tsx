"use client";

import { use } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { NavButton } from "@/components/recipes/nav-button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { usePlan } from "@/features/plans/hooks/use-plans";
import { PlanEditForm } from "@/features/plans/components/plan-edit-form";

export default function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = usePlan(id);

  if (isError || (!isLoading && !data)) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton href="/admin/plans" variant="ghost" size="sm" className="min-h-[44px]">
                {loadingHref === "/admin/plans" ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to plans
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Return to the plans list
            </TooltipContent>
          </Tooltip>
          <ErrorState
            title="Couldn't load this plan"
            message="It may have been deleted, or your connection dropped."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PlanEditForm plan={data} />
    </div>
  );
}
