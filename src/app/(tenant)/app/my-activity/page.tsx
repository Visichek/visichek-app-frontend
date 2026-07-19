"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { FilterBar } from "@/components/recipes/filter-bar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format-date";
import { useMyAuditLogs } from "@/features/audit/hooks/use-audit-logs";
import {
  AUDIT_OPERATION_OPTIONS,
  AUDIT_RANGE_OPTIONS,
  AUDIT_RESOURCE_TYPE_OPTIONS,
  auditDetailsText,
  rangeToTimestampGte,
  readableAction,
  operationVariant,
} from "@/features/audit/lib/audit-display";
import type { AuditLog } from "@/types/audit";

const PAGE_SIZE = 25;

/**
 * "My activity" — a self-scoped audit feed every tenant role can see. The
 * backend (`GET /v1/audit-logs/me`) forces the actor to the current user, so
 * this only ever shows the signed-in user's own actions. Supports free-text
 * search plus operation / resource / time-range filters — all server-side.
 */
export default function MyActivityPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Debounce the search box into the wire param (≥2 chars).
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      setQ(trimmed.length >= 2 ? trimmed : "");
      setPageIndex(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(
    () => ({
      skip: pageIndex * PAGE_SIZE,
      limit: PAGE_SIZE,
      ...(q ? { q } : {}),
      ...(filterValues.operation ? { operation: filterValues.operation } : {}),
      ...(filterValues.resourceType
        ? { resourceType: filterValues.resourceType }
        : {}),
      ...(filterValues.range
        ? { timestampGte: rangeToTimestampGte(filterValues.range) }
        : {}),
    }),
    [pageIndex, q, filterValues],
  );

  const { data, isLoading } = useMyAuditLogs(filters);
  const logs = data?.items ?? [];
  const meta = data?.meta;

  function handleFilterChange(key: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  }

  function handleClear() {
    setFilterValues({});
    setSearchInput("");
    setPageIndex(0);
  }

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "timestamp",
      header: "Time",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.timestamp)}
        </span>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Badge variant={operationVariant(row.original.action)}>
            {readableAction(row.original.action)}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "resourceType",
      header: "Resource",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.resourceType || "—"}
        </span>
      ),
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const text = auditDetailsText(row.original.details);
        return text ? (
          <span
            className="block max-w-[28rem] truncate text-sm text-muted-foreground"
            title={text}
          >
            {text}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
    },
  ];

  const mobileCard = (log: AuditLog) => {
    const details = auditDetailsText(log.details);
    return (
      <div className="rounded-lg border p-4 space-y-1">
        <Badge variant={operationVariant(log.action)}>
          {readableAction(log.action)}
        </Badge>
        <div className="text-sm text-muted-foreground">
          {formatDateTime(log.timestamp)}
        </div>
        {log.resourceType && (
          <div className="text-xs text-muted-foreground">{log.resourceType}</div>
        )}
        {details && (
          <div className="text-xs text-muted-foreground break-words">
            {details}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My activity"
        description="A record of every action you've taken in this workspace."
      />

      <FilterBar
        filters={[
          {
            key: "operation",
            label: "Operation",
            type: "select",
            options: AUDIT_OPERATION_OPTIONS,
          },
          {
            key: "resourceType",
            label: "Resource type",
            type: "select",
            options: AUDIT_RESOURCE_TYPE_OPTIONS,
          },
          {
            key: "range",
            label: "Time range",
            type: "select",
            options: AUDIT_RANGE_OPTIONS,
          },
        ]}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleClear}
        searchPlaceholder="Search your activity by action or details"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
      />

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        emptyTitle="No activity yet"
        emptyDescription="Actions you take in VisiChek will appear here."
        mobileCard={mobileCard}
      />
    </div>
  );
}
