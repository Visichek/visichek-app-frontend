"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, LifeBuoy, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
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
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSupportCases } from "@/features/support-cases/hooks/use-support-cases";
import {
  CaseStatusBadge,
  CasePriorityBadge,
  CaseCategoryBadge,
  QuotaBanner,
  CASE_CATEGORY_LABELS,
} from "@/features/support-cases/components";
import { formatRelative } from "@/lib/utils/format-date";
import type { SupportCase } from "@/types/support-case";
import type {
  SupportCaseStatus,
  SupportCasePriority,
  SupportCaseCategory,
} from "@/types/enums";

const OPEN_STATUSES: SupportCaseStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "awaiting_tenant",
  "reopened",
];

type StatusFilter = SupportCaseStatus | "all";
type PriorityFilter = SupportCasePriority | "all";
type CategoryFilter = SupportCaseCategory | "all";

export default function SupportCasesPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();

  const params = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      category: category === "all" ? undefined : category,
    }),
    [status, priority, category],
  );

  const { data, isLoading, isError, refetch } = useSupportCases(params);

  const cases = Array.isArray(data) ? data : [];

  // Count open cases against the cap regardless of current filter.
  const openCases = useMemo(
    () => cases.filter((c) => OPEN_STATUSES.includes(c.status)),
    [cases],
  );
  const openCount = openCases.length;
  const atCap = openCount >= 10;

  const columns: ColumnDef<SupportCase>[] = [
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => {
        const href = `/app/support-cases/${row.original.id ?? row.original._id}`;
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
              Open this case to view the full conversation and reply
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <CaseCategoryBadge category={row.original.category} />,
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
    const href = `/app/support-cases/${c.id ?? c._id}`;
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
            <p className="text-xs text-muted-foreground">
              {formatRelative(c.lastMessageAt ?? c.lastUpdated)}
            </p>
          </div>
          <CaseStatusBadge status={c.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CasePriorityBadge priority={c.priority} />
          <CaseCategoryBadge category={c.category} />
        </div>
      </Link>
    );
  };

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load support cases"
        message="Please check your connection and try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Cases"
        description="Open a case with the VisiChek support team and track replies in one place."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                {atCap ? (
                  <Button
                    disabled
                    className="w-full min-h-[44px] md:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    New case
                  </Button>
                ) : (
                  <Button asChild className="w-full min-h-[44px] md:w-auto">
                    <Link
                      href="/app/support-cases/new"
                      onClick={() => handleNavClick("/app/support-cases/new")}
                    >
                      {loadingHref === "/app/support-cases/new" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      New case
                    </Link>
                  </Button>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {atCap
                ? "You've hit the 10-open-case cap. Resolve or close one before opening a new case."
                : "Open a new support case with the VisiChek team"}
            </TooltipContent>
          </Tooltip>
        }
      />

      <QuotaBanner openCount={openCount} />

      <div className="grid gap-3 md:grid-cols-3">
        <FilterSelect
          id="status-filter"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "open", label: "Open" },
            { value: "acknowledged", label: "Acknowledged" },
            { value: "in_progress", label: "In progress" },
            { value: "awaiting_tenant", label: "Awaiting you" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
            { value: "reopened", label: "Reopened" },
          ]}
          tooltip="Filter cases by their current workflow status"
        />
        <FilterSelect
          id="priority-filter"
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as PriorityFilter)}
          options={[
            { value: "all", label: "All priorities" },
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ]}
          tooltip="Filter cases by the priority you assigned when opening them"
        />
        <FilterSelect
          id="category-filter"
          label="Category"
          value={category}
          onChange={(v) => setCategory(v as CategoryFilter)}
          options={[
            { value: "all", label: "All categories" },
            ...Object.entries(CASE_CATEGORY_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
          tooltip="Filter cases by their subject area (billing, technical, account, etc.)"
        />
      </div>

      {cases.length === 0 && !isLoading ? (
        <EmptyState
          icon={<LifeBuoy className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="No support cases yet"
          description="Open a case when you need help. Our team will respond through this thread."
          actionLabel={atCap ? undefined : "Open your first case"}
          onAction={atCap ? undefined : () => navigate("/app/support-cases/new")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={cases}
          isLoading={isLoading}
          searchKey="subject"
          searchPlaceholder="Search by subject…"
          pagination
          pageSize={10}
          mobileCard={mobileCard}
          emptyTitle="No cases match your filters"
          emptyDescription="Try removing a filter or clearing your search."
        />
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────

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
