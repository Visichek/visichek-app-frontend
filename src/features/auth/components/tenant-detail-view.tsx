"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  BarChart2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils/cn";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useActiveSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { useTenantUsage } from "@/features/usage/hooks/use-usage";
import { AddSuperAdminDialog } from "@/features/auth/components/add-super-admin-dialog";
import type { AdminTenant } from "@/types/admin";
import type { TenantUsageSummary } from "@/types/billing";

const LIST_HREF = "/admin/tenants";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function SectionDivider() {
  return <hr className="border-border" />;
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

// ── Tabs ──────────────────────────────────────────────────────────────────────

function OverviewTab({ tenant }: { tenant: AdminTenant }) {
  return (
    <div className="space-y-5">
      <Section title="Identity">
        <Field label="Company Name" value={tenant.companyName} />
        <Field
          label="Tenant ID"
          value={
            <span className="font-mono text-xs break-all">{tenant.id}</span>
          }
        />
        <Field
          label="Status"
          value={
            tenant.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )
          }
        />
        <Field label="Country of Hosting" value={tenant.countryOfHosting} />
        <Field
          label="Created"
          value={tenant.dateCreated ? formatDate(tenant.dateCreated) : "—"}
        />
        <Field
          label="Last Updated"
          value={tenant.lastUpdated ? formatDate(tenant.lastUpdated) : "—"}
        />
      </Section>

      <SectionDivider />

      <Section title="Data Privacy">
        <Field
          label="Lawful Basis"
          value={tenant.lawfulBasis ? tenant.lawfulBasis.replace(/_/g, " ") : "—"}
        />
        <Field
          label="Notice Display Mode"
          value={
            tenant.noticeDisplayMode
              ? tenant.noticeDisplayMode.replace(/_/g, " ")
              : "—"
          }
        />
        <Field
          label="Retention Period"
          value={tenant.retentionDays ? `${tenant.retentionDays} days` : "—"}
        />
        <Field
          label="Default Retention Action"
          value={tenant.defaultRetentionAction}
        />
        <Field
          label="Cross-Border Approved"
          value={
            tenant.crossBorderApproved != null
              ? tenant.crossBorderApproved
                ? "Yes"
                : "No"
              : "—"
          }
        />
        <Field label="DPO Contact Email" value={tenant.dpoContactEmail} />
      </Section>

      {tenant.planSummary && (
        <>
          <SectionDivider />
          <Section title="Current Plan">
            <Field
              label="Plan"
              value={
                tenant.planSummary.planDisplayName || tenant.planSummary.planName
              }
            />
            <Field
              label="Tier"
              value={
                <span className="capitalize">{tenant.planSummary.planTier}</span>
              }
            />
            <Field
              label="Subscription"
              value={
                <Badge
                  variant={subscriptionStatusVariant(
                    tenant.planSummary.subscriptionStatus
                  )}
                >
                  {tenant.planSummary.subscriptionStatus.replace(/_/g, " ")}
                </Badge>
              }
            />
            <Field
              label="Billing Cycle"
              value={
                <span className="capitalize">
                  {tenant.planSummary.billingCycle}
                </span>
              }
            />
            <Field
              label="Price"
              value={`${tenant.planSummary.currency} ${tenant.planSummary.effectivePrice.toLocaleString()}`}
            />
            <Field
              label="Period Ends"
              value={
                tenant.planSummary.currentPeriodEnd
                  ? formatDate(tenant.planSummary.currentPeriodEnd)
                  : "—"
              }
            />
          </Section>
        </>
      )}

      <SectionDivider />

      <Section title="Settings">
        <Field
          label="Repeat Visitor Recognition"
          value={
            tenant.enableRepeatVisitorRecognition != null
              ? tenant.enableRepeatVisitorRecognition
                ? "Enabled"
                : "Disabled"
              : "—"
          }
        />
        <Field
          label="MFA Default for Users"
          value={
            tenant.mfaDefaultForUsers != null
              ? tenant.mfaDefaultForUsers
                ? "Yes"
                : "No"
              : "—"
          }
        />
        <Field
          label="MFA User Override"
          value={
            tenant.mfaUserOverrideAllowed != null
              ? tenant.mfaUserOverrideAllowed
                ? "Allowed"
                : "Blocked"
              : "—"
          }
        />
        <Field
          label="Privacy Policy URL"
          value={
            tenant.privacyPolicyUrl ? (
              <a
                href={tenant.privacyPolicyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 break-all"
              >
                {tenant.privacyPolicyUrl}
              </a>
            ) : (
              "—"
            )
          }
        />
      </Section>
    </div>
  );
}

function SubscriptionTab({ tenantId }: { tenantId: string }) {
  const { data: sub, isLoading, isError } = useActiveSubscription(tenantId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !sub) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No active subscription for this tenant.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Section title="Current Plan">
        <Field
          label="Plan ID"
          value={<span className="font-mono text-xs">{sub.planId}</span>}
        />
        <Field
          label="Status"
          value={
            <Badge variant={subscriptionStatusVariant(sub.status)}>
              {sub.status.replace(/_/g, " ")}
            </Badge>
          }
        />
        <Field label="Billing Cycle" value={sub.billingCycle} />
        <Field label="Trial Days" value={sub.trialDays ?? "—"} />
        <Field
          label="Subscription ID"
          value={<span className="font-mono text-xs">{sub.id}</span>}
        />
        <Field
          label="Created"
          value={sub.createdAt ? formatDate(sub.createdAt) : "—"}
        />
        <Field
          label="Updated"
          value={sub.updatedAt ? formatDate(sub.updatedAt) : "—"}
        />
      </Section>

      {sub.adminNotes && (
        <>
          <SectionDivider />
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin Notes
            </p>
            <p className="text-sm">{sub.adminNotes}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Usage helpers ─────────────────────────────────────────────────────────────

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

function UsageTab({ tenantId }: { tenantId: string }) {
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

function UsagePlanContext({ usage }: { usage: TenantUsageSummary }) {
  return (
    <Section title="Plan Context">
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
    </Section>
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

  // Hide the row entirely when the storage provider hasn't reported usage yet
  // (the docs allow either rendering "—" or hiding — hiding keeps the panel
  // tidy and is the documented preference for null usage).
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
  // empty (the canonical Free / Starter / Premium plans don't ship explicit
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

// ── View ──────────────────────────────────────────────────────────────────────

export interface TenantDetailViewProps {
  tenant: AdminTenant;
}

export function TenantDetailView({ tenant }: TenantDetailViewProps) {
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();
  const [addSuperAdminOpen, setAddSuperAdminOpen] = useState(false);

  const subscriptionsHref = `/admin/subscriptions?tenantId=${tenant.id}`;
  const usageHref = `/admin/subscriptions?tenantId=${tenant.id}&tab=usage`;
  const isNavigatingBack = loadingHref === LIST_HREF;
  const isNavigatingSubscriptions = loadingHref === subscriptionsHref;
  const isNavigatingUsage = loadingHref === usageHref;
  const tenantIsActive = tenant.isActive !== false;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="min-h-[44px] -ml-2"
            >
              <Link
                href={LIST_HREF}
                onClick={() => handleNavClick(LIST_HREF)}
              >
                {isNavigatingBack ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to tenants
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the tenants list
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={tenant.companyName}
        description={`Tenant ID: ${tenant.id}`}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => {
                    handleNavClick(subscriptionsHref);
                    navigate(subscriptionsHref);
                  }}
                >
                  {isNavigatingSubscriptions ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CreditCard
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  Subscriptions
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                View and manage this tenant&apos;s subscriptions
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => {
                    handleNavClick(usageHref);
                    navigate(usageHref);
                  }}
                >
                  {isNavigatingUsage ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <BarChart2
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  Usage
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the usage dashboard for this tenant
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    disabled={!tenantIsActive}
                    onClick={() => setAddSuperAdminOpen(true)}
                  >
                    <ShieldCheck
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                    Add super admin
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {tenantIsActive
                  ? "Add another super admin to this tenant — useful for offboarded admins, redundancy, or restoring access."
                  : "This tenant is inactive. Reactivate it before adding a super admin."}
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <AddSuperAdminDialog
        open={addSuperAdminOpen}
        onOpenChange={setAddSuperAdminOpen}
        tenantId={tenant.id}
        tenantName={tenant.companyName}
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab tenant={tenant} />
        </TabsContent>
        <TabsContent value="subscription" className="mt-0">
          <SubscriptionTab tenantId={tenant.id} />
        </TabsContent>
        <TabsContent value="usage" className="mt-0">
          <UsageTab tenantId={tenant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
