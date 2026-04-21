"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import {
  useDiscounts,
  useDeleteDiscount,
  useDisableDiscount,
} from "@/features/discounts/hooks/use-discounts";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import type { Discount } from "@/types/billing";
import type { DiscountStatus } from "@/types/enums";

const NEW_DISCOUNT_HREF = "/admin/discounts/new";

function statusVariant(status: DiscountStatus | undefined) {
  switch (status) {
    case "active":
      return "success" as const;
    case "expired":
      return "warning" as const;
    case "disabled":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function capitalize(str: string | null | undefined): string {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatValue(value: number | null | undefined, type: string | null | undefined): string {
  if (value == null) return "—";
  if (type === "percentage") {
    return `${value}%`;
  }
  return `₦${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface DiscountRowProps {
  discount: Discount;
  onEdit: (id: string) => void;
  onDisable: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

function DiscountActions({
  discount,
  onEdit,
  onDisable,
  onDelete,
  isLoading,
}: DiscountRowProps) {
  const [confirmAction, setConfirmAction] = React.useState<
    "disable" | "delete" | null
  >(null);

  const handleConfirm = () => {
    if (confirmAction === "disable") {
      onDisable(discount.id);
    } else if (confirmAction === "delete") {
      onDelete(discount.id);
    }
    setConfirmAction(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0"
            aria-label="Open menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(discount.id)} disabled>
            Edit
          </DropdownMenuItem>
          {discount.status === "active" && (
            <DropdownMenuItem onClick={() => setConfirmAction("disable")}>
              Disable
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setConfirmAction("delete")}
            className="text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmAction === "disable"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Disable discount"
        description={`Are you sure you want to disable the discount code ${discount.code}? Users won't be able to apply it to new subscriptions.`}
        confirmLabel="Disable"
        cancelLabel="Keep it"
        isLoading={isLoading}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={confirmAction === "delete"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Delete discount"
        description={`Are you sure you want to permanently delete the discount code ${discount.code}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isLoading}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export function DiscountsPageClient() {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data: discounts = [], isLoading, isError, refetch } = useDiscounts();
  const { mutate: deleteDiscount, isPending: isDeletePending } =
    useDeleteDiscount();
  const { mutate: disableDiscount, isPending: isDisablePending } =
    useDisableDiscount();

  const isLoading_ = isDeletePending || isDisablePending;

  const handleEdit = (_id: string) => {
    toast.info("Edit functionality will be available soon.");
  };

  const handleDisable = (discountId: string) => {
    const discount = discounts.find((d) => d.id === discountId);
    if (!discount) return;

    disableDiscount(discountId, {
      onSuccess: () => {
        toast.success(`The discount code ${discount.code} has been disabled.`);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to disable discount"
        );
      },
    });
  };

  const handleDelete = (discountId: string) => {
    const discount = discounts.find((d) => d.id === discountId);
    if (!discount) return;

    deleteDiscount(discountId, {
      onSuccess: () => {
        toast.success(`The discount code ${discount.code} has been deleted.`);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete discount"
        );
      },
    });
  };

  const columns: ColumnDef<Discount>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("code")}</span>
      ),
    },
    {
      accessorKey: "discountType",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("discountType") as string | undefined;
        return <span className="text-sm">{capitalize(type)}</span>;
      },
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) => {
        const value = row.getValue("value") as number | undefined;
        const type = row.original.discountType;
        return <span className="text-sm">{formatValue(value, type)}</span>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as DiscountStatus | undefined;
        return (
          <Badge variant={statusVariant(status)}>
            {capitalize(status?.replace(/_/g, " "))}
          </Badge>
        );
      },
    },
    {
      accessorKey: "currentRedemptions",
      header: "Uses",
      cell: ({ row }) => {
        const current = row.original.currentRedemptions ?? 0;
        const max = row.original.maxRedemptions;
        const display = max ? `${current}/${max}` : `${current}`;
        return <span className="text-sm">{display}</span>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DiscountActions
          discount={row.original}
          onEdit={handleEdit}
          onDisable={handleDisable}
          onDelete={handleDelete}
          isLoading={isLoading_}
        />
      ),
    },
  ];

  const isNavigatingToNew = loadingHref === NEW_DISCOUNT_HREF;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Manage discount codes and promotions"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                className="w-full md:w-auto min-h-[44px]"
              >
                <Link
                  href={NEW_DISCOUNT_HREF}
                  onClick={() => handleNavClick(NEW_DISCOUNT_HREF)}
                >
                  {isNavigatingToNew ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  <span>Create Discount</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the discount creation wizard to add a new promo code
            </TooltipContent>
          </Tooltip>
        }
      />

      {isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load discounts.{" "}
            <button
              onClick={() => refetch()}
              className="underline hover:opacity-70"
            >
              Try again
            </button>
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={discounts}
          searchKey="code"
          searchPlaceholder="Search discount code..."
          isLoading={isLoading}
          mobileCard={(discount) => (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-medium">
                    {discount.code}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {capitalize(discount.discountType)} discount
                  </p>
                </div>
                <Badge variant={statusVariant(discount.status)}>
                  {capitalize(discount.status?.replace(/_/g, " "))}
                </Badge>
              </div>
              <div className="text-sm font-medium">
                {formatValue(discount.value, discount.discountType)} off
              </div>
              <div className="text-xs text-muted-foreground">
                Uses:{" "}
                {discount.maxRedemptions
                  ? `${discount.currentRedemptions ?? 0}/${discount.maxRedemptions}`
                  : `${discount.currentRedemptions ?? 0}`}
              </div>
              <div className="flex justify-end pt-2">
                <DiscountActions
                  discount={discount}
                  onEdit={handleEdit}
                  onDisable={handleDisable}
                  onDelete={handleDelete}
                  isLoading={isLoading_}
                />
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
