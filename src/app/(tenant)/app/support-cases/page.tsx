"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, LifeBuoy, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { NavButton } from "@/components/recipes/nav-button";
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
  CasePriorityDot,
  QuotaBanner,
  CASE_CATEGORY_LABELS,
  FilterSheet,
} from "@/features/support-cases/components";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
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

const SUPPORT_CASES_PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_tenant", label: "Awaiting you" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reopened", label: "Reopened" },
];

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function SupportCasesPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();

  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [status, priority, category]);

  const params = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      category: category === "all" ? undefined : category,
      skip: pageIndex * SUPPORT_CASES_PAGE_SIZE,
      limit: SUPPORT_CASES_PAGE_SIZE,
    }),
    [status, priority, category, pageIndex],
  );

  const { data, isLoading, isError, refetch } = useSupportCases(params);

  // Authoritative open-case count for the 10-case cap. Driven by the status
  // facet (counted across ALL of the tenant's cases, independent of the
  // current page/filter) rather than the visible page — a filtered or
  // paginated page would mis-count. Falls back to the loaded page if the
  // backend doesn't return facets.
  const { data: facetData } = useSupportCases({ facets: "status", limit: 1 });
  const statusFacets = facetData?.meta?.facets?.status;

  const cases = data?.items ?? [];
  const meta = data?.meta;

  const openCount = useMemo(() => {
    if (statusFacets) {
      return OPEN_STATUSES.reduce((sum, s) => sum + (statusFacets[s] ?? 0), 0);
    }
    return cases.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  }, [statusFacets, cases]);
  const atCap = openCount >= 10;

  const secondaryCount =
    (priority !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0);

  function clearSecondary() {
    setPriority("all");
    setCategory("all");
  }

  const columns: ColumnDef<SupportCase>[] = [
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => {
        const c = row.original;
        const href = `/app/support-cases/${c.id ?? c._id}`;
        const isLoadingRow = loadingHref === href;
        const category = CASE_CATEGORY_LABELS[c.category] ?? c.category;
        return (
          <div className="min-w-0">
            <Link
              href={href}
              onClick={() => handleNavClick(href)}
              title="Open this case to view the full conversation and reply"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              {isLoadingRow && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              <span className="line-clamp-1">{c.subject}</span>
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {category}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <CaseStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <CasePriorityDot priority={row.original.priority} />,
    },
    {
      accessorKey: "lastMessageAt",
      header: "Last activity",
      enableSorting: true,
      cell: ({ row }) => {
        const ts = row.original.lastMessageAt ?? row.original.lastUpdated;
        return (
          <span
            className="text-sm text-muted-foreground"
            title={formatDateTime(ts)}
          >
            {formatRelative(ts)}
          </span>
        );
      },
    },
  ];

  const mobileCard = (c: SupportCase) => {
    const href = `/app/support-cases/${c.id ?? c._id}`;
    const isLoadingRow = loadingHref === href;
    const category = CASE_CATEGORY_LABELS[c.category] ?? c.category;
    return (
      <Link
        href={href}
        onClick={() => handleNavClick(href)}
        className="block rounded-lg border p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              {isLoadingRow && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              <span className="line-clamp-1">{c.subject}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">{category}</p>
          </div>
          <CaseStatusBadge status={c.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <CasePriorityDot priority={c.priority} />
          <span className="text-xs text-muted-foreground">
            {formatRelative(c.lastMessageAt ?? c.lastUpdated)}
          </span>
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
                  <Button disabled className="min-h-[44px] w-full md:w-auto">
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    New case
                  </Button>
                ) : (
                  <NavButton
                    href="/app/support-cases/new"
                    className="min-h-[44px] w-full md:w-auto"
                  >
                    {loadingHref === "/app/support-cases/new" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    New case
                  </NavButton>
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

      {/* Inline controls: status + Filters disclosure */}
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="min-w-[10rem] flex-1 sm:flex-none">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="min-h-[44px]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Filter cases by their current workflow status
          </TooltipContent>
        </Tooltip>

        <FilterSheet
          activeCount={secondaryCount}
          onClear={clearSecondary}
          description="Refine your cases by priority and category."
        >
          <div className="space-y-1.5">
            <label
              htmlFor="tenant-filter-priority"
              className="text-xs font-medium text-muted-foreground"
            >
              Priority
            </label>
            <Select value={priority} onValueChange={(v) => setPriority(v as PriorityFilter)}>
              <SelectTrigger id="tenant-filter-priority" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="tenant-filter-category"
              className="text-xs font-medium text-muted-foreground"
            >
              Category
            </label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
              <SelectTrigger id="tenant-filter-category" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CASE_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterSheet>
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
          pagination
          serverPagination={{
            pageIndex,
            pageSize: SUPPORT_CASES_PAGE_SIZE,
            totalCount: meta?.total ?? null,
            hasMore: meta?.hasMore,
            onPageChange: setPageIndex,
          }}
          mobileCard={mobileCard}
          emptyTitle="No cases match your filters"
          emptyDescription="Try removing a filter or clearing your search."
          getRowId={(c) => c.id ?? c._id ?? ""}
          getRowHref={(c) => {
            const id = c.id ?? c._id ?? "";
            return id ? `/app/support-cases/${id}` : undefined;
          }}
          rowClickAriaLabel={(c) => `View support case ${c.subject ?? "details"}`}
        />
      )}
    </div>
  );
}
