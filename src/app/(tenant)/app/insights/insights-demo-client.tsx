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
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ScrollText,
  Shield,
  Sparkles,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/recipes/page-header";
import { StatCard } from "@/components/recipes/stat-card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { HeatmapBars } from "@/components/recipes/heatmap-bars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/hooks/use-session";
import type { SystemUserRole } from "@/types/enums";
import type { DistributionSlice, TimeSeriesPoint } from "@/types/dashboard";

// ──────────────────────────────────────────────────────────────────────
// Demo-data engine (no API — everything below is synthetic but stable)
// ──────────────────────────────────────────────────────────────────────

/** Deterministic PRNG so a given (range, nonce) seed reproduces the same
 *  dataset — keeps the page from "jumping" on every re-render while still
 *  letting the Shuffle button mint a fresh, repeatable scenario. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RangeKey = 7 | 30 | 90;

interface DemoData {
  trafficSeries: TimeSeriesPoint[];
  auditSeries: TimeSeriesPoint[];
  hourly: Array<{ label: string; value: number }>;
  visitStatus: DistributionSlice[];
  incidentStatus: DistributionSlice[];
  dsrType: DistributionSlice[];
  appointmentStatus: DistributionSlice[];
  newVsReturning: DistributionSlice[];
  topDepartments: Array<{ label: string; value: number }>;
  totals: {
    totalVisits: number;
    currentlyActive: number;
    awaitingCheckout: number;
    avgWaitMin: number;
    badgesPrinted: number;
    verificationRate: number;
    openIncidents: number;
    criticalIncidents: number;
    approachingDeadline: number;
    resolved30d: number;
    openDsr: number;
    consentRate: number;
    retentionPolicies: number;
    subProcessors: number;
    auditToday: number;
    audit7d: number;
    uniqueActors: number;
    exports30d: number;
    deptVisitorsToday: number;
    appointmentsToday: number;
    noShowRate: number;
    activeHosts: number;
  };
}

const DEPARTMENTS = [
  "Engineering",
  "Finance",
  "Human Resources",
  "Operations",
  "Legal & Compliance",
  "Executive Office",
  "Facilities",
];

function buildSeries(
  days: number,
  base: number,
  rand: () => number,
): TimeSeriesPoint[] {
  const out: TimeSeriesPoint[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.4 : 1;
    const noise = 0.7 + rand() * 0.65;
    const trend = 1 + (days - i) / (days * 3.5);
    out.push({
      timestamp: Math.floor(d.getTime() / 1000),
      label: d.toISOString().slice(0, 10),
      value: Math.max(1, Math.round(base * weekend * noise * trend)),
    });
  }
  return out;
}

function toDistribution(
  entries: Array<[string, string, number]>,
): DistributionSlice[] {
  const total = entries.reduce((sum, [, , v]) => sum + v, 0) || 1;
  return entries
    .filter(([, , v]) => v > 0)
    .map(([key, label, value]) => ({
      key,
      label,
      value,
      percentage: Math.round((value / total) * 1000) / 10,
    }));
}

function generateDemoData(range: RangeKey, nonce: number): DemoData {
  const rand = mulberry32(range * 1000 + nonce * 7 + 13);
  const r = () => rand();
  const pick = (min: number, max: number) =>
    Math.round(min + r() * (max - min));

  const trafficSeries = buildSeries(range, 60, r);
  const auditSeries = buildSeries(range, 140, r);
  const totalVisits = trafficSeries.reduce((s, p) => s + p.value, 0);

  // Hourly check-in shape: morning + post-lunch peaks, quiet overnight.
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const morning = Math.exp(-((h - 9.5) ** 2) / 6);
    const afternoon = Math.exp(-((h - 15) ** 2) / 8);
    const base = (morning * 1 + afternoon * 0.8) * 100;
    const open = h >= 7 && h <= 19 ? 1 : 0.06;
    return {
      label: `${String(h).padStart(2, "0")}:00`,
      value: Math.round(base * open * (0.7 + r() * 0.6)),
    };
  });

  const checkedIn = pick(180, 320);
  const pending = pick(20, 60);
  const checkedOut = Math.round(totalVisits * 0.78);
  const denied = pick(4, 18);

  const open = pick(2, 6);
  const investigating = pick(1, 4);
  const contained = pick(0, 3);
  const reported = pick(0, 2);
  const closed = pick(8, 22);

  const topDepartments = DEPARTMENTS.map((label) => ({
    label,
    value: pick(40, 320),
  })).sort((a, b) => b.value - a.value);

  return {
    trafficSeries,
    auditSeries,
    hourly,
    visitStatus: toDistribution([
      ["checked_in", "Checked in", checkedIn],
      ["pending_verification", "Pending verification", pending],
      ["checked_out", "Checked out", checkedOut],
      ["denied", "Denied", denied],
    ]),
    incidentStatus: toDistribution([
      ["open", "Open", open],
      ["investigating", "Investigating", investigating],
      ["contained", "Contained", contained],
      ["reported_to_ndpc", "Reported to NDPC", reported],
      ["closed", "Closed", closed],
    ]),
    dsrType: toDistribution([
      ["access", "Access", pick(6, 18)],
      ["correction", "Correction", pick(2, 9)],
      ["deletion", "Deletion", pick(3, 12)],
      ["consent_withdrawal", "Consent withdrawal", pick(1, 6)],
    ]),
    appointmentStatus: toDistribution([
      ["scheduled", "Scheduled", pick(40, 90)],
      ["fulfilled", "Fulfilled", pick(120, 220)],
      ["cancelled", "Cancelled", pick(8, 24)],
      ["missed", "Missed", pick(6, 20)],
    ]),
    newVsReturning: toDistribution([
      ["new", "New visitors", pick(120, 260)],
      ["returning", "Returning visitors", pick(180, 360)],
    ]),
    topDepartments,
    totals: {
      totalVisits,
      currentlyActive: checkedIn - checkedOut > 0 ? pick(40, 120) : pick(40, 120),
      awaitingCheckout: pending + pick(10, 40),
      avgWaitMin: pick(3, 11),
      badgesPrinted: checkedIn + checkedOut,
      verificationRate: pick(88, 99),
      openIncidents: open + investigating + contained,
      criticalIncidents: pick(0, 3),
      approachingDeadline: pick(0, 2),
      resolved30d: closed,
      openDsr: pick(3, 14),
      consentRate: pick(91, 99),
      retentionPolicies: pick(4, 9),
      subProcessors: pick(3, 8),
      auditToday: pick(120, 460),
      audit7d: auditSeries.slice(-7).reduce((s, p) => s + p.value, 0),
      uniqueActors: pick(8, 24),
      exports30d: pick(2, 12),
      deptVisitorsToday: pick(20, 90),
      appointmentsToday: pick(8, 36),
      noShowRate: pick(4, 16),
      activeHosts: pick(12, 48),
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Role views — the page is relevant to every tenant role
// ──────────────────────────────────────────────────────────────────────

interface StatItem {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  trend?: { value: number; isPositive: boolean };
}

interface RoleView {
  label: string;
  icon: LucideIcon;
  accent: string;
  blurb: string;
  kpis: (d: DemoData) => StatItem[];
}

const ROLE_VIEWS: Record<SystemUserRole, RoleView> = {
  super_admin: {
    label: "Super Admin",
    icon: TrendingUp,
    accent: "hsl(262 83% 58%)",
    blurb: "Org-wide rollup across every branch, department, and compliance area.",
    kpis: (d) => [
      { title: "Total visits", value: d.totals.totalVisits.toLocaleString(), description: "across the selected window", icon: <Users className="h-4 w-4" />, trend: { value: 12.4, isPositive: true } },
      { title: "Currently active", value: d.totals.currentlyActive, description: "on-site right now", icon: <Activity className="h-4 w-4" /> },
      { title: "Verification rate", value: `${d.totals.verificationRate}%`, description: "IDs verified at check-in", icon: <BadgeCheck className="h-4 w-4" />, trend: { value: 1.8, isPositive: true } },
      { title: "Open incidents", value: d.totals.openIncidents, description: `${d.totals.criticalIncidents} critical`, icon: <ShieldAlert className="h-4 w-4" />, trend: { value: 9.1, isPositive: false } },
    ],
  },
  dept_admin: {
    label: "Dept Admin",
    icon: ClipboardCheck,
    accent: "hsl(217 91% 60%)",
    blurb: "Visitor and appointment activity scoped to your department.",
    kpis: (d) => [
      { title: "Dept visitors today", value: d.totals.deptVisitorsToday, description: "checked into your department", icon: <Users className="h-4 w-4" />, trend: { value: 6.2, isPositive: true } },
      { title: "Appointments today", value: d.totals.appointmentsToday, description: "scheduled with your hosts", icon: <CalendarClock className="h-4 w-4" /> },
      { title: "No-show rate", value: `${d.totals.noShowRate}%`, description: "missed appointments (30d)", icon: <TrendingUp className="h-4 w-4" />, trend: { value: 2.3, isPositive: false } },
      { title: "Active hosts", value: d.totals.activeHosts, description: "receiving visitors", icon: <UserCog className="h-4 w-4" /> },
    ],
  },
  receptionist: {
    label: "Receptionist",
    icon: ClipboardCheck,
    accent: "hsl(173 80% 40%)",
    blurb: "Live front-desk throughput — who's in, who's waiting, how fast.",
    kpis: (d) => [
      { title: "Checked in today", value: d.totals.deptVisitorsToday * 3, description: "completed check-ins", icon: <ClipboardCheck className="h-4 w-4" />, trend: { value: 8.7, isPositive: true } },
      { title: "Awaiting checkout", value: d.totals.awaitingCheckout, description: "still on-site", icon: <Clock className="h-4 w-4" /> },
      { title: "Avg wait", value: `${d.totals.avgWaitMin} min`, description: "register → confirm", icon: <Activity className="h-4 w-4" />, trend: { value: 4.1, isPositive: true } },
      { title: "Badges printed", value: d.totals.badgesPrinted.toLocaleString(), description: "in the selected window", icon: <BadgeCheck className="h-4 w-4" /> },
    ],
  },
  auditor: {
    label: "Auditor",
    icon: ScrollText,
    accent: "hsl(38 92% 50%)",
    blurb: "Read-only system-activity trail and export volume.",
    kpis: (d) => [
      { title: "Audit events today", value: d.totals.auditToday, description: "actions recorded", icon: <ScrollText className="h-4 w-4" />, trend: { value: 14.2, isPositive: true } },
      { title: "Events (7d)", value: d.totals.audit7d.toLocaleString(), description: "rolling week", icon: <Activity className="h-4 w-4" /> },
      { title: "Unique actors", value: d.totals.uniqueActors, description: "distinct staff acting", icon: <UserCog className="h-4 w-4" /> },
      { title: "Exports (30d)", value: d.totals.exports30d, description: "audit packages pulled", icon: <FileCheck2 className="h-4 w-4" /> },
    ],
  },
  security_officer: {
    label: "Security Officer",
    icon: ShieldAlert,
    accent: "hsl(0 84% 60%)",
    blurb: "Incident posture and NDPC notification deadlines.",
    kpis: (d) => [
      { title: "Open incidents", value: d.totals.openIncidents, description: "not yet closed", icon: <ShieldAlert className="h-4 w-4" />, trend: { value: 5.0, isPositive: false } },
      { title: "Critical", value: d.totals.criticalIncidents, description: "highest severity", icon: <ShieldAlert className="h-4 w-4" /> },
      { title: "Deadline < 24h", value: d.totals.approachingDeadline, description: "NDPC 72h window", icon: <Clock className="h-4 w-4" /> },
      { title: "Resolved (30d)", value: d.totals.resolved30d, description: "closed incidents", icon: <BadgeCheck className="h-4 w-4" />, trend: { value: 11.0, isPositive: true } },
    ],
  },
  dpo: {
    label: "DPO",
    icon: Shield,
    accent: "hsl(199 89% 48%)",
    blurb: "Data-subject requests, consent health, and NDPA register coverage.",
    kpis: (d) => [
      { title: "Open DSRs", value: d.totals.openDsr, description: "awaiting fulfillment", icon: <Shield className="h-4 w-4" />, trend: { value: 3.4, isPositive: false } },
      { title: "Consent rate", value: `${d.totals.consentRate}%`, description: "visitors granting consent", icon: <BadgeCheck className="h-4 w-4" />, trend: { value: 1.2, isPositive: true } },
      { title: "Retention policies", value: d.totals.retentionPolicies, description: "active rules", icon: <FileCheck2 className="h-4 w-4" /> },
      { title: "Sub-processors", value: d.totals.subProcessors, description: "in the register", icon: <ClipboardCheck className="h-4 w-4" /> },
    ],
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

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: 7, label: "7 days" },
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
];

// ──────────────────────────────────────────────────────────────────────
// Tabbed sections — every role gets an Overview tab plus two tabs that
// surface the metrics that role actually works with. Content is described
// declaratively as rows of section kinds and rendered by `renderSection`.
// ──────────────────────────────────────────────────────────────────────

type SectionKind =
  | "kpis"
  | "traffic"
  | "audit"
  | "hourly"
  | "hourlyTall"
  | "visitStatus"
  | "incident"
  | "dsr"
  | "appointment"
  | "newReturning"
  | "topDepartments"
  | "feed";

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Plain-language hover hint describing what the tab shows. */
  description: string;
  /** Each inner array is one layout row: 1 kind = full width, 2 = side-by-side. */
  rows: SectionKind[][];
}

