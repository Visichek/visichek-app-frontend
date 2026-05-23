"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Loader2,
  Lock,
  RefreshCw,
  ScrollText,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/recipes/page-header";
import { ChartBodySkeleton } from "@/components/recipes/chart-body-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/hooks/use-session";
import { useUpgradePrompt } from "@/features/limitations/components";
import type { SystemUserRole } from "@/types/enums";
import type { Kpi, Section, SectionId } from "@/types/insights";

import { useInsights, toInsightsQueryParams, type InsightsParams } from "@/features/insights/hooks/use-insights";
import { useAnalyticsGates, ANALYTICS_FEATURES } from "@/features/insights/lib/analytics-gates";
import { type DateRange } from "@/features/insights/lib/ranges";
import { AdminRangeBar, type RangeMode } from "@/features/insights/components/admin-range-bar";
import { FilterOverlay } from "@/features/insights/components/filter-overlay";
import {
  InsightsFilters,
  activeFilterChips,
  chipsFromApplied,
  type InsightsFilterValues,
} from "@/features/insights/components/filters";
import { InsightsKpiCard } from "@/features/insights/components/kpi-card";
import {
  SectionRenderer,
  type SectionSelectPayload,
} from "@/features/insights/components/section-renderer";
import { LockedSection } from "@/features/insights/components/locked-section";
import { DrillBlock } from "@/features/insights/components/drill-block";
import { LiveStrip } from "@/features/insights/components/live-strip";
import { QuickActions } from "@/components/tenant/quick-actions";

const ONE_DAY = 86_400;
const DEFAULT_ROLLING_DAYS = 30;
const FALLBACK_CREATED_AT = Math.floor(Date.now() / 1000) - ONE_DAY * 365;

interface RoleView {
  label: string;
  icon: LucideIcon;
  accent: string;
  blurb: string;
}

const ROLE_VIEWS: Record<SystemUserRole, RoleView> = {
  super_admin: { label: "Super Admin", icon: TrendingUp, accent: "hsl(262 83% 58%)", blurb: "Org-wide rollup across every branch, department, and compliance area." },
  dept_admin: { label: "Dept Admin", icon: ClipboardCheck, accent: "hsl(217 91% 60%)", blurb: "Visitor and appointment activity scoped to your department." },
  receptionist: { label: "Receptionist", icon: ClipboardCheck, accent: "hsl(173 80% 40%)", blurb: "Live front-desk throughput — who's in, who's waiting, how fast." },
  auditor: { label: "Auditor", icon: ScrollText, accent: "hsl(38 92% 50%)", blurb: "Read-only system-activity trail and export volume." },
  security_officer: { label: "Security Officer", icon: ShieldAlert, accent: "hsl(0 84% 60%)", blurb: "Incident posture and NDPC notification deadlines." },
  dpo: { label: "DPO", icon: Shield, accent: "hsl(199 89% 48%)", blurb: "Data-subject requests, consent health, and NDPA register coverage." },
};

type RowItem = string; // section id or "kpis"

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

interface SelectionEntry {
  id: string;
  sectionId: string;
  key: string;
  title: string;
  subtitle: string;
}

