"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Activity,
  CalendarClock,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Loader2,
  ShieldAlert,
  ScrollText,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/recipes/page-header";
import { ChartBodySkeleton } from "@/components/recipes/chart-body-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/hooks/use-session";
import type { SystemUserRole } from "@/types/enums";
import type { SectionId } from "@/types/insights";

import { useInsights, type InsightsParams } from "@/features/insights/hooks/use-insights";
import { useAnalyticsGates } from "@/features/insights/lib/analytics-gates";
import {
  type DateRange,
  type RangePresetKey,
  resolvePreset,
} from "@/features/insights/lib/ranges";
import { SegmentButton, SegmentedControl } from "@/features/insights/components/segmented";
import { RangePicker } from "@/features/insights/components/range-picker";
import { InsightsKpiCard } from "@/features/insights/components/kpi-card";
import { SectionRenderer } from "@/features/insights/components/section-renderer";
import { LockedSection } from "@/features/insights/components/locked-section";
import { LiveStrip } from "@/features/insights/components/live-strip";
import { ExportButton } from "@/features/insights/components/export-button";
import {
  InsightsFilters,
  type InsightsFilterValues,
} from "@/features/insights/components/filters";
import type { Granularity } from "@/types/insights";

// ──────────────────────────────────────────────────────────────────────
// Role presentation (label/icon/accent/blurb). Data comes from the API.
// ──────────────────────────────────────────────────────────────────────

interface RoleView {
  label: string;
  icon: LucideIcon;
  accent: string;
  blurb: string;
}

const ROLE_VIEWS: Record<SystemUserRole, RoleView> = {
  super_admin: {
    label: "Super Admin",
    icon: TrendingUp,
    accent: "hsl(262 83% 58%)",
    blurb: "Org-wide rollup across every branch, department, and compliance area.",
  },
  dept_admin: {
    label: "Dept Admin",
    icon: ClipboardCheck,
    accent: "hsl(217 91% 60%)",
    blurb: "Visitor and appointment activity scoped to your department.",
  },
  receptionist: {
    label: "Receptionist",
    icon: ClipboardCheck,
    accent: "hsl(173 80% 40%)",
    blurb: "Live front-desk throughput — who's in, who's waiting, how fast.",
  },
  auditor: {
    label: "Auditor",
    icon: ScrollText,
    accent: "hsl(38 92% 50%)",
    blurb: "Read-only system-activity trail and export volume.",
  },
  security_officer: {
    label: "Security Officer",
    icon: ShieldAlert,
    accent: "hsl(0 84% 60%)",
    blurb: "Incident posture and NDPC notification deadlines.",
  },
  dpo: {
    label: "DPO",
    icon: Shield,
    accent: "hsl(199 89% 48%)",
    blurb: "Data-subject requests, consent health, and NDPA register coverage.",
  },
};

const ROLE_ORDER: SystemUserRole[] = [
  "super_admin",
  "dept_admin",
  "receptionist",
  "auditor",
  "security_officer",
  "dpo",
];

// ──────────────────────────────────────────────────────────────────────
// Per-role tabs. Each row is a layout row of section ids (1 = full width,
// 2 = side-by-side). "kpis" is a special row rendered as the KPI grid.
// ──────────────────────────────────────────────────────────────────────

type RowItem = SectionId | "kpis";

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  rows: RowItem[][];
}

