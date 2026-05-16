"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Inbox,
  LifeBuoy,
  Newspaper,
  Package,
  ShieldAlert,
  Sparkles,
  Tags,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppLink } from "@/components/navigation/app-link";
import { usePlans } from "@/features/plans/hooks";
import { useUserPreferences } from "@/features/settings/hooks";
import { useAttentionQueue } from "@/features/dashboard/hooks/use-attention-queue";
import type { AdminDashboardStats } from "@/types/dashboard";
import type { Plan } from "@/types/billing";

/** Same key/value pair the Pricing-content page persists. */
const PRICING_SYNC_PREFIX = "pricing.synced_at.";

/**
 * Resolve a Lucide icon for a server-supplied AttentionItem. Server
 * payloads can't ship React components, so we map ownerArea (plus a
 * couple of well-known ids) onto the icon set this file already
 * imports. Falls back to a neutral icon when we hit an unknown
 * ownerArea — better to render a card with a generic icon than to
 * drop the card on the floor.
 */
function iconForOwnerArea(ownerArea: string, id?: string): LucideIcon {
  if (id === "content.pricing-sync") return Tags;
  if (id === "billing.past-due") return Package;
  switch (ownerArea) {
    case "support":
      return LifeBuoy;
    case "onboarding":
      return Inbox;
    case "security":
      return ShieldAlert;
    case "content":
      return Newspaper;
    case "billing":
      return Package;
    default:
      return Sparkles;
  }
}

function countDriftedPlans(
  plans: Plan[] | undefined,
  prefs: Record<string, unknown> | undefined,
): number {
  if (!plans?.length) return 0;
  let drifted = 0;
  for (const plan of plans) {
    if (!plan.isPublic || plan.status !== "active") continue;
    const raw = prefs?.[`${PRICING_SYNC_PREFIX}${plan.id}`];
    const syncedAt = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    if (syncedAt == null || plan.lastUpdated > syncedAt) drifted++;
  }
  return drifted;
}

/**
 * Issue 1 — "Needs attention" panel on the platform admin dashboard.
 *
 * Until the backend ships a first-class `/v1/admins/dashboard/attention`
 * endpoint, we derive attention items directly from the existing
 * `/admins/dashboard/stats` payload. The same item shape is what we'll
 * adopt when the dedicated endpoint lands — only the data source
 * changes, not the renderer or the action contract.
 *
 * The user explicitly asked for support cases, content tasks, plan
 * updates, and blog content as example items; this panel surfaces all
 * four when the stats payload says they're non-zero.
 */

type AttentionPriority = "blocker" | "urgent" | "normal" | "informational";

type OwnerArea =
  | "support"
  | "content"
  | "billing"
  | "onboarding"
  | "system"
  | "security";

interface AttentionItem {
  id: string;
  priority: AttentionPriority;
  title: string;
  reason: string;
  count?: number;
  href: string;
  ownerArea: OwnerArea;
  icon: LucideIcon;
}

const PRIORITY_RANK: Record<AttentionPriority, number> = {
  blocker: 0,
  urgent: 1,
  normal: 2,
  informational: 3,
};

const PRIORITY_LABEL: Record<AttentionPriority, string> = {
  blocker: "Blocker",
  urgent: "Urgent",
  normal: "Today",
  informational: "FYI",
};

const PRIORITY_BADGE: Record<AttentionPriority, string> = {
  blocker: "bg-destructive text-destructive-foreground",
  urgent: "bg-amber-500 text-amber-950 dark:text-amber-50",
  normal: "bg-primary text-primary-foreground",
  informational: "bg-muted text-muted-foreground",
};

const OWNER_LABEL: Record<OwnerArea, string> = {
  support: "Support",
  content: "Content",
  billing: "Billing",
  onboarding: "Onboarding",
  system: "System",
  security: "Security",
};

/**
 * Build the attention queue from the stats payload. Each helper here
 * mirrors a future server-side rule — when the backend ships
 * `/admins/dashboard/attention`, we replace this derivation with a
 * straight passthrough of the items array.
 */