export function TenantInsightsClient() {
  const { currentRole } = useSession();
  const gates = useAnalyticsGates();
  const { promptUpgrade } = useUpgradePrompt();

  const [roleView, setRoleView] = useState<SystemUserRole>(
    currentRole && ROLE_VIEWS[currentRole] ? currentRole : "super_admin",
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [rangeMode, setRangeMode] = useState<RangeMode>("recent");
  const [rollingDays, setRollingDays] = useState(DEFAULT_ROLLING_DAYS);
  const [range, setRange] = useState<DateRange>(() => ({
    start: Math.floor(Date.now() / 1000) - DEFAULT_ROLLING_DAYS * ONE_DAY,
    stop: Math.floor(Date.now() / 1000),
  }));
  const [filters, setFilters] = useState<InsightsFilterValues>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selections, setSelections] = useState<SelectionEntry[]>([]);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const selectionRef = useRef<HTMLDivElement>(null);
  const hintShownOnce = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const appliedRoleDefault = useRef(false);
  useEffect(() => {
    if (!appliedRoleDefault.current && currentRole && ROLE_VIEWS[currentRole]) {
      appliedRoleDefault.current = true;
      setRoleView(currentRole);
      setActiveTab("overview");
    }
  }, [currentRole]);

  // On Free we omit range/filters: the server forces the fixed 7-day window
  // and ignores them, and this hits the cached view.
  const params = useMemo<InsightsParams>(() => {
    if (gates.isFreePlan) return { roleView, tab: activeTab };
    return { roleView, tab: activeTab, start: range.start, stop: range.stop, ...filters };
  }, [gates.isFreePlan, roleView, activeTab, range, filters]);

  const filtersEmpty = Object.values(filters).every((v) => !v);
  const pollLive = gates.isFreePlan || (rangeMode !== "custom" && filtersEmpty);

  const query = useInsights(params, { pollLive });
  const data = query.data;
  const meta = data?.meta;
  const view = ROLE_VIEWS[roleView];
  const tabs = ROLE_TABS[roleView];
  const activeTabDef = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  // Server-resolved chips (entity ids → names) when present; raw fallback else.
  const chips = meta?.appliedFilters
    ? chipsFromApplied(meta.appliedFilters)
    : activeFilterChips(filters);
  const createdAt = meta?.tenantCreatedAt ?? FALLBACK_CREATED_AT;
  const availableSet = useMemo(
    () => new Set<string>(meta?.availableSections ?? []),
    [meta],
  );
  const drillParams = useMemo(() => toInsightsQueryParams(params), [params]);

  const selectedBySection = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of selections) (map[s.sectionId] ??= []).push(s.key);
    return map;
  }, [selections]);

  function handleSelect(p: SectionSelectPayload) {
    const id = `${p.sectionId}:${p.key}`;
    setSelections((prev) => {
      if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id);
      if (prev.length === 0 && !hintShownOnce.current) {
        hintShownOnce.current = true;
        setShowScrollHint(true);
        hintTimer.current = setTimeout(() => setShowScrollHint(false), 5000);
      }
      return [...prev, { id, sectionId: p.sectionId, key: p.key, title: p.sectionTitle, subtitle: p.label }];
    });
  }

  function switchTab(next: string, locked: boolean) {
    if (locked) {
      promptUpgrade({ featureKey: ANALYTICS_FEATURES.roleTabs, title: "Role tabs" });
      return;
    }
    if (next === activeTab) return;
    setPendingTarget(`tab-${next}`);
    startTransition(() => {
      setActiveTab(next);
      setSelections([]);
    });
  }

  function changeMode(next: RangeMode) {
    const now = Math.floor(Date.now() / 1000);
    setRangeMode(next);
    if (next === "recent") setRange({ start: now - rollingDays * ONE_DAY, stop: now });
    else if (next === "all") setRange({ start: createdAt, stop: now });
  }

  function changeRollingDays(days: number) {
    const now = Math.floor(Date.now() / 1000);
    setRollingDays(days);
    setRange({ start: now - days * ONE_DAY, stop: now });
  }

  useEffect(() => {
    if (!isPending) setPendingTarget(null);
  }, [isPending]);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live, role-scoped analytics — adjustable range, per-tab breakdowns, drill-down, and live counters."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh">
                <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} aria-hidden="true" />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Re-fetch the latest data for this view.</TooltipContent>
          </Tooltip>
        }
      />

      <QuickActions />

      <LiveStrip role={roleView} />

      {gates.canCustomRange ? (
        <AdminRangeBar
          mode={rangeMode}
          rollingDays={rollingDays}
          range={range}
          platformLaunchAt={createdAt}
          effectiveGranularity={meta?.granularity}
          onMode={changeMode}
          onRollingDays={changeRollingDays}
          onCustomRange={setRange}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Time range</span>
          <button
            type="button"
            onClick={() => promptUpgrade({ featureKey: ANALYTICS_FEATURES.customRange, title: "Custom date ranges" })}
            title="Free plans see the last 7 days. Upgrade to choose any date range."
            className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            Last 7 days
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">Upgrade</span>
          </button>
        </div>
      )}

      {/* Filters trigger + chips (hidden on Free) */}
      {!gates.isFreePlan && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setFiltersOpen(true)} title="Open filters — they appear as removable tags once applied">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {chips.length > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5">{chips.length}</Badge>}
          </Button>
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
              {chip.text}
              <button
                type="button"
                onClick={() => setFilters((prev) => { const next = { ...prev }; delete next[chip.key as keyof InsightsFilterValues]; return next; })}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove filter ${chip.text}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {chips.length > 0 && (
            <button type="button" onClick={() => setFilters({})} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Clear all</button>
          )}
        </div>
      )}

      <FilterOverlay open={filtersOpen} onClear={() => setFilters({})} onClose={() => setFiltersOpen(false)}>
        <InsightsFilters role={roleView} values={filters} onChange={setFilters} />
      </FilterOverlay>

      {/* Tab strip */}
      <div role="tablist" aria-label={`${view.label} insight sections`} className="flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const active = tab.id === activeTabDef.id;
          const loading = isPending && pendingTarget === `tab-${tab.id}`;
          const locked = gates.isFreePlan && tab.id !== "overview";
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={locked ? `${tab.label} — available on paid plans` : tab.description}
              onClick={() => switchTab(tab.id, locked)}
              className={cn(
                "-mb-px inline-flex h-10 min-h-[40px] items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                locked && "opacity-70",
              )}
              style={active ? { borderBottomColor: view.accent } : undefined}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : locked ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <TabIcon className="h-4 w-4" aria-hidden="true" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {query.isError ? (
        <ErrorState title="Couldn't load insights" message="We hit a problem fetching this view. Try again." onRetry={() => query.refetch()} />
      ) : (
        <TabContent
          rows={activeTabDef.rows}
          kpis={data?.kpis ?? []}
          sections={data?.sections ?? {}}
          availableSet={availableSet}
          isFreePlan={gates.isFreePlan}
          isLoading={query.isLoading}
          accent={view.accent}
          tabId={activeTabDef.id}
          onSelect={handleSelect}
          selectedBySection={selectedBySection}
        />
      )}

      {/* Selection drill-down panel — at the bottom */}
      {selections.length > 0 && (
        <div ref={selectionRef} className="scroll-mt-6 space-y-4 rounded-xl border-2 bg-card p-4" style={{ borderColor: view.accent }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Selection
              <span className="ml-2 text-muted-foreground">{selections.length} item{selections.length === 1 ? "" : "s"} · click chart elements to add or remove</span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelections([])}>Clear selection</Button>
          </div>
          {selections.map((sel) => (
            <div key={sel.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{sel.title} <span className="text-muted-foreground">· {sel.subtitle}</span></p>
                <button
                  type="button"
                  onClick={() => setSelections((prev) => prev.filter((s) => s.id !== sel.id))}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${sel.title} · ${sel.subtitle}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <DrillBlock scope="tenant" sectionId={sel.sectionId} elementKey={sel.key} params={drillParams} />
            </div>
          ))}
        </div>
      )}

      {showScrollHint && (
        <button
          type="button"
          onClick={() => {
            selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            setShowScrollHint(false);
          }}
          aria-label="Scroll to the selection added below"
          className="fixed bottom-6 left-1/2 z-toast flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-background/40 text-foreground shadow-2xl ring-1 ring-black/5 backdrop-blur-md transition-colors hover:bg-background/60 animate-in fade-in zoom-in-90"
        >
          <ChevronDown className="h-5 w-5 animate-bounce motion-reduce:animate-none" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function TabContent({
  rows,
  kpis,
  sections,
  availableSet,
  isFreePlan,
  isLoading,
  accent,
  tabId,
  onSelect,
  selectedBySection,
}: {
  rows: RowItem[][];
  kpis: Kpi[];
  sections: Partial<Record<string, Section>>;
  availableSet: Set<string>;
  isFreePlan: boolean;
  isLoading: boolean;
  accent: string;
  tabId: string;
  onSelect: (payload: SectionSelectPayload) => void;
  selectedBySection: Record<string, string[]>;
}) {
  return (
    <div className="space-y-4">
      {rows.map((row, i) => {
        if (row.length === 1 && row[0] === "kpis") {
          return (
            <div key={`${tabId}-row-${i}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {isLoading && kpis.length === 0
                ? Array.from({ length: 4 }).map((_, k) => (
                    <div key={k} className="rounded-xl border border-border bg-card p-6"><ChartBodySkeleton height={64} /></div>
                  ))
                : kpis.map((k) => <InsightsKpiCard key={k.key} kpi={k} />)}
            </div>
          );
        }
        return (
          <div key={`${tabId}-row-${i}`} className={row.length > 1 ? "grid gap-4 lg:grid-cols-2" : ""}>
            {row.map((id) => (
              <Slot
                key={id}
                id={id}
                section={sections[id]}
                available={availableSet.has(id)}
                isFreePlan={isFreePlan}
                isLoading={isLoading}
                accent={accent}
                tall={tabId === "hourly-flow" && id === "hourly"}
                onSelect={onSelect}
                selectedKeys={selectedBySection[id] ?? []}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Slot({
  id,
  section,
  available,
  isFreePlan,
  isLoading,
  accent,
  tall,
  onSelect,
  selectedKeys,
}: {
  id: string;
  section?: Section;
  available: boolean;
  isFreePlan: boolean;
  isLoading: boolean;
  accent: string;
  tall: boolean;
  onSelect: (payload: SectionSelectPayload) => void;
  selectedKeys: string[];
}) {
  if (isLoading && !section) {
    return <div className="rounded-xl border border-border bg-card p-4"><ChartBodySkeleton height={tall ? 340 : 240} /></div>;
  }
  if (!section) {
    // Gated server-side (absent + not available) → locked placeholder.
    if (isFreePlan && !available) return <LockedSection id={id as SectionId} height={tall ? 340 : 220} />;
    return null;
  }
  return (
    <SectionRenderer
      id={id}
      section={section}
      accent={accent}
      tall={tall}
      onSelect={onSelect}
      selectedKeys={selectedKeys}
    />
  );
}
