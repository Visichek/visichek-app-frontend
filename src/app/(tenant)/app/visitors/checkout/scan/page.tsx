"use client";

import { ArrowLeft, Loader2 } from "lucide-react";

import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { ScanCheckoutFlow } from "@/features/visitors/components/scan-checkout-flow";

export default function ScanCheckOutPage() {
  const { loadingHref, navigate } = useNavigationLoading();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href="/app/visitors/checkout" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/app/visitors/checkout" ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to checkout method
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to choose between scanning and manual entry
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="Scan badge to check out"
        description="Pick a visitor from the list, then scan their badge to confirm and check them out."
      />

      <ScanCheckoutFlow
        onDone={() => navigate("/app/visitors/checked-out")}
      />
    </div>
  );
}
