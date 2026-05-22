"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSeriesChart } from "@/components/recipes/time-series-chart";
import { DistributionPie } from "@/components/recipes/distribution-pie";
import { HeatmapBars } from "@/components/recipes/heatmap-bars";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/format-date";
import type { Section, SectionId } from "@/types/insights";
import type { VisitStatus } from "@/types/enums";
import type { TopItem, RecentCheckIn } from "@/types/dashboard";

/** Per-section chart heights, so the grid stays visually balanced. */
const SECTION_HEIGHT: Partial<Record<SectionId, number>> = {
  traffic: 300,
  audit: 280,
  hourly: 220,
  visitStatus: 220,
  incident: 220,
  dsr: 220,
  appointment: 220,
  newReturning: 220,
};

export function SectionRenderer({
  id,
  section,
  accent,
  /** Taller hourly variant for the receptionist "Hourly flow" tab. */
  tall = false,
}: {
  id: SectionId;
  section: Section;
  accent: string;
  tall?: boolean;
}) {
  switch (section.type) {
    case "timeSeries":
      return (
        <TimeSeriesChart
          title={section.title}
          data={section.points}
          color={accent}
          height={SECTION_HEIGHT[id] ?? 280}
          valueLabel={section.valueLabel}
        />
      );

    case "distribution":
      return (
        <div className="space-y-2">
          {id === "incident" && <IncidentDeadlineBanner meta={section.meta} />}
          <DistributionPie
            title={section.title}
            data={section.slices}
            height={SECTION_HEIGHT[id] ?? 220}
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
