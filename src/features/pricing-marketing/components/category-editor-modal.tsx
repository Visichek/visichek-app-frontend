"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import {
  useDeletePricingMarketingRow,
  useUpdatePricingMarketing,
} from "@/features/pricing-marketing/hooks";
import type { PricingMarketingSection } from "@/types/pricing-marketing";

interface CategoryEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: PricingMarketingSection;
}

interface FormState {
  label: string;
  sortOrder: string;
}

function fromSection(section: PricingMarketingSection): FormState {
  return {
    label: section.label ?? "",
    sortOrder: String(section.sortOrder ?? ""),
  };
}

export function CategoryEditorModal({
  open,
  onOpenChange,
  section,
}: CategoryEditorModalProps) {
  const [form, setForm] = useState<FormState>(() => fromSection(section));
  const [resetOpen, setResetOpen] = useState(false);

  const update = useUpdatePricingMarketing();
  const remove = useDeletePricingMarketingRow();

  useEffect(() => {
    if (open) setForm(fromSection(section));
  }, [open, section]);

  function handleSave() {
    const sortOrderNumber = Number(form.sortOrder);
    const sortOrder = Number.isFinite(sortOrderNumber)
      ? Math.floor(sortOrderNumber)
      : undefined;

    update.mutate(
      {
        categories: [
          {
            categoryKey: section.categoryKey,
            label: form.label.trim() || null,
            ...(sortOrder !== undefined ? { sortOrder } : {}),
          },
        ],
      },
      {
        onSuccess: () => {
          toast.success(`${section.label}: section saved.`);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't save the section.",
          ),
      },
    );
  }

  function handleReset() {
    remove.mutate(
      { kind: "category", key: section.categoryKey },
      {
        onSuccess: () => {
          toast.success(`${section.label}: overlay reset to defaults.`);
          setResetOpen(false);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't reset the section.",
          ),
      },
    );
  }

  const saving = update.isPending;
  const resetting = remove.isPending;

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title="Edit section"
        description="Rename or re-order this section of the comparison table."
      >
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-mono">
            {section.categoryKey}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="section-label">Section label</Label>
            <Input
              id="section-label"
              value={form.label}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="e.g. Capacity & limits"
              className="text-base md:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="section-sort">Sort order</Label>
            <Input
              id="section-sort"
              type="number"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sortOrder: e.target.value }))
              }
              placeholder="10"
              className="text-base md:text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Lower numbers render first. Capacity defaults to 10, Features
              to 20, Storage 30, Throughput 40, Support &amp; SLA 50,
              Billing 60.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setResetOpen(true)}
                  disabled={saving || resetting}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reset to default
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Remove the overlay for this section so the code-shipped label
                and sort order render again.
              </TooltipContent>
            </Tooltip>
            <div className="flex gap-2 md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || resetting}
                className="min-h-[44px] w-full md:w-auto"
              >
                Cancel
              </Button>
              <LoadingButton
                type="button"
                onClick={handleSave}
                isLoading={saving}
                loadingText="Saving…"
                className="w-full md:w-auto"
              >
                Save changes
              </LoadingButton>
            </div>
          </div>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset this section?"
        description="The section will fall back to the code-shipped label and sort order on the next page render. Rows already in the section stay in the section."
        confirmLabel="Reset overlay"
        variant="destructive"
        isLoading={resetting}
        onConfirm={handleReset}
      />
    </>
  );
}
