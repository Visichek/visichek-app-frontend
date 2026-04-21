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
import { useIncident } from "@/features/incidents/hooks/use-incidents";
import { IncidentForm } from "@/features/incidents/components/incident-form";

export default function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = useIncident(id);

  if (isError || (!isLoading && !data)) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/incidents"
                onClick={() => handleNavClick("/app/incidents")}
              >
                {loadingHref === "/app/incidents" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to incidents
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the incidents list
          </TooltipContent>
        </Tooltip>
        <ErrorState
          title="Couldn't load this incident"
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
        <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return <IncidentForm incident={data} />;
}
