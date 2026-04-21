"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useAdminSupportCases } from "@/features/support-cases/hooks/use-admin-support-cases";
import {
  CaseStatusBadge,
  CasePriorityBadge,
  CaseCategoryBadge,
  SupportTierBadge,
  CASE_CATEGORY_LABELS,
} from "@/features/support-cases/components";
import { formatRelative } from "@/lib/utils/format-date";
import type { SupportCase } from "@/types/support-case";
import type {
  SupportCaseStatus,
  SupportCasePriority,
  SupportCaseCategory,
  SupportTier,
} from "@/types/enums";

type StatusFilter = SupportCaseStatus | "all";
type PriorityFilter = SupportCasePriority | "all";
type CategoryFilter = SupportCaseCategory | "all";
type TierFilter = SupportTier | "all";

export default function AdminSupportCasesPage() {
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [supportTier, setSupportTier] = useState<TierFilter>("all");
  const [tenantId, setTenantId] = useState("");
  const [assignedAdminId, setAssignedAdminId] = useState("");

  const params = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      category: category === "all" ? undefined : category,
      supportTier: supportTier === "all" ? undefined : supportTier,
      tenantId: tenantId.trim() || undefined,
      assignedAdminId: assignedAdminId.trim() || undefined,
    }),
    [status, priority, category, supportTier, tenantId, assignedAdminId],
  );

  const { data, isLoading, isError, refetch } = useAdminSupportCases(params);
  const cases = Array.isArray(data) ? data : [];

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
              Open this case to view the thread and respond
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
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <CaseCategoryBadge category={row.original.category} />,
    },
    {
      accessorKey: "lastMessageAt",
      header: "Last activity",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatRelative(row.original.lastMessageAt ?? row.original.lastUpdated)}
        </span>
      ),
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
        </div>
      </Link>
    );
  };

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load admin support cases"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Cases"
        description="Every open case across all tenants. Use filters to narrow the queue."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link
                  href="/admin/support-cases/sla-watch"
                  onClick={() => handleNavClick("/admin/support-cases/sla-watch")}
                >
                  {loadingHref === "/admin/support-cases/sla-watch" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <AlarmClock className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  SLA watch
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Jump to cases whose SLA deadline falls in the next 24 hours
            </TooltipContent>
          </Tooltip>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <FilterSelect
          id="admin-status"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "open", label: "Open" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "in_progress", label: "In progress" },
            { value: "awaiting_tenant", label: "Awaiting tenant" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
            { value: "reopened", label: "Reopened" },
          ]}
          tooltip="Filter by workflow status"
        />
        <FilterSelect
          id="admin-priority"
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as PriorityFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ]}
          tooltip="Filter by the tenant-declared priority of each case"
        />
        <FilterSelect
          id="admin-category"
          label="Category"
          value={category}
          onChange={(v) => setCategory(v as CategoryFilter)}
          options={[
            { value: "all", label: "All" },
            ...Object.entries(CASE_CATEGORY_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
          tooltip="Filter by the tenant-declared subject area"
        />
        <FilterSelect
          id="admin-tier"
          label="Support tier"
          value={supportTier}
          onChange={(v) => setSupportTier(v as TierFilter)}
          options={[
            { value: "all", label: "All tiers" },
            { value: "none", label: "Best-effort" },
            { value: "standard", label: "Standard" },
            { value: "priority", label: "Priority" },
          ]}
          tooltip="Filter by the tenant's plan-level support tier"
        />
        <div className="space-y-1.5">
          <Label htmlFor="tenant-filter" className="text-xs font-medium text-muted-foreground">
            Tenant ID
          </Label>
          <Input
            id="tenant-filter"
            placeholder="Full tenant id"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="min-h-[44px] font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="assigned-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Assigned admin
          </Label>
          <Input
            id="assigned-filter"
            placeholder="Admin id"
            value={assignedAdminId}
            onChange={(e) => setAssignedAdminId(e.target.value)}
            className="min-h-[44px] font-mono text-xs"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={cases}
        isLoading={isLoading}
        searchKey="subject"
        searchPlaceholder="Search by subject…"
        pagination
        pageSize={15}
        mobileCard={mobileCard}
        emptyTitle="No cases match your filters"
        emptyDescription="Adjust or clear the filters to see more results."
      />
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  tooltip,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  tooltip: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger id={id} className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