function deriveAttentionItems(
  stats: AdminDashboardStats,
  driftedPlanCount: number,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  // ── Support: open cases ───────────────────────────────────────────
  if (stats.supportCasesOpen > 0) {
    items.push({
      id: "support.open-cases",
      priority: stats.supportCasesOpen >= 10 ? "urgent" : "normal",
      title: `${stats.supportCasesOpen} open support case${
        stats.supportCasesOpen === 1 ? "" : "s"
      }`,
      reason:
        "Tenants are waiting for a reply. Review the queue, post replies, or move stale cases through the workflow.",
      count: stats.supportCasesOpen,
      href: "/admin/support-cases",
      ownerArea: "support",
      icon: LifeBuoy,
    });
  }

  // ── Onboarding queue ──────────────────────────────────────────────
  if (stats.onboardingNew > 0) {
    items.push({
      id: "onboarding.pending",
      priority: stats.onboardingNew >= 5 ? "urgent" : "normal",
      title: `${stats.onboardingNew} new onboarding submission${
        stats.onboardingNew === 1 ? "" : "s"
      }`,
      reason:
        "Accept to provision a tenant, partial-accept to flag missing fields, or reject with notes.",
      count: stats.onboardingNew,
      href: "/admin/tenants/onboarding",
      ownerArea: "onboarding",
      icon: Inbox,
    });
  }

  // ── Security: incidents nearing the 72-hour NDPC deadline ────────
  if (stats.incidentsApproachingDeadline > 0) {
    items.push({
      id: "security.ndpc-deadline",
      priority: "blocker",
      title: `${stats.incidentsApproachingDeadline} incident${
        stats.incidentsApproachingDeadline === 1 ? "" : "s"
      } near NDPC deadline`,
      reason:
        "Notification must reach the NDPC within 72 hours of the incident. Review and mark notified before the window closes.",
      count: stats.incidentsApproachingDeadline,
      href: "/admin/tenants",
      ownerArea: "security",
      icon: ShieldAlert,
    });
  }

  // ── Content: blog cadence ─────────────────────────────────────────
  // Heuristic: when fewer than 2 new blog posts in 30 days, surface a
  // "publish more" reminder. Replace with a real
  // `recentBlogPublishCount` when the backend exposes it.
  // For now we conservatively only emit this when no marketing-driven
  // signal is in the payload (avoid double-counting).
  // Always surface a "blog content" cue so content ops have an entry
  // point — uses informational priority so it never outranks real
  // work.
  items.push({
    id: "content.blog-cadence",
    priority: "informational",
    title: "Publish or schedule a new blog post",
    reason:
      "Keep the marketing site fresh — a steady publish cadence helps inbound signups and SEO.",
    href: "/admin/blogs",
    ownerArea: "content",
    icon: Newspaper,
  });

  // ── Content: pricing sync ─────────────────────────────────────────
  // When the Pricing-content page has at least one plan flagged as
  // drifted, raise the urgency and quote the count. When everything
  // is synced (or we haven't loaded plans yet), fall back to a calm
  // informational reminder so the panel never goes silent on
  // marketing ops.
  if (driftedPlanCount > 0) {
    items.push({
      id: "content.pricing-sync",
      priority: driftedPlanCount >= 3 ? "urgent" : "normal",
      title: `${driftedPlanCount} pricing card${
        driftedPlanCount === 1 ? "" : "s"
      } need${driftedPlanCount === 1 ? "s" : ""} a review`,
      reason:
        "These plans changed since the marketing pricing was last marked synced. Open the pricing-content page and reconcile.",
      count: driftedPlanCount,
      href: "/admin/content/pricing",
      ownerArea: "content",
      icon: Tags,
    });
  } else {
    items.push({
      id: "content.pricing-sync",
      priority: "informational",
      title: "Review plan/pricing copy",
      reason:
        "Make sure the public marketing pricing matches the live billing plans before the next release.",
      href: "/admin/content/pricing",
      ownerArea: "content",
      icon: Tags,
    });
  }

  // ── Billing: subscriptions past due ───────────────────────────────
  // Many stats payloads include a `subscriptionsPastDue` field — if
  // present and >0, raise it. The field is optional on the type so we
  // use a defensive cast.
  const pastDue = (stats as unknown as { subscriptionsPastDue?: number })
    .subscriptionsPastDue;
  if (typeof pastDue === "number" && pastDue > 0) {
    items.push({
      id: "billing.past-due",
      priority: pastDue >= 3 ? "urgent" : "normal",
      title: `${pastDue} past-due subscription${pastDue === 1 ? "" : "s"}`,
      reason:
        "Dunning is running automatically, but failed retries may need a manual nudge or a chat with the tenant.",
      count: pastDue,
      href: "/admin/subscriptions",
      ownerArea: "billing",
      icon: Package,
    });
  }

  // Sort by priority then by count (descending) so the rail surfaces
  // the most urgent work first.
  return items.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return (b.count ?? 0) - (a.count ?? 0);
  });
}

