"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  endOfMonth,
  format,
  fromUnixTime,
  getUnixTime,
  isSameDay,
  startOfMonth,
  subDays,
} from "date-fns";
import {
  AlarmClock,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { NavButton } from "@/components/recipes/nav-button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useAdminSupportCases,
  useApproachingSla,
} from "@/features/support-cases/hooks/use-admin-support-cases";
import {
  CaseStatusBadge,
  CasePriorityBadge,
  SupportTierBadge,
} from "@/features/support-cases/components";
import { BetaBadge } from "@/features/beta/components/beta-badge";
import { Countdown } from "@/features/beta/components/countdown";
import {
  MonthCalendar,
  type CalendarEvent,
} from "@/features/beta/components/month-calendar";
import { formatDateTime } from "@/lib/utils/format-date";
import type { SupportCase } from "@/types/support-case";

const BACK_HREF = "/admin/support-cases";

function caseId(c: SupportCase): string {
  return c.id ?? c._id ?? "";
}

function caseHref(c: SupportCase): string {
  // The beta admin support page is the chat — deep-link with ?case= so the
  // conversation opens in the pane.
  return `/admin/support-cases?case=${caseId(c)}`;
}

function orgName(c: SupportCase): string {
  return c.tenantSummary?.companyName?.trim() || c.tenantId;
}

/**
 * Beta SLA Watch — every active case plotted on the day its SLA falls due,
 * with a live-countdown rail for the ones due in the next 24 hours.
 */
