"use client";

import {
  useMemo,
  type ReactNode,
} from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import {
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  QrCode,
  Loader2,
  ShieldCheck,
  UserMinus,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckinStateBadge } from "@/features/checkins";
import { useTenantCheckins } from "@/features/checkins/hooks";
import { useSession } from "@/hooks/use-session";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime } from "@/lib/utils/format-date";
import type { CheckinOut, CheckinState } from "@/types/checkin";
import { GroupedVisitorsList } from "@/features/visitors/components/grouped-visitors-list";

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

function confirmHref(id: string, action: "approve" | "reject") {
  return `/app/visitors/${id}/confirm?action=${action}`;
}

function detailHref(id: string) {
  return `/app/visitors/${id}`;
}

interface VisitorsPageClientProps {
  activeState: VisitorsTabState;
}

export function VisitorsPageClient({ activeState }: VisitorsPageClientProps) {
  const { tenantId } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const pendingQuery = useTenantCheckins(tenantId ?? undefined, {
    state: "pending_approval",
  });
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
    pending_approval: pendingQuery.data?.length ?? 0,
    approved: approvedQuery.data?.length ?? 0,
    rejected: rejectedQuery.data?.length ?? 0,
    checked_out: checkedOutQuery.data?.length ?? 0,
  };

  const queryByState: Record<
    VisitorsTabState,
    { data?: CheckinOut[]; isLoading: boolean }
  > = {
    pending_approval: pendingQuery,
    approved: approvedQuery,
    rejected: rejectedQuery,
    checked_out: checkedOutQuery,
  };

  const activeQuery = queryByState[activeState];
  const activeData = activeQuery.data ?? [];
  const isLoading = activeQuery.isLoading;

  const visitorName = (row: CheckinOut) =>
    row.visitor?.fullName || "Unnamed visitor";

  const columns: ColumnDef<CheckinOut>[] = useMemo(
    () => [
      {
        accessorKey: "visitor.fullName",
        id: "visitorName",
        header: "Visitor",
        cell: ({ row }) => (
          <div className="flex items-center gap-3 min-w-0">
            {row.original.visitor?.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.original.visitor.portraitUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover border"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-full bg-muted"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">
                {visitorName(row.original)}
              </p>
              {row.original.visitor?.email && (
                <p className="text-xs text-muted-foreground truncate">
                  {row.original.visitor.email}
                </p>
              )}
            </div>
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "purpose.purpose",
        id: "purpose",
        header: "Purpose",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.purpose.purpose}</span>
        ),
      },
      {
        accessorKey: "verified",
        id: "verified",
        header: "ID",
        cell: ({ row }) =>
          row.original.verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not verified</span>
          ),
      },
      {
        accessorKey: "dateCreated",
        id: "dateCreated",
        header: "Submitted",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDateTime(row.original.dateCreated)}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "state",
        id: "state",
        header: "Status",
        cell: ({ row }) => <CheckinStateBadge state={row.original.state} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const isPendingRow = row.original.state === "pending_approval";
          const approveHref = confirmHref(row.original.id, "approve");
          const rejectHref = confirmHref(row.original.id, "reject");
          const viewHref = detailHref(row.original.id);
          return (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 min-h-[44px] md:min-h-0"
                      aria-label="Row actions"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Open actions for this check-in
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    href={viewHref}
                    onClick={() => handleNavClick(viewHref)}
                    className="flex items-center"
                  >
                    {loadingHref === viewHref ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    View details
                  </Link>
                </DropdownMenuItem>
                {isPendingRow && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href={approveHref}
                        onClick={() => handleNavClick(approveHref)}
                        className="flex items-center"
                      >
                        {loadingHref === approveHref ? (
                          <Loader2
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCircle2
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                          />
                        )}
                        Approve
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={rejectHref}
                        onClick={() => handleNavClick(rejectHref)}
                        className="flex items-center text-destructive"
                      >
                        {loadingHref === rejectHref ? (
                          <Loader2
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                          />
                        )}
                        Reject
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [handleNavClick, loadingHref],
  );

  const mobileCard = (checkin: CheckinOut): ReactNode => {
    const isPendingRow = checkin.state === "pending_approval";
    const approveHref = confirmHref(checkin.id, "approve");
    const rejectHref = confirmHref(checkin.id, "reject");
    const viewHref = detailHref(checkin.id);
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-3">
            {checkin.visitor?.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={checkin.visitor.portraitUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover border"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-full bg-muted"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {visitorName(checkin)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {checkin.purpose.purpose}
              </p>
            </div>
          </div>
          <CheckinStateBadge state={checkin.state} />
        </div>
        <div className="text-xs text-muted-foreground">
          Submitted {formatDateTime(checkin.dateCreated)}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="min-h-[44px]"
              >
                <Link
                  href={viewHref}
                  onClick={() => handleNavClick(viewHref)}
                >
                  {loadingHref === viewHref ? (
                    <Loader2
                      className="mr-1 h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Details
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Open the full details for this check-in
            </TooltipContent>
          </Tooltip>
          {isPendingRow && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    asChild
                    className="flex-1 min-h-[44px]"
                  >
                    <Link
                      href={approveHref}
                      onClick={() => handleNavClick(approveHref)}
                    >
                      {loadingHref === approveHref ? (
                        <Loader2
                          className="mr-1 h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2
                          className="mr-1 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )}
                      Approve
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Let this visitor in and issue a badge
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    asChild
                    className="min-h-[44px]"
                  >
                    <Link
                      href={rejectHref}
                      onClick={() => handleNavClick(rejectHref)}
                    >
                      {loadingHref === rejectHref ? (
                        <Loader2
                          className="mr-1 h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <XCircle
                          className="mr-1 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      )}
                      Reject
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Deny this visitor entry and notify their host
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    );
  };

  const activeTab = TABS.find((t) => t.id === activeState) ?? TABS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitors"
        description="Review pending check-ins, approve or reject visitors, and see past activity."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
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
        <DataTable
          columns={columns}
          data={activeData}
          isLoading={isLoading}
          searchKey="visitorName"
          searchPlaceholder="Search by visitor name..."
          pagination
          pageSize={10}
          mobileCard={mobileCard}
          emptyTitle={activeTab.emptyTitle}
          emptyDescription={activeTab.emptyDescription}
        />
      ) : (
        <GroupedVisitorsList
          checkins={activeData}
          emptyTitle={activeTab.emptyTitle}
          emptyDescription={activeTab.emptyDescription}
        />
      )}
    </div>
  );
}
