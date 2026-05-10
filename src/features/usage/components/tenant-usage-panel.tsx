"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { useTenantUsage } from "@/features/usage/hooks/use-usage";
import type { TenantUsageSummary } from "@/types/billing";

// ── Local types & helpers ─────────────────────────────────────────────────────

interface CrudCounter {
  used: number;
  limit: number | null;
}

interface CrudCollectionUsage {
  create?: CrudCounter;
  update?: CrudCounter;
  delete?: CrudCounter;
}

interface RetrievalCollectionUsage {
  read?: CrudCounter;
}

function pickCount(
  counts: Record<string, number>,
  ...keys: string[]
): number {
  for (const k of keys) {
    const v = counts[k];
    if (typeof v === "number") return v;
  }
  return 0;
}

function pickCap(
  caps: Record<string, number | null>,
  ...keys: string[]
): number | null | undefined {
  for (const k of keys) {
    if (k in caps) return caps[k];
  }
  return undefined;
}

function formatPeriodReset(periodEnd: number | undefined): string | null {
  if (!periodEnd) return null;
  const seconds = periodEnd - Date.now() / 1000;
  if (seconds <= 0) return "Resets soon";
  const days = Math.ceil(seconds / 86400);
  if (days <= 1) return "Resets in <1 day";
  return `Resets in ${days} days`;
}

