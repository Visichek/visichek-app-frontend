"use client";

import { useRouter } from "next/navigation";
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
import { AwaitingCheckoutPicker } from "@/features/visitors/components/awaiting-checkout-picker";

export default function ManualCheckOutPage() {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();

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
        title="Manual check-out"
        description="Pick a visitor from the list and confirm to check them out."
      />

      <section
        aria-labelledby="awaiting-checkout-heading"
        className="space-y-3"
      >
        <div>
          <h2
            id="awaiting-checkout-heading"
            className="text-base font-semibold"
          >
            Visitors awaiting checkout
          </h2>
          <p className="text-sm text-muted-foreground">
            Auto-refreshes every few seconds. Tap a visitor and confirm to
            check them out.
          </p>
        </div>
        <AwaitingCheckoutPicker
          onCheckedOut={() => router.push("/app/visitors/checked-out")}
        />
      </section>
    </div>
  );
}
