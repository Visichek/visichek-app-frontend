"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  RowSelectionState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import {
  BulkActionsBar,
  type BulkAction,
} from "@/components/recipes/bulk-actions-bar";

// Click targets that should NOT trigger the row-level navigation handler.
// Order matters only for readability — the selector list is OR-ed by the
// browser's matches(). Keep in sync with the "Click-ignore rules" section
// of CLAUDE.md so primitives behave consistently across every table.
const ROW_CLICK_IGNORE_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="option"]',
  "[data-row-click-ignore]",
].join(",");

function isInteractiveClickTarget(
  target: EventTarget | null,
  rowRoot: HTMLElement | null,
): boolean {
  if (!(target instanceof Element)) return false;
  // Walk up from the click target until we either find an interactive
  // ancestor (ignore the row click) or reach the row root (treat the
  // click as a row click). closest() would happily walk past the row
  // and match a button outside the table, so we bound it explicitly.
  let node: Element | null = target;
  while (node && node !== rowRoot) {
    if (node.matches(ROW_CLICK_IGNORE_SELECTOR)) return true;
    node = node.parentElement;
  }
  return false;
}

export type DataTableBulkAction<TData> = Omit<BulkAction, "onClick"> & {
  onClick: (selectedIds: string[], selectedRows: TData[]) => void;
};

/**
 * Server-driven pagination state. When this prop is provided the table
 * disables its own pagination row-model and instead drives prev/next from
 * the caller. `totalCount` is the absolute total from the backend list
 * envelope (`meta.total`), not the current page length — that's the whole
 * point of switching: a `?limit=50` query returns at most 50 items but the
 * user must still be able to walk past row 50 and the count line has to
 * reflect the true total.
 */
export interface ServerPagination {
  pageIndex: number; // 0-based
  pageSize: number;
  totalCount: number | null | undefined;
  onPageChange: (pageIndex: number) => void;
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // Search and filtering
  searchKey?: string;
  searchPlaceholder?: string;

  // Pagination
  pagination?: boolean;
  pageSize?: number;
  /**
   * Server-driven pagination. When set, the table ignores its internal
   * page model and renders the supplied page directly. The count line
   * displays `totalCount` rather than the local row length.
   */
  serverPagination?: ServerPagination;
  /**
   * Display-only override for the results count when the caller has a
   * backend total but isn't (yet) wiring server pagination. Ignored when
   * `serverPagination` is set (`serverPagination.totalCount` wins).
   */
  totalCount?: number | null;

  // Mobile rendering
  mobileCard?: (row: TData) => React.ReactNode;

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;

  // Loading
  isLoading?: boolean;

  // Multi-select
  selectable?: boolean;
  getRowId?: (row: TData) => string;
  onSelectionChange?: (selectedIds: string[], selectedRows: TData[]) => void;
  bulkActions?: DataTableBulkAction<TData>[];
  itemNoun?: string;

  /**
   * Row-click shortcut to the row's detail view. Use `getRowHref` when the
   * destination is a route — middle-click / ctrl-click / open-in-new-tab
   * keep working, the row prefetches on hover, and SSR sees a real link.
   * Use `onRowClick` for sheets, modals, or other programmatic side
   * effects. Clicks inside interactive controls (buttons, links, inputs,
   * `[role="menuitem"]`, `[data-row-click-ignore]`, etc.) are ignored.
   */
  getRowHref?: (row: TData) => string | undefined;
  onRowClick?: (row: TData) => void;
  /** aria-label override for the row-as-button. Defaults to "View details". */
  rowClickAriaLabel?: (row: TData) => string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  pagination = true,
  pageSize = 10,
  serverPagination,
  totalCount,
  mobileCard,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your filters or search terms.",
  isLoading = false,
  selectable = false,
  getRowId,
  onSelectionChange,
  bulkActions,
  itemNoun,
  getRowHref,
  onRowClick,
  rowClickAriaLabel,
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  const rowClickEnabled = !!(getRowHref || onRowClick);