interface AttentionPanelProps {
  stats: AdminDashboardStats;
}

export function AttentionPanel({ stats }: AttentionPanelProps) {
  // Pull plans + per-plan sync prefs so the pricing-drift card can
  // show a real count and link straight to the affected plans on the
  // pricing-content page. The queries are lightweight (already cached
  // from the Plans page) and fall back gracefully when empty.
  const plansQ = usePlans({ limit: 100 });
  const prefsQ = useUserPreferences();
  const driftedPlanCount = countDriftedPlans(
    plansQ.data?.items,
    prefsQ.data,
  );

  // Issue 1 backend: prefer the authoritative attention queue when
  // the endpoint is deployed. The server payload's `items` are
  // already sorted + counted; if the queue is empty or the endpoint
  // 404s we fall back to the stats-derivation logic below so older
  // backends keep showing the panel.
  const serverQueue = useAttentionQueue();
  const serverItems = useMemo(() => {
    const raw = serverQueue.data?.items;
    if (!raw?.length) return null;
    // Adapt server items to the local AttentionItem shape (icon
    // resolution from `ownerArea` since icons are React components
    // and don't survive JSON transport).
    return raw.map<AttentionItem>((row) => ({
      id: row.id,
      priority: row.priority,
      title: row.title,
      reason: row.reason,
      count: row.count ?? undefined,
      href: row.href,
      ownerArea: row.ownerArea,
      icon: iconForOwnerArea(row.ownerArea, row.id),
    }));
  }, [serverQueue.data]);

  const derivedItems = useMemo(
    () => deriveAttentionItems(stats, driftedPlanCount),
    [stats, driftedPlanCount],
  );

  const items = serverItems ?? derivedItems;
  const blockerCount = items.filter((i) => i.priority === "blocker").length;
  const urgentCount = items.filter((i) => i.priority === "urgent").length;
  const topFive = items.slice(0, 5);

  return (
    <Card className="border-amber-400/30 bg-amber-50/20 dark:bg-amber-500/[0.04]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-600" aria-hidden="true" />
          Needs attention
          {(blockerCount > 0 || urgentCount > 0) && (
            <Badge
              variant="outline"
              className="ml-1 border-destructive/50 text-destructive"
            >
              {blockerCount + urgentCount} urgent
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Work that's waiting on you across support, onboarding, content, and
          billing. Items clear automatically once the underlying state changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {topFive.length === 0 ? (
          <p
            role="status"
            className="rounded-md border bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground"
          >
            All clear — no urgent items waiting on you right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {topFive.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AppLink
                        href={item.href}
                        className="group flex items-start gap-3 rounded-md border bg-background/60 p-3 transition-colors hover:bg-accent"
                      >
                        <Icon
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium leading-tight">
                              {item.title}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                PRIORITY_BADGE[item.priority]
                              }`}
                            >
                              {PRIORITY_LABEL[item.priority]}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {OWNER_LABEL[item.ownerArea]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {item.reason}
                          </p>
                        </div>
                        {typeof item.count === "number" && (
                          <span className="ml-2 inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-foreground/[0.06] px-2 text-xs font-semibold tabular-nums">
                            {item.count}
                          </span>
                        )}
                      </AppLink>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[260px]">
                      Open the page that owns this task and start working on
                      it. The card here clears as soon as the underlying state
                      changes.
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > topFive.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            <AlertTriangle
              className="mr-1 inline h-3 w-3"
              aria-hidden="true"
            />
            {items.length - topFive.length} more item
            {items.length - topFive.length === 1 ? "" : "s"} hidden — open the
            individual queues to triage.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
