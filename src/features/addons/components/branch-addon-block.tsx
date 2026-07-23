"use client";

/**
 * "Add-ons" block shown under the Premium card on the change-plan page.
 * Task 11 / parent plan WS2 — replaces the old per-location stepper.
 *
 * Premium no longer bills per location: the plan ships with 1 branch and
 * extra branches are a separate recurring add-on purchase. Purchasing an
 * add-on requires the tenant to already be effectively Premium (backend
 * gate), so while upgrading TO Premium this block is informational only
 * — quantity is for the tenant's own budgeting, not sent with checkout.
 * Once already on Premium (`canPurchaseNow`), it wires straight into the
 * real purchase flow (`usePurchaseAddon`).
 */

import { useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils/format-currency";
import { resolveCheckoutUrl } from "@/features/checkout/hooks/use-checkout";
import {
  useAddonCatalog,
  usePurchaseAddon,
} from "@/features/addons/hooks/use-addons";

export interface BranchAddonBlockProps {
  /** True when the tenant's current (not selected) plan is already Premium. */
  canPurchaseNow: boolean;
}

export function BranchAddonBlock({ canPurchaseNow }: BranchAddonBlockProps) {
  const [quantity, setQuantity] = useState(1);
  const catalog = useAddonCatalog({ kind: "branch_quota" });
  const addon = catalog.data?.[0];
  const purchase = usePurchaseAddon();

  const unitPrice = addon?.unitPrice ?? 0;
  const maxQty = addon?.maxUnitsPerPurchase ?? 10;

  async function handleBuyNow() {
    if (!addon) return;
    try {
      const resp = await purchase.mutateAsync({
        addonId: addon.id,
        quantity,
      });
      if (resp.checkoutUrl) {
        window.open(
          resolveCheckoutUrl(resp.checkoutUrl),
          "_blank",
          "noopener,noreferrer",
        );
      }
      toast.info(
        "Checkout opened in a new tab. Your branch add-on activates once payment completes.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't start the purchase.",
      );
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Add-ons</p>
        {catalog.isLoading ? (
          <Skeleton className="h-4 w-64" />
        ) : addon ? (
          <p className="text-xs text-muted-foreground">
            Additional branch — {formatCurrency(unitPrice * 100, addon.currency)}
            /mo (20% off Premium). Each branch includes its own 1,000 new
            visitors/month.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Additional branches are available as an add-on once you&apos;re
            on Premium.
          </p>
        )}
      </div>

      {addon && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Extra branches
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label="Decrease extra branch quantity"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((n) => Math.max(1, n - 1))}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Reduce the number of extra branches
                </TooltipContent>
              </Tooltip>
              <Input
                type="number"
                min={1}
                max={maxQty}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setQuantity(
                    Number.isFinite(v) ? Math.min(Math.max(1, v), maxQty) : 1,
                  );
                }}
                className="h-11 w-16 text-center"
                aria-label="Extra branches"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label="Increase extra branch quantity"
                    disabled={quantity >= maxQty}
                    onClick={() => setQuantity((n) => Math.min(maxQty, n + 1))}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Add another extra branch
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Add-on subtotal</span>
            <span className="tabular-nums">
              {formatCurrency(unitPrice * quantity * 100, addon.currency)}/mo
            </span>
          </div>

          {canPurchaseNow ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] w-full sm:w-auto"
                  disabled={purchase.isPending}
                  onClick={handleBuyNow}
                >
                  {purchase.isPending ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Starting checkout…
                    </>
                  ) : (
                    "Buy branch add-on"
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Purchase this branch add-on now — separate checkout from
                your plan
              </TooltipContent>
            </Tooltip>
          ) : (
            <p className="text-xs text-muted-foreground">
              This is not included in the checkout above — once your
              Premium subscription is active, buy branch add-ons from the
              Billing or Branches page.
            </p>
          )}
        </>
      )}
    </div>
  );
}
