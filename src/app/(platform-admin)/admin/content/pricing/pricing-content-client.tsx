"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { AppLink } from "@/components/navigation/app-link";
import { usePlans } from "@/features/plans/hooks";
import {
  useUserPreferences,
  useUpdateUserPreference,
} from "@/features/settings/hooks";
import type { Plan } from "@/types/billing";

/**
 * Pricing-content editorial view (Issue 10) + drift detection (Issue
 * 10 polish).
 *
 * The drift signal is the gap between each plan's `lastUpdated` and
 * the last time an admin marked the public pricing as "synced". The
 * marker is persisted as a user preference (key
 * `pricing.synced_at.<planId>`) so the workflow works today without
 * a backend `pricing_displays` table. When that table lands, swap
 * the local preference for the server-side `lastSyncedPlanVersion`
 * — the rest of this component doesn't change.
 *
 * Drift surfaces in two places:
 *   - A summary card at the top of the page totals "N plans need a
 *     marketing review" so it lines up with the dashboard attention
 *     panel's pricing-sync hint (Issue 1).
 *   - Each plan row gets an inline "Stale" badge and a "Mark synced"
 *     action that snapshots the current `lastUpdated`.
 */

const PRICING_SYNC_PREFIX = "pricing.synced_at.";

function prefKey(planId: string): string {
  return `${PRICING_SYNC_PREFIX}${planId}`;
}

