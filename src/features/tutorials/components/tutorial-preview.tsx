"use client";

import {
  Search,
  Bell,
  Plus,
  MoreHorizontal,
  AlarmClock,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PreviewHighlight, PreviewSpec } from "../lib/preview-types";

/**
 * `<TutorialPreview>` — a token-styled mock of an app screen rendered
 * inside a tutorial step so the user *sees the page* while they read.
 *
 * It is intentionally illustrative, not a screenshot: every surface uses
 * design tokens (`bg-card`, `bg-muted`, `bg-primary`, …) so it themes with
 * the app, never goes stale, ships no binary assets, and respects
 * branding. The whole thing is `aria-hidden` — the step's title/body carry
 * the accessible content.
 *
 * A single mini "app shell" (sidebar + topbar) frames a content mock that
 * switches on `spec.kind`. `spec.highlight` rings exactly one region with
 * a pulsing focus ring (disabled under `prefers-reduced-motion`).
 */
export function TutorialPreview({
  spec,
  className,
}: {
  spec: PreviewSpec;
  className?: string;
}) {
  const hl = spec.highlight ?? "none";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "w-full overflow-hidden rounded-lg border bg-muted/40 shadow-inner",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b bg-card/60 px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
      </div>
      {/* App shell */}
      <div className="flex aspect-[16/10] w-full text-[10px] leading-none">
        <MockSidebar hl={hl} />
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <MockTopbar hl={hl} label={spec.label} />
          <div className="min-h-0 flex-1 overflow-hidden p-2.5">
            <MockContent spec={spec} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Spotlight wrapper ──────────────────────────────────────────────────

/** Wraps a region; draws a pulsing focus ring when `on`. */
function Spot({
  on,
  children,
  className,
}: {
  on: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-md transition-shadow",
        on &&
          "z-10 ring-2 ring-primary ring-offset-1 ring-offset-background motion-safe:animate-pulse",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Tiny atoms ──────────────────────────────────────────────────────────

/** A neutral content bar — stands in for a line of text. */
function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block h-1.5 rounded-full bg-muted-foreground/25",
        className,
      )}
    />
  );
}

/** A faux status pill. */
function Pill({
  tone = "muted",
  className,
}: {
  tone?: "muted" | "primary" | "success" | "destructive";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted-foreground/20",
    primary: "bg-primary/20 ring-1 ring-primary/40",
    success: "bg-success/20 ring-1 ring-success/40",
    destructive: "bg-destructive/20 ring-1 ring-destructive/40",
  };
  return (
    <span
      className={cn("inline-block h-2.5 w-8 rounded-full", tones[tone], className)}
    />
  );
}

/** A faux primary button. */
function Btn({
  label,
  icon: Icon,
  variant = "primary",
}: {
  label?: string;
  icon?: LucideIcon;
  variant?: "primary" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-medium",
        variant === "primary"
          ? "bg-primary text-primary-foreground"
          : "border bg-card text-foreground",
      )}
    >
      {Icon ? <Icon className="h-2.5 w-2.5" aria-hidden="true" /> : null}
      {label ? <span>{label}</span> : <span className="block h-1.5 w-6 rounded-full bg-current opacity-60" />}
    </span>
  );
}

/** The page header inside content: title + a primary action. */
function ContentHeader({
  label,
  highlightAction,
  actionLabel = "New",
}: {
  label?: string;
  highlightAction: boolean;
  actionLabel?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-foreground">
          {label ?? "Page"}
        </span>
        <Bar className="w-16 opacity-60" />
      </div>
      <Spot on={highlightAction}>
        <Btn label={actionLabel} icon={Plus} />
      </Spot>
    </div>
  );
}

// ── Shell ───────────────────────────────────────────────────────────────

function MockSidebar({ hl }: { hl: PreviewHighlight }) {
  const items = [0, 1, 2, 3, 4, 5];
  return (
    <Spot on={hl === "sidebar"} className="shrink-0">
      <div className="flex h-full w-12 flex-col gap-1 border-r bg-card px-1.5 py-2 sm:w-16">
        {/* Brand */}
        <div className="mb-1 flex items-center gap-1 px-0.5">
          <span className="h-3 w-3 rounded bg-primary" />
          <span className="hidden h-1.5 w-6 rounded-full bg-muted-foreground/30 sm:block" />
        </div>
        {items.map((i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-1 py-1",
              i === 0 && "bg-accent",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-sm",
                i === 0 ? "bg-primary" : "bg-muted-foreground/40",
              )}
            />
            <span
              className={cn(
                "hidden h-1.5 flex-1 rounded-full sm:block",
                i === 0 ? "bg-primary/40" : "bg-muted-foreground/20",
              )}
            />
          </div>
        ))}
      </div>
    </Spot>
  );
}

