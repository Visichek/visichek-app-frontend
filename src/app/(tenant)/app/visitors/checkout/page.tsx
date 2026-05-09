"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  QrCode,
  Keyboard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { useNavigationLoading } from "@/lib/routing/navigation-context";

interface MethodOption {
  href: string;
  label: string;
  description: string;
  Icon: typeof QrCode;
  tooltip: string;
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
  const { loadingHref, handleNavClick } = useNavigationLoading();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/visitors/pending"
                onClick={() => handleNavClick("/app/visitors/pending")}
              >
                {loadingHref === "/app/visitors/pending" ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to visitors
              </Link>
            </Button>
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
        {METHODS.map(({ href, label, description, Icon, tooltip }) => {
          const isLoadingTile = loadingHref === href;
          return (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  onClick={() => handleNavClick(href)}
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
        })}
      </div>
    </div>
  );
}
