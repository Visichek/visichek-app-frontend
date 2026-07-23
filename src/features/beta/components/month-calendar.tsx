"use client";

import { useMemo, type ReactNode } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  fromUnixTime,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export type CalendarTone =
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "muted";

export interface CalendarEvent {
  id: string;
  /** Unix epoch seconds deciding which day cell the event lands on. */
  date: number;
  label: string;
  tone: CalendarTone;
  /** Hover copy for the chip (falls back to the label). */
  tooltip?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

const TONE_CLASSES: Record<CalendarTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  muted: "border-border bg-muted text-muted-foreground",
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MonthCalendarProps {
  /** Any date inside the month to render. */
  month: Date;
  events: CalendarEvent[];
  /** Clicking a day cell (also fires for empty days). */
  onDayClick?: (day: Date, events: CalendarEvent[]) => void;
  selectedDay?: Date | null;
  /** Event chips shown per cell before collapsing into "+N more". */
  maxPerDay?: number;
  isLoading?: boolean;
  /** Copy used in tooltips/aria to name what the chips are, e.g. "case". */
  itemNoun?: string;
}

/**
 * Generic month-grid calendar (Monday start) with tone-colored event chips.
 * The grid keeps a minimum width and scrolls horizontally inside its own
 * container on narrow screens.
 */
export function MonthCalendar({
  month,
  events,
  onDayClick,
  selectedDay = null,
  maxPerDay = 3,
  isLoading = false,
  itemNoun = "item",
}: MonthCalendarProps) {
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = format(fromUnixTime(event.date), "yyyy-MM-dd");
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-muted/60 px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="min-h-24 bg-card p-2">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="mt-2 h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        aria-label={`Calendar for ${format(month, "MMMM yyyy")}`}
        className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border"
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-muted/60 px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;
          const visible = dayEvents.slice(0, maxPerDay);
          const hiddenCount = dayEvents.length - visible.length;
          const dayName = format(day, "EEEE, MMM d");

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                {/* Focusable div rather than role="button": the cell contains
                    real <button> chips, and nesting buttons is an ARIA
                    violation. Keyboard activation is wired manually below. */}
                <div
                  tabIndex={onDayClick ? 0 : undefined}
                  aria-label={`${dayName} — ${dayEvents.length} ${itemNoun}${dayEvents.length === 1 ? "" : "s"}`}
                  onClick={() => onDayClick?.(day, dayEvents)}
                  onKeyDown={(e) => {
                    if (onDayClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onDayClick(day, dayEvents);
                    }
                  }}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 bg-card p-1.5 text-left transition-colors",
                    onDayClick &&
                      "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    !inMonth && "bg-muted/30",
                    selected && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                      isToday(day) &&
                        "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {visible.map((event) =>
                    event.onClick ? (
                      <Tooltip key={event.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              event.onClick?.();
                            }}
                            aria-label={event.tooltip ?? event.label}
                            className={cn(
                              "flex w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              TONE_CLASSES[event.tone],
                            )}
                          >
                            {event.icon}
                            <span className="truncate">{event.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {event.tooltip ?? event.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span
                        key={event.id}
                        title={event.tooltip ?? event.label}
                        className={cn(
                          "flex w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4",
                          TONE_CLASSES[event.tone],
                        )}
                      >
                        {event.icon}
                        <span className="truncate">{event.label}</span>
                      </span>
                    ),
                  )}

                  {hiddenCount > 0 && (
                    <span className="px-1 text-[11px] text-muted-foreground">
                      +{hiddenCount} more
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {dayEvents.length > 0
                  ? `${dayName}: ${dayEvents.length} ${itemNoun}${dayEvents.length === 1 ? "" : "s"} — click to review`
                  : `${dayName}: no ${itemNoun}s`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
