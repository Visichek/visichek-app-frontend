"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { HeatmapBars } from "@/components/recipes/heatmap-bars";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatRelative } from "@/lib/utils/format-date";
import type { Section } from "@/types/insights";
import type { VisitStatus } from "@/types/enums";
import type { TopItem, RecentCheckIn } from "@/types/dashboard";

/** Per-section chart heights, so the grid stays visually balanced. */
const SECTION_HEIGHT: Record<string, number> = {
  traffic: 300,
  audit: 280,
  revenue: 280,
  tenantSignups: 280,
  visitorCheckIns: 280,
  visitorSignups: 280,
  newSubscriptions: 280,
  incidents: 280,
  hourly: 220,
};

/** Fired when a chart element is clicked for drill-down. */
export interface SectionSelectPayload {
  sectionId: string;
  sectionTitle: string;
  kind: "point" | "slice";
  key: string;
  label: string;
}

export function SectionRenderer({
  id,
  section,
  accent,
  /** Taller hourly variant for the receptionist "Hourly flow" tab. */
  tall = false,
  onSelect,
  selectedKeys,
}: {
  id: string;
  section: Section;
  accent: string;
  tall?: boolean;
  /** When provided, time-series points and pie slices become clickable. */
  onSelect?: (payload: SectionSelectPayload) => void;
  /** Highlight the currently-selected point labels / slice keys. */
  selectedKeys?: string[];
}) {
  switch (section.type) {
    case "timeSeries":
      return (
        <div className="space-y-2">
          <IncidentDeadlineBanner meta={section.meta} />
          <TimeSeriesChart
            title={section.title}
            data={section.points}
            color={accent}
            height={SECTION_HEIGHT[id] ?? 280}
            valueLabel={section.valueLabel}
            selectedLabels={selectedKeys}
            onPointSelect={
              onSelect
                ? (p) =>
                    onSelect({
                      sectionId: id,
                      sectionTitle: section.title,
                      kind: "point",
                      key: p.label,
                      label: p.label,
                    })
                : undefined
            }
          />
        </div>
      );

    case "distribution":
      return (
        <div className="space-y-2">
          <IncidentDeadlineBanner meta={section.meta} />
          <DistributionPie
            title={section.title}
            data={section.slices}
            height={SECTION_HEIGHT[id] ?? 220}
            selectedKeys={selectedKeys}
            onSliceSelect={
              onSelect
                ? (s) =>
                    onSelect({
                      sectionId: id,
                      sectionTitle: section.title,
                      kind: "slice",
                      key: s.key,
                      label: s.label,
                    })
                : undefined
            }
          />
        </div>
      );

    case "hourly":
      return (
        <HeatmapBars
          title={section.title}
          data={section.buckets}
          color={accent}
          unit="check-ins"
          height={tall ? 340 : (SECTION_HEIGHT[id] ?? 220)}
        />
      );

    case "topList":
      return <TopListCard title={section.title} items={section.items} accent={accent} />;

    case "feed":
      return <FeedCard title={section.title} events={section.events} />;

    case "table":
      return (
        <AdminTableCard
          title={section.title}
          rows={section.rows}
          columns={section.columns}
          meta={section.meta}
        />
      );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Incident NDPC deadline banner (security_officer)
// ──────────────────────────────────────────────────────────────────────

function IncidentDeadlineBanner({
  meta,
}: {
  meta?: { pastDeadline?: number; approachingDeadline?: number };
}) {
  const past = meta?.pastDeadline ?? 0;
  const approaching = meta?.approachingDeadline ?? 0;
  if (past === 0 && approaching === 0) return null;

  const isPast = past > 0;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border-l-4 px-3 py-2 text-sm",
        isPast
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {isPast && (
          <strong>
            {past} incident{past === 1 ? "" : "s"} past the NDPC 72-hour deadline.
          </strong>
        )}
        {isPast && approaching > 0 && " "}
        {approaching > 0 && (
          <>
            {approaching} approaching deadline within 24h — notify the NDPC and mark them as
            reported.
          </>
        )}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Top-N ranked list (topDepartments / "Top hosts")
// ──────────────────────────────────────────────────────────────────────

function TopListCard({
  title,
  items,
  accent,
}: {
  title: string;
  items: TopItem[];
  accent: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="No data yet" />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const pct = Math.round((item.value / max) * 100);
              return (
                <li key={item.id ?? item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {item.value.toLocaleString()}
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
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Recent check-in feed (receptionist live desk)
// ──────────────────────────────────────────────────────────────────────

const VISIT_STATUS_META: Record<VisitStatus, { label: string; dot: string; text: string }> = {
  registered: { label: "Registered", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  pending_verification: { label: "Pending", dot: "bg-warning", text: "text-warning" },
  checked_in: { label: "Checked in", dot: "bg-success", text: "text-success" },
  checked_out: { label: "Checked out", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  denied: { label: "Denied", dot: "bg-destructive", text: "text-destructive" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

function FeedCard({ title, events }: { title: string; events: RecentCheckIn[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState title="No recent check-ins" />
        ) : (
          <ul className="divide-y divide-border" aria-live="polite">
            {events.map((e) => {
              const meta = VISIT_STATUS_META[e.status];
              return (
                <li
                  key={e.sessionId}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", meta?.dot ?? "bg-muted-foreground")}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{e.visitorName}</span>
                    {e.company && (
                      <span className="hidden truncate text-muted-foreground sm:inline">
                        · {e.company}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={cn("text-xs font-medium", meta?.text ?? "text-muted-foreground")}>
                      {meta?.label ?? e.status}
                    </span>
                    <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                      {formatRelative(e.checkInTime)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Tabular section (admin) — read-only aggregate, exempt from the
// multi-select / clickable-row rules.
// ──────────────────────────────────────────────────────────────────────

function columnLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

const MONEY_KEY = /(revenue|price|mrr|arr|invoice)/i;
const DATE_KEY = /(date|deadline|created|^.*At$)/i;
const NUMERIC_KEY = /(count|visitors|cases|incidents)/i;

function humanizeValue(value: string): string {
  // Turn enum-ish snake_case ("data_breach") into "Data breach" while leaving
  // already-spaced labels (company names) intact.
  if (!/[_]/.test(value)) return value;
  return value
    .split(/[_]+/)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function formatCell(key: string, value: string | number | null): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (MONEY_KEY.test(key)) {
      return `₦${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    if (DATE_KEY.test(key)) return formatDate(value);
    return value.toLocaleString();
  }
  return humanizeValue(value);
}

function isRightAligned(key: string): boolean {
  return MONEY_KEY.test(key) || NUMERIC_KEY.test(key);
}

function AdminTableCard({
  title,
  rows,
  columns,
  meta,
}: {
  title: string;
  rows: Array<Record<string, string | number | null>>;
  columns: string[];
  meta?: { pastDeadline?: number; approachingDeadline?: number };
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <IncidentDeadlineBanner meta={meta} />
      </CardHeader>
      <CardContent>
        <InsightsMiniTable columns={columns} rows={rows} />
      </CardContent>
    </Card>
  );
}

/** Bare read-only table (no Card) — reused by the selection drill-down panel. */
export function InsightsMiniTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
}) {
  if (rows.length === 0) return <EmptyState title="No data yet" />;
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((col) => (
              <th key={col} className={cn("py-2 pr-4 font-medium", isRightAligned(col) && "text-right")}>
                {columnLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {columns.map((col) => (
                <td
                  key={col}
                  className={cn("py-2.5 pr-4", isRightAligned(col) && "text-right tabular-nums")}
                >
                  {formatCell(col, row[col] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
