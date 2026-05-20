"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, Loader2, Search, X } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { NavButton } from "@/components/recipes/nav-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useTenantList } from "@/features/auth/hooks/use-admin-dashboard";
import {
  CaseStatusBadge,
  CasePriorityBadge,
  CaseCategoryBadge,
  CASE_CATEGORY_LABELS,
} from "@/features/support-cases/components";
import { formatRelative } from "@/lib/utils/format-date";
import type { SupportCase, AdminSupportCaseSort } from "@/types/support-case";
import type {
  SupportCaseStatus,
  SupportCasePriority,
  SupportCaseCategory,
} from "@/types/enums";

type StatusFilter = SupportCaseStatus | "all";
type PriorityFilter = SupportCasePriority | "all";
type CategoryFilter = SupportCaseCategory | "all";

const SUPPORT_CASES_PAGE_SIZE = 25;
const DEFAULT_SORT: AdminSupportCaseSort = "-date_created";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_tenant", label: "Awaiting tenant" },
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

const SORT_OPTIONS: { value: AdminSupportCaseSort; label: string }[] = [
  { value: "-date_created", label: "Newest first" },
  { value: "date_created", label: "Oldest first" },
  { value: "-last_updated", label: "Recently updated" },
  { value: "sla_due_at", label: "SLA due soonest" },
  { value: "-priority", label: "Priority (A–Z)" },
  { value: "status", label: "Status (A–Z)" },
];

/** Local YYYY-MM-DD → unix epoch seconds at the start of that day. */
function dateStringToEpoch(value: string, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59)
    : new Date(y, m - 1, d, 0, 0, 0);
  const ms = date.getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

