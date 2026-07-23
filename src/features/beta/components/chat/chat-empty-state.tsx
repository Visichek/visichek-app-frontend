"use client";

import Image from "next/image";

/**
 * Right-pane placeholder when no conversation is selected — mirrors the
 * Google Chat empty pane using the bundled illustration.
 */
export function ChatEmptyState({
  title = "No conversation selected",
  hint = "Pick a case from the list to read the thread and reply.",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
      {/* The illustration carries its own baked-in palette (dark strokes on a
          transparent canvas), so it sits on a constant white plate to stay
          legible in dark mode — the plate is part of the artwork, not themed
          UI, hence the one deliberate non-token color. */}
      <span className="flex h-40 w-40 items-center justify-center rounded-full bg-white p-6 ring-1 ring-border">
        <Image
          src="/illustrations/no-conversation-selected.svg"
          alt=""
          width={146}
          height={144}
          aria-hidden="true"
          unoptimized
          className="h-auto w-full"
        />
      </span>
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
  );
}
