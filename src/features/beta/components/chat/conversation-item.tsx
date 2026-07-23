"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";

/** Rounded initial-letter avatar used by conversation rows. */
export function ConversationAvatar({
  seed,
  icon,
}: {
  /** String whose first character becomes the avatar letter. */
  seed: string;
  /** Optional icon that replaces the letter (e.g. a category glyph). */
  icon?: ReactNode;
}) {
  const letter = seed.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
    >
      {icon ?? letter}
    </span>
  );
}

interface ConversationItemProps {
  title: string;
  /** Second line — last-message preview / category, truncated to one line. */
  snippet?: string | null;
  /** Epoch seconds shown as a relative time on the right. */
  timestamp?: number | null;
  selected?: boolean;
  onSelect: () => void;
  avatar: ReactNode;
  /** Chips row under the snippet (status badge, priority dot, SLA chip…). */
  meta?: ReactNode;
  /** Hover tooltip describing what opening this conversation shows. */
  tooltip: string;
  ariaLabel: string;
  /** True while the pane is loading this conversation — shows a spinner. */
  loading?: boolean;
}

/**
 * One Gmail-style conversation row: avatar, bold title, muted snippet,
 * relative time on the right; the selected row holds a soft accent tint.
 */
export function ConversationItem({
  title,
  snippet,
  timestamp,
  selected = false,
  onSelect,
  avatar,
  meta,
  tooltip,
  ariaLabel,
  loading = false,
}: ConversationItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-label={ariaLabel}
          aria-current={selected ? "true" : undefined}
          className={cn(
            "flex w-full min-h-[64px] items-start gap-3 px-4 py-3 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            selected ? "bg-accent" : "hover:bg-muted/60",
          )}
        >
          {avatar}
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground">
                {loading && (
                  <Loader2
                    className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{title}</span>
              </span>
              {typeof timestamp === "number" && timestamp > 0 && (
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={String(timestamp)}
                  title={formatDateTime(timestamp)}
                >
                  {formatRelative(timestamp)}
                </time>
              )}
            </span>
            {snippet ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {snippet}
              </span>
            ) : null}
            {meta ? (
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {meta}
              </span>
            ) : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