function MockTopbar({
  hl,
  label,
}: {
  hl: PreviewHighlight;
  label?: string;
}) {
  return (
    <div className="flex h-7 items-center justify-between border-b bg-card/40 px-2.5">
      <span className="text-[10px] font-medium text-muted-foreground">
        {label ?? "VisiChek"}
      </span>
      <div className="flex items-center gap-2">
        <Spot on={hl === "search" || hl === "topbar"}>
          <span className="flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5">
            <Search className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
            <span className="block h-1 w-6 rounded-full bg-muted-foreground/25" />
          </span>
        </Spot>
        <Spot on={hl === "bell" || hl === "topbar"}>
          <span className="relative block">
            <Bell className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
        </Spot>
      </div>
    </div>
  );
}

// ── Content router ───────────────────────────────────────────────────────

function MockContent({ spec }: { spec: PreviewSpec }) {
  const hl = spec.highlight ?? "none";
  switch (spec.kind) {
    case "table":
      return <MockTable hl={hl} label={spec.label} />;
    case "form":
      return <MockForm hl={hl} label={spec.label} />;
    case "cards":
      return <MockCards hl={hl} label={spec.label} />;
    case "chart":
      return <MockChart hl={hl} label={spec.label} />;
    case "detail":
      return <MockDetail hl={hl} label={spec.label} />;
    case "settings":
      return <MockSettings hl={hl} label={spec.label} />;
    case "wizard":
      return <MockWizard hl={hl} label={spec.label} />;
    case "badge":
      return <MockBadge hl={hl} label={spec.label} />;
    case "qr":
      return <MockQR hl={hl} label={spec.label} />;
    case "log":
      return <MockLog hl={hl} label={spec.label} />;
    case "banner":
      return <MockBanner hl={hl} label={spec.label} />;
    case "shell":
    default:
      return <MockShellContent hl={hl} label={spec.label} />;
  }
}

// ── Content mocks ─────────────────────────────────────────────────────────

function MockShellContent({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <span className="text-[11px] font-semibold text-foreground">
        {label ?? "Welcome"}
      </span>
      <div className="grid flex-1 grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-md border bg-card p-2">
            <Bar className="w-2/3" />
            <Bar className="h-3 w-1/2 bg-foreground/20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MockTable({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  const rows = [0, 1, 2, 3];
  return (
    <div className="flex h-full flex-col">
      <ContentHeader label={label} highlightAction={hl === "primary-action"} />

      {/* Filter / search bar */}
      <Spot on={hl === "search"} className="mb-1.5">
        <div className="flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-1">
          <Search className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
          <Bar className="w-20" />
        </div>
      </Spot>

      {/* Bulk-action bar */}
      {hl === "bulk-bar" && (
        <Spot on className="mb-1.5">
          <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1">
            <span className="text-[9px] font-medium text-foreground">3 selected</span>
            <Btn label="Delete" variant="outline" />
            <Btn label="Export" variant="outline" />
          </div>
        </Spot>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-md border bg-card">
        {/* Column headers */}
        <div className="flex items-center gap-2 border-b bg-muted/40 px-2 py-1">
          <span className="h-2 w-2 rounded-sm border border-muted-foreground/40" />
          <Bar className="w-14" />
          <Bar className="ml-auto w-10" />
          <Bar className="w-8" />
        </div>
        {rows.map((i) => (
          <Spot
            key={i}
            on={(hl === "row" || hl === "checkbox") && i === 0}
            className="border-b last:border-b-0"
          >
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Spot on={hl === "checkbox"} className="leading-none">
                <span
                  className={cn(
                    "block h-2 w-2 rounded-sm border",
                    hl === "checkbox"
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40",
                  )}
                />
              </Spot>
              <span className="h-3 w-3 rounded-full bg-muted-foreground/20" />
              <Bar className="w-12" />
              <span className="ml-auto">
                <Spot on={hl === "status" && i === 0}>
                  <Pill tone={i === 0 ? "success" : "muted"} />
                </Spot>
              </span>
              <MoreHorizontal
                className="h-3 w-3 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
          </Spot>
        ))}
      </div>
    </div>
  );
}

function MockForm({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  return (
    <div className="flex h-full flex-col">
      <span className="mb-2 text-[11px] font-semibold text-foreground">
        {label ?? "Form"}
      </span>
      <div className="flex flex-1 flex-col gap-2 rounded-md border bg-card p-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <Bar className="w-10 opacity-60" />
            <Spot on={hl === "field" && i === 1}>
              <span className="block h-3.5 w-full rounded border bg-background" />
            </Spot>
          </div>
        ))}
        <div className="mt-auto flex justify-end">
          <Spot on={hl === "primary-action"}>
            <Btn label="Save" />
          </Spot>
        </div>
      </div>
    </div>
  );
}

function MockCards({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  return (
    <div className="flex h-full flex-col">
      <span className="mb-2 text-[11px] font-semibold text-foreground">
        {label ?? "Overview"}
      </span>
      <Spot on={hl === "row"}>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-md border bg-card p-2"
            >
              <Bar className="w-2/3 opacity-60" />
              <span className="block h-3.5 w-1/2 rounded bg-primary/30" />
              <Bar className="h-1 w-1/3" />
            </div>
          ))}
        </div>
      </Spot>
      <div className="mt-2 flex-1 rounded-md border bg-card p-2">
        <Bar className="mb-1.5 w-1/4 opacity-60" />
        <div className="flex flex-col gap-1.5">
          <Bar className="w-full" />
          <Bar className="w-5/6" />
          <Bar className="w-2/3" />
        </div>
      </div>
    </div>
  );
}

