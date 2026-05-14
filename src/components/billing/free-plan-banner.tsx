"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useMyUsage } from "@/features/usage/hooks/use-usage";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const UPGRADE_HREF = "/app/billing/change-plan";

/**
 * Persistent slim banner mounted at the top of the tenant shell for tenants
 * on the free plan. Not dismissible by design — a quiet, always-present
 * reminder rather than a takeover. Hidden for paid tiers, while usage is
 * loading, and on the billing pages themselves so it doesn't compete with
 * the upgrade UI you're already looking at.
 */
export function FreePlanBanner({ pathname }: { pathname: string }) {
  const { data: usage, isLoading } = useMyUsage();
  const { loadingHref, navigateFromOverlay } = useNavigationLoading();

  if (isLoading) return null;
  if (!usage) return null;
  if (usage.planTier !== "free") return null;
  if (pathname.startsWith("/app/billing")) return null;

  const isNavigating = loadingHref === UPGRADE_HREF;

  return (
    <div
      role="region"
      aria-label="Free plan notice"
      className="border-b border-primary/20 bg-gradient-to-r from-primary/[0.06] via-primary/[0.04] to-transparent"
    >
      <div className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-3 sm:items-center">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="text-foreground/90">
            <span className="font-medium">You&apos;re on the Free plan.</span>{" "}
            <span className="text-muted-foreground">
              Upgrade to unlock appointments, multi-location, branding and
              higher monthly limits.
            </span>
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={UPGRADE_HREF}
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                navigateFromOverlay(UPGRADE_HREF);
              }}
              className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 self-start rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:self-auto"
            >
              {isNavigating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              View plans
              {!isNavigating && (
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Open the plan picker to upgrade your subscription
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
