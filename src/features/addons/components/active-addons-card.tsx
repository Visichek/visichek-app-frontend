"use client";

/**
 * Billing-page "Add-ons" card: active add-on rows with cancel + buy-more
 * CTA. Task 11 / parent plan WS2.
 */

import { useState } from "react";
import { PlusCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import {
  useTenantAddonHistory,
  useCancelTenantAddon,
} from "@/features/addons/hooks/use-addons";
import { BuyBranchAddonModal } from "@/features/addons/components/buy-branch-addon-modal";
import type { TenantAddonOut, TenantAddonStatus } from "@/types/addon";

const STATUS_VARIANT: Record<
  TenantAddonStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  active: "secondary",
  expired: "destructive",
  cancelled: "destructive",
};

function isGrantedMigrationRow(addon: TenantAddonOut): boolean {
  return addon.metadata?.granted === "premium-per-location-migration";
}

function statusLabel(addon: TenantAddonOut): string {
  if (isGrantedMigrationRow(addon)) return "Included — migration";
  return addon.status.charAt(0).toUpperCase() + addon.status.slice(1);
}

export interface AddonsCardProps {
  /** Only render the "Buy another branch" CTA when the tenant is Premium. */
  canBuyBranchAddon: boolean;
}

export function AddonsCard({ canBuyBranchAddon }: AddonsCardProps) {
  const { data: addons, isLoading, isError } = useTenantAddonHistory();
  const cancelAddon = useCancelTenantAddon();
  const [cancelTarget, setCancelTarget] = useState<TenantAddonOut | null>(
    null,
  );
  const [buyOpen, setBuyOpen] = useState(false);

  const visibleAddons = (addons ?? []).filter(
    (a) => a.status === "active" || a.status === "pending",
  );

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    try {
      await cancelAddon.mutateAsync({ tenantAddonId: cancelTarget.id });
      toast.success("Add-on cancelled.");
      setCancelTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel add-on",
      );
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">Add-ons</CardTitle>
        {canBuyBranchAddon && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] gap-2"
                onClick={() => setBuyOpen(true)}
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Buy another branch
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the branch add-on purchase flow
            </TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your add-ons. Try refreshing the page.
          </p>
        ) : visibleAddons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No add-ons purchased yet.
          </p>
        ) : (
          <div className="divide-y">
            {visibleAddons.map((addon) => {
              const granted = isGrantedMigrationRow(addon);
              return (
                <div
                  key={addon.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{addon.addonName}</span>
                      <Badge variant={STATUS_VARIANT[addon.status]}>
                        {statusLabel(addon)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Qty {addon.quantity} ·{" "}
                      {granted
                        ? "Granted at no charge"
                        : `${formatCurrency(
                            addon.unitPriceSnapshot * 100,
                            addon.currencySnapshot,
                          )} / unit`}{" "}
                      ·{" "}
                      {addon.expiresAt
                        ? `${addon.status === "cancelled" ? "Ends" : "Renews"} ${formatDate(addon.expiresAt)}`
                        : "Never expires"}
                    </p>
                  </div>
                  {addon.status === "active" && !granted && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-[44px] gap-2 text-destructive"
                          onClick={() => setCancelTarget(addon)}
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          Cancel
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        Cancel this add-on — it stays active until it expires
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Cancel add-on"
        description={`Cancel "${cancelTarget?.addonName}"? It stays active until the end of its current period, then won't renew.`}
        confirmLabel="Cancel add-on"
        variant="destructive"
        isLoading={cancelAddon.isPending}
        onConfirm={handleCancelConfirm}
      />

      <BuyBranchAddonModal open={buyOpen} onOpenChange={setBuyOpen} />
    </Card>
  );
}