function subscriptionStatusVariant(status: string) {
  switch (status) {
    case "active":
      return "success" as const;
    case "trialing":
      return "info" as const;
    case "past_due":
      return "warning" as const;
    case "cancelled":
    case "suspended":
    case "expired":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function SectionDivider() {
  return <hr className="border-border" />;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

interface UsageRowProps {
  label: string;
  used: number;
  limit: number | null | undefined;
  /** Period reset hint, only shown for monthly counters that aren't unlimited/locked. */
  periodHint?: string | null;
  /** Optional unit suffix (e.g. "MB"). */
  unit?: string;
}

function UsageRow({ label, used, limit, periodHint, unit }: UsageRowProps) {
  const suffix = unit ? ` ${unit}` : "";

  // Locked: explicit zero cap means the feature is unavailable on this plan.
  if (limit === 0) {
    return (
      <div className="space-y-1.5 opacity-60">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            Locked under current plan
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary" />
      </div>
    );
  }

  // Unlimited: null cap means no ceiling.
  if (limit == null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono text-foreground">
              {used.toLocaleString()}
              {suffix}
            </span>{" "}
            · Unlimited
          </span>
        </div>
      </div>
    );
  }

  const overLimit = used >= limit;
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            "font-mono text-xs",
            overLimit ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {used.toLocaleString()}
          {suffix} of {limit.toLocaleString()}
          {suffix}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn(
            "h-full transition-all",
            overLimit ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {overLimit ? (
        <p className="text-xs font-medium text-destructive">
          Limit reached, upgrade to do more
        </p>
      ) : periodHint ? (
        <p className="text-xs text-muted-foreground">{periodHint}</p>
      ) : null}
    </div>
  );
}

function CrudCounterRow({
  label,
  counter,
}: {
  label: string;
  counter: CrudCounter | undefined;
}) {
  if (!counter) return null;
  return (
    <UsageRow
      label={label}
      used={counter.used ?? 0}
      limit={counter.limit ?? null}
    />
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function UsagePlanContext({ usage }: { usage: TenantUsageSummary }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Plan Context
      </p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Plan Name" value={usage.planName} />
        <Field label="Plan Tier" value={usage.planTier} />
        <Field
          label="Subscription Status"
          value={
            usage.subscriptionStatus ? (
              <Badge variant={subscriptionStatusVariant(usage.subscriptionStatus)}>
                {usage.subscriptionStatus.replace(/_/g, " ")}
              </Badge>
            ) : (
              "—"
            )
          }
        />
        <Field label="Period" value={usage.period} />
      </div>
    </div>
  );
}

function UsagePrimaryCounters({ usage }: { usage: TenantUsageSummary }) {
  const counts = usage.entityCounts ?? {};
  const caps = usage.entityCaps ?? {};

  const periodEnd =
    pickCount(counts, "period_end", "periodEnd") || undefined;
  const resetHint = formatPeriodReset(periodEnd);

  const rows: Array<UsageRowProps & { key: string; monthly?: boolean }> = [
    {
      key: "branches",
      label: "Locations",
      used: pickCount(counts, "branches"),
      limit: pickCap(caps, "max_branches", "maxBranches"),
    },
    {
      key: "departments",
      label: "Departments",
      used: pickCount(counts, "departments"),
      limit: pickCap(caps, "max_departments", "maxDepartments"),
    },
    {
      key: "system_users",
      label: "Team members",
      used: pickCount(counts, "system_users", "systemUsers"),
      limit: pickCap(caps, "max_system_users", "maxSystemUsers"),
    },
    {
      key: "visitors",
      label: "Visitors this month",
      used: pickCount(counts, "visitors_this_month", "visitorsThisMonth"),
      limit: pickCap(
        caps,
        "max_visitors_per_month",
        "maxVisitorsPerMonth"
      ),
      monthly: true,
    },
    {
      key: "appointments",
      label: "Appointments this month",
      used: pickCount(
        counts,
        "appointments_this_month",
        "appointmentsThisMonth"
      ),
      limit: pickCap(
        caps,
        "max_appointments_per_month",
        "maxAppointmentsPerMonth"
      ),
      monthly: true,
    },
    {
      key: "documents",
      label: "Documents stored",
      used: usage.storage?.documentsUsed ?? 0,
      limit: usage.storage?.documentsLimit ?? null,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Plan Usage
      </p>
      <div className="space-y-4">
        {rows.map((row) => (
          <UsageRow
            key={row.key}
            label={row.label}
            used={row.used}
            limit={row.limit}
            periodHint={row.monthly ? resetHint : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function UsageStorageMb({ usage }: { usage: TenantUsageSummary }) {
  const used = usage.storage?.storageMbUsed;
  const limit = usage.storage?.storageMbLimit;

  // Hide entirely when the storage provider hasn't reported usage (the docs
  // allow either rendering "—" or hiding — hiding keeps the panel tidy).
  if (used == null) return null;

  return (
    <>
      <SectionDivider />
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Storage
        </p>
        <UsageRow
          label="Storage used"
          used={used}
          limit={limit ?? null}
          unit="MB"
        />
      </div>
    </>
  );
}

function UsageSecondaryCounters({ usage }: { usage: TenantUsageSummary }) {
  const crudEntries = Object.entries(
    (usage.crudUsage ?? {}) as Record<string, CrudCollectionUsage>
  );
  const retrievalEntries = Object.entries(
    (usage.retrievalUsage ?? {}) as Record<string, RetrievalCollectionUsage>
  );

  // Per the guide: omit the entire detailed-quotas section when both maps are
  // empty (canonical Free / Starter / Premium plans don't ship explicit
  // CRUD or retrieval quotas).
  if (crudEntries.length === 0 && retrievalEntries.length === 0) return null;

  return (
    <>
      <SectionDivider />
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Detailed Quotas
        </p>
        {crudEntries.map(([collection, ops]) => (
          <div key={`crud-${collection}`} className="space-y-3">
            <p className="text-sm font-medium capitalize">
              {collection.replace(/_/g, " ")}
            </p>
            <div className="space-y-3">
              <CrudCounterRow label="Create" counter={ops.create} />
              <CrudCounterRow label="Update" counter={ops.update} />
              <CrudCounterRow label="Delete" counter={ops.delete} />
            </div>
          </div>
        ))}
        {retrievalEntries.map(([collection, ops]) => (
          <div key={`read-${collection}`} className="space-y-3">
            <p className="text-sm font-medium capitalize">
              {collection.replace(/_/g, " ")} (reads)
            </p>
            <CrudCounterRow label="Read" counter={ops.read} />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface TenantUsagePanelProps {
  tenantId: string;
}

export function TenantUsagePanel({ tenantId }: TenantUsagePanelProps) {
  const { data: usage, isLoading, isError } = useTenantUsage(tenantId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !usage) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Usage data unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UsagePlanContext usage={usage} />
      <SectionDivider />
      <UsagePrimaryCounters usage={usage} />
      <UsageStorageMb usage={usage} />
      <UsageSecondaryCounters usage={usage} />
    </div>
  );
}
