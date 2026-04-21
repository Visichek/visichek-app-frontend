"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useDataSubjectRequest } from "@/features/dsr/hooks/use-dsr";
import { DSRForm } from "@/features/dsr/components/dsr-form";

export default function EditDSRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = useDataSubjectRequest(id);

  if (isError || (!isLoading && !data)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/dpo"
                onClick={() => handleNavClick("/app/dpo")}
              >
                {loadingHref === "/app/dpo" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to data protection
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the data protection workspace
          </TooltipContent>
        </Tooltip>
        <ErrorState
          title="Couldn't load this request"
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
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return <DSRForm dsr={data} />;
}
