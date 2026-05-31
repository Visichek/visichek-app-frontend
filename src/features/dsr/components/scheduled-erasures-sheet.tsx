"use client";

/**
 * The "Scheduled erasures" queue: visitor profiles soft-deleted via a DSR
 * erasure and awaiting permanent deletion. The DPO / super admin can restore
 * any of them (individually or in bulk) until the grace window elapses.
 *
 * Shown in a DetailSheet, opened from the Data Protection page. Uses the
 * shared DataTable recipe so multi-select bulk-restore comes for free.
 */

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Clock, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { DetailSheet } from "@/components/recipes/detail-sheet";
import { DataTable } from "@/components/recipes/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import {
  useRestoreVisitorProfile,
  useScheduledDeletions,
} from "@/features/dsr/hooks/use-visitor-erasure";
import { formatDate, formatRelative } from "@/lib/utils/format-date";
import type { ScheduledDeletionProfile } from "@/types/dpo";

interface ScheduledErasuresSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduledErasuresSheet({
  open,
  onOpenChange,
}: ScheduledErasuresSheetProps) {
  // Only fetch while the sheet is open — it's a low-frequency view.
  const { data, isLoading, isError, error, refetch } =
    useScheduledDeletions(open);
  const restore = useRestoreVisitorProfile();
  const profiles = data ?? [];

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [bulkRestoring, setBulkRestoring] = useState(false);

  async function restoreOne(id: string): Promise<boolean> {
    try {
      await restore.mutateAsync(id);
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore visitor data",
      );
      return false;
    }
  }

  async function handleRestore(id: string) {
    setRestoringId(id);
    const ok = await restoreOne(id);
    setRestoringId(null);
    if (ok) toast.success("Visitor data restored");
  }

  async function handleBulkRestore(ids: string[]) {
    if (ids.length === 0) return;
    setBulkRestoring(true);
    const results = await Promise.all(ids.map((id) => restoreOne(id)));
    setBulkRestoring(false);
    const ok = results.filter(Boolean).length;
    if (ok) toast.success(`Restored ${ok} visitor${ok === 1 ? "" : "s"}`);
  }

  const columns = useMemo<ColumnDef<ScheduledDeletionProfile>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Visitor",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.fullName}
            </p>
            {(row.original.emailAddress || row.original.phone) && (
              <p className="truncate text-xs text-muted-foreground">
                {[row.original.emailAddress, row.original.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "scheduledPurgeAt",
        header: "Permanent deletion",
        cell: ({ row }) => {
          const at = row.original.scheduledPurgeAt;
          if (!at) return <span className="text-sm text-muted-foreground">—</span>;
          return (
            <Badge variant="warning" className="gap-1 font-normal">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatDate(at)} ({formatRelative(at)})
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const id = row.original.id;
          const pending = restoringId === id || bulkRestoring;
          return (
            <div className="flex justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[40px]"
                    disabled={pending}
                    onClick={() => handleRestore(id)}
                  >
                    {restoringId === id ? (
                      <Loader2
                        className="mr-1 h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Restore
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Cancel the scheduled deletion and restore this visitor&apos;s
                  data
                </TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    // restoringId / bulkRestoring drive the per-row button state.
    [restoringId, bulkRestoring],
  );

  const mobileCard = (profile: ScheduledDeletionProfile) => {
    const pending = restoringId === profile.id || bulkRestoring;
    return (
      <div className="space-y-2 rounded-lg border p-4">
        <p className="text-sm font-medium">{profile.fullName}</p>
        {(profile.emailAddress || profile.phone) && (
          <p className="text-xs text-muted-foreground">
            {[profile.emailAddress, profile.phone].filter(Boolean).join(" · ")}
          </p>
        )}
        {profile.scheduledPurgeAt && (
          <Badge variant="warning" className="gap-1 font-normal">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Deletes {formatRelative(profile.scheduledPurgeAt)}
          </Badge>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px] w-full"
              disabled={pending}
              aria-label={`Restore ${profile.fullName}'s data and cancel its scheduled deletion`}
              onClick={() => handleRestore(profile.id)}
            >
              {restoringId === profile.id ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
              )}
              Restore
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Cancel the scheduled deletion and restore this visitor&apos;s data
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Scheduled erasures"
      description="Visitor profiles soft-deleted by a data subject erasure request. Restore one before its grace window closes, or it is permanently deleted."
    >
      {isError ? (
        <ErrorState
          title="Couldn't load scheduled erasures"
          message="We couldn't load the visitor profiles awaiting deletion."
          error={error}
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={profiles}
          isLoading={isLoading}
          pagination={false}
          selectable
          getRowId={(p) => p.id}
          itemNoun="profiles"
          bulkActions={[
            {
              label: "Restore",
              description: "Restore the selected visitor profiles",
              icon: <RotateCcw className="h-4 w-4" aria-hidden="true" />,
              variant: "outline",
              isLoading: bulkRestoring,
              onClick: (ids) => handleBulkRestore(ids),
            },
          ]}
          emptyTitle="Nothing scheduled for deletion"
          emptyDescription="When you fulfil an erasure request, the visitor's profile will appear here until it's permanently deleted."
          mobileCard={mobileCard}
        />
      )}
    </DetailSheet>
  );
}
