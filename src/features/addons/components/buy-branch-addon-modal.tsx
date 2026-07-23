"use client";

/**
 * Purchase flow for the `additional-branch` add-on (kind `branch_quota`).
 * Task 11 / parent plan WS2. Premium-only — callers must gate rendering
 * on `isPremiumTier` before mounting this (the backend also 403s
 * non-Premium purchases, this is a UX nicety, not the real gate).
 */

import { useEffect, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils/format-currency";
import { resolveCheckoutUrl } from "@/features/checkout/hooks/use-checkout";
import {
  useAddonCatalog,
  usePurchaseAddon,
  useTenantAddon,
  useInvalidateAddonEntitlementCaches,
} from "@/features/addons/hooks/use-addons";

/** Only catalog SKU of kind `branch_quota` today — singleton per Task 7 seed. */
const BRANCH_ADDON_KIND = "branch_quota" as const;

export interface BuyBranchAddonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the purchase activates (webhook flipped the row to `active`). */
  onPurchased?: () => void;
}

export function BuyBranchAddonModal({
  open,
  onOpenChange,
  onPurchased,
}: BuyBranchAddonModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const catalog = useAddonCatalog({ kind: BRANCH_ADDON_KIND });
  const addon = catalog.data?.[0];
  const purchase = usePurchaseAddon();
  const invalidateEntitlements = useInvalidateAddonEntitlementCaches();

  const pendingAddon = useTenantAddon(pendingId ?? undefined, { poll: true });

  // Reset local state whenever the modal is reopened.
  useEffect(() => {
    if (open) {
      setQuantity(1);
      setPendingId(null);
    }
  }, [open]);

  // React to the polled status once it leaves `pending`.
  useEffect(() => {
    if (!pendingId) return;
    const status = pendingAddon.data?.status;
    if (status === "active") {
      invalidateEntitlements();
      toast.success("Branch add-on activated — you can add a branch now.");
      setPendingId(null);
      onOpenChange(false);
      onPurchased?.();
    } else if (status === "cancelled") {
      toast.error("The branch add-on payment didn't go through. Try again.");
      setPendingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAddon.data?.status, pendingId]);

  const maxQty = addon?.maxUnitsPerPurchase ?? 10;
  const unitPrice = addon?.unitPrice ?? 0;
  const totalPrice = unitPrice * quantity;
  const isWaitingOnPayment = !!pendingId;

  async function handlePurchase() {
    if (!addon) return;
    try {
      const resp = await purchase.mutateAsync({
        addonId: addon.id,
        quantity,
      });
      setPendingId(resp.tenantAddonId);
      if (resp.checkoutUrl) {
        window.open(
          resolveCheckoutUrl(resp.checkoutUrl),
          "_blank",
          "noopener,noreferrer",
        );
      }
      toast.info(
        "Checkout opened in a new tab. Finish payment there — we'll pick it up automatically.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't start the purchase.",
      );
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Buy another branch"
      description="Add branch capacity to your Premium plan. Each branch includes its own 1,000 new visitors per month."
    >
      {catalog.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !addon ? (
        <p className="text-sm text-muted-foreground">
          Branch add-ons aren&apos;t available right now. Please try again
          later or contact support.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{addon.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(unitPrice * 100, addon.currency)} / month
                each — 20% off the Premium base rate
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1 || isWaitingOnPayment}
                    onClick={() => setQuantity((n) => Math.max(1, n - 1))}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Reduce the number of branch add-ons to buy
                </TooltipContent>
              </Tooltip>
              <Input
                type="number"
                min={1}
                max={maxQty}
                inputMode="numeric"
                value={quantity}
                disabled={isWaitingOnPayment}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setQuantity(
                    Number.isFinite(v) ? Math.min(Math.max(1, v), maxQty) : 1,
                  );
                }}
                className="h-11 w-16 text-center"
                aria-label="Quantity"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label="Increase quantity"
                    disabled={quantity >= maxQty || isWaitingOnPayment}
                    onClick={() =>
                      setQuantity((n) => Math.min(maxQty, n + 1))
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Add another branch add-on to this purchase
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="font-medium">Total</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(totalPrice * 100, addon.currency)} / month
            </span>
          </div>

          {isWaitingOnPayment && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Waiting for payment confirmation — this updates automatically.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={purchase.isPending || isWaitingOnPayment}
                  onClick={() => onOpenChange(false)}
                  className="min-h-[44px] w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Close without purchasing
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={handlePurchase}
                  disabled={purchase.isPending || isWaitingOnPayment}
                  className="min-h-[44px] w-full sm:w-auto"
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
                    "Continue to payment"
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Create a checkout session and open a secure payment page in a
                new tab
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}
