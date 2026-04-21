"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard, BarChart2, Loader2 } from "lucide-react";
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
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useActiveSubscription } from "@/features/subscriptions/hooks/use-subscriptions";
import { useTenantUsage } from "@/features/usage/hooks/use-usage";
import type { AdminTenant } from "@/types/admin";

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

  const entityEntries = Object.entries(usage.entityCounts ?? {});
  const capEntries = usage.entityCaps ?? {};

  return (
    <div className="space-y-5">
      <Section title="Plan Context">
        <Field label="Plan Name" value={usage.planName} />
        <Field label="Plan Tier" value={usage.planTier} />
        <Field
          label="Subscription Status"
          value={
            usage.subscriptionStatus ? (
              <Badge
                variant={subscriptionStatusVariant(usage.subscriptionStatus)}
              >
                {usage.subscriptionStatus.replace(/_/g, " ")}
              </Badge>
            ) : (
              "—"
            )
          }
        />
        <Field label="Period" value={usage.period} />
      </Section>

      <SectionDivider />

      <Section title="Storage">
        <Field
          label="Documents Used"
          value={`${usage.storage?.documentsUsed ?? 0}${
            usage.storage?.documentsLimit != null
              ? ` / ${usage.storage.documentsLimit}`
              : ""
          }`}
        />
        <Field
          label="Storage Used"
          value={`${usage.storage?.storageMbUsed ?? 0} MB${
            usage.storage?.storageMbLimit != null
              ? ` / ${usage.storage.storageMbLimit} MB`
              : ""
          }`}
        />
      </Section>

      {entityEntries.length > 0 && (
        <>
          <SectionDivider />
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Entity Counts
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {entityEntries.map(([key, count]) => {
                const cap = capEntries[key];
                return (
                  <Field
                    key={key}
                    label={key.replace(/_/g, " ")}
                    value={`${count}${cap != null ? ` / ${cap}` : ""}`}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export interface TenantDetailViewProps {
  tenant: AdminTenant;
}

export function TenantDetailView({ tenant }: TenantDetailViewProps) {
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();

  const subscriptionsHref = `/admin/subscriptions?tenantId=${tenant.id}`;
  const usageHref = `/admin/subscriptions?tenantId=${tenant.id}&tab=usage`;
  const isNavigatingBack = loadingHref === LIST_HREF;
  const isNavigatingSubscriptions = loadingHref === subscriptionsHref;
  const isNavigatingUsage = loadingHref === usageHref;

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
          </div>
        }
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
