"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
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
      className="border-b border-amber-400/40 bg-gradient-to-r from-amber-100/80 via-amber-50/70 to-amber-100/40 dark:border-amber-500/30 dark:from-amber-500/15 dark:via-amber-500/10 dark:to-amber-500/5"
    >
      <div className="flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-3 sm:items-center">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200/70 ring-1 ring-amber-500/40 dark:bg-amber-500/20 dark:ring-amber-400/40"
            aria-hidden="true"
          >
            <Image
              src="/visichek_logo.svg"
              alt=""
              aria-hidden="true"
              width={16}
              height={16}
              unoptimized
              className="h-4 w-4"
            />
          </span>
          <p className="text-amber-950 dark:text-amber-100">
            <span className="font-semibold">You&apos;re on the Free plan.</span>{" "}
            <span className="text-amber-900/80 dark:text-amber-100/80">
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
              className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 self-start rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 sm:self-auto"
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
