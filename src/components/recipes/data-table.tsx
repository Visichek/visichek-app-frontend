"use client";

import * as React from "react";
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

export type DataTableBulkAction<TData> = Omit<BulkAction, "onClick"> & {
  onClick: (selectedIds: string[], selectedRows: TData[]) => void;
};

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];

  // Search and filtering
  searchKey?: string;
  searchPlaceholder?: string;

  // Pagination
  pagination?: boolean;
  pageSize?: number;

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
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  pagination = true,
  pageSize = 10,
  mobileCard,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your filters or search terms.",
  isLoading = false,
  selectable = false,
  getRowId,
  onSelectionChange,
  bulkActions,
  itemNoun,
}: DataTableProps<TData, TValue>) {
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
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
  });

  // Set initial page size
  React.useEffect(() => {
    if (pagination) {
      table.setPageSize(pageSize);
    }
  }, [table, pagination, pageSize]);

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
    return <TableSkeleton rows={pageSize ?? 5} columns={columns.length + (selectable ? 1 : 0)} />;
  }

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
              if (!selectable) {
                return <div key={row.id}>{card}</div>;
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
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(value) => row.toggleSelected(!!value)}
                    />
                  </label>
                  <div className="min-w-0 flex-1">{card}</div>
                </div>
              );
            })}
          </div>

          {pagination && (
            <div className="flex items-center justify-between gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-10 w-10 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
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
                return (
                  <TableRow
                    key={row.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={isSelected ? "bg-primary/5" : undefined}
                  >
                    {selectable && (
                      <TableCell className="w-10">
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
              {table.getFilteredRowModel().rows.length} result
              {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-9 gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <div className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
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
