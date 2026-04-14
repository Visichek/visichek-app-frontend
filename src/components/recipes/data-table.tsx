"use client";

import * as React from "react";
import {
  ColumnDef,
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
import { useMediaQuery } from "@/hooks/use-media-query";

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
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<Array<{ id: string; value: unknown }>>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
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

  // Show loading skeleton
  if (isLoading) {
    return <TableSkeleton rows={pageSize ?? 5} columns={columns.length} />;
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

  // Mobile: card-based list
  if (!isDesktop && mobileCard) {
    return (
      <div className="space-y-3">
        {/* Search */}
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-11"
          />
        )}

        {/* Card list */}
        <div className="space-y-2">
          {table.getRowModel().rows.map((row) => (
            <div key={row.id}>
              {mobileCard(row.original)}
            </div>
          ))}
        </div>

        {/* Pagination */}
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
    );
  }

  // Desktop: standard table
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Search input */}
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
        )}

        {/* Column visibility toggle */}
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

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
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
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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
  );
}
