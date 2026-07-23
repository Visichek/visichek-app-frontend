"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ChatShellProps {
  /** Left panel — conversation list (header + scrollable rows). */
  list: ReactNode;
  /** Right panel — empty state or the open conversation. */
  pane: ReactNode;
  /**
   * Below `lg` only one panel fits: false shows the list, true shows the
   * open conversation (the pane header renders a back control).
   */
  showPaneOnMobile?: boolean;
  className?: string;
}

/**
 * Google Chat–style split shell: fixed-width conversation list on the left,
 * conversation pane on the right, single-panel swap below `lg`. Height is
 * viewport-bound so the list and thread scroll independently inside it.
 */
export function ChatShell({
  list,
  pane,
  showPaneOnMobile = false,
  className,
}: ChatShellProps) {
  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-12rem)] min-h-[480px] overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "w-full flex-col lg:flex lg:w-[360px] lg:shrink-0 lg:border-r lg:border-border",
          showPaneOnMobile ? "hidden lg:flex" : "flex",
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 flex-col",
          showPaneOnMobile ? "flex" : "hidden lg:flex",
        )}
      >
        {pane}
      </div>
    </div>
  );
}
