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
import type {
  AwaitingCheckoutItem,
  AwaitingCheckoutSourceType,
} from "@/types/visitor";

export interface AwaitingCheckoutPickerProps {
  /** Optional department scope. When set, only that department's visitors show. */
  departmentId?: string;
  /** Page size to request. Defaults to 50 (matches backend default). */
  pageSize?: number;
  /** Called after a successful checkout. Use to close a parent modal, etc. */
  onCheckedOut?: (row: AwaitingCheckoutItem) => void;
}

// Either `visitorSummary` (approved_checkin path) or
// `visitorProfileSummary` (visit_session / appointment path) is
// populated for any given row — never both. Render whichever is non-null
// and fall back to the flat fields the server denormalises onto every
// row.
function visitorName(row: AwaitingCheckoutItem): string {
  return (
    row.visitorSummary?.fullName ||
    row.visitorProfileSummary?.fullName ||
    row.visitorName ||
    "Unnamed visitor"
  );
}

function visitorCompany(row: AwaitingCheckoutItem): string | undefined {
  return (
    row.visitorSummary?.company ||
    row.visitorProfileSummary?.company ||
    row.company ||
    undefined
  ) ?? undefined;
}

function visitorPhoto(row: AwaitingCheckoutItem): string | undefined {
  return (
    row.visitorSummary?.portraitUrl ||
    row.visitorProfileSummary?.photoUrl ||
    undefined
  ) ?? undefined;
}

function hostName(row: AwaitingCheckoutItem): string | undefined {
  return row.hostSummary?.fullName;
}

function departmentName(row: AwaitingCheckoutItem): string | undefined {
  return row.departmentSummary?.name;
}

// Source-aware label for the timestamp. The server returns the right
// epoch under `eligibleSince` regardless of source, but the receptionist
// reads the row better when the verb matches the lifecycle.
const ELIGIBLE_LABEL: Record<AwaitingCheckoutSourceType, string> = {
  visit_session: "Checked in",
  approved_checkin: "Approved",
  scheduled_appointment: "Scheduled for",
};

const SOURCE_BADGE: Record<
  AwaitingCheckoutSourceType,
  { label: string; tooltip: string; tone: string }
> = {
  visit_session: {
    label: "Visit",
    tooltip: "Classic visit session — receptionist-driven check-in",
    tone: "bg-primary/10 text-primary",
  },
  approved_checkin: {
    label: "Self-registered",
    tooltip: "Visitor self-registered and a host approved them",
    tone: "bg-success/10 text-success",
  },
  scheduled_appointment: {
    label: "Appointment",
    tooltip:
      "Pre-booked appointment that has reached its day — checking out marks it fulfilled",
    tone: "bg-muted text-muted-foreground",
  },
};

export function AwaitingCheckoutPicker({
  departmentId,
  pageSize = 50,
  onCheckedOut,
}: AwaitingCheckoutPickerProps) {
  const [query, setQuery] = useState("");
  const [pendingRow, setPendingRow] = useState<AwaitingCheckoutItem | null>(
    null,
  );

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
      const phone = (row.phone ?? "").toLowerCase();
      return (
        name.includes(q) ||
        company.includes(q) ||
        host.includes(q) ||
        dept.includes(q) ||
        phone.includes(q)
      );
    });
  }, [data, query]);

  async function confirmCheckOut() {
    if (!pendingRow) return;
    const target = pendingRow;
    try {
      // Discriminated form per the spec: server resolves the right
      // collection from `sourceType`. Method is "manual" because the
      // receptionist confirmed via UI, not a badge scan — only persists
      // for `visit_session` rows; the other sources accept-and-ignore.
      await checkOut.mutateAsync({
        sourceType: target.sourceType,
        checkoutId: target.checkoutId,
        checkOutMethod: "manual",
      });
      toast.success(`${visitorName(target)} checked out`);
      setPendingRow(null);
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
            placeholder="Search by name, company, host, department, or phone"
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
              ? "When visitors check in, are approved, or have an appointment today, they'll appear here."
              : "Try a different search term, or clear the search to see everyone."
          }
        />
      ) : (
        <ul className="space-y-2" role="list">
          {filtered.map((row) => {
            const isThisRowPending =
              checkOut.isPending && pendingRow?.id === row.id;
            const photo = visitorPhoto(row);
            const name = visitorName(row);
            const company = visitorCompany(row);
            const host = hostName(row);
            const dept = departmentName(row);
            const sourceBadge = SOURCE_BADGE[row.sourceType];
            const eligibleLabel = ELIGIBLE_LABEL[row.sourceType];
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{name}</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              sourceBadge.tone,
                            )}
                          >
                            {sourceBadge.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {sourceBadge.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    </div>
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
                    {eligibleLabel} {formatRelative(row.eligibleSince)}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={() => setPendingRow(row)}
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
        open={pendingRow !== null}
        onOpenChange={(open) => {
          if (!open && !checkOut.isPending) setPendingRow(null);
        }}
        title="Check out this visitor?"
        description={
          pendingRow
            ? `${visitorName(pendingRow)} will be marked as ${
                pendingRow.sourceType === "scheduled_appointment"
                  ? "fulfilled"
                  : "checked out"
              }. This cannot be undone from this screen.`
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
