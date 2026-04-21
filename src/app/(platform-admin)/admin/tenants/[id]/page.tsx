"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useTenant } from "@/features/auth/hooks/use-admin-dashboard";
import { TenantDetailView } from "@/features/auth/components/tenant-detail-view";

const LIST_HREF = "/admin/tenants";

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = useTenant(id);

  if (isError || (!isLoading && !data)) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="min-h-[44px] -ml-2"
              >
                <Link
                  href={LIST_HREF}
                  onClick={() => handleNavClick(LIST_HREF)}
                >
                  {loadingHref === LIST_HREF ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Back to tenants
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Return to the tenants list
            </TooltipContent>
          </Tooltip>
          <ErrorState
            title="Couldn't load this tenant"
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
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
          <div className="h-16 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <TenantDetailView tenant={data} />
    </div>
  );
}
