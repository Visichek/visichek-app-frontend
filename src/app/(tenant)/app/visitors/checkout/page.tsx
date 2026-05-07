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
import { CheckOutForm } from "@/features/visitors/components/check-out-form";

export default function CheckOutVisitorPage() {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/visitors"
                onClick={() => handleNavClick("/app/visitors")}
              >
                {loadingHref === "/app/visitors" ? (
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
        description="Pick a visitor from the list, or scan their badge QR / enter a session ID below."
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
          onCheckedOut={() => router.push("/app/visitors")}
        />
      </section>

      <div
        className="relative my-2"
        role="separator"
        aria-label="Or check out manually"
      >
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs uppercase tracking-wide text-muted-foreground">
            Or scan / enter manually
          </span>
        </div>
      </div>

      <CheckOutForm />
    </div>
  );
}