function getSyncedAt(
  prefs: Record<string, unknown> | undefined,
  planId: string,
): number | null {
  if (!prefs) return null;
  const v = prefs[prefKey(planId)];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isPlanDrifted(plan: Plan, syncedAt: number | null): boolean {
  if (!plan.isPublic || plan.status !== "active") return false;
  if (syncedAt == null) return true; // never marked synced → assume stale
  return plan.lastUpdated > syncedAt;
}

function formatRelative(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function PlanRow({
  plan,
  syncedAt,
  isDrifted,
  onMarkSynced,
  saving,
}: {
  plan: Plan;
  syncedAt: number | null;
  isDrifted: boolean;
  onMarkSynced: () => void;
  saving: boolean;
}) {
  const visible = plan.isPublic && plan.status === "active";
  return (
    <li
      className={`flex items-start gap-3 rounded-md border p-4 ${
        isDrifted
          ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/[0.06]"
          : "bg-background/40"
      }`}
    >
      <Tags
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          isDrifted ? "text-amber-600" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            {plan.displayName || plan.name}
          </span>
          <Badge variant="outline" className="text-[10px] uppercase">
            {plan.tier}
          </Badge>
          <Badge
            variant={visible ? "default" : "secondary"}
            className="text-[10px] uppercase"
          >
            {visible ? (
              <>
                <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
                Public
              </>
            ) : (
              <>
                <EyeOff className="mr-1 h-3 w-3" aria-hidden="true" />
                {plan.status === "active" ? "Hidden" : plan.status}
              </>
            )}
          </Badge>
          {isDrifted && (
            <Badge
              variant="outline"
              className="border-amber-500/60 text-amber-700 dark:text-amber-300 text-[10px] uppercase"
            >
              <AlertTriangle
                className="mr-1 h-3 w-3"
                aria-hidden="true"
              />
              Stale
            </Badge>
          )}
        </div>
        {plan.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {plan.description}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          {syncedAt
            ? `Last synced ${formatRelative(syncedAt)}`
            : "Never marked synced"}
          {" · "}
          Plan updated {formatRelative(plan.lastUpdated)}
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="sm" variant="outline" className="h-7">
                <AppLink href={`/admin/plans/${plan.id}/edit`}>
                  Edit plan
                </AppLink>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Open the billing plan so you can adjust feature rules and pricing.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isDrifted ? "default" : "ghost"}
                className="h-7"
                onClick={onMarkSynced}
                disabled={saving || (!isDrifted && syncedAt != null)}
              >
                <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                {syncedAt == null
                  ? "Mark synced"
                  : isDrifted
                    ? "Mark synced again"
                    : "In sync"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Snapshot the current plan timestamp so the dashboard stops
              flagging this plan as drift. Doesn't change any public copy on
              its own — pair this with reviewing the public pricing page.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-muted-foreground"
                disabled
                title="Coming with the pricing-content backend endpoint"
              >
                Edit marketing copy
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Override display name, marketing description, feature
              highlights, and CTA copy for the public pricing page (lands with
              the backend half of Issue 10).
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </li>
  );
}

export default function PricingContentClient() {
  const plansQ = usePlans({ limit: 100 });
  const prefsQ = useUserPreferences();
  const updatePref = useUpdateUserPreference();
  const [savingId, setSavingId] = useState<string | null>(null);

  const sortedPlans = useMemo<Plan[]>(() => {
    const items = plansQ.data?.items ?? [];
    return [...items].sort((a, b) => {
      const order = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      if (order !== 0) return order;
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });
  }, [plansQ.data?.items]);

  const driftSummary = useMemo(() => {
    const drifted: Plan[] = [];
    const synced: Plan[] = [];
    const hidden: Plan[] = [];
    for (const plan of sortedPlans) {
      if (!plan.isPublic || plan.status !== "active") {
        hidden.push(plan);
        continue;
      }
      const syncedAt = getSyncedAt(prefsQ.data, plan.id);
      if (isPlanDrifted(plan, syncedAt)) drifted.push(plan);
      else synced.push(plan);
    }
    return { drifted, synced, hidden };
  }, [sortedPlans, prefsQ.data]);

  const markSynced = useCallback(
    (plan: Plan) => {
      setSavingId(plan.id);
      updatePref.mutate(
        { key: prefKey(plan.id), value: Math.floor(Date.now() / 1000) },
        {
          onSuccess: () => {
            toast.success(`${plan.displayName || plan.name}: marked synced.`);
            setSavingId(null);
          },
          onError: (err) => {
            toast.error(
              err instanceof Error ? err.message : "Couldn't save the marker.",
            );
            setSavingId(null);
          },
        },
      );
    },
    [updatePref],
  );

  if (plansQ.isLoading) return <PageSkeleton />;
  if (plansQ.isError) {
    return <ErrorState error={plansQ.error} onRetry={plansQ.refetch} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing"
        description="Editorial layer for the public marketing pricing page. Plans below feed the live website — keep marketing copy in sync."
      />

      {/* Issue 10 polish: drift summary card. Mirrors the
          dashboard attention panel's pricing-sync hint so admins land
          here when the dashboard says there's drift. */}
      <Card
        className={
          driftSummary.drifted.length > 0
            ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-500/[0.06]"
            : "border-emerald-400/40 bg-emerald-50/20 dark:bg-emerald-500/[0.04]"
        }
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {driftSummary.drifted.length > 0 ? (
              <>
                <AlertTriangle
                  className="h-4 w-4 text-amber-600"
                  aria-hidden="true"
                />
                {driftSummary.drifted.length} plan
                {driftSummary.drifted.length === 1 ? "" : "s"} need
                {driftSummary.drifted.length === 1 ? "s" : ""} a marketing review
              </>
            ) : (
              <>
                <Check
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
                All public plans are in sync
              </>
            )}
          </CardTitle>
          <CardDescription>
            {driftSummary.drifted.length > 0
              ? "These plans have changed since you last marked the public pricing as synced. Review the public pricing page, then mark each one synced below."
              : "No plan has changed since the last sync. The marketing pricing page is up to date."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://visichek.app/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open public pricing page
                  <ExternalLink
                    className="ml-2 h-3 w-3"
                    aria-hidden="true"
                  />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Open the live marketing pricing page in a new tab so you can
              confirm what visitors see.
            </TooltipContent>
          </Tooltip>
          <span className="text-xs text-muted-foreground">
            {driftSummary.synced.length} synced · {driftSummary.hidden.length}{" "}
            hidden / drafts
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Public plans ({driftSummary.drifted.length + driftSummary.synced.length})
          </CardTitle>
          <CardDescription>
            Plans marked <strong>public</strong> appear on the marketing
            pricing page. Toggling a plan in or out of public visibility
            happens on the plan edit page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedPlans.length === 0 ? (
            <p className="rounded-md border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              No plans configured yet — create one from Billing → Plans.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedPlans.map((plan) => {
                const syncedAt = getSyncedAt(prefsQ.data, plan.id);
                const drifted = isPlanDrifted(plan, syncedAt);
                return (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    syncedAt={syncedAt}
                    isDrifted={drifted}
                    onMarkSynced={() => markSynced(plan)}
                    saving={savingId === plan.id}
                  />
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