const ROLE_TABS: Record<SystemUserRole, TabDef[]> = {
  super_admin: [
    {
      id: "overview",
      label: "Overview",
      icon: TrendingUp,
      description: "Org-wide KPIs, daily traffic, and the headline visitor mix at a glance.",
      rows: [["kpis"], ["traffic"], ["newReturning", "topDepartments"], ["hourly", "visitStatus"]],
    },
    {
      id: "compliance",
      label: "Compliance",
      icon: Shield,
      description: "Incident posture and data-subject requests across the whole organisation.",
      rows: [["incident", "dsr"], ["audit"]],
    },
    {
      id: "departments",
      label: "Departments",
      icon: Users,
      description: "Which departments and which hours drive the most visitor volume.",
      rows: [["topDepartments"], ["hourly", "appointment"]],
    },
  ],
  dept_admin: [
    {
      id: "overview",
      label: "Overview",
      icon: ClipboardCheck,
      description: "Department KPIs, traffic, and how today's appointments and visits are tracking.",
      rows: [["kpis"], ["traffic"], ["appointment", "topDepartments"], ["hourly", "visitStatus"]],
    },
    {
      id: "appointments",
      label: "Appointments",
      icon: CalendarClock,
      description: "Appointment outcomes and the new-versus-returning split for your hosts.",
      rows: [["appointment", "newReturning"], ["traffic"]],
    },
    {
      id: "visitors",
      label: "Visitors",
      icon: Users,
      description: "Hourly arrival patterns, current visit statuses, and busiest departments.",
      rows: [["hourly", "visitStatus"], ["topDepartments"]],
    },
  ],
  receptionist: [
    {
      id: "overview",
      label: "Overview",
      icon: ClipboardCheck,
      description: "Front-desk KPIs, daily traffic, hourly load, and the live activity stream.",
      rows: [["kpis"], ["traffic"], ["hourly", "visitStatus"], ["feed"]],
    },
    {
      id: "live-desk",
      label: "Live desk",
      icon: Activity,
      description: "The real-time check-in stream alongside current statuses and hourly load.",
      rows: [["feed"], ["visitStatus", "hourly"]],
    },
    {
      id: "hourly-flow",
      label: "Hourly flow",
      icon: Clock,
      description: "A detailed view of how arrivals spread across the day to plan desk cover.",
      rows: [["hourlyTall"], ["traffic"]],
    },
  ],
  auditor: [
    {
      id: "overview",
      label: "Overview",
      icon: ScrollText,
      description: "Audit-event KPIs, the activity timeline, and supporting visit context.",
      rows: [["kpis"], ["audit"], ["hourly", "visitStatus"]],
    },
    {
      id: "activity",
      label: "Activity",
      icon: Activity,
      description: "System actions over time, hourly distribution, and the busiest departments.",
      rows: [["audit"], ["hourly", "topDepartments"]],
    },
    {
      id: "coverage",
      label: "Coverage",
      icon: FileCheck2,
      description: "Read-only visit and incident status coverage and where activity concentrates.",
      rows: [["visitStatus", "incident"], ["topDepartments"]],
    },
  ],
  security_officer: [
    {
      id: "overview",
      label: "Overview",
      icon: ShieldAlert,
      description: "Incident KPIs, current incident status, visit mix, and daily traffic.",
      rows: [["kpis"], ["incident", "visitStatus"], ["traffic"]],
    },
    {
      id: "incidents",
      label: "Incidents",
      icon: ShieldAlert,
      description: "Incident workflow status next to data-subject requests, plus the action trail.",
      rows: [["incident", "dsr"], ["audit"]],
    },
    {
      id: "activity-trail",
      label: "Activity trail",
      icon: Activity,
      description: "System actions over time with hourly load and the busiest departments.",
      rows: [["audit"], ["hourly", "topDepartments"]],
    },
  ],
  dpo: [
    {
      id: "overview",
      label: "Overview",
      icon: Shield,
      description: "Privacy KPIs, the DSR mix, current visit statuses, and daily traffic.",
      rows: [["kpis"], ["dsr", "visitStatus"], ["traffic"]],
    },
    {
      id: "requests",
      label: "Requests",
      icon: FileCheck2,
      description: "Data-subject requests by type, the visitor acquisition mix, and the action trail.",
      rows: [["dsr", "newReturning"], ["audit"]],
    },
    {
      id: "consent",
      label: "Consent",
      icon: BadgeCheck,
      description: "Consent and visit-status health alongside where visitor volume concentrates.",
      rows: [["newReturning", "visitStatus"], ["topDepartments"]],
    },
  ],
};

