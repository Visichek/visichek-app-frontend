"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/recipes/page-header";
import { ChartBodySkeleton } from "@/components/recipes/chart-body-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type { AdminTabId, Kpi, Section } from "@/types/insights";

import {
  useAdminInsights,
  toAdminInsightsQueryParams,
  type AdminInsightsParams,
} from "@/features/insights/hooks/use-admin-insights";
import { type DateRange } from "@/features/insights/lib/ranges";
import { InsightsKpiCard } from "@/features/insights/components/kpi-card";
import {
  SectionRenderer,
  type SectionSelectPayload,
} from "@/features/insights/components/section-renderer";
import { DrillBlock } from "@/features/insights/components/drill-block";
import { AdminLiveStrip } from "@/features/insights/components/admin-live-strip";
import { QuickActions } from "@/components/platform-admin/quick-actions";
import { AttentionPanel } from "@/features/dashboard/components/admin/attention-panel";
import { useAdminDashboardStats } from "@/features/auth/hooks/use-admin-dashboard";
import {
  AdminRangeBar,
  resolveAdminRange,
  type AdminRangeKey,
} from "@/features/insights/components/admin-range-bar";
import { FilterOverlay } from "@/features/insights/components/filter-overlay";
import {
  AdminFilters,
  activeFilterChips,
  chipsFromApplied,
  type AdminFilterValues,
} from "@/features/insights/components/admin-filters";

const ACCENT = "hsl(262 83% 58%)";
const ONE_DAY = 86_400;
const DEFAULT_RANGE_KEY = "7d" as const;
/** Fallback lower bound before meta.platformLaunchAt arrives (~2 years). */
const FALLBACK_LAUNCH = Math.floor(Date.now() / 1000) - ONE_DAY * 730;

/**
 * Platform admins don't need billing or visitor figures on this dashboard, so
 * we drop those KPIs (MRR, ARR, revenue, invoices, visitors) client-side.
 */
const HIDDEN_KPI = /revenue|\bmrr\b|\barr\b|invoice|visitor/i;
function isHiddenKpi(kpi: Kpi): boolean {
  return HIDDEN_KPI.test(kpi.key) || HIDDEN_KPI.test(kpi.label);
}

