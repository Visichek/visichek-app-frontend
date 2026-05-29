"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  AlarmClock,
  ArrowLeft,
  Clock,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { NavButton } from "@/components/recipes/nav-button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import {
  useAdminDSRApproachingSla,
  useAdminDSRBreachedSla,
} from "@/features/dsr/hooks/use-admin-dsr";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import type { AdminDataSubjectRequest } from "@/types/dpo";
import type { DSRStatus } from "@/types/enums";

type SlaMode = "breached" | "approaching";

function statusVariant(status: DSRStatus) {
  switch (status) {
    case "pending":
      return "warning" as const;
    case "in_progress":
      return "info" as const;
    case "completed":
      return "success" as const;
    case "rejected":
      return "destructive" as const;
  }
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function AdminDSRSlaWatchPage() {
  const { loadingHref } = useNavigationLoading();

  const breached = useAdminDSRBreachedSla();
  const approaching = useAdminDSRApproachingSla();

  const breachedItems = breached.data ?? [];
  const approachingItems = approaching.data ?? [];

  if (breached.isError || approaching.isError) {
    return (
      <ErrorState
        title="Couldn't load SLA watch"
        onRetry={() => {
          breached.refetch();
          approaching.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href="/admin/dsr" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/admin/dsr" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to DSRs
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the full data subject request list
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="DSR SLA watch"
        description="Open DSRs whose legal deadline has passed or lands in the next 24 hours."
      />

      <section className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-semibold">
              {breachedItems.length} request{breachedItems.length === 1 ? "" : "s"} past deadline
            </p>
            <p className="text-muted-foreground">
              The tenant has missed the legal SLA window. Platform admins cannot
              process DSRs on the tenant&apos;s behalf — escalate by opening a
              support case against the affected tenant or by contacting their DPO
              directly.
            </p>
          </div>
        </div>

        <SlaTable
          data={breachedItems}
          isLoading={breached.isLoading}
          emptyTitle="No breached DSRs"
          emptyDescription="Every open DSR is still inside its SLA window."
          mode="breached"
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlarmClock
            className="mt-0.5 h-5 w-5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-semibold">
              {approachingItems.length} request{approachingItems.length === 1 ? "" : "s"} due in 24h
            </p>
            <p className="text-muted-foreground">
              Auto-refreshes every minute. Use these to nudge the tenant&apos;s DPO
              before the legal window closes.
            </p>
          </div>
        </div>

        <SlaTable
          data={approachingItems}
          isLoading={approaching.isLoading}
          emptyTitle="No DSRs approaching SLA"
          emptyDescription="Nothing is within 24 hours of its deadline. The queue is healthy."
          mode="approaching"
        />
      </section>
    </div>
  );
}

function SlaTable({
  data,
  isLoading,
  emptyTitle,
  emptyDescription,
  mode,
}: {
  data: AdminDataSubjectRequest[];
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  mode: SlaMode;
}) {
  const columns: ColumnDef<AdminDataSubjectRequest>[] = [
    {
      accessorKey: "requestType",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-sm capitalize">
          {row.original.requestType.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "tenantId",
      header: "Tenant",
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs text-muted-foreground">
              {truncateId(row.original.tenantId)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <span className="font-mono text-xs">{row.original.tenantId}</span>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {row.original.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "slaDeadline",
      header: mode === "breached" ? "Overdue by" : "Time left",
      cell: ({ row }) => (
        <SlaCell deadline={row.original.slaDeadline} mode={mode} />
      ),
    },
    {
      accessorKey: "dateCreated",
      header: "Received",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.receivedAt ?? row.original.dateCreated)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      pagination={false}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      getRowId={(d) => d.id}
      getRowHref={(d) => `/admin/dsr/${d.id}`}
      rowClickAriaLabel={(d) => `View DSR ${d.requestType} from tenant ${d.tenantId}`}
      mobileCard={(dsr) => (
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium capitalize">
                {dsr.requestType.replace(/_/g, " ")}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {truncateId(dsr.tenantId)}
              </p>
            </div>
            <Badge variant={statusVariant(dsr.status)}>
              {dsr.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <SlaCell deadline={dsr.slaDeadline} mode={mode} />
          <p className="text-xs text-muted-foreground">
            Received {formatRelative(dsr.receivedAt ?? dsr.dateCreated)}
          </p>
        </div>
      )}
    />
  );
}

function SlaCell({
  deadline,
  mode,
}: {
  deadline?: number;
  mode: SlaMode;
}) {
  if (!deadline) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = deadline - now;
  const hoursLeft = Math.floor(Math.abs(secondsLeft) / 3600);
  const className =
    mode === "breached"
      ? "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
      : "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          <Clock className="h-3 w-3" aria-hidden="true" />
          {mode === "breached"
            ? hoursLeft < 24
              ? `${hoursLeft}h ago`
              : `${Math.floor(hoursLeft / 24)}d ago`
            : hoursLeft < 1
              ? "< 1h"
              : `${hoursLeft}h left`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        SLA deadline {formatRelative(deadline)}
      </TooltipContent>
    </Tooltip>
  );
}
