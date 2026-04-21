"use client";

import {
  useState,
  useMemo,
  useTransition,
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

interface TabDef {
  id: CheckinState;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
}

const TABS: readonly TabDef[] = [
  {
    id: "pending_approval",
    label: "Pending approval",
    emptyTitle: "No pending check-ins",
    emptyDescription: "New submissions appear here automatically.",
  },
  {
    id: "approved",
    label: "Approved",
    emptyTitle: "No approved check-ins yet",
    emptyDescription:
      "Once you approve a pending check-in it will show up here.",
  },
  {
    id: "rejected",
    label: "Rejected",
    emptyTitle: "No rejected check-ins",
    emptyDescription: "Rejected check-ins will show here with their reason.",
  },
  {
    id: "checked_out",
    label: "Checked out",
    emptyTitle: "No checked-out visitors yet",
    emptyDescription: "Visitors appear here after their visit ends.",
  },
] as const;

function confirmHref(id: string, action: "approve" | "reject") {
  return `/app/visitors/${id}/confirm?action=${action}`;
}

function detailHref(id: string) {
  return `/app/visitors/${id}`;
}

export function VisitorsPageClient() {
  const { tenantId } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [activeTab, setActiveTab] = useState<CheckinState>("pending_approval");
  const [switchingTo, setSwitchingTo] = useState<CheckinState | null>(null);
  const [isPending, startTransition] = useTransition();

  function switchTab(next: CheckinState) {
    if (next === activeTab) return;
    setSwitchingTo(next);
    startTransition(() => {
      setActiveTab(next);
      setSwitchingTo(null);
    });
  }

  const { data: checkins = [], isLoading } = useTenantCheckins(
    tenantId ?? undefined,
    { state: activeTab },
  );

  const { data: pendingForCount = [] } = useTenantCheckins(
    tenantId ?? undefined,
    { state: "pending_approval" },
  );
  const pendingCount = pendingForCount.length;

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
                Record a visitor&apos;s departure by scanning their badge or
                entering their session ID
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
          const isActive = activeTab === tab.id;
          const isSpinning = isPending && switchingTo === tab.id;
          const showPendingCount =
            tab.id === "pending_approval" && pendingCount > 0;
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchTab(tab.id)}
                  className={cn(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors relative whitespace-nowrap inline-flex items-center gap-1.5 min-h-[44px]",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isSpinning && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {tab.label}
                  {showPendingCount && (
                    <span
                      className="ml-1 inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-semibold h-5 min-w-[20px] px-1.5"
                      aria-label={`${pendingCount} pending`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {tab.id === "pending_approval"
                  ? "Check-ins awaiting your review"
                  : tab.id === "approved"
                    ? "Visitors you've let in"
                    : tab.id === "rejected"
                      ? "Check-ins you've denied and why"
                      : "Visitors whose visit has ended"}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {TABS.map((tab) => {
        if (tab.id !== activeTab) return null;
        return (
          <DataTable
            key={tab.id}
            columns={columns}
            data={checkins}
            isLoading={isLoading}
            searchKey="visitorName"
            searchPlaceholder="Search by visitor name..."
            pagination
            pageSize={10}
            mobileCard={mobileCard}
            emptyTitle={tab.emptyTitle}
            emptyDescription={tab.emptyDescription}
          />
        );
      })}

    </div>
  );
}
