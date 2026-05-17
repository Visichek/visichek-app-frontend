"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
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
  useDeleteFaqRow,
  useUpdateFaqs,
} from "@/features/faqs/hooks";
import type { FaqSection } from "@/types/faqs";

interface FaqCategoryEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` → create a new section. Non-null → edit the existing section. */
  section: FaqSection | null;
}

interface FormState {
  categoryKey: string;
  label: string;
  sortOrder: string;
}

/** Default code-shipped sections that auto-reappear after a DELETE. */
const DEFAULT_CATEGORY_KEYS = new Set([
  "general",
  "billing",
  "security",
  "support",
]);

function slugifyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fromSection(section: FaqSection | null): FormState {
  if (!section) {
    return { categoryKey: "", label: "", sortOrder: "" };
  }
  return {
    categoryKey: section.categoryKey,
    label: section.label ?? "",
    sortOrder: String(section.sortOrder ?? ""),
  };
}

export function FaqCategoryEditorModal({
  open,
  onOpenChange,
  section,
}: FaqCategoryEditorModalProps) {
  const isCreate = section === null;
  const [form, setForm] = useState<FormState>(() => fromSection(section));
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);

  const update = useUpdateFaqs();
  const remove = useDeleteFaqRow();

  useEffect(() => {
    if (open) {
      setForm(fromSection(section));
      setKeyTouched(false);
    }
  }, [open, section]);

  const categoryKeyForSave = isCreate
    ? form.categoryKey.trim() || slugifyKey(form.label)
    : form.categoryKey;

  const canSave =
    form.label.trim().length > 0 && categoryKeyForSave.length > 0;

  const isDefaultSection =
    !!section && DEFAULT_CATEGORY_KEYS.has(section.categoryKey);

  function handleSave() {
    const sortOrderNumber = Number(form.sortOrder);
    const sortOrder = Number.isFinite(sortOrderNumber) && form.sortOrder.trim() !== ""
      ? Math.floor(sortOrderNumber)
      : undefined;

    update.mutate(
      {
        categories: [
          {
            categoryKey: categoryKeyForSave,
            label: form.label.trim() || null,
            ...(sortOrder !== undefined ? { sortOrder } : {}),
          },
        ],
      },
      {
        onSuccess: () => {
          toast.success(
            isCreate
              ? "Section added."
              : `${form.label.trim() || "Section"}: saved.`,
          );
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
    if (!section) return;
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

  function handleDelete() {
    if (!section) return;
    remove.mutate(
      { kind: "category", key: section.categoryKey },
      {
        onSuccess: () => {
          toast.success(`${section.label}: section deleted.`);
          setDeleteOpen(false);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't delete the section.",
          ),
      },
    );
  }

  const saving = update.isPending;
  const removing = remove.isPending;

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title={isCreate ? "Add section" : "Edit section"}
        description={
          isCreate
            ? "Add a new section to group FAQ items under. Pick a stable slug — re-using it later will update this same section."
            : "Rename or re-order this section of the FAQ page."
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="faq-cat-key">
              Section key {isCreate ? "(slug)" : ""}
            </Label>
            <Input
              id="faq-cat-key"
              value={form.categoryKey}
              onChange={(e) => {
                if (!isCreate) return;
                setKeyTouched(true);
                setForm((prev) => ({
                  ...prev,
                  categoryKey: slugifyKey(e.target.value),
                }));
              }}
              placeholder={
                isCreate
                  ? form.label
                    ? slugifyKey(form.label)
                    : "integrations"
                  : ""
              }
              disabled={!isCreate}
              className="text-base md:text-sm font-mono"
              aria-describedby="faq-cat-key-hint"
            />
            <p
              id="faq-cat-key-hint"
              className="text-[11px] text-muted-foreground"
            >
              {isCreate
                ? "Lower-case, kebab-style. Auto-generated from the label if you leave it blank. Cannot be changed after save."
                : "Natural key for this section — cannot be changed."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-cat-label">Section label</Label>
            <Input
              id="faq-cat-label"
              value={form.label}
              onChange={(e) => {
                const next = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  label: next,
                  categoryKey:
                    isCreate && !keyTouched
                      ? slugifyKey(next)
                      : prev.categoryKey,
                }));
              }}
              placeholder="e.g. Integrations"
              className="text-base md:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-cat-sort">Sort order</Label>
            <Input
              id="faq-cat-sort"
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
              Lower numbers render first. Defaults: General 10, Billing 20,
              Security 30, Support 40.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-between">
            {!isCreate ? (
              isDefaultSection ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setResetOpen(true)}
                      disabled={saving || removing}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Reset to default
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Remove the overlay for this default section so the
                    code-shipped label and sort order render again.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDeleteOpen(true)}
                      disabled={saving || removing}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Delete section
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Delete this custom section. Items inside get parked under
                    "General" on the next render.
                  </TooltipContent>
                </Tooltip>
              )
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex gap-2 md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || removing}
                className="min-h-[44px] w-full md:w-auto"
              >
                Cancel
              </Button>
              <LoadingButton
                type="button"
                onClick={handleSave}
                isLoading={saving}
                loadingText={isCreate ? "Adding…" : "Saving…"}
                disabled={!canSave}
                className="w-full md:w-auto"
              >
                {isCreate ? "Add section" : "Save changes"}
              </LoadingButton>
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {section && (
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Reset this section?"
          description="The section will fall back to the code-shipped label and sort order on the next page render. Items already in the section stay in the section."
          confirmLabel="Reset overlay"
          variant="destructive"
          isLoading={removing}
          onConfirm={handleReset}
        />
      )}

      {section && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete "${section.label}"?`}
          description={`This section will be removed from the FAQ page. Items pointing at "${section.categoryKey}" will be parked under "General" on the next render.`}
          confirmLabel="Delete section"
          variant="destructive"
          isLoading={removing}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
