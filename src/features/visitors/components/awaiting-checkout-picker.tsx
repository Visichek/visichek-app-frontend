"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  UserMinus,
  Users,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { useAwaitingCheckout, useCheckOut } from "@/features/visitors/hooks";
import { useShowBranch } from "@/hooks/use-show-branch";
import { formatRelative } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils/cn";
import type {
  AwaitingCheckoutItem,
  AwaitingCheckoutSourceType,
  CheckoutResult,
} from "@/types/visitor";

export interface AwaitingCheckoutPickerProps {
  /** Optional department scope. When set, only that department's visitors show. */
  departmentId?: string;
  /** Page size to request. Defaults to 50 (matches backend default). */
  pageSize?: number;
  /**
   * Called when the receptionist clicks "Done" on the success panel —
   * the signal that they're finished and want to leave the screen.
   * Not fired on individual checkouts; the panel stays open so multiple
   * visitors can be checked out from the same screen.
   */
  onDone?: () => void;
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
  return row.hostSummary?.name;
}

function departmentName(row: AwaitingCheckoutItem): string | undefined {
  return row.departmentSummary?.name;
}

function branchName(row: AwaitingCheckoutItem): string | undefined {
  return row.branchSummary?.name ?? undefined;
}

const ELIGIBLE_LABEL: Record<AwaitingCheckoutSourceType, string> = {
  visit_session: "Checked in",
  approved_checkin: "Approved",
  scheduled_appointment: "Scheduled for",
};

