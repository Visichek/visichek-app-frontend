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
import { useHost } from "@/features/hosts/hooks/use-hosts";
import { HostForm } from "@/features/hosts/components/host-form";

export default function EditHostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = useHost(id);

  if (isError || (!isLoading && !data)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton
              href="/app/hosts"
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
            >
              {loadingHref === "/app/hosts" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to hosts
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">Return to the hosts list</TooltipContent>
        </Tooltip>
        <ErrorState
          title="Couldn't load this host"
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

  return <HostForm host={data} />;
}
