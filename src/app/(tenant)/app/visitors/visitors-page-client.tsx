"use client";

import { useMemo } from "react";
import Link from "next/link";
import { QrCode, Loader2, UserMinus, Settings2 } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/recipes/page-header";
import { Button } from "@/components/ui/button";
import {
  usePendingApprovals,
  useTenantCheckins,
} from "@/features/checkins/hooks";
import { useAwaitingCheckout } from "@/features/visitors/hooks/use-visitors";
import { useSession } from "@/hooks/use-session";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import type { CheckinOut, CheckinState } from "@/types/checkin";
import type { AwaitingCheckoutItem } from "@/types/visitor";
import { GroupedVisitorsList } from "@/features/visitors/components/grouped-visitors-list";
import { PendingApprovalsQueue } from "@/features/visitors/components/pending-approvals-queue";

type VisitorsTabState = Extract<
  CheckinState,
  "pending_approval" | "approved" | "rejected" | "checked_out"
>;

interface TabDef {
  id: VisitorsTabState;
  href: string;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  tooltip: string;
}

const TABS: readonly TabDef[] = [
  {
    id: "pending_approval",
    href: "/app/visitors/pending",
    label: "Pending",
    emptyTitle: "No pending check-ins",
    emptyDescription: "New submissions appear here automatically.",
    tooltip: "Check-ins awaiting your review",
  },
  {
    id: "approved",
    href: "/app/visitors/approved",
    label: "Approved",
    emptyTitle: "No approved check-ins yet",
    emptyDescription:
      "Once you approve a pending check-in it will show up here.",
    tooltip: "Visitors you've let in",
  },
  {
    id: "rejected",
    href: "/app/visitors/rejected",
    label: "Rejected",
    emptyTitle: "No rejected check-ins",
    emptyDescription: "Rejected check-ins will show here with their reason.",
    tooltip: "Check-ins you've denied and why",
  },
  {
    id: "checked_out",
    href: "/app/visitors/checked-out",
    label: "Checked out",
    emptyTitle: "No checked-out visitors yet",
    emptyDescription: "Visitors appear here after their visit ends.",
    tooltip: "Visitors whose visit has ended",
  },
] as const;

interface VisitorsPageClientProps {
  activeState: VisitorsTabState;
}

export function VisitorsPageClient({ activeState }: VisitorsPageClientProps) {
  const { tenantId, currentRole } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const canConfigureForm = currentRole === "super_admin";
  const formBuilderHref = "/app/visitors/form-builder";

  // The Pending tab is backed by the unified `/pending-approvals` queue,
  // which merges kiosk check-ins AND scheduled appointments. The other
  // tabs still use the per-state checkins endpoint — only kiosk
  // check-ins have approved/rejected/checked_out states to surface.
  const pendingApprovalsQuery = usePendingApprovals(tenantId ?? undefined);
  const approvedQuery = useTenantCheckins(tenantId ?? undefined, {
    state: "approved",
  });
  const rejectedQuery = useTenantCheckins(tenantId ?? undefined, {
    state: "rejected",
  });
  const checkedOutQuery = useTenantCheckins(tenantId ?? undefined, {
    state: "checked_out",
  });

  const counts: Record<VisitorsTabState, number> = {
    pending_approval: pendingApprovalsQuery.data?.length ?? 0,
    approved: approvedQuery.data?.length ?? 0,
    rejected: rejectedQuery.data?.length ?? 0,
    checked_out: checkedOutQuery.data?.length ?? 0,
  };

  // Other-state tabs stay on CheckinOut rows; the Pending tab renders
  // its own component below.
  const queryByState: Record<
    Exclude<VisitorsTabState, "pending_approval">,
    { data?: CheckinOut[]; isLoading: boolean }
  > = {
    approved: approvedQuery,
    rejected: rejectedQuery,
    checked_out: checkedOutQuery,
  };

  const activeQuery =
    activeState === "pending_approval" ? null : queryByState[activeState];
  const activeData = activeQuery?.data ?? [];

  // Awaiting-checkout is the only endpoint that carries the badge QR
  // token for already-approved visitors. The map is only consumed on the
  // Approved tab; the query is shared cache so the 5s poll is paid once.
  const awaitingCheckoutQuery = useAwaitingCheckout();
  const printableByCheckinId = useMemo(() => {
    const map = new Map<string, AwaitingCheckoutItem>();
    for (const item of awaitingCheckoutQuery.data ?? []) {
      if (item.sourceType !== "approved_checkin") continue;
      if (!item.badgeQrToken) continue;
      map.set(item.checkoutId, item);
    }
    return map;
  }, [awaitingCheckoutQuery.data]);

  const activeTab = TABS.find((t) => t.id === activeState) ?? TABS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="Review pending check-ins, approve or reject visitors, and see past activity."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            {canConfigureForm && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    className="flex-1 sm:flex-none min-h-[44px]"
                  >
                    <Link
                      href={formBuilderHref}
                      onClick={() => handleNavClick(formBuilderHref)}
                    >
                      {loadingHref === formBuilderHref ? (
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Settings2
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                      )}
                      Configure form
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Customise the fields visitors fill in when they check in,
                  including required information and consent
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 sm:flex-none min-h-[44px]"
                >
                  <Link
                    href="/app/visitors/checkout"
                    onClick={() => handleNavClick("/app/visitors/checkout")}
                  >
                    {loadingHref === "/app/visitors/checkout" ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <UserMinus
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                    Check out visitor
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Choose how to check a visitor out — by scanning their badge or
                picking them from the list
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 sm:flex-none min-h-[44px]"
                >
                  <Link
                    href="/app/visitors/qr"
                    onClick={() => handleNavClick("/app/visitors/qr")}
                  >
                    {loadingHref === "/app/visitors/qr" ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <QrCode
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                    Registration QR
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Generate a QR code visitors can scan to self-register from their
                phone
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <div
        className="flex gap-2 border-b overflow-x-auto"
        role="tablist"
        aria-label="Check-in states"
      >
        {TABS.map((tab) => {
          const isActive = activeState === tab.id;
          const isLoadingTab = loadingHref === tab.href;
          const count = counts[tab.id];
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                {/* Plain <a> — see app-sidebar for the rationale.
                    Combining a Radix Tooltip portal with a Next.js
                    client transition triggered by the same click was
                    racing the React 19 reconciler during the page-tree
                    swap and surfacing as `removeChild on null` deep in
                    react-dom's commit phase. A full-page navigation
                    sidesteps the portal cleanup entirely. */}
                <a
                  href={tab.href}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleNavClick(tab.href)}
                  className={cn(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors relative whitespace-nowrap inline-flex items-center gap-1.5 min-h-[44px]",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isLoadingTab && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-1 inline-flex items-center justify-center rounded-full text-xs font-semibold h-5 min-w-[20px] px-1.5",
                        tab.id === "pending_approval"
                          ? "bg-warning text-warning-foreground"
                          : isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                      aria-label={`${count} ${tab.label.toLowerCase()}`}
                    >
                      {count}
                    </span>
                  )}
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tab.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {activeState === "pending_approval" ? (
        <PendingApprovalsQueue tenantId={tenantId ?? undefined} />
      ) : (
        <GroupedVisitorsList
          checkins={activeData}
          emptyTitle={activeTab.emptyTitle}
          emptyDescription={activeTab.emptyDescription}
          badgeByCheckinId={
            activeState === "approved" ? printableByCheckinId : undefined
          }
        />
      )}
    </div>
  );
}
