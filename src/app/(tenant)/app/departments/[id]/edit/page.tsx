"use client";

import { use } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useDepartment } from "@/features/departments/hooks/use-departments";
import { DepartmentForm } from "@/features/departments/components/department-form";

export default function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = useDepartment(id);

  if (isError || (!isLoading && !data)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href="/app/departments" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/app/departments" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to departments
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the departments list
          </TooltipContent>
        </Tooltip>
        <ErrorState
          title="Couldn't load this department"
          message="It may have been deleted, or your connection dropped."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return <DepartmentForm department={data} />;
}
