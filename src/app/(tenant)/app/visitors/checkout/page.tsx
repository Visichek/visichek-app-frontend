"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  QrCode,
  Keyboard,
} from "lucide-react";

import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCapability } from "@/features/limitations/hooks/use-limitations";
import { LockedOverlay } from "@/features/limitations/components/locked-overlay";
import type { PlanFeatureKey } from "@/types/billing";

interface MethodOption {
  href: string;
  label: string;
  description: string;
  Icon: typeof QrCode;
  tooltip: string;
  /**
   * Feature key gating this method. When denied by the active plan, the
   * tile renders blurred behind a padlock and clicks open the upgrade
   * modal instead of navigating to the workflow.
   */
  lockFeature?: PlanFeatureKey;
}

const METHODS: readonly MethodOption[] = [
  {
    href: "/app/visitors/checkout/scan",
    label: "Scan badge",
    description:
      "Point a camera or use a hardware scanner to read the visitor's badge QR or barcode.",
    Icon: QrCode,
    tooltip:
      "Open the scanner workflow — pick the visitor, then scan their badge to confirm",
    // Free plan blocks /v1/badges entirely — printable badges and the
    // QR scanner that reads them are paid-only.
    lockFeature: "badges",
  },
  {
    href: "/app/visitors/checkout/manual",
    label: "Manual entry",
    description:
      "Pick a visitor from the awaiting-checkout list and confirm to check them out.",
    Icon: Keyboard,
    tooltip:
      "Open the manual workflow — pick the visitor from a list and confirm",
  },
] as const;

export default function CheckOutMethodChoicePage() {
  const { loadingHref, navigateFromOverlay } = useNavigationLoading();
  const { can, isLoading: limitationsLoading } = useCapability();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href="/app/visitors/pending" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/app/visitors/pending" ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to visitors
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the visitors list without checking anyone out
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="Check out visitor"
        description="Choose how you'd like to check this visitor out."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {METHODS.map(({ href, label, description, Icon, tooltip, lockFeature }) => {
          const isLoadingTile = loadingHref === href;
          const locked = !!lockFeature && !limitationsLoading && !can(lockFeature);
          const tile = (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={href}
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
                    navigateFromOverlay(href);
                  }}
                  className="group relative flex flex-col gap-3 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[160px]"
                  aria-label={label}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      {isLoadingTile ? (
                        <Loader2
                          className="h-5 w-5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                    <h2 className="text-base font-semibold">{label}</h2>
                    <ArrowRight
                      className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tooltip}</TooltipContent>
            </Tooltip>
          );

          if (locked) {
            return (
              <LockedOverlay
                key={href}
                locked
                featureKey={lockFeature ?? null}
                title={label}
              >
                {tile}
              </LockedOverlay>
            );
          }
          return <div key={href}>{tile}</div>;
        })}
      </div>
    </div>
  );
}
