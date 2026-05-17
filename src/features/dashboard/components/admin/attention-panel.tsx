"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { usePlans } from "@/features/plans/hooks";
import { useUserPreferences } from "@/features/settings/hooks";
import { useAttentionQueue } from "@/features/dashboard/hooks/use-attention-queue";
import type { AdminDashboardStats } from "@/types/dashboard";
import type { Plan } from "@/types/billing";

const PRICING_SYNC_PREFIX = "pricing.synced_at.";
const COLLAPSE_STORAGE_KEY = "visichek_admin_attention_collapsed";

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

const OWNER_LABEL: Record<OwnerArea, string> = {
  support: "Support",
  content: "Content",
  billing: "Billing",
  onboarding: "Onboarding",
  system: "System",
  security: "Security",
};

/**
 * Neutral palette with a single red accent for urgency. No yellow,
 * no theme green — keeps the panel from competing with brand surfaces.
 */
const PRIORITY_TONE: Record<
  AttentionPriority,
  {
    card: string;
    accent: string;
    iconBg: string;
    iconText: string;
    pill: string;
  }
> = {
  blocker: {
    card: "border-destructive/40 hover:border-destructive/70",
    accent: "bg-destructive",
    iconBg: "bg-destructive/10",
    iconText: "text-destructive",
    pill: "bg-destructive/12 text-destructive",
  },
  urgent: {
    card: "border-border hover:border-foreground/30",
    accent: "bg-foreground/60",
    iconBg: "bg-foreground/[0.07]",
    iconText: "text-foreground",
    pill: "bg-foreground/[0.08] text-foreground",
  },
  normal: {
    card: "border-border hover:border-foreground/20",
    accent: "bg-muted-foreground/40",
    iconBg: "bg-muted",
    iconText: "text-muted-foreground",
    pill: "bg-muted text-muted-foreground",
  },
  informational: {
    card: "border-border hover:border-foreground/15",
    accent: "bg-muted-foreground/25",
    iconBg: "bg-muted",
    iconText: "text-muted-foreground",
    pill: "bg-muted text-muted-foreground",
  },
};

function deriveAttentionItems(
  stats: AdminDashboardStats,
  driftedPlanCount: number,
): AttentionItem[] {
  const items: AttentionItem[] = [];

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

  return items.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return (b.count ?? 0) - (a.count ?? 0);
  });
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

interface AttentionPanelProps {
  stats: AdminDashboardStats;
}

export function AttentionPanel({ stats }: AttentionPanelProps) {
  const { navigate } = useNavigationLoading();
  const plansQ = usePlans({ limit: 100 });
  const prefsQ = useUserPreferences();
  const driftedPlanCount = countDriftedPlans(plansQ.data?.items, prefsQ.data);

  const serverQueue = useAttentionQueue();
  const serverItems = useMemo(() => {
    const raw = serverQueue.data?.items;
    if (!raw?.length) return null;
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
  const urgentTotal = blockerCount + urgentCount;
  const topFive = items.slice(0, 5);

  const [collapsed, setCollapsed] = useState(false);
  // Hydrate collapsed state on mount only — avoids SSR/CSR mismatch.
  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);
  useEffect(() => {
    writeCollapsed(collapsed);
  }, [collapsed]);

  return (
    <section
      aria-label="Needs attention"
      className="space-y-3"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-medium text-muted-foreground">
            Needs attention
          </h2>
          {urgentTotal > 0 && (
            <span
              className="inline-flex h-5 items-center gap-1 rounded-full bg-destructive/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-destructive animate-in fade-in zoom-in-95"
              aria-label={`${urgentTotal} urgent item${urgentTotal === 1 ? "" : "s"}`}
            >
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
              </span>
              {urgentTotal} urgent
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
              aria-controls="attention-panel-body"
            >
              {collapsed ? (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Show
                  {urgentTotal > 0 && (
                    <span className="ml-1 tabular-nums">({urgentTotal})</span>
                  )}
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hide
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {collapsed
              ? "Show the attention queue and review what's waiting on you"
              : "Hide the attention queue from view — items still raise as toasts elsewhere"}
          </TooltipContent>
        </Tooltip>
      </div>

      {!collapsed && (
        <div id="attention-panel-body" className="space-y-3">
          {topFive.length === 0 ? (
            <p
              role="status"
              className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-1"
            >
              All clear — nothing urgent waiting on you right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topFive.map((item, idx) => {
                const Icon = item.icon;
                const tone = PRIORITY_TONE[item.priority];
                const isBlocker = item.priority === "blocker";
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(item.href)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(item.href);
                          }
                        }}
                        className={cn(
                          "group/attn relative flex min-h-[96px] cursor-pointer items-start gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-all",
                          "hover:shadow-sm hover:-translate-y-[1px]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "animate-in fade-in slide-in-from-bottom-2",
                          tone.card,
                        )}
                        style={{
                          animationDelay: `${idx * 60}ms`,
                          animationFillMode: "both",
                        }}
                        aria-label={`${item.title} — ${PRIORITY_LABEL[item.priority]}`}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-opacity",
                            tone.accent,
                            isBlocker && "animate-pulse",
                          )}
                        />

                        <div
                          className={cn(
                            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover/attn:scale-105",
                            tone.iconBg,
                          )}
                        >
                          <Icon
                            className={cn("h-5 w-5", tone.iconText)}
                            aria-hidden="true"
                          />
                          {isBlocker && (
                            <span
                              className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2"
                              aria-hidden="true"
                            >
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight text-foreground">
                              {item.title}
                            </span>
                            {typeof item.count === "number" && (
                              <span className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] px-1.5 text-xs font-semibold tabular-nums text-foreground/80">
                                {item.count}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {item.reason}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                tone.pill,
                              )}
                            >
                              {PRIORITY_LABEL[item.priority]}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                              {OWNER_LABEL[item.ownerArea]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px]">
                      Open the {OWNER_LABEL[item.ownerArea].toLowerCase()} queue
                      and start working on this. The card clears as soon as the
                      underlying state changes.
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {items.length > topFive.length && (
            <p className="text-xs text-muted-foreground">
              <AlertTriangle
                className="mr-1 inline h-3 w-3"
                aria-hidden="true"
              />
              {items.length - topFive.length} more item
              {items.length - topFive.length === 1 ? "" : "s"} hidden — open the
              individual queues to triage.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
