"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  AlarmClock,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import {
  DataTable,
  type DataTableBulkAction,
} from "@/components/recipes/data-table";
import { summarizeBulkResult } from "@/lib/api/bulk";
import { NavButton } from "@/components/recipes/nav-button";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/feedback/loading-button";
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
import {
  useAdminSupportCases,
  useBulkAdminSupportCaseAction,
} from "@/features/support-cases/hooks/use-admin-support-cases";
import { useTenantList } from "@/features/auth/hooks/use-admin-dashboard";
import {
  CaseStatusBadge,
  CasePriorityDot,
  CASE_CATEGORY_LABELS,
  AdminSearchCombobox,
  FilterSheet,
  getInitials,
} from "@/features/support-cases/components";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import type {
  SupportCase,
  AdminSupportCaseSort,
} from "@/types/support-case";
import type { AdminSearchResult } from "@/types/admin";
import type {
  SupportCaseStatus,
  SupportCasePriority,
  SupportCaseCategory,
} from "@/types/enums";

type StatusFilter = SupportCaseStatus | "all";
type PriorityFilter = SupportCasePriority | "all";
type CategoryFilter = SupportCaseCategory | "all";
type BulkAction = "assign" | "status" | "close";

const SUPPORT_CASES_PAGE_SIZE = 25;
const DEFAULT_SORT: AdminSupportCaseSort = "-date_created";

const STATUS_LABELS: Record<SupportCaseStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  awaiting_tenant: "Awaiting organization",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(STATUS_LABELS) as SupportCaseStatus[]).map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
  })),
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

/** Statuses an admin can move cases into in bulk. */
const BULK_STATUS_OPTIONS: SupportCaseStatus[] = [
  "acknowledged",
  "in_progress",
  "awaiting_tenant",
  "resolved",
  "closed",
];

/** Local YYYY-MM-DD → unix epoch seconds at the start/end of that day. */
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

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

