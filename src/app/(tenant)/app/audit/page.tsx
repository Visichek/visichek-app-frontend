"use client";

import { Download } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils/format-date";
import { useAuditLogs } from "@/features/audit/hooks/use-audit-logs";
import type { AuditLog } from "@/types/audit";

export default function AuditPage() {
  const { data, isLoading } = useAuditLogs();
  const logs = data?.data || [];

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "occurred_at",
      header: "Time",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.occurred_at)}
        </span>
      ),
    },
    {
      id: "actor",
      header: "Actor",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.actor_name_snapshot || row.original.actor_id}
        </span>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <span className="text-sm font-mono">{row.original.action}</span>
      ),
    },
    {
      accessorKey: "target_entity",
      header: "Entity",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.target_entity || "—"}
        </span>
      ),
    },
  ];

  const mobileCard = (log: AuditLog) => (
    <div className="rounded-lg border p-4 space-y-1">
      <div className="font-mono text-sm">{log.action}</div>
      <div className="text-sm text-muted-foreground">
        {log.actor_name_snapshot || log.actor_id} • {formatDateTime(log.occurred_at)}
      </div>
      {log.target_entity && (
        <div className="text-xs text-muted-foreground">{log.target_entity}</div>
      )}
    </div>
  );

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export audit logs");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Immutable record of system activity"
        actions={
          <Button
            variant="outline"
            className="w-full md:w-auto min-h-[44px]"
            onClick={handleExport}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        pagination={true}
        pageSize={20}
        emptyTitle="No audit events"
        emptyDescription="Audit events will appear here as the system is used."
        mobileCard={mobileCard}
      />
    </div>
  );
}