// ──────────────────────────────────────────────────────────────────────
// Live activity feed (synthetic ticker)
// ──────────────────────────────────────────────────────────────────────

const VISITOR_NAMES = [
  "Amara Okeke", "Tunde Bello", "Zainab Yusuf", "Chidi Nwosu", "Ngozi Eze",
  "Femi Adeyemi", "Halima Sani", "Emeka Obi", "Bukola Ade", "Ifeoma Udeh",
  "Sadia Bello", "Kunle Ojo", "Aisha Bala", "Obi Maduka", "Yetunde Cole",
];

type FeedStatus = "checked_in" | "pending_verification" | "checked_out" | "denied";

interface FeedEvent {
  id: number;
  name: string;
  dept: string;
  status: FeedStatus;
  at: number;
}

const FEED_STATUS_META: Record<
  FeedStatus,
  { label: string; dot: string; text: string }
> = {
  checked_in: { label: "Checked in", dot: "bg-success", text: "text-success" },
  pending_verification: { label: "Pending", dot: "bg-warning", text: "text-warning" },
  checked_out: { label: "Checked out", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  denied: { label: "Denied", dot: "bg-destructive", text: "text-destructive" },
};

const FEED_STATUSES: FeedStatus[] = [
  "checked_in", "checked_in", "checked_in", "pending_verification", "checked_out", "denied",
];

function makeFeedEvent(id: number): FeedEvent {
  const rand = mulberry32(id * 2654435761);
  const r = () => rand();
  return {
    id,
    name: VISITOR_NAMES[Math.floor(r() * VISITOR_NAMES.length)],
    dept: DEPARTMENTS[Math.floor(r() * DEPARTMENTS.length)],
    status: FEED_STATUSES[Math.floor(r() * FEED_STATUSES.length)],
    at: Date.now(),
  };
}

function relativeTime(at: number, now: number): string {
  const secs = Math.max(0, Math.floor((now - at) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

// ──────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────

export function InsightsDemoClient() {
  const { currentRole } = useSession();
  const [range, setRange] = useState<RangeKey>(30);
  const [roleView, setRoleView] = useState<SystemUserRole>(
    currentRole && ROLE_VIEWS[currentRole] ? currentRole : "super_admin",
  );
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [nonce, setNonce] = useState(0);
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

  const data = useMemo(() => generateDemoData(range, nonce), [range, nonce]);
  const view = ROLE_VIEWS[roleView];
  const kpis = useMemo(() => view.kpis(data), [view, data]);

  const tabs = ROLE_TABS[roleView];
  const activeTabDef = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const ctx: TabCtx = { data, range, accent: view.accent, kpis };

  function switchRange(next: RangeKey) {
    if (next === range) return;
    setPendingTarget(`range-${next}`);
    startTransition(() => setRange(next));
  }

  function switchRole(next: SystemUserRole) {
    if (next === roleView) return;
    setPendingTarget(`role-${next}`);
    // Every role's first tab is "overview", so resetting is always valid.
    startTransition(() => {
      setRoleView(next);
      setActiveTab("overview");
    });
  }

  function switchTab(next: string) {
    if (next === activeTab) return;
    setPendingTarget(`tab-${next}`);
    startTransition(() => setActiveTab(next));
  }

  // Clear the spinner target once the transition settles.
  useEffect(() => {
    if (!isPending) setPendingTarget(null);
  }, [isPending]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitor Insights"
        description="An interactive demo of VisiChek analytics. All figures below are synthetic — switch roles, tabs, and ranges to explore."
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Demo data
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setNonce((n) => n + 1)}
                  aria-label="Shuffle demo data"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Shuffle
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Regenerate a fresh synthetic scenario with new numbers across
                every chart on this page.
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {/* Controls: range + role view */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl label="Time range">
          {RANGE_OPTIONS.map((opt) => (
            <SegmentButton
              key={opt.key}
              active={range === opt.key}
              loading={isPending && pendingTarget === `range-${opt.key}`}
              title={`Show the last ${opt.label} of activity`}
              onClick={() => switchRange(opt.key)}
            >
              {opt.label}
            </SegmentButton>
          ))}
        </SegmentedControl>

        <SegmentedControl label="Role view" className="flex-wrap">
          {ROLE_ORDER.map((role) => {
            const RoleIcon = ROLE_VIEWS[role].icon;
            return (
              <SegmentButton
                key={role}
                active={roleView === role}
                loading={isPending && pendingTarget === `role-${role}`}
                title={ROLE_VIEWS[role].blurb}
                onClick={() => switchRole(role)}
              >
                {isPending && pendingTarget === `role-${role}` ? null : (
                  <RoleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                )}
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
        <view.icon
          className="h-4 w-4 shrink-0"
          style={{ color: view.accent }}
          aria-hidden="true"
        />
        <span>
          <span className="font-medium text-foreground">{view.label} view:</span>{" "}
          {view.blurb}
        </span>
      </div>

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
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              // Native title (not Radix Tooltip) is deliberate: these tabs swap
              // the chart subtree, and a portalled Radix Tooltip racing the
              // React 19 reconciler on that swap can crash. `title` is safe.
              title={tab.description}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "-mb-px inline-flex h-10 min-h-[40px] items-center gap-1.5 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
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

      {/* Active tab content */}
      <TabContent tab={activeTabDef} ctx={ctx} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Tab content rendering
// ──────────────────────────────────────────────────────────────────────

interface TabCtx {
  data: DemoData;
  range: RangeKey;
  accent: string;
  kpis: StatItem[];
}

function TabContent({ tab, ctx }: { tab: TabDef; ctx: TabCtx }) {
  return (
    <div className="space-y-4">
      {tab.rows.map((row, i) =>
        row.length === 1 ? (
          <div key={`${tab.id}-row-${i}`}>{renderSection(row[0], ctx)}</div>
        ) : (
          <div key={`${tab.id}-row-${i}`} className="grid gap-4 lg:grid-cols-2">
            {row.map((kind) => (
              <div key={kind}>{renderSection(kind, ctx)}</div>
            ))}
          </div>
        ),
      )}
    </div>
  );
}

function renderSection(kind: SectionKind, ctx: TabCtx): ReactNode {
  const { data, range, accent } = ctx;
  switch (kind) {
    case "kpis":
      return <KpiGrid kpis={ctx.kpis} />;
    case "traffic":
      return (
        <TimeSeriesChart
          title="Visitor traffic"
          description={`Daily check-ins over the last ${range} days`}
          data={data.trafficSeries}
          color={accent}
          height={300}
          valueLabel="Visits"
        />
      );
    case "audit":
      return (
        <TimeSeriesChart
          title="Audit events"
          description="System actions recorded over time"
          data={data.auditSeries}
          color={accent}
          height={280}
          valueLabel="Events"
        />
      );
    case "hourly":
      return (
        <HeatmapBars
          title="Check-ins by hour"
          description="When your lobby is busiest"
          data={data.hourly}
          color={accent}
          unit="check-ins"
          height={220}
        />
      );
    case "hourlyTall":
      return (
        <HeatmapBars
          title="Check-ins by hour"
          description="Hourly arrival pattern across the lobby"
          data={data.hourly}
          color={accent}
          unit="check-ins"
          height={340}
        />
      );
    case "visitStatus":
      return (
        <DistributionPie
          title="Visit status breakdown"
          description="Share of sessions by current status"
          data={data.visitStatus}
          height={220}
        />
      );
    case "incident":
      return (
        <DistributionPie
          title="Incident status"
          description="Where open incidents sit in your workflow"
          data={data.incidentStatus}
          height={220}
        />
      );
    case "dsr":
      return (
        <DistributionPie
          title="Data-subject requests"
          description="DSRs by type under NDPA"
          data={data.dsrType}
          height={220}
        />
      );
    case "appointment":
      return (
        <DistributionPie
          title="Appointment outcomes"
          description="Scheduled vs fulfilled, missed, and cancelled"
          data={data.appointmentStatus}
          height={220}
        />
      );
    case "newReturning":
      return (
        <DistributionPie
          title="New vs returning"
          description="Acquisition mix of your visitor base"
          data={data.newVsReturning}
          height={220}
        />
      );
    case "topDepartments":
      return <TopDepartments departments={data.topDepartments} accent={accent} />;
    case "feed":
      return <LiveActivityFeed />;
  }
}

function KpiGrid({ kpis }: { kpis: StatItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <StatCard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          description={kpi.description}
          icon={kpi.icon}
          trend={kpi.trend}
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Pieces
// ──────────────────────────────────────────────────────────────────────

function SegmentedControl({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  loading,
  onClick,
  title,
  children,
}: {
  active: boolean;
  loading: boolean;
  onClick: () => void;
  // Native title (not Radix Tooltip) is deliberate: these buttons swap the
  // chart subtree, and a portalled Radix Tooltip racing the React 19
  // reconciler on that swap can crash. `title` gives the hover hint safely.
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 min-h-[36px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

function TopDepartments({
  departments,
  accent,
}: {
  departments: Array<{ label: string; value: number }>;
  accent: string;
}) {
  const max = Math.max(...departments.map((d) => d.value), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top departments by visits</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {departments.map((dept) => {
            const pct = Math.round((dept.value / max) * 100);
            return (
              <li key={dept.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{dept.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {dept.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${pct}%`, backgroundColor: accent }}
                    role="presentation"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function LiveActivityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const nextId = useRef(1);

  // Seed the feed and then tick a new event in every few seconds. Both the
  // event timer and the "relative time" clock are cleared on unmount.
  useEffect(() => {
    const seed = Array.from({ length: 6 }, () => {
      const e = makeFeedEvent(nextId.current++);
      return { ...e, at: Date.now() - Math.floor(Math.random() * 90_000) };
    });
    setEvents(seed.sort((a, b) => b.at - a.at));

    const addTimer = setInterval(() => {
      setEvents((prev) => [makeFeedEvent(nextId.current++), ...prev].slice(0, 8));
    }, 4000);
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      clearInterval(addTimer);
      clearInterval(clockTimer);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          Live activity
          <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            streaming
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border" aria-live="polite">
          {events.map((e) => {
            const meta = FEED_STATUS_META[e.status];
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium">{e.name}</span>
                  <span className="hidden truncate text-muted-foreground sm:inline">
                    · {e.dept}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={cn("text-xs font-medium", meta.text)}>
                    {meta.label}
                  </span>
                  <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                    {relativeTime(e.at, now)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
