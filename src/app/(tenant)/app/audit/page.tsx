"use client";

import { Download, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/utils/format-date";
import {
  useAuditLogs,
  useExportAuditLogs,
} from "@/features/audit/hooks/use-audit-logs";
import type { AuditLog } from "@/types/audit";

export default function AuditPage() {
  const { data, isLoading } = useAuditLogs({ limit: 100 });
  const exportMutation = useExportAuditLogs();
  const logs = data?.items ?? [];

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
        const role = log.actorSummary?.role || log.actorRole;
        return (
          <div className="flex flex-col">
            <span className="text-sm">{name}</span>
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
  ];

  const mobileCard = (log: AuditLog) => {
    const name = log.actorSummary?.fullName || log.actorId;
    return (
      <div className="rounded-lg border p-4 space-y-1">
        <div className="font-mono text-sm">{log.action}</div>
        <div className="text-sm text-muted-foreground">
          {name} • {formatDateTime(log.timestamp)}
        </div>
        {log.resourceType && (
          <div className="text-xs text-muted-foreground">{log.resourceType}</div>
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
