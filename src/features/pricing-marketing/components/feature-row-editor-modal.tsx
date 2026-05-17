"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type {
  PricingMarketingRow,
  PricingMarketingSection,
} from "@/types/pricing-marketing";

interface FeatureRowEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PricingMarketingRow;
  currentCategoryKey: string;
  categories: PricingMarketingSection[];
}

interface FormState {
  label: string;
  description: string;
  categoryKey: string;
}

function fromRow(
  row: PricingMarketingRow,
  currentCategoryKey: string,
): FormState {
  return {
    label: row.label ?? "",
    description: row.description ?? "",
    categoryKey: currentCategoryKey,
  };
}

export function FeatureRowEditorModal({
  open,
  onOpenChange,
  row,
  currentCategoryKey,
  categories,
}: FeatureRowEditorModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    fromRow(row, currentCategoryKey),
  );
  const [resetOpen, setResetOpen] = useState(false);

  const update = useUpdatePricingMarketing();
  const remove = useDeletePricingMarketingRow();

  useEffect(() => {
    if (open) setForm(fromRow(row, currentCategoryKey));
  }, [open, row, currentCategoryKey]);

  function handleSave() {
    update.mutate(
      {
        features: [
          {
            rowKey: row.rowKey,
            label: form.label.trim() || null,
            description: form.description.trim() || null,
            categoryKey: form.categoryKey,
          },
        ],
      },
      {
        onSuccess: () => {
          toast.success(`${row.label}: row saved.`);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't save the row.",
          ),
      },
    );
  }

  function handleReset() {
    remove.mutate(
      { kind: "feature", key: row.rowKey },
      {
        onSuccess: () => {
          toast.success(`${row.label}: overlay reset to defaults.`);
          setResetOpen(false);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't reset the row.",
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
        title="Edit comparison row"
        description="Override the label, description, or section for this row in the comparison table. The cell values themselves come from the live plans."
      >
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-mono">
            {row.rowKey}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="row-label">Row label</Label>
            <Input
              id="row-label"
              value={form.label}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="e.g. Identity verification"
              className="text-base md:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="row-description">Description (optional)</Label>
            <Textarea
              id="row-description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="One-sentence explainer shown as a tooltip on the row."
              className="text-base md:text-sm"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="row-category">Section</Label>
            <Select
              value={form.categoryKey}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, categoryKey: value }))
              }
            >
              <SelectTrigger id="row-category">
                <SelectValue placeholder="Choose a section" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((section) => (
                  <SelectItem key={section.categoryKey} value={section.categoryKey}>
                    {section.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Move this row into a different section of the comparison table.
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
                Remove the overlay for this row so the code-shipped label and
                section render again.
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
        title="Reset this row?"
        description="The row will fall back to the code-shipped label and section on the next page render. The underlying plan data is not affected."
        confirmLabel="Reset overlay"
        variant="destructive"
        isLoading={resetting}
        onConfirm={handleReset}
      />
    </>
  );
}