const ROLE_TABS: Record<SystemUserRole, TabDef[]> = {
  super_admin: [
    { id: "overview", label: "Overview", icon: TrendingUp, description: "Org-wide KPIs, daily traffic, and the headline visitor mix.", rows: [["kpis"], ["traffic"], ["newReturning", "topDepartments"], ["hourly", "visitStatus"]] },
    { id: "compliance", label: "Compliance", icon: Shield, description: "Incident posture and data-subject requests across the organisation.", rows: [["incident", "dsr"], ["audit"]] },
    { id: "departments", label: "Departments", icon: Users, description: "Which departments and hours drive the most visitor volume.", rows: [["topDepartments"], ["hourly", "appointment"]] },
  ],
  dept_admin: [
    { id: "overview", label: "Overview", icon: ClipboardCheck, description: "Department KPIs, traffic, and how appointments and visits are tracking.", rows: [["kpis"], ["traffic"], ["appointment", "topDepartments"], ["hourly", "visitStatus"]] },
    { id: "appointments", label: "Appointments", icon: CalendarClock, description: "Appointment outcomes and the new-versus-returning split for your hosts.", rows: [["appointment", "newReturning"], ["traffic"]] },
    { id: "visitors", label: "Visitors", icon: Users, description: "Hourly arrival patterns, current visit statuses, and busiest hosts.", rows: [["hourly", "visitStatus"], ["topDepartments"]] },
  ],
  receptionist: [
    { id: "overview", label: "Overview", icon: ClipboardCheck, description: "Front-desk KPIs, daily traffic, hourly load, and the live stream.", rows: [["kpis"], ["traffic"], ["hourly", "visitStatus"], ["feed"]] },
    { id: "live-desk", label: "Live desk", icon: Activity, description: "The real-time check-in stream alongside current statuses and hourly load.", rows: [["feed"], ["visitStatus", "hourly"]] },
    { id: "hourly-flow", label: "Hourly flow", icon: Clock, description: "A detailed view of how arrivals spread across the day.", rows: [["hourly"], ["traffic"]] },
  ],
  auditor: [
    { id: "overview", label: "Overview", icon: ScrollText, description: "Audit-event KPIs, the activity timeline, and supporting visit context.", rows: [["kpis"], ["audit"], ["hourly", "visitStatus"]] },
    { id: "activity", label: "Activity", icon: Activity, description: "System actions over time, hourly distribution, and busiest departments.", rows: [["audit"], ["hourly", "topDepartments"]] },
    { id: "coverage", label: "Coverage", icon: FileCheck2, description: "Read-only visit and incident status coverage.", rows: [["visitStatus", "incident"], ["topDepartments"]] },
  ],
  security_officer: [
    { id: "overview", label: "Overview", icon: ShieldAlert, description: "Incident KPIs, current incident status, visit mix, and daily traffic.", rows: [["kpis"], ["incident", "visitStatus"], ["traffic"]] },
    { id: "incidents", label: "Incidents", icon: ShieldAlert, description: "Incident workflow status next to data-subject requests, plus the action trail.", rows: [["incident", "dsr"], ["audit"]] },
    { id: "activity-trail", label: "Activity trail", icon: Activity, description: "System actions over time with hourly load and busiest departments.", rows: [["audit"], ["hourly", "topDepartments"]] },
  ],
  dpo: [
    { id: "overview", label: "Overview", icon: Shield, description: "Privacy KPIs, the DSR mix, current visit statuses, and daily traffic.", rows: [["kpis"], ["dsr", "visitStatus"], ["traffic"]] },
    { id: "requests", label: "Requests", icon: FileCheck2, description: "Data-subject requests by type, the acquisition mix, and the action trail.", rows: [["dsr", "newReturning"], ["audit"]] },
    { id: "consent", label: "Consent", icon: ClipboardCheck, description: "Consent and visit-status health alongside where volume concentrates.", rows: [["newReturning", "visitStatus"], ["topDepartments"]] },
  ],
};

const DEFAULT_PRESET = "30d" as const;

// ──────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────