function MockChart({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  const bars = [40, 65, 50, 80, 55, 95, 70];
  return (
    <div className="flex h-full flex-col">
      <span className="mb-2 text-[11px] font-semibold text-foreground">
        {label ?? "Trends"}
      </span>
      <div className="mb-2 grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-1 rounded-md border bg-card p-2">
            <Bar className="w-1/2 opacity-60" />
            <span className="block h-3 w-2/3 rounded bg-foreground/20" />
          </div>
        ))}
      </div>
      <Spot on={hl === "chart"} className="flex-1">
        <div className="flex h-full items-end gap-1.5 rounded-md border bg-card p-2">
          {bars.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t bg-primary/50"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </Spot>
    </div>
  );
}

function MockDetail({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  return (
    <div className="flex h-full flex-col rounded-md border bg-card p-2.5">
      <div className="flex items-center gap-2 border-b pb-2">
        <span className="h-6 w-6 rounded-full bg-muted-foreground/20" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-foreground">
            {label ?? "Record"}
          </span>
          <Bar className="w-12 opacity-60" />
        </div>
        <span className="ml-auto">
          <Spot on={hl === "status"}>
            <Pill tone="primary" />
          </Spot>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <Bar className="w-10 opacity-60" />
            <Bar className="w-20" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex justify-end gap-1.5 border-t pt-2">
        <Btn label="Close" variant="outline" />
        <Spot on={hl === "primary-action"}>
          <Btn label="Update" />
        </Spot>
      </div>
    </div>
  );
}

function MockSettings({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  const tabs = [0, 1, 2, 3];
  return (
    <div className="flex h-full gap-2">
      <Spot on={hl === "sidebar"}>
        <div className="flex w-1/3 flex-col gap-1 rounded-md border bg-card p-1.5">
          {tabs.map((i) => (
            <Spot key={i} on={hl === "tab" && i === 0}>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded px-1.5 py-1",
                  i === 0 && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-sm",
                    i === 0 ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                />
                <Bar className="w-10" />
              </div>
            </Spot>
          ))}
        </div>
      </Spot>
      <div className="flex flex-1 flex-col gap-2 rounded-md border bg-card p-2.5">
        <span className="text-[10px] font-semibold text-foreground">
          {label ?? "Settings"}
        </span>
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <Bar className="w-10 opacity-60" />
            <Spot on={hl === "field" && i === 0}>
              <span className="block h-3.5 w-full rounded border bg-background" />
            </Spot>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockWizard({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  const steps = ["Register", "Verify", "Confirm"];
  return (
    <div className="flex h-full flex-col rounded-md border bg-card p-2.5">
      {/* Stepper */}
      <Spot on={hl === "status"} className="mb-2">
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div key={i} className="flex flex-1 items-center gap-1">
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold",
                  i <= 1
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "h-0.5 flex-1 rounded",
                    i < 1 ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </Spot>
      <span className="mb-1.5 text-[10px] font-semibold text-foreground">
        {label ?? "Check in visitor"}
      </span>
      <div className="flex flex-1 flex-col gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <Bar className="w-10 opacity-60" />
            <Spot on={hl === "field" && i === 0}>
              <span className="block h-3.5 w-full rounded border bg-background" />
            </Spot>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between border-t pt-2">
        <Btn label="Back" variant="outline" />
        <Spot on={hl === "primary-action"}>
          <Btn label="Continue" icon={ChevronRight} />
        </Spot>
      </div>
    </div>
  );
}

function MockBadge({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      {/* The badge */}
      <Spot on={hl === "badge-doc"}>
        <div className="flex w-20 flex-col items-center gap-1 rounded-md border-2 border-dashed bg-card p-2 shadow-sm">
          <span className="h-3 w-10 rounded bg-primary/40" />
          <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
            Visitor
          </span>
          <span className="h-7 w-7 rounded bg-muted-foreground/20" />
          <Bar className="w-12" />
          <Bar className="w-8 opacity-60" />
          <QrSquare className="h-6 w-6" />
        </div>
      </Spot>
      {/* Format picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold text-foreground">
          {label ?? "Badge"}
        </span>
        <Spot on={hl === "field"}>
          <div className="flex gap-1">
            <span className="rounded border bg-background px-1.5 py-0.5 text-[8px] text-muted-foreground">
              A6
            </span>
            <span className="rounded border border-primary bg-primary/10 px-1.5 py-0.5 text-[8px] font-medium text-primary">
              A7
            </span>
          </div>
        </Spot>
        <Btn label="Print" />
      </div>
    </div>
  );
}

function MockQR({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      <Spot on={hl === "qr-code"}>
        <QrSquare className="h-16 w-16" />
      </Spot>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold text-foreground">
          {label ?? "Self-registration"}
        </span>
        <Bar className="w-20 opacity-60" />
        <Bar className="w-14 opacity-60" />
        <Spot on={hl === "primary-action"}>
          <Btn label="Generate" />
        </Spot>
      </div>
    </div>
  );
}

function MockLog({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  const rows = [0, 1, 2, 3];
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-foreground">
          {label ?? "Log"}
        </span>
        <Spot on={hl === "primary-action"}>
          <Btn label="Export" variant="outline" />
        </Spot>
      </div>
      <Spot on={hl === "timeline"} className="flex-1">
        <div className="flex h-full flex-col gap-1.5 rounded-md border bg-card p-2">
          {rows.map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="block h-1 w-8 rounded-full bg-muted-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/40" />
              <Bar className="w-16" />
              <Bar className="ml-auto w-8 opacity-60" />
            </div>
          ))}
        </div>
      </Spot>
    </div>
  );
}

function MockBanner({ hl, label }: { hl: PreviewHighlight; label?: string }) {
  return (
    <div className="flex h-full flex-col">
      <Spot on={hl === "banner"} className="mb-2">
        <div className="flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning/10 px-2 py-1.5">
          <AlarmClock className="h-3 w-3 text-warning" aria-hidden="true" />
          <span className="text-[9px] font-medium text-warning">
            2 incidents approaching their 72-hour deadline
          </span>
        </div>
      </Spot>
      <span className="mb-1.5 text-[11px] font-semibold text-foreground">
        {label ?? "Incidents"}
      </span>
      <div className="flex-1 overflow-hidden rounded-md border bg-card">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-b px-2 py-1.5 last:border-b-0"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
            <Bar className="w-12" />
            <span className="ml-auto">
              <Pill tone={i === 0 ? "destructive" : "muted"} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── A faux QR code (deterministic, no randomness → SSR-safe) ─────────────

const QR_PATTERN: boolean[] = [
  true, true, true, false, true, false, true,
  true, false, true, false, false, true, true,
  true, true, false, true, true, false, true,
  false, false, true, true, false, true, false,
  true, true, false, false, true, true, true,
  false, true, true, false, true, false, false,
  true, false, true, true, false, true, true,
];

function QrSquare({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid grid-cols-7 gap-px rounded bg-background p-0.5 ring-1 ring-border",
        className,
      )}
    >
      {QR_PATTERN.map((on, i) => (
        <span
          key={i}
          className={cn("rounded-[1px]", on ? "bg-foreground" : "bg-transparent")}
        />
      ))}
    </span>
  );
}
