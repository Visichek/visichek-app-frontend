"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { FilterBar } from "@/components/recipes/filter-bar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/utils/format-date";
import {
  useAuditLogs,
  useExportAuditLogs,
} from "@/features/audit/hooks/use-audit-logs";
import {
  AUDIT_OPERATION_OPTIONS,
  AUDIT_RANGE_OPTIONS,
  AUDIT_RESOURCE_TYPE_OPTIONS,
  auditDetailsText,
  rangeToTimestampGte,
} from "@/features/audit/lib/audit-display";
import type { AuditLog } from "@/types/audit";

const AUDIT_PAGE_SIZE = 25;

export default function AuditPage() {
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

  const listFilters = useMemo(
    () => ({
      skip: pageIndex * AUDIT_PAGE_SIZE,
      limit: AUDIT_PAGE_SIZE,
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

  const { data, isLoading } = useAuditLogs(listFilters);
  const exportMutation = useExportAuditLogs();
  const logs = data?.items ?? [];
  const meta = data?.meta;

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
      id: "actor",
      header: "Actor",
      cell: ({ row }) => {
        const log = row.original;
        const name = log.actorSummary?.fullName || log.actorId;
        const email = log.actorSummary?.email;
        const role = log.actorSummary?.role || log.actorRole;
        return (
          <div className="flex flex-col">
            <span className="text-sm">{name}</span>
            {email && (
              <span className="text-xs text-muted-foreground">{email}</span>
            )}
            {role && (
              <span className="text-xs text-muted-foreground">{role}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <span className="text-sm font-mono">{row.original.action}</span>
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
    const name = log.actorSummary?.fullName || log.actorId;
    const email = log.actorSummary?.email;
    const details = auditDetailsText(log.details);
    return (
      <div className="rounded-lg border p-4 space-y-1">
        <div className="font-mono text-sm">{log.action}</div>
        <div className="text-sm text-muted-foreground">
          {name} • {formatDateTime(log.timestamp)}
        </div>
        {email && (
          <div className="text-xs text-muted-foreground">{email}</div>
        )}
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

  const handleExport = async () => {
    try {
      const { filename } = await exportMutation.mutateAsync({ limit: 10000 });
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to export audit logs",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Immutable record of system activity"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full md:w-auto min-h-[44px]"
                onClick={handleExport}
                disabled={exportMutation.isPending}
                aria-busy={exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {exportMutation.isPending ? "Exporting…" : "Export"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Download the current audit log as an XLSX file for offline review
              or compliance reporting
            </TooltipContent>
          </Tooltip>
        }
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
        onChange={(key, value) => {
          setFilterValues((prev) => ({ ...prev, [key]: value }));
          setPageIndex(0);
        }}
        onClear={() => {
          setFilterValues({});
          setSearchInput("");
          setPageIndex(0);
        }}
        searchPlaceholder="Search by action or details"
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
          pageSize: AUDIT_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        emptyTitle="No audit events"
        emptyDescription="Audit events will appear here as the system is used."
        mobileCard={mobileCard}
      />
    </div>
  );
}