export function InsightsClient() {
  const { currentRole } = useSession();
  const gates = useAnalyticsGates();

  const [roleView, setRoleView] = useState<SystemUserRole>(
    currentRole && ROLE_VIEWS[currentRole] ? currentRole : "super_admin",
  );
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [presetKey, setPresetKey] = useState<RangePresetKey>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(() =>
    resolvePreset(DEFAULT_PRESET, Math.floor(Date.now() / 1000) - 86_400 * 90),
  );
  const [granularity, setGranularity] = useState<Granularity | "auto">("auto");
  const [filters, setFilters] = useState<InsightsFilterValues>({});
  const [showFilters, setShowFilters] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  // Default the role view to the signed-in user's role once it resolves.
  const appliedRoleDefault = useRef(false);
  useEffect(() => {
    if (!appliedRoleDefault.current && currentRole && ROLE_VIEWS[currentRole]) {
      appliedRoleDefault.current = true;
      setRoleView(currentRole);
      setActiveTab("overview");
    }
  }, [currentRole]);

  // Build the request. On Free we send no range/filters: the server forces the
  // fixed 7-day window and ignores them anyway, and this hits the cached view.
  const params = useMemo<InsightsParams>(() => {
    if (gates.isFreePlan) return { roleView };
    return {
      roleView,
      start: range.start,
      stop: range.stop,
      granularity: granularity === "auto" ? undefined : granularity,
      ...filters,
    };
  }, [gates.isFreePlan, roleView, range, granularity, filters]);

  // A relative preset (everything except an explicit custom window) ending
  // "now" with no filters set is still a now-anchored view — keep it polling.
  const filtersEmpty = Object.values(filters).every((v) => !v);
  const pollLive = gates.isFreePlan || (presetKey !== "custom" && filtersEmpty);

  const query = useInsights(params, { pollLive });
  const data = query.data;
  const meta = data?.meta;
  const view = ROLE_VIEWS[roleView];
  const tabs = ROLE_TABS[roleView];
  const activeTabDef = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  const availableSet = useMemo(
    () => new Set<SectionId>(meta?.availableSections ?? []),
    [meta],
  );

  function switchRole(next: SystemUserRole) {
    if (next === roleView) return;
    setPendingTarget(`role-${next}`);
    startTransition(() => {
      setRoleView(next);
      setActiveTab("overview");
      setFilters({});
    });
  }

  function switchTab(next: string) {
    if (next === activeTab) return;
    setPendingTarget(`tab-${next}`);
    startTransition(() => setActiveTab(next));
  }

  function applyPreset(next: Exclude<RangePresetKey, "custom">) {
    setPendingTarget(`range-${next}`);
    const tenantCreatedAt = meta?.tenantCreatedAt ?? Math.floor(Date.now() / 1000) - 86_400 * 365;
    startTransition(() => {
      setPresetKey(next);
      setRange(resolvePreset(next, tenantCreatedAt));
    });
  }

  function applyCustomRange(next: DateRange) {
    startTransition(() => {
      setPresetKey("custom");
      setRange(next);
    });
  }

  function applyGranularity(next: Granularity | "auto") {
    setPendingTarget(`gran-${next}`);
    startTransition(() => setGranularity(next));
  }

  useEffect(() => {
    if (!isPending) setPendingTarget(null);
  }, [isPending]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitor Insights"
        description="Live, role-scoped analytics for your organisation. Switch roles, tabs, and ranges to explore."
        actions={
          <div className="flex items-center gap-2">
            <ExportButton params={params} canExport={gates.canExport} />
          </div>
        }
      />

      {/* Live counter strip (SSE-backed, polling fallback) */}
      <LiveStrip role={roleView} />

      {/* Range + role view controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <RangePicker
          presetKey={presetKey}
          range={range}
          granularity={granularity}
          effectiveGranularity={meta?.granularity}
          tenantCreatedAt={meta?.tenantCreatedAt ?? Math.floor(Date.now() / 1000)}
          earliestData={meta?.earliestData}
          appliedRange={meta?.appliedRange ?? null}
          canCustomRange={gates.canCustomRange}
          pendingKey={pendingTarget}
          onPreset={applyPreset}
          onCustomRange={applyCustomRange}
          onGranularity={applyGranularity}
        />

        <SegmentedControl label="Role view" className="flex-wrap">
          {ROLE_ORDER.map((role) => {
            const RoleIcon = ROLE_VIEWS[role].icon;
            const loading = isPending && pendingTarget === `role-${role}`;
            return (
              <SegmentButton
                key={role}
                active={roleView === role}
                loading={loading}
                title={ROLE_VIEWS[role].blurb}
                onClick={() => switchRole(role)}
              >
                {loading ? null : <RoleIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                {ROLE_VIEWS[role].label}
              </SegmentButton>
            );
          })}
        </SegmentedControl>
      </div>

      {/* Role blurb */}
      <div
        className="flex items-center gap-2 rounded-lg border-l-4 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        style={{ borderLeftColor: view.accent }}
      >
        <view.icon className="h-4 w-4 shrink-0" style={{ color: view.accent }} aria-hidden="true" />
        <span>
          <span className="font-medium text-foreground">{view.label} view:</span> {view.blurb}
        </span>
      </div>

      {/* Filters (collapsible) — hidden on Free */}
      {!gates.isFreePlan && (
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            title="Show or hide the filters that narrow this view"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {showFilters ? "Hide filters" : "Filters"}
          </Button>
          {showFilters && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <InsightsFilters role={roleView} values={filters} onChange={setFilters} />
            </div>
          )}
        </div>
      )}

      {/* Per-role tab strip */}
      <div
        role="tablist"
        aria-label={`${view.label} insight sections`}
        className="flex flex-wrap items-center gap-1 border-b border-border"
      >
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const active = tab.id === activeTabDef.id;
          const loading = isPending && pendingTarget === `tab-${tab.id}`;
          // Free locks the two non-overview tabs.
          const locked = gates.isFreePlan && tab.id !== "overview";
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              // Native title (not Radix Tooltip): these tabs swap the chart
              // subtree, and a portalled tooltip racing the React 19 reconciler
              // on that swap can crash.
              title={locked ? `${tab.label} — available on paid plans` : tab.description}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "-mb-px inline-flex h-10 min-h-[40px] items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                locked && "opacity-70",
              )}
              style={active ? { borderBottomColor: view.accent } : undefined}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <TabIcon className="h-4 w-4" aria-hidden="true" />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {query.isError ? (
        <ErrorState
          title="Couldn't load insights"
          message="We hit a problem fetching this view. Try again."
          onRetry={() => query.refetch()}
        />
      ) : (
        <TabContent
          rows={activeTabDef.rows}
          kpis={data?.kpis ?? []}
          sections={data?.sections ?? {}}
          availableSet={availableSet}
          accent={view.accent}
          isLoading={query.isLoading}
          isFreePlan={gates.isFreePlan}
          tabId={activeTabDef.id}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Tab content rendering
// ──────────────────────────────────────────────────────────────────────

function TabContent({
  rows,
  kpis,
  sections,
  availableSet,
  accent,
  isLoading,
  isFreePlan,
  tabId,
}: {
  rows: RowItem[][];
  kpis: import("@/types/insights").Kpi[];
  sections: Partial<Record<SectionId, import("@/types/insights").Section>>;
  availableSet: Set<SectionId>;
  accent: string;
  isLoading: boolean;
  isFreePlan: boolean;
  tabId: string;
}) {
  return (
    <div className="space-y-4">
      {rows.map((row, i) => {
        if (row.length === 1 && row[0] === "kpis") {
          return (
            <KpiGrid key={`${tabId}-row-${i}`} kpis={kpis} isLoading={isLoading} />
          );
        }
        const items = row as SectionId[];
        return (
          <div
            key={`${tabId}-row-${i}`}
            className={items.length > 1 ? "grid gap-4 lg:grid-cols-2" : ""}
          >
            {items.map((id) => (
              <SlotRenderer
                key={id}
                id={id}
                section={sections[id]}
                available={availableSet.has(id)}
                accent={accent}
                isLoading={isLoading}
                isFreePlan={isFreePlan}
                tall={tabId === "hourly-flow" && id === "hourly"}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SlotRenderer({
  id,
  section,
  available,
  accent,
  isLoading,
  isFreePlan,
  tall,
}: {
  id: SectionId;
  section?: import("@/types/insights").Section;
  available: boolean;
  accent: string;
  isLoading: boolean;
  isFreePlan: boolean;
  tall: boolean;
}) {
  if (isLoading && !section) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <ChartBodySkeleton height={tall ? 340 : 240} />
      </div>
    );
  }
  // Locked: the section was gated server-side (absent + not in available set).
  if (!section) {
    if (!available) return <LockedSection id={id} height={tall ? 340 : 220} />;
    // Available but no data (shouldn't usually happen) — show empty via renderer.
    return null;
  }
  return <SectionRenderer id={id} section={section} accent={accent} tall={tall} />;
}

function KpiGrid({
  kpis,
  isLoading,
}: {
  kpis: import("@/types/insights").Kpi[];
  isLoading: boolean;
}) {
  if (isLoading && kpis.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6">
            <ChartBodySkeleton height={64} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <InsightsKpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}
