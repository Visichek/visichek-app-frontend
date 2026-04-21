"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, ArrowLeft, Clock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useApproachingSla } from "@/features/support-cases/hooks/use-admin-support-cases";
import {
  CaseStatusBadge,
  CasePriorityBadge,
  SupportTierBadge,
} from "@/features/support-cases/components";
import { formatRelative } from "@/lib/utils/format-date";
import type { SupportCase } from "@/types/support-case";

export default function AdminSlaWatchPage() {
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const { data, isLoading, isError, refetch } = useApproachingSla();
  const cases = data?.data ?? [];

  const columns: ColumnDef<SupportCase>[] = [
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => {
        const id = row.original.id ?? row.original._id ?? "";
        const href = `/admin/support-cases/${id}`;
        const isLoadingRow = loadingHref === href;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={href}
                onClick={() => handleNavClick(href)}
                className="inline-flex items-center gap-2 font-medium text-sm hover:underline"
              >
                {isLoadingRow && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                )}
                <span className="line-clamp-1">{row.original.subject}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">
              Open this case to review the thread and act before the SLA deadline
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "tenantId",
      header: "Tenant",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {truncateId(row.original.tenantId)}
        </span>
      ),
    },
    {
      accessorKey: "supportTier",
      header: "Tier",
      cell: ({ row }) =>
        row.original.supportTier ? (
          <SupportTierBadge tier={row.original.supportTier} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <CasePriorityBadge priority={row.original.priority} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <CaseStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "slaDueAt",
      header: "SLA due",
      cell: ({ row }) => <SlaCountdown slaDueAt={row.original.slaDueAt} />,
      enableSorting: true,
    },
  ];

  const mobileCard = (c: SupportCase) => {
    const id = c.id ?? c._id ?? "";
    const href = `/admin/support-cases/${id}`;
    const isLoadingRow = loadingHref === href;
    return (
      <Link
        href={href}
        onClick={() => handleNavClick(href)}
        className="block rounded-lg border p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              {isLoadingRow && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              {c.subject}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {truncateId(c.tenantId)}
            </p>
          </div>
          <CaseStatusBadge status={c.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CasePriorityBadge priority={c.priority} />
          {c.supportTier && <SupportTierBadge tier={c.supportTier} />}
          <SlaCountdown slaDueAt={c.slaDueAt} />
        </div>
      </Link>
    );
  };

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load SLA watch"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/admin/support-cases"
                onClick={() => handleNavClick("/admin/support-cases")}
              >
                {loadingHref === "/admin/support-cases" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to cases
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the full support cases queue
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="SLA watch"
        description="Active cases whose SLA deadline falls in the next 24 hours — prioritise these."
      />

      <section
        aria-label="SLA watch explainer"
        className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
      >
        <AlarmClock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">
            {cases.length} case{cases.length === 1 ? "" : "s"} approaching their SLA
          </p>
          <p className="text-muted-foreground">
            Auto-refreshes every minute. Cases listed here need a response or state
            transition before their deadline expires.
          </p>
        </div>
      </section>

      <DataTable
        columns={columns}
        data={cases}
        isLoading={isLoading}
        searchKey="subject"
        searchPlaceholder="Search by subject…"
        pagination
        pageSize={15}
        mobileCard={mobileCard}
        emptyTitle="No cases are approaching SLA"
        emptyDescription="Nothing to do here — the queue is healthy."
      />
    </div>
  );
}

function SlaCountdown({ slaDueAt }: { slaDueAt?: number | null }) {
  if (!slaDueAt) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = slaDueAt - now;
  const hoursLeft = Math.floor(Math.abs(secondsLeft) / 3600);
  const overdue = secondsLeft < 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            overdue
              ? "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
              : hoursLeft < 6
                ? "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning"
                : "inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {overdue
            ? `Overdue by ${hoursLeft}h`
            : hoursLeft < 1
              ? "< 1h"
              : `${hoursLeft}h left`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        SLA deadline {formatRelative(slaDueAt)} — based on the tenant's support tier
      </TooltipContent>
    </Tooltip>
  );
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
