"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  addMonths,
  format,
  fromUnixTime,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import {
  AlarmClock,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { NavButton } from "@/components/recipes/nav-button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import {
  useIncidents,
  useApproachingDeadlineIncidents,
  useUpdateIncident,
} from "@/features/incidents/hooks/use-incidents";
import { IncidentRiskDot } from "@/features/incidents/components/incident-risk-dot";
import { BetaBadge } from "@/features/beta/components/beta-badge";
import { Countdown } from "@/features/beta/components/countdown";
import {
  MonthCalendar,
  type CalendarEvent,
} from "@/features/beta/components/month-calendar";
import { formatDateTime } from "@/lib/utils/format-date";
import type { Incident } from "@/types/incident";
import type { IncidentStatus } from "@/types/enums";

const NEW_HREF = "/app/incidents/new";

/** How many recent incidents feed the calendar + overdue stat (client-side
 * month filter — tenants with more than this many recent incidents would see
 * older ones drop off the calendar). */
const CALENDAR_FETCH_LIMIT = 200;

function formatType(type?: string | null): string {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function incidentLabel(incident: Incident): string {
  return (
    incident.description?.trim() ||
    formatType(incident.incidentType) ||
    "Incident"
  );
}

function statusVariant(
  status?: IncidentStatus | null,
):
  | "destructive"
  | "warning"
  | "info"
  | "secondary"
  | "success"
  | "outline" {
  switch (status) {
    case "open":
      return "destructive";
    case "investigating":
      return "warning";
    case "contained":
      return "info";
    case "reported_to_ndpc":
      return "secondary";
    case "closed":
      return "success";
    default:
      return "outline";
  }
}

function editHref(incident: Incident): string {
  return `/app/incidents/${incident.id}/edit`;
}

function detectionTimestamp(incident: Incident): number {
  return incident.detectionTime ?? incident.dateCreated;
}

/** Unnotified with a deadline = the NDPC clock is still running. */
function clockRunning(incident: Incident): boolean {
  return !incident.ndpcNotified && !!incident.notificationDeadline;
}

/**
 * Beta tenant Incidents — NDPC deadline countdowns front and center, plus a
 * month calendar of detections and notification deadlines.
 */
export function IncidentsBeta() {
  const { loadingHref, navigate } = useNavigationLoading();
  const { hasCapability } = useCapabilities();
  const canCreate = hasCapability(CAPABILITIES.INCIDENT_CREATE);
  const canEdit = hasCapability(CAPABILITIES.INCIDENT_EDIT);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data, isLoading, isError, refetch } = useIncidents({
    sort: "-dateCreated",
    skip: 0,
    limit: CALENDAR_FETCH_LIMIT,
  });
  const incidents = useMemo(() => data?.items ?? [], [data]);

  // Tenant-wide status facet so the "active" stat counts every incident,
  // not just the loaded page.
  const { data: facetData } = useIncidents({ facets: "status", limit: 1 });
  const statusFacets = facetData?.meta?.facets?.status;
  const activeCount = useMemo(() => {
    if (statusFacets) {
      return Object.entries(statusFacets)
        .filter(([status]) => status !== "closed")
        .reduce((sum, [, n]) => sum + n, 0);
    }
    return incidents.filter((i) => i.status !== "closed").length;
  }, [statusFacets, incidents]);

  // Server-truth feed of incidents within 24h of the 72h NDPC deadline
  // (refreshes every minute).
  const { data: approachingData } = useApproachingDeadlineIncidents();
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Deadline rail = union of the approaching feed and any loaded unnotified
  // incident whose deadline is inside 24h or already passed.
  const deadlineRail = useMemo(() => {
    const byId = new Map<string, Incident>();
    for (const inc of approachingData?.items ?? []) {
      if (clockRunning(inc)) byId.set(inc.id, inc);
    }
    for (const inc of incidents) {
      if (
        clockRunning(inc) &&
        (inc.notificationDeadline ?? 0) - nowSeconds < 24 * 3600
      ) {
        byId.set(inc.id, inc);
      }
    }
    return [...byId.values()].sort(
      (a, b) => (a.notificationDeadline ?? 0) - (b.notificationDeadline ?? 0),
    );
  }, [approachingData, incidents, nowSeconds]);

  const overdueCount = useMemo(
    () =>
      incidents.filter(
        (i) => clockRunning(i) && (i.notificationDeadline ?? 0) < nowSeconds,
      ).length,
    [incidents, nowSeconds],
  );
  const dueSoonCount = deadlineRail.filter(
    (i) => (i.notificationDeadline ?? 0) >= nowSeconds,
  ).length;

  const events: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];
    for (const inc of incidents) {
      const detectedAt = detectionTimestamp(inc);
      if (isSameMonth(fromUnixTime(detectedAt), month)) {
        const closed = inc.status === "closed";
        list.push({
          id: `detect-${inc.id}`,
          date: detectedAt,
          label: incidentLabel(inc),
          tone: closed
            ? "muted"
            : inc.riskLevel === "critical"
              ? "destructive"
              : inc.riskLevel === "high"
                ? "warning"
                : inc.riskLevel === "medium"
                  ? "info"
                  : "muted",
          tooltip: `${formatType(inc.incidentType)} · ${incidentLabel(inc)} — detected ${formatDateTime(detectedAt)}. Click to open.`,
          onClick: () => navigate(editHref(inc)),
        });
      }
      if (
        clockRunning(inc) &&
        inc.notificationDeadline &&
        isSameMonth(fromUnixTime(inc.notificationDeadline), month)
      ) {
        const overdue = inc.notificationDeadline < nowSeconds;
        list.push({
          id: `deadline-${inc.id}`,
          date: inc.notificationDeadline,
          label: `NDPC · ${incidentLabel(inc)}`,
          tone: overdue ? "destructive" : "warning",
          icon: (
            <AlarmClock className="h-3 w-3 shrink-0" aria-hidden="true" />
          ),
          tooltip: `72-hour NDPC notification deadline ${formatDateTime(inc.notificationDeadline)} for "${incidentLabel(inc)}". Click to open.`,
          onClick: () => navigate(editHref(inc)),
        });
      }
    }
    return list;
  }, [incidents, month, nowSeconds, navigate]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return { detections: [], deadlines: [] };
    return {
      detections: incidents
        .filter((i) =>
          isSameDay(fromUnixTime(detectionTimestamp(i)), selectedDay),
        )
        .sort((a, b) => detectionTimestamp(a) - detectionTimestamp(b)),
      deadlines: incidents
        .filter(
          (i) =>
            clockRunning(i) &&
            i.notificationDeadline &&
            isSameDay(fromUnixTime(i.notificationDeadline), selectedDay),
        )
        .sort(
          (a, b) =>
            (a.notificationDeadline ?? 0) - (b.notificationDeadline ?? 0),
        ),
    };
  }, [incidents, selectedDay]);

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load incidents"
        message="Please check your connection and try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              Incidents
            </h1>
            <BetaBadge />
          </div>
          <p className="text-sm text-muted-foreground">
            Every incident on a calendar, with the 72-hour NDPC notification
            clock counting down in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Previous month"
                  onClick={() => {
                    setSelectedDay(null);
                    setMonth((m) => addMonths(m, -1));
                  }}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Show the previous month
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="min-h-[44px] px-3"
                  onClick={() => {
                    setSelectedDay(null);
                    setMonth(startOfMonth(new Date()));
                  }}
                  aria-label="Jump back to the current month"
                >
                  <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                  {format(month, "MMMM yyyy")}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Jump back to the current month
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Next month"
                  onClick={() => {
                    setSelectedDay(null);
                    setMonth((m) => addMonths(m, 1));
                  }}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Show the next month</TooltipContent>
            </Tooltip>
          </div>
          {canCreate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <NavButton
                    href={NEW_HREF}
                    className="min-h-[44px] w-full md:w-auto"
                  >
                    {loadingHref === NEW_HREF ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Report incident
                  </NavButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Report a new data-protection incident — the 72-hour NDPC clock
                starts from creation
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <section aria-label="Incident overview" className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={
            <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" />
          }
          label="Active incidents"
          value={activeCount}
          hint="Everything not yet closed"
        />
        <StatCard
          icon={
            <AlarmClock className="h-4 w-4 text-warning" aria-hidden="true" />
          }
          label="NDPC due in 24h"
          value={dueSoonCount}
          hint="Unnotified incidents nearing the 72-hour deadline"
        />
        <StatCard
          icon={
            <BellRing className="h-4 w-4 text-destructive" aria-hidden="true" />
          }
          label="Deadline missed"
          value={overdueCount}
          hint="Unnotified incidents past the 72-hour deadline"
        />
      </section>

      {deadlineRail.length > 0 && (
        <section
          aria-label="NDPC notification deadlines"
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlarmClock className="h-4 w-4 text-warning" aria-hidden="true" />
            NDPC notification clock
            <span className="text-muted-foreground">
              · refreshes every minute
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {deadlineRail.map((inc) => (
              <DeadlineCard key={inc.id} incident={inc} canEdit={canEdit} />
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <MonthCalendar
          month={month}
          events={[]}
          isLoading
          itemNoun="incident"
        />
      ) : (
        <MonthCalendar
          month={month}
          events={events}
          selectedDay={selectedDay}
          onDayClick={(day) => setSelectedDay(day)}
          maxPerDay={3}
          itemNoun="incident"
        />
      )}

      {selectedDay && (
        <section
          aria-label={`Incidents on ${format(selectedDay, "EEEE, MMMM d")}`}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">
            {format(selectedDay, "EEEE, MMMM d")}
          </h2>

          {selectedDayItems.detections.length === 0 &&
          selectedDayItems.deadlines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing detected and no NDPC deadlines on this day.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {selectedDayItems.deadlines.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    NDPC deadlines
                  </h3>
                  <ul className="space-y-2">
                    {selectedDayItems.deadlines.map((inc) => (
                      <DayIncidentRow
                        key={`deadline-${inc.id}`}
                        incident={inc}
                        canEdit={canEdit}
                        showDeadline
                      />
                    ))}
                  </ul>
                </div>
              )}
              {selectedDayItems.detections.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Detected this day
                  </h3>
                  <ul className="space-y-2">
                    {selectedDayItems.detections.map((inc) => (
                      <DayIncidentRow
                        key={`detect-${inc.id}`}
                        incident={inc}
                        canEdit={canEdit}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-destructive"
          />
          Critical risk / missed deadline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-warning"
          />
          High risk / deadline approaching
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-info" />
          Medium risk
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40"
          />
          Low risk / closed
        </span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {icon}
            {label}
          </div>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {value}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

/** Rail card with a live countdown and (for triage roles) one-click notify. */
function DeadlineCard({
  incident,
  canEdit,
}: {
  incident: Incident;
  canEdit: boolean;
}) {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const href = editHref(incident);
  const overdue =
    (incident.notificationDeadline ?? 0) < Math.floor(Date.now() / 1000);

  return (
    <div
      className={`min-w-[260px] max-w-[300px] shrink-0 rounded-xl border p-3 ${
        overdue
          ? "border-destructive/40 bg-destructive/5"
          : "border-warning/40 bg-warning/5"
      }`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            onClick={() => handleNavClick(href)}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-medium">
              {loadingHref === href && (
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{incidentLabel(incident)}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {formatType(incident.incidentType)}
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Open this incident to review details and record mitigation
        </TooltipContent>
      </Tooltip>

      <div className="mt-2 flex items-center justify-between gap-2">
        <IncidentRiskDot risk={incident.riskLevel} />
        {incident.notificationDeadline && (
          <Countdown
            deadline={incident.notificationDeadline}
            warnUnderSeconds={24 * 3600}
            overdueLabel="Deadline missed"
            className="text-sm"
          />
        )}
      </div>

      {canEdit && <MarkNotifiedButton incident={incident} className="mt-2" />}
    </div>
  );
}

function DayIncidentRow({
  incident,
  canEdit,
  showDeadline = false,
}: {
  incident: Incident;
  canEdit: boolean;
  showDeadline?: boolean;
}) {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const href = editHref(incident);

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            onClick={() => handleNavClick(href)}
            className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {loadingHref === href && (
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin"
                aria-hidden="true"
              />
            )}
            <span className="truncate">{incidentLabel(incident)}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">
          Open this incident to review details and update its status
        </TooltipContent>
      </Tooltip>
      <Badge variant={statusVariant(incident.status)}>
        {(incident.status ?? "").replace(/_/g, " ") || "—"}
      </Badge>
      <IncidentRiskDot risk={incident.riskLevel} />
      {showDeadline && incident.notificationDeadline && (
        <Countdown
          deadline={incident.notificationDeadline}
          warnUnderSeconds={24 * 3600}
          overdueLabel="Deadline missed"
          className="text-xs"
        />
      )}
      {canEdit && clockRunning(incident) && (
        <MarkNotifiedButton incident={incident} />
      )}
    </li>
  );
}

/**
 * One-click "regulator notified" action. Each instance owns its mutation so
 * spinners stay per-incident.
 */
function MarkNotifiedButton({
  incident,
  className,
}: {
  incident: Incident;
  className?: string;
}) {
  const updateMutation = useUpdateIncident(incident.id);

  const handleMarkNotified = async () => {
    try {
      await updateMutation.mutateAsync({
        ndpcNotified: true,
        notificationSentAt: Math.floor(Date.now() / 1000),
      });
      toast.success("Marked as notified to the NDPC");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't mark the incident as notified",
      );
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          <LoadingButton
            size="sm"
            variant="outline"
            onClick={handleMarkNotified}
            isLoading={updateMutation.isPending}
            loadingText="Saving…"
            className="min-h-[36px] w-full"
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Mark as notified
          </LoadingButton>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        Record that the NDPC has been formally notified — this stops the
        72-hour countdown
      </TooltipContent>
    </Tooltip>
  );
}

// Neutral skeleton the page gate can show while the org beta flag resolves.
export function IncidentsBetaSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