const naira = (n: number) =>
  `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Money KPI values are raw numbers; the `unit` field is the signal:
 *   "₦"     → major naira  → format ₦, drop the unit (don't append it)
 *   "minor" → kobo integer → /100 then format ₦
 *   "%" / null → leave for the card to render as-is.
 */
function withCurrency(kpi: Kpi): Kpi {
  if (typeof kpi.value !== "number") return kpi;
  if (kpi.unit === "₦") return { ...kpi, value: naira(kpi.value), unit: null };
  if (kpi.unit === "minor") return { ...kpi, value: naira(kpi.value / 100), unit: null };
  return kpi;
}

/** A drilled-into chart element (records are fetched lazily in the panel). */
interface SelectionEntry {
  id: string;
  sectionId: string;
  key: string;
  title: string;
  subtitle: string;
}

interface TabDef {
  id: AdminTabId;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Each row: ["kpis"] renders the KPI grid; otherwise a row of section ids. */
  rows: Array<Array<string>>;
}

const TABS: TabDef[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Headline platform KPIs, signups, revenue, and top tenants.",
    rows: [["kpis"], ["tenantSignups"], ["planTier"]],
  },
  {
    id: "tenants",
    label: "Tenants",
    icon: Building2,
    description: "Tenant growth, geography, and recent signups.",
    rows: [["kpis"], ["tenantSignups"], ["geography"], ["recentSignups"]],
  },
  {
    id: "risk",
    label: "Risk",
    icon: ShieldAlert,
    description: "Incident breakdown, NDPC deadlines, and the most urgent incidents.",
    rows: [["kpis"], ["incidentStatus", "incidentType"], ["incidentsTable"]],
  },
];

export function AdminInsightsClient() {
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");
  const [rangeKey, setRangeKey] = useState<AdminRangeKey>(DEFAULT_RANGE_KEY);
  const [range, setRange] = useState<DateRange>(() =>
    resolveAdminRange(DEFAULT_RANGE_KEY, FALLBACK_LAUNCH),
  );
  const [filters, setFilters] = useState<AdminFilterValues>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selections, setSelections] = useState<SelectionEntry[]>([]);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const selectionRef = useRef<HTMLDivElement>(null);
  const hintShownOnce = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const params = useMemo<AdminInsightsParams>(
    () => ({
      tab: activeTab,
      start: range.start,
      stop: range.stop,
      ...filters,
    }),
    [activeTab, range, filters],
  );

  // A relative window (not custom) with no filters is now-anchored → poll it.
  const filtersEmpty = Object.values(filters).every((v) => !v);
  const pollLive = rangeKey !== "custom" && filtersEmpty;

  const query = useAdminInsights(params, { pollLive });
  // Operational queue + quick actions still read the classic stats payload.
  const { data: attentionStats } = useAdminDashboardStats();
  const data = query.data;
  const meta = data?.meta;
  const launch = meta?.platformLaunchAt ?? FALLBACK_LAUNCH;
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  // Server-resolved chips (entity ids → names) when present; raw fallback else.
  const chips = meta?.appliedFilters
    ? chipsFromApplied(meta.appliedFilters)
    : activeFilterChips(filters);

  // Range + filters passed to drill so the records match the chart.
  const drillParams = useMemo(() => toAdminInsightsQueryParams(params), [params]);

  // Drill-down: highlight every selected key per section (a pie can have
  // several slices selected at once).
  const selectedBySection = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of selections) {
      (map[s.sectionId] ??= []).push(s.key);
    }
    return map;
  }, [selections]);

  function handleSelect(p: SectionSelectPayload) {
    const id = `${p.sectionId}:${p.key}`;
    setSelections((prev) => {
      if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id); // toggle off
      // First time a selection is ever added: nudge the user to the panel
      // below, then auto-dismiss the hint after 5s.
      if (prev.length === 0 && !hintShownOnce.current) {
        hintShownOnce.current = true;
        setShowScrollHint(true);
        hintTimer.current = setTimeout(() => setShowScrollHint(false), 5000);
      }
      return [
        ...prev,
        { id, sectionId: p.sectionId, key: p.key, title: p.sectionTitle, subtitle: p.label },
      ];
    });
  }

  function switchTab(next: AdminTabId) {
    if (next === activeTab) return;
    setPendingTarget(`tab-${next}`);
    startTransition(() => {
      setActiveTab(next);
      setFilters({});
      setSelections([]); // selections reference the previous tab's sections
    });
  }

  function changePreset(key: AdminRangeKey) {
    setRangeKey(key);
    // "custom" keeps the current range and reveals the date inputs.
    if (key !== "custom") setRange(resolveAdminRange(key, launch));
  }

  function clearFilter(key: keyof AdminFilterValues) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  useEffect(() => {
    if (!isPending) setPendingTarget(null);
  }, [isPending]);

  // Clear the hint timer on unmount so it can't fire after teardown.
  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Dashboard"
        description="Cross-tenant analytics — adjustable range, per-tab breakdowns, live counters."
        actions={
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => query.refetch()}
                  disabled={query.isFetching}
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} aria-hidden="true" />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Re-fetch the latest data for this view.</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {/* Operational queue first — support cases, onboarding, NDPC deadlines,
          content tasks — so they don't get buried under analytics. */}
      {attentionStats && <AttentionPanel stats={attentionStats} />}

      <QuickActions />

      <AdminLiveStrip />

      {/* Date presets (Today / 7d / 60d / 90d / All time) + Custom */}
      <AdminRangeBar
        activeKey={rangeKey}
        range={range}
        platformLaunchAt={meta?.platformLaunchAt ?? launch}
        effectiveGranularity={meta?.granularity}
        onPreset={changePreset}
        onCustomRange={setRange}
      />

      {/* Filters trigger + active-filter chips, under the range row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setFiltersOpen(true)}
          title="Open filters — they appear as removable tags once applied"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
          {chips.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1.5">
              {chips.length}
            </Badge>
          )}
        </Button>

        {chips.map((chip) => (
          <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
            {chip.text}
            <button
              type="button"
              onClick={() => clearFilter(chip.key as keyof AdminFilterValues)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove filter ${chip.text}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}
        {chips.length > 0 && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <FilterOverlay
        open={filtersOpen}
        onClear={() => setFilters({})}
        onClose={() => setFiltersOpen(false)}
      >
        <AdminFilters tab={activeTab} values={filters} onChange={setFilters} />
      </FilterOverlay>

      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Platform insight sections"
        className="flex flex-wrap items-center gap-1 border-b border-border"
      >
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const active = tab.id === activeTabDef.id;
          const loading = isPending && pendingTarget === `tab-${tab.id}`;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              // Native title (not Radix Tooltip): these tabs swap the chart
              // subtree, where a portalled tooltip can crash the reconciler.
              title={tab.description}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "-mb-px inline-flex h-10 min-h-[40px] items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              style={active ? { borderBottomColor: ACCENT } : undefined}
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
          message="We hit a problem generating this view. Try again."
          onRetry={() => query.refetch()}
        />
      ) : (
        <TabContent
          rows={activeTabDef.rows}
          kpis={(data?.kpis ?? []).filter((k) => !isHiddenKpi(k)).map(withCurrency)}
          sections={data?.sections ?? {}}
          isLoading={query.isLoading}
          tabId={activeTabDef.id}
          onSelect={handleSelect}
          selectedBySection={selectedBySection}
        />
      )}

      {/* Selection drill-down panel — at the bottom, below the charts */}
      {selections.length > 0 && (
        <div
          ref={selectionRef}
          className="scroll-mt-6 space-y-4 rounded-xl border-2 bg-card p-4"
          style={{ borderColor: "hsl(262 83% 58% / 0.4)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Selection
              <span className="ml-2 text-muted-foreground">
                {selections.length} item{selections.length === 1 ? "" : "s"} · click chart elements to add or remove
              </span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelections([])}>
              Clear selection
            </Button>
          </div>
          {selections.map((sel) => (
            <div key={sel.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {sel.title} <span className="text-muted-foreground">· {sel.subtitle}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setSelections((prev) => prev.filter((s) => s.id !== sel.id))}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remove ${sel.title} · ${sel.subtitle}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <DrillBlock scope="admin" sectionId={sel.sectionId} elementKey={sel.key} params={drillParams} />
            </div>
          ))}
        </div>
      )}

      {/* First-time hint: a floating pill nudging the user to the panel below */}
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
  isLoading,
  tabId,
  onSelect,
  selectedBySection,
}: {
  rows: Array<Array<string>>;
  kpis: Kpi[];
  sections: Record<string, Section> | Partial<Record<string, Section>>;
  isLoading: boolean;
  tabId: string;
  onSelect: (payload: SectionSelectPayload) => void;
  selectedBySection: Record<string, string[]>;
}) {
  return (
    <div className="space-y-4">
      {rows.map((row, i) => {
        if (row.length === 1 && row[0] === "kpis") {
          return <KpiGrid key={`${tabId}-row-${i}`} kpis={kpis} isLoading={isLoading} />;
        }
        return (
          <div key={`${tabId}-row-${i}`} className={row.length > 1 ? "grid gap-4 lg:grid-cols-2" : ""}>
            {row.map((id) => (
              <Slot
                key={id}
                id={id}
                section={sections[id]}
                isLoading={isLoading}
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
  isLoading,
  onSelect,
  selectedKeys,
}: {
  id: string;
  section?: Section;
  isLoading: boolean;
  onSelect: (payload: SectionSelectPayload) => void;
  selectedKeys: string[];
}) {
  if (isLoading && !section) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <ChartBodySkeleton height={240} />
      </div>
    );
  }
  if (!section) return null;
  return (
    <SectionRenderer
      id={id}
      section={section}
      accent={ACCENT}
      onSelect={onSelect}
      selectedKeys={selectedKeys}
    />
  );
}

function KpiGrid({ kpis, isLoading }: { kpis: Kpi[]; isLoading: boolean }): ReactNode {
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