export default function AdminSupportCasesPage() {
  const { loadingHref, handleNavClick } = useNavigationLoading();

  // Inline filters
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Secondary filters (live behind the Filters sheet)
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [tenantId, setTenantId] = useState("all");
  const [assignee, setAssignee] = useState<AdminSearchResult | null>(null);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sort, setSort] = useState<AdminSupportCaseSort>(DEFAULT_SORT);

  const [pageIndex, setPageIndex] = useState(0);
  // Bumped after a bulk mutation to remount the table and clear its selection.
  const [tableKey, setTableKey] = useState(0);

  // Bulk-action dialog state
  const [bulkTarget, setBulkTarget] = useState<{
    action: BulkAction;
    ids: string[];
  } | null>(null);
  const [bulkAssignee, setBulkAssignee] = useState<AdminSearchResult | null>(null);
  const [bulkStatusValue, setBulkStatusValue] =
    useState<SupportCaseStatus>("acknowledged");

  const bulkAssign = useBulkAdminSupportCaseAction("assign");
  const bulkStatus = useBulkAdminSupportCaseAction("status");
  const bulkClose = useBulkAdminSupportCaseAction("close");

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
  }, [q, status, priority, category, tenantId, assignee, createdFrom, createdTo, sort]);

  const params = useMemo(
    () => ({
      q: q.length >= 2 ? q : undefined,
      status: status === "all" ? undefined : status,
      priority: priority === "all" ? undefined : priority,
      category: category === "all" ? undefined : category,
      tenantId: tenantId === "all" ? undefined : tenantId,
      assigneeId: assignee?.id,
      createdAtGte: dateStringToEpoch(createdFrom),
      createdAtLte: dateStringToEpoch(createdTo, true),
      sort: sort === DEFAULT_SORT ? undefined : sort,
      skip: pageIndex * SUPPORT_CASES_PAGE_SIZE,
      limit: SUPPORT_CASES_PAGE_SIZE,
    }),
    [q, status, priority, category, tenantId, assignee, createdFrom, createdTo, sort, pageIndex],
  );

  const { data, isLoading, isFetching, isError, refetch } = useAdminSupportCases(params);
  const cases = data?.items ?? [];
  const meta = data?.meta;

  // ── Filter summary chips ────────────────────────────────────────────
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (q.length >= 2)
      chips.push({ key: "q", label: `Search: “${q}”`, clear: () => setSearchInput("") });
    if (status !== "all")
      chips.push({
        key: "status",
        label: `Status: ${STATUS_LABELS[status]}`,
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
        label: `Organization: ${tenantOptions.find((o) => o.value === tenantId)?.label ?? tenantId}`,
        clear: () => setTenantId("all"),
      });
    if (assignee)
      chips.push({
        key: "assignee",
        label: `Assignee: ${assignee.fullName}`,
        clear: () => setAssignee(null),
      });
    if (createdFrom)
      chips.push({ key: "from", label: `From: ${createdFrom}`, clear: () => setCreatedFrom("") });
    if (createdTo)
      chips.push({ key: "to", label: `To: ${createdTo}`, clear: () => setCreatedTo("") });
    return chips;
  }, [q, status, priority, category, tenantId, assignee, createdFrom, createdTo, tenantOptions]);

  // Count only the filters that live behind the Filters sheet (search + status
  // are inline, so they don't contribute to the Filters badge).
  const secondaryCount =
    (priority !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (tenantId !== "all" ? 1 : 0) +
    (assignee ? 1 : 0) +
    (createdFrom ? 1 : 0) +
    (createdTo ? 1 : 0) +
    (sort !== DEFAULT_SORT ? 1 : 0);

  const hasActiveFilters = activeChips.length > 0 || sort !== DEFAULT_SORT;

  function clearSecondary() {
    setPriority("all");
    setCategory("all");
    setTenantId("all");
    setAssignee(null);
    setCreatedFrom("");
    setCreatedTo("");
    setSort(DEFAULT_SORT);
  }

  function clearAll() {
    setSearchInput("");
    setStatus("all");
    clearSecondary();
  }

  // ── Bulk actions ────────────────────────────────────────────────────
  const cancelBulk = () => {
    setBulkTarget(null);
    setBulkAssignee(null);
  };

  const finishBulk = () => {
    cancelBulk();
    setTableKey((k) => k + 1); // remount table → clears selection
  };

  const runBulkAssign = async () => {
    if (!bulkTarget || !bulkAssignee) return;
    try {
      const result = await bulkAssign.mutateAsync({
        ids: bulkTarget.ids,
        assigneeId: bulkAssignee.id,
      });
      const { tone, message } = summarizeBulkResult(result, "case", "assigned");
      toast[tone](message);
      finishBulk();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't assign the cases");
    }
  };

  const runBulkStatus = async () => {
    if (!bulkTarget) return;
    try {
      const result = await bulkStatus.mutateAsync({
        ids: bulkTarget.ids,
        status: bulkStatusValue,
      });
      const { tone, message } = summarizeBulkResult(result, "case", "updated");
      toast[tone](message);
      finishBulk();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the cases");
    }
  };

  const runBulkClose = async () => {
    if (!bulkTarget) return;
    try {
      const result = await bulkClose.mutateAsync({ ids: bulkTarget.ids });
      const { tone, message } = summarizeBulkResult(result, "case", "closed");
      toast[tone](message);
      finishBulk();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't close the cases");
    }
  };

  const bulkActions: DataTableBulkAction<SupportCase>[] = [
    {
      label: "Assign",
      description: "Assign the selected cases to an admin",
      icon: <UserPlus className="h-4 w-4" aria-hidden="true" />,
      onClick: (ids) => {
        setBulkAssignee(null);
        setBulkTarget({ action: "assign", ids });
      },
    },
    {
      label: "Change status",
      description: "Move the selected cases to a new workflow status",
      icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
      onClick: (ids) => {
        setBulkStatusValue("acknowledged");
        setBulkTarget({ action: "status", ids });
      },
    },
    {
      label: "Close",
      description: "Close the selected cases — organizations can reopen them",
      icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
      variant: "destructive",
      onClick: (ids) => setBulkTarget({ action: "close", ids }),
    },
  ];

  // ── Columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<SupportCase>[] = [
    {
      accessorKey: "subject",
      header: "Subject",
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        const id = c.id ?? c._id ?? "";
        const href = `/admin/support-cases/${id}`;
        const isLoadingRow = loadingHref === href;
        const tenantName =
          c.tenantSummary?.companyName?.trim() || truncateId(c.tenantId);
        const category = CASE_CATEGORY_LABELS[c.category] ?? c.category;
        return (
          <div className="min-w-0">
            <Link
              href={href}
              onClick={() => handleNavClick(href)}
              title="Open this case to view the thread and respond"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              {isLoadingRow && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              <span className="line-clamp-1">{c.subject}</span>
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {tenantName} · {category}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => <CaseStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "priority",
      header: "Priority",
      enableSorting: false,
      cell: ({ row }) => <CasePriorityDot priority={row.original.priority} />,
    },
    {
      id: "assignedAdmin",
      header: "Assigned",
      enableSorting: false,
      cell: ({ row }) => {
        const name = row.original.assignedAdminSummary?.fullName?.trim();
        if (!name) {
          return <span className="text-xs text-muted-foreground">Unassigned</span>;
        }
        return (
          <span
            className="inline-flex items-center gap-2"
            title={`Assigned to ${name}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {getInitials(name)}
            </span>
            <span className="max-w-[120px] truncate text-sm">{name}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "lastMessageAt",
      header: "Last activity",
      enableSorting: false,
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
    const id = c.id ?? c._id ?? "";
    const href = `/admin/support-cases/${id}`;
    const isLoadingRow = loadingHref === href;
    const tenantName =
      c.tenantSummary?.companyName?.trim() || truncateId(c.tenantId);
    const category = CASE_CATEGORY_LABELS[c.category] ?? c.category;
    const assigneeName = c.assignedAdminSummary?.fullName?.trim();
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
            <p className="truncate text-xs text-muted-foreground">
              {tenantName} · {category}
            </p>
          </div>
          <CaseStatusBadge status={c.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <CasePriorityDot priority={c.priority} />
          <span className="text-xs text-muted-foreground">
            {assigneeName ? `Assigned: ${assigneeName}` : "Unassigned"}
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

  const bulkCount = bulkTarget?.ids.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Cases"
        description="Every case across all organizations. Search, filter, and act on the queue."
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

      {/* Inline controls: search + status + Filters disclosure */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
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

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="min-w-[10rem]">
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusFilter)}
                >
                  <SelectTrigger
                    className="min-h-[44px]"
                    aria-label="Filter by status"
                  >
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
              Filter by workflow status — e.g. show only Resolved or Awaiting organization cases
            </TooltipContent>
          </Tooltip>

          <FilterSheet
            activeCount={secondaryCount}
            onClear={clearSecondary}
            description="Refine the queue by priority, category, organization, assignee, date, and sort order."
          >
            <FilterSelect
              id="filter-priority"
              label="Priority"
              value={priority}
              onChange={(v) => setPriority(v as PriorityFilter)}
              options={PRIORITY_OPTIONS}
            />
            <FilterSelect
              id="filter-category"
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
            />
            <FilterSelect
              id="filter-tenant"
              label="Organization"
              value={tenantId}
              onChange={setTenantId}
              options={[{ value: "all", label: "All organizations" }, ...tenantOptions]}
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Assigned admin
              </Label>
              <AdminSearchCombobox
                id="filter-assignee"
                selected={assignee}
                onSelect={setAssignee}
                placeholder="Filter by assigned admin…"
              />
            </div>
            <FilterSelect
              id="filter-sort"
              label="Sort by"
              value={sort}
              onChange={(v) => setSort(v as AdminSupportCaseSort)}
              options={SORT_OPTIONS}
            />
            <div className="grid grid-cols-2 gap-3">
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
          </FilterSheet>
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
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 gap-1.5">
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
        key={tableKey}
        columns={columns}
        data={cases}
        isLoading={isLoading}
        pagination
        selectable
        getRowId={(c) => c.id ?? c._id ?? ""}
        itemNoun="case"
        bulkActions={bulkActions}
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
        getRowHref={(c) => {
          const id = c.id ?? c._id ?? "";
          return id ? `/admin/support-cases/${id}` : undefined;
        }}
        rowClickAriaLabel={(c) => `View support case ${c.subject ?? "details"}`}
      />

      {/* Bulk: assign */}
      <ResponsiveModal
        open={bulkTarget?.action === "assign"}
        onOpenChange={(o) => !o && cancelBulk()}
        title={`Assign ${bulkCount} case${plural(bulkCount)}`}
        description="Search for an admin to take ownership of the selected cases."
      >
        <div className="space-y-4">
          <AdminSearchCombobox
            id="bulk-assign-admin"
            selected={bulkAssignee}
            onSelect={setBulkAssignee}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-[44px]" onClick={cancelBulk}>
              Cancel
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    onClick={runBulkAssign}
                    isLoading={bulkAssign.isPending}
                    loadingText="Assigning…"
                    disabled={!bulkAssignee || bulkAssign.isPending}
                    className="w-full sm:w-auto"
                  >
                    Assign {bulkCount} case{plural(bulkCount)}
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Route every selected case to the chosen admin
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </ResponsiveModal>

      {/* Bulk: change status */}
      <ResponsiveModal
        open={bulkTarget?.action === "status"}
        onOpenChange={(o) => !o && cancelBulk()}
        title={`Change status of ${bulkCount} case${plural(bulkCount)}`}
        description="Move the selected cases to a new workflow status."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-status" className="text-xs font-medium text-muted-foreground">
              New status
            </Label>
            <Select
              value={bulkStatusValue}
              onValueChange={(v) => setBulkStatusValue(v as SupportCaseStatus)}
            >
              <SelectTrigger id="bulk-status" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BULK_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-[44px]" onClick={cancelBulk}>
              Cancel
            </Button>
            <LoadingButton
              onClick={runBulkStatus}
              isLoading={bulkStatus.isPending}
              loadingText="Updating…"
              className="w-full sm:w-auto"
            >
              Update {bulkCount} case{plural(bulkCount)}
            </LoadingButton>
          </div>
        </div>
      </ResponsiveModal>

      {/* Bulk: close */}
      <ConfirmDialog
        open={bulkTarget?.action === "close"}
        onOpenChange={(o) => !o && cancelBulk()}
        title={`Close ${bulkCount} case${plural(bulkCount)}?`}
        description={`The selected case${plural(bulkCount)} will be closed. Organizations can reopen a closed case if they still need help.`}
        confirmLabel={`Close ${bulkCount} case${plural(bulkCount)}`}
        variant="destructive"
        isLoading={bulkClose.isPending}
        onConfirm={runBulkClose}
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
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
  );
}
