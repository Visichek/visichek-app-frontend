"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NavButton } from "@/components/recipes/nav-button";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

interface CaseDetailLayoutProps {
  backHref: string;
  backTooltip: string;
  loadingHref: string | null;
  title: string;
  /** Status / priority chips shown under the title. */
  badges?: ReactNode;
  /** Case properties + actions: a right rail on desktop, a Details sheet on mobile. */
  rail: ReactNode;
  railTitle?: string;
  /** The conversation thread. */
  children: ReactNode;
  /** The reply composer, pinned to the bottom of the conversation column. */
  composer: ReactNode;
}

/**
 * Messaging-app shell for a support case: a compact header, the conversation
 * as the primary column with a sticky composer pinned to the bottom, and the
 * case meta + actions tucked into a right rail (desktop) or a "Details" bottom
 * sheet (mobile) so they never push the conversation down the page.
 */
export function CaseDetailLayout({
  backHref,
  backTooltip,
  loadingHref,
  title,
  badges,
  rail,
  railTitle = "Case details",
  children,
  composer,
}: CaseDetailLayoutProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <BackLink href={backHref} tooltip={backTooltip} loadingHref={loadingHref} />
          {!isDesktop && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => setDetailsOpen(true)}
                  aria-label="Open case details and actions"
                >
                  <PanelRightOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                  Details
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                View case properties and actions — status, assignment, and SLA
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl tracking-tight md:text-3xl">{title}</h1>
          {badges && (
            <div className="flex flex-wrap items-center gap-2">{badges}</div>
          )}
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        {/* Conversation column */}
        <div className="flex min-w-0 flex-col lg:col-start-1 lg:row-start-1">
          <div className="flex-1 pb-4">{children}</div>
          <div className="sticky bottom-0 z-sticky border-t border-border bg-background pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {composer}
          </div>
        </div>

        {/* Desktop rail */}
        {isDesktop && (
          <aside className="lg:col-start-2 lg:row-start-1" aria-label={railTitle}>
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="mb-3 font-display text-lg tracking-tight">{railTitle}</h2>
              <div className="space-y-4">{rail}</div>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile details sheet */}
      {!isDesktop && (
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle>{railTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">{rail}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function BackLink({
  href,
  tooltip,
  loadingHref,
}: {
  href: string;
  tooltip: string;
  loadingHref: string | null;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavButton href={href} variant="ghost" size="sm" className="min-h-[44px]">
          {loadingHref === href ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Back to cases
        </NavButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ── Rail content primitives ───────────────────────────────────────────

/** A titled subsection inside the rail (e.g. "Properties", "Actions"). */
export function RailSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)} aria-label={title}>
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

/** A compact label/value definition list for case properties. */
export function PropertyList({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="space-y-2.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start justify-between gap-3 text-sm"
        >
          <dt className="shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