export default function AdminSupportCasesPage() {
  const { loadingHref, handleNavClick, navigateFromOverlay } = useNavigationLoading();

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [tenantId, setTenantId] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sort, setSort] = useState<AdminSupportCaseSort>(DEFAULT_SORT);

  const [pageIndex, setPageIndex] = useState(0);

  // Debounce the free-text search so each keystroke doesn't fire a request.
  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Tenant dropdown options (names instead of raw ids).
  const { data: tenantData } = useTenantList();
  const tenantOptions = useMemo(
    () =>
      (tenantData?.items ?? [])
        .map((t) => ({ value: t.id, label: t.companyName || t.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [tenantData],
  );

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPageIndex(0);
  }, [q, status, priority, category, tenantId, createdFrom, createdTo, sort]);

  const params = useMemo(
    () => ({
      q: q.length >= 2 ? q : undefined,
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      category: category === "all" ? undefined : category,
      tenantId: tenantId === "all" ? undefined : tenantId,
      createdAtGte: dateStringToEpoch(createdFrom),
      createdAtLte: dateStringToEpoch(createdTo, true),
      // Only send `sort` when it differs from the backend default so the
      // unfiltered first page keeps hitting the precompute cache fast-path.
      sort: sort === DEFAULT_SORT ? undefined : sort,
      skip: pageIndex * SUPPORT_CASES_PAGE_SIZE,
      limit: SUPPORT_CASES_PAGE_SIZE,
    }),
    [q, status, priority, category, tenantId, createdFrom, createdTo, sort, pageIndex],
  );

  const { data, isLoading, isFetching, isError, refetch } = useAdminSupportCases(params);
  const cases = data?.items ?? [];
  const meta = data?.meta;

  // Active-filter chips (search + each non-default filter).
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (q.length >= 2)
      chips.push({ key: "q", label: `Search: “${q}”`, clear: () => setSearchInput("") });
    if (status !== "all")
      chips.push({
        key: "status",
        label: `Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`,
        clear: () => setStatus("all"),
      });
    if (priority !== "all")
      chips.push({
        key: "priority",
        label: `Priority: ${PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority}`,
        clear: () => setPriority("all"),
      });
    if (category !== "all")
      chips.push({
        key: "category",
        label: `Category: ${CASE_CATEGORY_LABELS[category] ?? category}`,
        clear: () => setCategory("all"),
      });
    if (tenantId !== "all")
      chips.push({
        key: "tenant",
        label: `Tenant: ${tenantOptions.find((o) => o.value === tenantId)?.label ?? tenantId}`,
        clear: () => setTenantId("all"),
      });
    if (createdFrom)
      chips.push({ key: "from", label: `From: ${createdFrom}`, clear: () => setCreatedFrom("") });
    if (createdTo)
      chips.push({ key: "to", label: `To: ${createdTo}`, clear: () => setCreatedTo("") });
    return chips;
  }, [q, status, priority, category, tenantId, createdFrom, createdTo, tenantOptions]);

  const hasActiveFilters = activeChips.length > 0 || sort !== DEFAULT_SORT;

  function clearAll() {
    setSearchInput("");
    setStatus("all");
    setPriority("all");
    setCategory("all");
    setTenantId("all");
    setCreatedFrom("");
    setCreatedTo("");
    setSort(DEFAULT_SORT);
  }

  const columns: ColumnDef<SupportCase>[] = [
    {
      accessorKey: "subject",
      header: "Subject",
      enableSorting: false,
      cell: ({ row }) => {
        const id = row.original.id ?? row.original._id ?? "";
        const href = `/admin/support-cases/${id}`;
        const isLoadingRow = loadingHref === href;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={href}
                onClick={(event) => {
                  // Intercept plain left-click only; preserve cmd/ctrl/middle
                  // for open-in-new-tab. The defer is what stops the page-tree
                  // swap from racing the tooltip portal unmount.
                  if (
                    event.defaultPrevented ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  navigateFromOverlay(href);
                }}
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
      enableSorting: false,
      cell: ({ row }) => {
        const summary = row.original.tenantSummary;
        const name = summary?.companyName?.trim();
        const country = summary?.countryOfHosting;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block max-w-[180px] truncate text-sm">
                {name || (
                  <span className="font-mono text-xs text-muted-foreground">
                    {truncateId(row.original.tenantId)}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="font-mono text-xs">{row.original.tenantId}</span>
              {country ? ` · ${country}` : ""}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      enableSorting: false,
      cell: ({ row }) => <CasePriorityBadge priority={row.original.priority} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => <CaseStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "category",
      header: "Category",
      enableSorting: false,
      cell: ({ row }) => <CaseCategoryBadge category={row.original.category} />,
    },
    {
      id: "assignedAdmin",
      header: "Assigned",
      enableSorting: false,
      cell: ({ row }) => {
        const name = row.original.assignedAdminSummary?.fullName?.trim();
        return name ? (
          <span className="text-sm">{name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        );
      },
    },
    {
      accessorKey: "lastMessageAt",
      header: "Last activity",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatRelative(row.original.lastMessageAt ?? row.original.lastUpdated)}
        </span>
      ),
    },
  ];

  const mobileCard = (c: SupportCase) => {
    const id = c.id ?? c._id ?? "";
    const href = `/admin/support-cases/${id}`;
    const isLoadingRow = loadingHref === href;
    const tenantName = c.tenantSummary?.companyName?.trim() || truncateId(c.tenantId);
    const assignee = c.assignedAdminSummary?.fullName?.trim();
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
            <p className="text-xs text-muted-foreground">{tenantName}</p>
          </div>
          <CaseStatusBadge status={c.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CasePriorityBadge priority={c.priority} />
          <span className="text-xs text-muted-foreground">
            {assignee ? `Assigned: ${assignee}` : "Unassigned"}
          </span>
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
        description="Every case across all tenants. Search, filter, and sort to narrow the queue."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href="/admin/support-cases/sla-watch"
                variant="outline"
                className="min-h-[44px]"
              >
                {loadingHref === "/admin/support-cases/sla-watch" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <AlarmClock className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                SLA watch
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Jump to cases whose SLA deadline falls in the next 24 hours
            </TooltipContent>
          </Tooltip>
        }
      />

      {/* Single search bar — matches subject + description server-side. */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search cases by subject or description…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="min-h-[44px] pl-10 text-base md:text-sm"
          aria-label="Search support cases"
        />
        {isFetching && searchInput && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <FilterSelect
          id="admin-status"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={STATUS_OPTIONS}
          tooltip="Filter by workflow status — e.g. show only Resolved or Awaiting tenant cases"
        />
        <FilterSelect
          id="admin-priority"
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as PriorityFilter)}
          options={PRIORITY_OPTIONS}
          tooltip="Filter by the tenant-declared priority of each case"
        />
        <FilterSelect
          id="admin-category"
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
          tooltip="Filter by the tenant-declared subject area"
        />
        <FilterSelect
          id="admin-tenant"
          label="Tenant"
          value={tenantId}
          onChange={setTenantId}
          options={[{ value: "all", label: "All tenants" }, ...tenantOptions]}
          tooltip="Show only cases opened by a specific tenant company"
        />
        <FilterSelect
          id="admin-sort"
          label="Sort by"
          value={sort}
          onChange={(v) => setSort(v as AdminSupportCaseSort)}
          options={SORT_OPTIONS}
          tooltip="Change the order cases are listed in"
        />
      </div>

      {/* Created-date range */}
      <div className="grid gap-3 md:grid-cols-2 lg:max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="created-from" className="text-xs font-medium text-muted-foreground">
            Created from
          </Label>
          <Input
            id="created-from"
            type="date"
            value={createdFrom}
            max={createdTo || undefined}
            onChange={(e) => setCreatedFrom(e.target.value)}
            className="min-h-[44px] text-base md:text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="created-to" className="text-xs font-medium text-muted-foreground">
            Created to
          </Label>
          <Input
            id="created-to"
            type="date"
            value={createdTo}
            min={createdFrom || undefined}
            onChange={(e) => setCreatedTo(e.target.value)}
            className="min-h-[44px] text-base md:text-sm"
          />
        </div>
      </div>

      {/* Active filter chips + clear all */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[200px] truncate">{chip.label}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={chip.clear}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Remove this filter</TooltipContent>
              </Tooltip>
            </Badge>
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-8 gap-1.5"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Clear all
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Reset search, every filter, and the sort order back to defaults
            </TooltipContent>
          </Tooltip>
        </div>
      )}

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
        emptyDescription="Adjust or clear the filters to see more results."
        getRowId={(c) => c.id ?? c._id ?? ""}
        getRowHref={(c) => {
          const id = c.id ?? c._id ?? "";
          return id ? `/admin/support-cases/${id}` : undefined;
        }}
        rowClickAriaLabel={(c) => `View support case ${c.subject ?? "details"}`}
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
