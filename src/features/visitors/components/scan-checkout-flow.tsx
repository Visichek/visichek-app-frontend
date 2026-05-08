"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/table-skeleton";
import { useAwaitingCheckout, useCheckOut } from "@/features/visitors/hooks";
import { formatRelative } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils/cn";
import type { VisitSessionWithSummary } from "@/types/visitor";
import { BadgeScanner } from "./badge-scanner";

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

export function ScanCheckoutFlow() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<VisitSessionWithSummary | null>(null);

  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAwaitingCheckout({ start: 0, stop: 50 });

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

  async function handleScannedToken(token: string) {
    if (!picked || checkOut.isPending) return;
    const target = picked;
    const expected = target.badgeQrToken;
    if (expected && expected.trim() && expected.trim() !== token) {
      toast.error(
        "That badge doesn't match the selected visitor. Double-check the token or pick a different visitor.",
      );
      return;
    }
    try {
      await checkOut.mutateAsync({
        sessionId: target.id,
        badgeQrToken: token,
        checkOutMethod: "qr_scan",
      });
      toast.success(`${visitorName(target)} checked out`);
      router.push("/app/visitors/checked-out");
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

  if (picked) {
    return (
      <div className="space-y-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPicked(null)}
              disabled={checkOut.isPending}
              className="min-h-[44px]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Pick a different visitor
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Cancel this scan and choose a different visitor from the list
          </TooltipContent>
        </Tooltip>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            {picked.visitorProfileSummary?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={picked.visitorProfileSummary.photoUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover border shrink-0"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-full bg-muted shrink-0"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{visitorName(picked)}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[visitorCompany(picked), picked.purpose]
                  .filter(Boolean)
                  .join(" · ") || "No company or purpose"}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {[hostName(picked) && `Host: ${hostName(picked)}`, departmentName(picked)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold">Scan badge to confirm</h3>
          <p className="text-sm text-muted-foreground">
            Scan the visitor&apos;s badge QR or barcode. Once read, we&apos;ll
            check them out automatically.
          </p>
        </div>

        <BadgeScanner
          onResult={(token) => void handleScannedToken(token)}
          hideManualEntry={false}
        />

        {checkOut.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking out {visitorName(picked)}…
          </div>
        )}
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
            data.length === 0 ? "Nobody is awaiting checkout" : "No matches"
          }
          description={
            data.length === 0
              ? "When visitors check in, they'll appear here so you can scan their badge."
              : "Try a different search term, or clear the search to see everyone."
          }
        />
      ) : (
        <ul className="space-y-2" role="list">
          {filtered.map((row) => {
            const photo = row.visitorProfileSummary?.photoUrl;
            const name = visitorName(row);
            const company = visitorCompany(row);
            const host = hostName(row);
            const dept = departmentName(row);
            const checkedInAt = row.checkedInAt ?? row.checkInTime;
            const hasBadgeToken = !!row.badgeQrToken;
            return (
              <li key={row.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setPicked(row)}
                      className={cn(
                        "w-full rounded-lg border p-3 md:p-4 text-left transition-colors",
                        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
                        "hover:border-primary hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                            {hasBadgeToken && (
                              <span className="inline-flex items-center gap-1 text-xs text-success">
                                <ShieldCheck
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                Badge issued
                              </span>
                            )}
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
                      <span className="text-xs text-muted-foreground whitespace-nowrap md:text-right">
                        Checked in {formatRelative(checkedInAt)}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Pick this visitor and scan their badge to check them out
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
