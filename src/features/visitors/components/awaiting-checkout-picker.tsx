"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  UserMinus,
  Users,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { useAwaitingCheckout, useCheckOut } from "@/features/visitors/hooks";
import { formatRelative } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils/cn";
import type { VisitSessionWithSummary } from "@/types/visitor";

export interface AwaitingCheckoutPickerProps {
  /** Optional department scope. When set, only that department's visitors show. */
  departmentId?: string;
  /** Page size to request. Defaults to 50 (matches backend default). */
  pageSize?: number;
  /** Called after a successful checkout. Use to close a parent modal, etc. */
  onCheckedOut?: (session: VisitSessionWithSummary) => void;
}

function visitorName(row: VisitSessionWithSummary): string {
  return (
    row.visitorProfileSummary?.fullName ||
    row.visitorNameSnapshot ||
    "Unnamed visitor"
  );
}

function visitorCompany(row: VisitSessionWithSummary): string | undefined {
  return row.visitorProfileSummary?.company || row.companySnapshot;
}

function hostName(row: VisitSessionWithSummary): string | undefined {
  return row.hostSummary?.fullName || row.hostNameSnapshot;
}

function departmentName(row: VisitSessionWithSummary): string | undefined {
  return row.departmentSummary?.name || row.departmentNameSnapshot;
}

export function AwaitingCheckoutPicker({
  departmentId,
  pageSize = 50,
  onCheckedOut,
}: AwaitingCheckoutPickerProps) {
  const [query, setQuery] = useState("");
  const [pendingSession, setPendingSession] =
    useState<VisitSessionWithSummary | null>(null);

  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAwaitingCheckout({
    departmentId,
    start: 0,
    stop: pageSize,
  });

  const checkOut = useCheckOut();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => {
      const name = visitorName(row).toLowerCase();
      const company = (visitorCompany(row) ?? "").toLowerCase();
      const host = (hostName(row) ?? "").toLowerCase();
      const dept = (departmentName(row) ?? "").toLowerCase();
      return (
        name.includes(q) ||
        company.includes(q) ||
        host.includes(q) ||
        dept.includes(q)
      );
    });
  }, [data, query]);

  async function confirmCheckOut() {
    if (!pendingSession) return;
    const target = pendingSession;
    try {
      await checkOut.mutateAsync({
        sessionId: target.id,
        checkOutMethod: "manual",
      });
      toast.success(`${visitorName(target)} checked out`);
      setPendingSession(null);
      onCheckedOut?.(target);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to check out visitor",
      );
    }
  }

  if (isLoading) {
    return <TableSkeleton rows={4} />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="h-4 w-4 mt-0.5 text-destructive"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-destructive">
              Couldn&apos;t load visitors awaiting checkout
            </p>
            <p className="text-muted-foreground mt-0.5">
              {error instanceof Error
                ? error.message
                : "Please try again in a moment."}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="min-h-[44px]"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Reload the awaiting-checkout list from the server
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            inputMode="search"
            placeholder="Search by name, company, host, or department"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 text-base md:text-sm min-h-[44px]"
            aria-label="Search visitors awaiting checkout"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="min-h-[44px] min-w-[44px]"
              aria-label="Refresh list"
            >
              {isRefetching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Reload the awaiting-checkout list now
          </TooltipContent>
        </Tooltip>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6 text-muted-foreground" />}
          title={
            data.length === 0
              ? "Nobody is awaiting checkout"
              : "No matches"
          }
          description={
            data.length === 0
              ? "When visitors check in, they'll appear here so you can check them out."
              : "Try a different search term, or clear the search to see everyone."
          }
        />
      ) : (
        <ul className="space-y-2" role="list">
          {filtered.map((row) => {
            const isThisRowPending =
              checkOut.isPending && pendingSession?.id === row.id;
            const photo = row.visitorProfileSummary?.photoUrl;
            const name = visitorName(row);
            const company = visitorCompany(row);
            const host = hostName(row);
            const dept = departmentName(row);
            const checkedInAt = row.checkedInAt ?? row.checkInTime;
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded-lg border p-3 md:p-4 transition-colors",
                  "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
                  isThisRowPending && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border shrink-0"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-full bg-muted shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[company, row.purpose].filter(Boolean).join(" · ") ||
                        "No company or purpose"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[host && `Host: ${host}`, dept]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 md:gap-4 md:justify-end">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Checked in {formatRelative(checkedInAt)}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => setPendingSession(row)}
                        disabled={checkOut.isPending}
                        className="min-h-[44px]"
                      >
                        {isThisRowPending ? (
                          <Loader2
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <UserMinus
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                          />
                        )}
                        Check out
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      End this visitor&apos;s session and mark them as checked
                      out
                    </TooltipContent>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingSession !== null}
        onOpenChange={(open) => {
          if (!open && !checkOut.isPending) setPendingSession(null);
        }}
        title="Check out this visitor?"
        description={
          pendingSession
            ? `${visitorName(pendingSession)} will be marked as checked out. This cannot be undone from this screen.`
            : ""
        }
        confirmLabel="Check out"
        cancelLabel="Cancel"
        onConfirm={confirmCheckOut}
        isLoading={checkOut.isPending}
      />
    </div>
  );
}
