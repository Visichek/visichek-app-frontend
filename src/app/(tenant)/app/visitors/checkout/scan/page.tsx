"use client";

import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { ScanCheckoutFlow } from "@/features/visitors/components/scan-checkout-flow";

export default function ScanCheckOutPage() {
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/visitors/checkout"
                onClick={() => handleNavClick("/app/visitors/checkout")}
              >
                {loadingHref === "/app/visitors/checkout" ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to checkout method
              </Link>
            </Button>
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
        onCheckedOut={() => navigate("/app/visitors/checked-out")}
      />
    </div>
  );
}
