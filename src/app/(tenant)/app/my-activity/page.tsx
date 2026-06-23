"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format-date";
import { useMyAuditLogs } from "@/features/audit/hooks/use-audit-logs";
import type { AuditLog } from "@/types/audit";

const PAGE_SIZE = 25;

/** Render `incident.create` as a readable "Incident · create". */
function readableAction(action: string): string {
  if (!action) return "—";
  return action
    .split(".")
    .map((part) =>
      part
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    )
    .join(" · ");
}

function operationVariant(action: string) {
  if (action.endsWith(".delete") || action.includes("erase")) return "destructive" as const;
  if (action.endsWith(".create")) return "success" as const;
  if (action.endsWith(".update")) return "info" as const;
  if (action.endsWith(".read")) return "secondary" as const;
  return "secondary" as const;
}

/**
 * "My activity" — a self-scoped audit feed every tenant role can see. The
 * backend (`GET /v1/audit-logs/me`) forces the actor to the current user, so
 * this only ever shows the signed-in user's own actions. The full tenant
 * audit trail remains restricted to auditor / DPO / super_admin.
 */
export default function MyActivityPage() {
  const [pageIndex, setPageIndex] = useState(0);

  const filters = useMemo(
    () => ({ skip: pageIndex * PAGE_SIZE, limit: PAGE_SIZE }),
    [pageIndex],
  );

  const { data, isLoading } = useMyAuditLogs(filters);
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
  ];

  const mobileCard = (log: AuditLog) => (
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
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My activity"
        description="A record of every action you've taken in this workspace."
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