  // Resolve a row's destination + click behavior once per render. `href`
  // is only meaningful when the caller supplied `getRowHref` — we still
  // honor `onRowClick` as a fallback so a caller can do both (rare, but
  // valid: e.g. "navigate AND track"). Returns `null` when there's no
  // action for this particular row — caller renders a non-button row.
  const resolveRowAction = React.useCallback(
    (row: TData): { href?: string; activate: () => void } | null => {
      const href = getRowHref?.(row);
      if (!href && !onRowClick) return null;
      return {
        href,
        activate: () => {
          if (href) router.push(href);
          if (onRowClick) onRowClick(row);
        },
      };
    },
    [getRowHref, onRowClick, router],
  );

  const handleRowKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>, activate: () => void) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (isInteractiveClickTarget(e.target, e.currentTarget)) return;
      e.preventDefault();
      activate();
    },
    [],
  );
  const isServerPaginated = !!serverPagination;
  const effectivePageSize = isServerPaginated ? serverPagination.pageSize : pageSize;
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<Array<{ id: string; value: unknown }>>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  if (selectable && !getRowId && process.env.NODE_ENV !== "production") {
    console.warn(
      "DataTable: selectable={true} requires a getRowId prop so selection survives sorting and pagination."
    );
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: selectable,
    getRowId: getRowId,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // When the caller drives pagination from the server, skip the
    // internal page-row-model entirely — `data` already represents the
    // single visible page and we render it as-is.
    getPaginationRowModel:
      pagination && !isServerPaginated ? getPaginationRowModel() : undefined,
  });

  // Set initial page size for the internal model; only relevant in
  // client-paginated mode.
  React.useEffect(() => {
    if (pagination && !isServerPaginated) {
      table.setPageSize(pageSize);
    }
  }, [table, pagination, pageSize, isServerPaginated]);

  // Drop selection ids that no longer correspond to visible rows so the
  // selection stays consistent with what the user can see (matches the
  // CLAUDE.md rule for the useMultiSelect hook).
  const visibleRowIds = React.useMemo(() => {
    if (!selectable) return null;
    return new Set(table.getRowModel().rows.map((row) => row.id));
    // intentionally depend on the row model identity; a selection drift
    // requires a paginated page change or filter change to recompute
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectable, data, globalFilter, sorting, columnFilters]);

  React.useEffect(() => {
    if (!selectable || !visibleRowIds) return;
    setRowSelection((prev) => {
      let changed = false;
      const next: RowSelectionState = {};
      for (const id in prev) {
        if (visibleRowIds.has(id)) {
          next[id] = prev[id];
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectable, visibleRowIds]);

  // Compute selected ids/rows and notify the consumer.
  const selectedRowModel = table.getSelectedRowModel();
  const selectedIds = React.useMemo(
    () => selectedRowModel.rows.map((r) => r.id),
    [selectedRowModel]
  );
  const selectedRows = React.useMemo(
    () => selectedRowModel.rows.map((r) => r.original),
    [selectedRowModel]
  );

  const lastNotifiedKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!selectable || !onSelectionChange) return;
    const key = selectedIds.join("|");
    if (key === lastNotifiedKeyRef.current) return;
    lastNotifiedKeyRef.current = key;
    onSelectionChange(selectedIds, selectedRows);
  }, [selectable, onSelectionChange, selectedIds, selectedRows]);

  // Show loading skeleton
  if (isLoading) {
    return (
      <TableSkeleton
        rows={effectivePageSize ?? 5}
        columns={columns.length + (selectable ? 1 : 0)}
      />
    );
  }

  // Server-driven pagination derivations. `serverTotal` is the true backend
  // total; `serverPageCount` is how many pages we have to walk through.
  const serverTotal = serverPagination?.totalCount ?? null;
  const serverPageCount =
    serverPagination && serverTotal != null && serverPagination.pageSize > 0
      ? Math.max(1, Math.ceil(serverTotal / serverPagination.pageSize))
      : null;
  const serverCanPrev = serverPagination ? serverPagination.pageIndex > 0 : false;
  const serverCanNext =
    serverPagination && serverPageCount != null
      ? serverPagination.pageIndex < serverPageCount - 1
      : // If we don't know the total, allow next as long as the current
        // page is full — best-effort hint that there might be more.
        serverPagination
        ? data.length === serverPagination.pageSize
        : false;
  const serverPageStart = serverPagination
    ? serverPagination.pageIndex * serverPagination.pageSize + (data.length === 0 ? 0 : 1)
    : 0;
  const serverPageEnd = serverPagination
    ? serverPagination.pageIndex * serverPagination.pageSize + data.length
    : 0;

  // Show empty state
  if (table.getRowModel().rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  const allRowsSelected = selectable && table.getIsAllRowsSelected();
  const someRowsSelected = selectable && !allRowsSelected && table.getIsSomeRowsSelected();

  const bulkBar =
    selectable && bulkActions && bulkActions.length > 0 && selectedIds.length > 0 ? (
      <BulkActionsBar
        selectedCount={selectedIds.length}
        onClear={() => table.resetRowSelection()}
        itemNoun={itemNoun}
        actions={bulkActions.map((action) => ({
          ...action,
          onClick: () => action.onClick(selectedIds, selectedRows),
        }))}
      />
    ) : null;

  // Render mobile and desktop layouts BOTH and let CSS hide the inactive
  // one. The previous JS-branched approach (useMediaQuery → return one
  // tree or the other) caused a hydration tree swap on first commit:
  // SSR rendered the mobile-cards tree, the client hydrated it, the
  // matchMedia effect fired, and React reconciled by tearing down the
  // mobile cards (with all their Tooltip / DropdownMenu portals) and
  // replacing them with the desktop table. The portal cleanup raced
  // React 19's DOM removal and surfaced as `removeChild on null` deep in
  // react-dom's commit phase. CSS responsiveness keeps a single tree
  // committed for the lifetime of the page.
  return (
    <>
      {bulkBar}

      {/* ── Mobile: card-based list ─────────────────────────── */}
      {mobileCard && (
        <div className="space-y-3 md:hidden">
          {searchKey && (
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-11"
            />
          )}

          <div className="space-y-2">
            {table.getRowModel().rows.map((row) => {
              const card = mobileCard(row.original);
              const action = rowClickEnabled ? resolveRowAction(row.original) : null;
              const ariaLabel = rowClickAriaLabel?.(row.original) ?? "View details";

              const cardBody = action ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                  className={cn(
                    "min-w-0 flex-1 cursor-pointer rounded-lg outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                  onMouseEnter={() => {
                    if (action.href) router.prefetch(action.href);
                  }}
                  onClick={(e) => {
                    if (isInteractiveClickTarget(e.target, e.currentTarget)) return;
                    action.activate();
                  }}
                  onKeyDown={(e) => handleRowKeyDown(e, action.activate)}
                >
                  {card}
                </div>
              ) : (
                <div className="min-w-0 flex-1">{card}</div>
              );

              if (!selectable) {
                return (
                  <div key={row.id}>
                    {action ? cardBody : <div>{card}</div>}
                  </div>
                );
              }
              const isSelected = row.getIsSelected();
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg transition-colors",
                    isSelected && "bg-primary/5 ring-1 ring-primary/40"
                  )}
                >
                  <label
                    className="flex h-11 w-11 flex-none items-center justify-center"
                    aria-label={isSelected ? "Deselect row" : "Select row"}
                    data-row-click-ignore
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                    />
                  </label>
                  {cardBody}
                </div>
              );
            })}
          </div>

          {pagination && (
            <div className="flex items-center justify-between gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  isServerPaginated
                    ? serverPagination!.onPageChange(
                        Math.max(0, serverPagination!.pageIndex - 1),
                      )
                    : table.previousPage()
                }
                disabled={
                  isServerPaginated ? !serverCanPrev : !table.getCanPreviousPage()
                }
                className="h-10 w-10 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {isServerPaginated
                  ? `Page ${serverPagination!.pageIndex + 1}${
                      serverPageCount != null ? ` of ${serverPageCount}` : ""
                    }`
                  : `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  isServerPaginated
                    ? serverPagination!.onPageChange(
                        serverPagination!.pageIndex + 1,
                      )
                    : table.nextPage()
                }
                disabled={
                  isServerPaginated ? !serverCanNext : !table.getCanNextPage()
                }
                className="h-10 w-10 p-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Desktop: standard table ─────────────────────────── */}
      <div className={cn("space-y-4", mobileCard ? "hidden md:block" : undefined)}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {searchKey && (
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.columnDef.header ? String(column.columnDef.header) : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {selectable && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          allRowsSelected
                            ? true
                            : someRowsSelected
                            ? "indeterminate"
                            : false
                        }
                        onCheckedChange={(value) =>
                          table.toggleAllRowsSelected(!!value)
                        }
                        aria-label={
                          allRowsSelected
                            ? "Deselect all rows"
                            : "Select all rows"
                        }
                      />
                    </TableHead>
                  )}
                  {headerGroup.headers.map((header) => {
                    const isSortable = header.column.getCanSort();
                    return (
                      <TableHead
                        key={header.id}
                        className={isSortable ? "cursor-pointer select-none" : ""}
                        onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            isSortable && "hover:text-foreground"
                          )}
                        >
                          {header.isPlaceholder ? null : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                          {isSortable && header.column.getIsSorted() && (
                            <span className="ml-1">
                              {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const isSelected = selectable && row.getIsSelected();
                const action = rowClickEnabled ? resolveRowAction(row.original) : null;
                const ariaLabel = rowClickAriaLabel?.(row.original) ?? "View details";

                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    role={action ? "button" : undefined}
                    tabIndex={action ? 0 : undefined}
                    aria-label={action ? ariaLabel : undefined}
                    onMouseEnter={
                      action?.href ? () => router.prefetch(action.href!) : undefined
                    }
                    onClick={
                      action
                        ? (e) => {
                            if (
                              isInteractiveClickTarget(
                                e.target,
                                e.currentTarget as HTMLElement,
                              )
                            )
                              return;
                            action.activate();
                          }
                        : undefined
                    }
                    onKeyDown={
                      action
                        ? (e) => handleRowKeyDown(e, action.activate)
                        : undefined
                    }
                    className={cn(
                      isSelected && "bg-primary/5",
                      action &&
                        "cursor-pointer outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    )}
                  >
                    {selectable && (
                      <TableCell className="w-10" data-row-click-ignore>
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) => row.toggleSelected(!!value)}
                          aria-label={
                            row.getIsSelected()
                              ? "Deselect row"
                              : "Select row"
                          }
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pagination && (
          <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
            <div className="text-sm text-muted-foreground">
              {(() => {
                if (isServerPaginated) {
                  if (serverTotal != null) {
                    if (serverTotal === 0) return "0 results";
                    return `Showing ${serverPageStart}–${serverPageEnd} of ${serverTotal.toLocaleString()} result${serverTotal === 1 ? "" : "s"}`;
                  }
                  return `Showing ${serverPageStart}–${serverPageEnd}`;
                }
                const localTotal =
                  typeof totalCount === "number"
                    ? totalCount
                    : table.getFilteredRowModel().rows.length;
                return `${localTotal.toLocaleString()} result${localTotal !== 1 ? "s" : ""}`;
              })()}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  isServerPaginated
                    ? serverPagination!.onPageChange(
                        Math.max(0, serverPagination!.pageIndex - 1),
                      )
                    : table.previousPage()
                }
                disabled={
                  isServerPaginated ? !serverCanPrev : !table.getCanPreviousPage()
                }
                className="h-9 gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="text-sm text-muted-foreground">
                {isServerPaginated
                  ? `Page ${serverPagination!.pageIndex + 1}${
                      serverPageCount != null ? ` of ${serverPageCount}` : ""
                    }`
                  : `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  isServerPaginated
                    ? serverPagination!.onPageChange(
                        serverPagination!.pageIndex + 1,
                      )
                    : table.nextPage()
                }
                disabled={
                  isServerPaginated ? !serverCanNext : !table.getCanNextPage()
                }
                className="h-9 gap-2"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