export function SlaWatchCalendar() {
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // SLA due dates trail case creation by at most 7 days (the low-priority
  // window), so the cases whose deadline lands in the visible month were all
  // created between monthStart-7d and monthEnd.
  const listParams = useMemo(
    () => ({
      createdAtGte: getUnixTime(subDays(startOfMonth(month), 7)),
      createdAtLte: getUnixTime(endOfMonth(month)),
      sort: "sla_due_at" as const,
      skip: 0,
      limit: 100,
    }),
    [month],
  );
  const { data, isLoading, isError, refetch } = useAdminSupportCases(listParams);

  // Cases due within 24h — dedicated endpoint, auto-refreshes every minute.
  const { data: approaching } = useApproachingSla();
  const dueSoon = useMemo(
    () =>
      (Array.isArray(approaching) ? approaching : [])
        .filter((c) => !!c.slaDueAt)
        .sort((a, b) => (a.slaDueAt ?? 0) - (b.slaDueAt ?? 0)),
    [approaching],
  );

  const monthCases = useMemo(
    () =>
      (data?.items ?? []).filter((c): c is SupportCase & { slaDueAt: number } =>
        typeof c.slaDueAt === "number",
      ),
    [data],
  );

  const nowSeconds = Math.floor(Date.now() / 1000);
  const events: CalendarEvent[] = useMemo(
    () =>
      monthCases.map((c) => {
        const done = c.status === "resolved" || c.status === "closed";
        const overdue = !done && c.slaDueAt < nowSeconds;
        const urgent = !done && !overdue && c.slaDueAt - nowSeconds < 24 * 3600;
        return {
          id: caseId(c),
          date: c.slaDueAt,
          label: `${format(fromUnixTime(c.slaDueAt), "HH:mm")} ${c.subject}`,
          tone: done
            ? ("muted" as const)
            : overdue
              ? ("destructive" as const)
              : urgent
                ? ("warning" as const)
                : ("success" as const),
          tooltip: `${orgName(c)} — "${c.subject}" · SLA due ${formatDateTime(c.slaDueAt)}. Click to open the conversation.`,
          onClick: () => navigate(caseHref(c)),
        };
      }),
    [monthCases, nowSeconds, navigate],
  );

  const selectedDayCases = useMemo(() => {
    if (!selectedDay) return [];
    return monthCases
      .filter((c) => isSameDay(fromUnixTime(c.slaDueAt), selectedDay))
      .sort((a, b) => a.slaDueAt - b.slaDueAt);
  }, [monthCases, selectedDay]);

  if (isError) {
    return (
      <ErrorState title="Couldn't load SLA watch" onRetry={() => refetch()} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton
              href={BACK_HREF}
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
            >
              {loadingHref === BACK_HREF ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to cases
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the full support cases queue
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              SLA watch
            </h1>
            <BetaBadge hint="You're seeing the early-access calendar design. Turn it off any time from Settings → Platform → Beta features." />
          </div>
          <p className="text-sm text-muted-foreground">
            Every case plotted on the day its SLA falls due — clear the red and
            amber ones first.
          </p>
        </div>

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
            <TooltipContent side="bottom">Show the previous month</TooltipContent>
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
      </div>

      {dueSoon.length > 0 && (
        <section aria-label="Cases due within 24 hours" className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlarmClock className="h-4 w-4 text-warning" aria-hidden="true" />
            Due in the next 24 hours
            <span className="text-muted-foreground">
              · auto-refreshes every minute
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {dueSoon.map((c) => {
              const href = caseHref(c);
              return (
                <Tooltip key={caseId(c)}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      onClick={() => handleNavClick(href)}
                      className="min-w-[240px] max-w-[280px] shrink-0 rounded-xl border border-warning/40 bg-warning/5 p-3 transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium">
                          {loadingHref === href && (
                            <Loader2
                              className="h-3.5 w-3.5 shrink-0 animate-spin"
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate">{c.subject}</span>
                        </span>
                        {c.supportTier && c.supportTier !== "none" && (
                          <SupportTierBadge tier={c.supportTier} />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {orgName(c)}
                      </p>
                      {c.slaDueAt && (
                        <p className="mt-2 text-sm">
                          <Countdown
                            deadline={c.slaDueAt}
                            warnUnderSeconds={6 * 3600}
                            overdueLabel="SLA missed"
                          />
                        </p>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Open {orgName(c)}&apos;s case before its SLA deadline passes
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </section>
      )}

      {isLoading ? (
        <MonthCalendar month={month} events={[]} isLoading itemNoun="case" />
      ) : (
        <MonthCalendar
          month={month}
          events={events}
          selectedDay={selectedDay}
          onDayClick={(day) => setSelectedDay(day)}
          itemNoun="case"
        />
      )}

      {selectedDay && (
        <section
          aria-label={`Cases due on ${format(selectedDay, "EEEE, MMMM d")}`}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">
            Due {format(selectedDay, "EEEE, MMMM d")}
          </h2>
          {selectedDayCases.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No SLA deadlines fall on this day.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {selectedDayCases.map((c) => {
                const href = caseHref(c);
                return (
                  <li key={caseId(c)}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={href}
                          onClick={() => handleNavClick(href)}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
                            {loadingHref === href && (
                              <Loader2
                                className="h-3.5 w-3.5 shrink-0 animate-spin"
                                aria-hidden="true"
                              />
                            )}
                            <span className="truncate">{c.subject}</span>
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {orgName(c)}
                          </span>
                          <CaseStatusBadge status={c.status} />
                          <CasePriorityBadge priority={c.priority} />
                          <Countdown
                            deadline={c.slaDueAt}
                            warnUnderSeconds={24 * 3600}
                            overdueLabel="SLA missed"
                            className="text-xs"
                          />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Open this case to review the thread and act before the
                        deadline
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {!isLoading && monthCases.length === 0 && dueSoon.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No SLA deadlines in {format(month, "MMMM yyyy")} — the queue is
          healthy.
        </p>
      )}
      <SlaLegend />
    </div>
  );
}

function SlaLegend() {
  const items = [
    { className: "bg-destructive", label: "Overdue" },
    { className: "bg-warning", label: "Due within 24h" },
    { className: "bg-success", label: "On track" },
    { className: "bg-muted-foreground/40", label: "Resolved or closed" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${item.className}`}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Skeleton export kept local to the beta page: the gate renders it while the
// admin preference loads so beta users never flash the classic table.
export function SlaWatchCalendarSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