const TERMINAL_VERB: Record<AwaitingCheckoutSourceType, string> = {
  visit_session: "Checked out",
  approved_checkin: "Checked out",
  scheduled_appointment: "Marked fulfilled",
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

/**
 * Format the actual duration the server returned. Falls back to null
 * when the source row never had an `eligibleSince` to measure against —
 * we deliberately do NOT show "0 min" in that case because that misleads
 * the receptionist into thinking the stay was instantaneous.
 */
function formatDurationLabel(result: CheckoutResult): string | null {
  const minutes = result.actualDurationMinutes;
  if (minutes == null) return null;
  if (minutes < 1) return "less than 1 min";
  // Round half-hour and above into hours+min for readability —
  // "stayed 1h 23m" reads better than "stayed 83 min" at a glance.
  if (minutes >= 60) {
    const wholeHours = Math.floor(minutes / 60);
    const remainder = Math.round(minutes - wholeHours * 60);
    return remainder === 0
      ? `${wholeHours}h`
      : `${wholeHours}h ${remainder}m`;
  }
  return `${Math.round(minutes)} min`;
}

interface VarianceBadgeProps {
  variance: number | null | undefined;
}

/**
 * Renders the variance vs the visitor's expected duration.
 * Per spec: |variance| < 60s = "on time" (neutral), negative = "left
 * early" (green), positive = "stayed over" (amber). Returns null when
 * variance isn't available — appointments and visit_sessions never
 * carry an expected duration.
 */
function VarianceBadge({ variance }: VarianceBadgeProps) {
  if (variance == null) return null;
  const abs = Math.abs(variance);
  let tone: string;
  let label: string;
  if (abs < 60) {
    tone = "bg-muted text-muted-foreground";
    label = "On time";
  } else {
    const minutes = Math.round(abs / 60);
    if (variance < 0) {
      tone = "bg-success/10 text-success";
      label = `Left ${minutes} min early`;
    } else {
      tone = "bg-warning/10 text-warning";
      label = `Stayed ${minutes} min over`;
    }
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}

interface RecentEntry {
  row: AwaitingCheckoutItem;
  result: CheckoutResult;
}

export function AwaitingCheckoutPicker({
  departmentId,
  pageSize = 50,
  onDone,
}: AwaitingCheckoutPickerProps) {
  const showBranch = useShowBranch();
  const [query, setQuery] = useState("");
  const [pendingRow, setPendingRow] = useState<AwaitingCheckoutItem | null>(
    null,
  );
  const [pendingBatch, setPendingBatch] = useState<
    AwaitingCheckoutItem[] | null
  >(null);

  // Selection for multi-checkout. Keyed by row.id so it survives
  // refetches that re-shuffle the array.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Persistent log of who's been checked out from this screen, so the
  // receptionist can confirm their work before leaving via "Done".
  // Cleared on Done; not auto-dismissed because the receptionist may
  // batch through 5+ visitors and want all of them visible. Each entry
  // pairs the original picker row (for name / photo continuity) with
  // the server's CheckoutResult (for duration and variance).
  const [recentlyCheckedOut, setRecentlyCheckedOut] = useState<RecentEntry[]>(
    [],
  );

  // Tracks rows currently in flight during a batch so individual rows
  // can show a spinner without blocking other clicks.
  const [batchInFlight, setBatchInFlight] = useState<Set<string>>(
    () => new Set(),
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
    skip: 0,
    limit: pageSize,
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
      const branch = (branchName(row) ?? "").toLowerCase();
      const phone = (row.phone ?? "").toLowerCase();
      return (
        name.includes(q) ||
        company.includes(q) ||
        host.includes(q) ||
        dept.includes(q) ||
        branch.includes(q) ||
        phone.includes(q)
      );
    });
  }, [data, query]);

  // Trim selection to ids still present in the data — once a refetch
  // confirms the row is gone (terminal state filters it out), we
  // shouldn't keep "ghost" selections around.
  const visibleIds = useMemo(() => new Set(data.map((r) => r.id)), [data]);
  const liveSelection = useMemo(
    () =>
      [...selectedIds]
        .filter((id) => visibleIds.has(id))
        .map((id) => data.find((r) => r.id === id)!)
        .filter(Boolean),
    [selectedIds, visibleIds, data],
  );

  const allFilteredSelected =
    filtered.length > 0 &&
    filtered.every((row) => selectedIds.has(row.id));

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const row of filtered) next.add(row.id);
      } else {
        for (const row of filtered) next.delete(row.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleSingleCheckOut(row: AwaitingCheckoutItem) {
    setPendingRow(row);
  }

  async function confirmSingleCheckOut() {
    if (!pendingRow) return;
    const target = pendingRow;
    try {
      // Discriminated form per the spec: server resolves the right
      // collection from `sourceType`. Method is "manual" because the
      // receptionist confirmed via UI, not a badge scan — only persists
      // for `visit_session` rows; the other sources accept-and-ignore.
      const result = await checkOut.mutateAsync({
        sourceType: target.sourceType,
        checkoutId: target.checkoutId,
        checkOutMethod: "manual",
      });
      setRecentlyCheckedOut((prev) => [{ row: target, result }, ...prev]);
      setSelectedIds((prev) => {
        if (!prev.has(target.id)) return prev;
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      setPendingRow(null);
      const durationLabel = formatDurationLabel(result);
      toast.success(
        durationLabel
          ? `${visitorName(target)} checked out — stayed ${durationLabel}`
          : `${visitorName(target)} checked out`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to check out visitor",
      );
    }
  }

  function handleBatchCheckOut() {
    if (liveSelection.length === 0) return;
    setPendingBatch(liveSelection);
  }

  async function confirmBatchCheckOut() {
    if (!pendingBatch || pendingBatch.length === 0) return;
    const targets = pendingBatch;
    setPendingBatch(null);

    // Mark every target as in flight up front so individual rows can
    // show a spinner. We fire them in parallel — the backend doesn't
    // require ordering, and the receptionist is waiting on a wall
    // clock, not a serial replay.
    setBatchInFlight(new Set(targets.map((t) => t.id)));

    const results = await Promise.allSettled(
      targets.map((row) =>
        checkOut
          .mutateAsync({
            sourceType: row.sourceType,
            checkoutId: row.checkoutId,
            checkOutMethod: "manual",
          })
          .then((result) => ({ row, result })),
      ),
    );

    const succeeded: RecentEntry[] = [];
    const failed: { row: AwaitingCheckoutItem; reason: string }[] = [];
    results.forEach((settled, idx) => {
      const row = targets[idx];
      if (settled.status === "fulfilled") {
        succeeded.push(settled.value);
      } else {
        const reason =
          settled.reason instanceof Error
            ? settled.reason.message
            : "Unknown error";
        failed.push({ row, reason });
      }
    });

    setBatchInFlight(new Set());

    if (succeeded.length > 0) {
      setRecentlyCheckedOut((prev) => [...succeeded, ...prev]);
      // Drop checked-out rows from selection so the bar count shrinks.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of succeeded) next.delete(r.row.id);
        return next;
      });
    }

    if (failed.length === 0) {
      if (succeeded.length === 1) {
        const { row, result } = succeeded[0];
        const durationLabel = formatDurationLabel(result);
        toast.success(
          durationLabel
            ? `${visitorName(row)} checked out — stayed ${durationLabel}`
            : `${visitorName(row)} checked out`,
        );
      } else {
        toast.success(`${succeeded.length} visitors checked out`);
      }
    } else if (succeeded.length === 0) {
      toast.error(
        failed.length === 1
          ? `Failed to check out ${visitorName(failed[0].row)}: ${failed[0].reason}`
          : `Failed to check out ${failed.length} visitors`,
      );
    } else {
      toast.warning(
        `${succeeded.length} checked out, ${failed.length} failed — failed rows kept selected so you can retry`,
      );
    }
  }

  function handleDone() {
    setRecentlyCheckedOut([]);
    onDone?.();
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
      {recentlyCheckedOut.length > 0 && (
        <SuccessPanel
          entries={recentlyCheckedOut}
          onDone={handleDone}
          onDismiss={() => setRecentlyCheckedOut([])}
        />
      )}

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

      {liveSelection.length > 0 && (
        <BatchActionBar
          count={liveSelection.length}
          isPending={batchInFlight.size > 0 || checkOut.isPending}
          onClear={clearSelection}
          onCheckOutAll={handleBatchCheckOut}
        />
      )}

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
        <>
          <div className="flex items-center gap-2 px-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={(c) => toggleSelectAllVisible(c === true)}
                  aria-label="Select all visible visitors"
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                Select every visitor in the current view to check them out at
                once
              </TooltipContent>
            </Tooltip>
            <span className="text-xs text-muted-foreground">
              {allFilteredSelected
                ? `All ${filtered.length} selected`
                : `Select all (${filtered.length})`}
            </span>
          </div>
          <ul className="space-y-2" role="list">
            {filtered.map((row) => {
              const isInFlight = batchInFlight.has(row.id);
              const isSinglePending =
                checkOut.isPending && pendingRow?.id === row.id;
              const photo = visitorPhoto(row);
              const name = visitorName(row);
              const company = visitorCompany(row);
              const host = hostName(row);
              const dept = departmentName(row);
              const branch = showBranch ? branchName(row) : undefined;
              const sourceBadge = SOURCE_BADGE[row.sourceType];
              const eligibleLabel = ELIGIBLE_LABEL[row.sourceType];
              const isSelected = selectedIds.has(row.id);
              return (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-lg border p-3 md:p-4 transition-colors",
                    "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
                    (isSinglePending || isInFlight) && "opacity-60",
                    isSelected && "border-primary/60 bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="pt-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(c) =>
                              toggleRow(row.id, c === true)
                            }
                            aria-label={`Select ${name} for batch checkout`}
                            disabled={batchInFlight.size > 0}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Tick to add this visitor to the batch checkout
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        width={40}
                        height={40}
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
                        {[host && `Host: ${host}`, dept, branch && `Branch: ${branch}`]
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
                          onClick={() => handleSingleCheckOut(row)}
                          disabled={
                            checkOut.isPending || batchInFlight.size > 0
                          }
                          className="min-h-[44px]"
                        >
                          {isSinglePending || isInFlight ? (
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
                        End this visitor&apos;s session and mark them as
                        checked out
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
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
        onConfirm={confirmSingleCheckOut}
        isLoading={checkOut.isPending}
      />

      <ConfirmDialog
        open={pendingBatch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBatch(null);
        }}
        title={
          pendingBatch
            ? `Check out ${pendingBatch.length} visitors?`
            : "Check out visitors?"
        }
        description={
          pendingBatch
            ? `${pendingBatch.length} visitor${pendingBatch.length === 1 ? "" : "s"} will be marked as checked out (or fulfilled, for appointments). This cannot be undone from this screen.`
            : ""
        }
        confirmLabel="Check all out"
        cancelLabel="Cancel"
        onConfirm={confirmBatchCheckOut}
        isLoading={batchInFlight.size > 0}
      />
    </div>
  );
}

interface SuccessPanelProps {
  entries: RecentEntry[];
  onDone: () => void;
  onDismiss: () => void;
}

function SuccessPanel({ entries, onDone, onDismiss }: SuccessPanelProps) {
  const single = entries.length === 1 ? entries[0] : null;
  const singleDuration = single ? formatDurationLabel(single.result) : null;
  return (
    <section
      className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="h-5 w-5 text-success mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-success">
            {single
              ? `${visitorName(single.row)} ${TERMINAL_VERB[single.row.sourceType].toLowerCase()}`
              : `${entries.length} visitors checked out`}
          </h3>
          {single ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {singleDuration && <span>Stayed {singleDuration}</span>}
              <VarianceBadge
                variance={single.result.durationVarianceSeconds}
              />
              {!singleDuration && (
                <span>
                  Keep checking people out, or click Done when you&apos;re
                  finished.
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep checking people out from the list below, or click Done when
              you&apos;re finished.
            </p>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-8 w-8 shrink-0"
              aria-label="Dismiss success panel"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Hide this confirmation without leaving the page
          </TooltipContent>
        </Tooltip>
      </div>

      {entries.length > 1 && (
        <ul
          className="space-y-1 pl-8 text-sm max-h-48 overflow-y-auto"
          aria-label="Recently checked out visitors"
        >
          {entries.map(({ row, result }) => {
            const duration = formatDurationLabel(result);
            return (
              <li
                key={`${result.checkoutId}-${result.checkedOutAt}`}
                className="flex flex-wrap items-center gap-2 text-foreground/80"
              >
                <CheckCircle2
                  className="h-3.5 w-3.5 text-success shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">{visitorName(row)}</span>
                <span className="text-xs text-muted-foreground">
                  · {TERMINAL_VERB[row.sourceType]}
                </span>
                {duration && (
                  <span className="text-xs text-muted-foreground">
                    · {duration}
                  </span>
                )}
                <VarianceBadge variance={result.durationVarianceSeconds} />
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end pt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onDone} className="min-h-[40px]">
              Done
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Finish and go to the checked-out visitors list
          </TooltipContent>
        </Tooltip>
      </div>
    </section>
  );
}

interface BatchActionBarProps {
  count: number;
  isPending: boolean;
  onClear: () => void;
  onCheckOutAll: () => void;
}

function BatchActionBar({
  count,
  isPending,
  onClear,
  onCheckOutAll,
}: BatchActionBarProps) {
  return (
    <div
      className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      role="region"
      aria-label="Batch checkout"
    >
      <p className="text-sm font-medium">
        {count} selected
        <span className="text-xs font-normal text-muted-foreground ml-2">
          Check them all out at once.
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={isPending}
              className="min-h-[40px]"
            >
              Clear
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Deselect every visitor and stay on this screen
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={onCheckOutAll}
              disabled={isPending}
              className="min-h-[40px]"
            >
              {isPending ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Check out {count}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Check out every selected visitor in parallel
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
