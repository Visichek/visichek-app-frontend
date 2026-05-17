"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
  useDeleteFaqRow,
  useUpdateFaqs,
} from "@/features/faqs/hooks";
import type { FaqItem, FaqSection } from "@/types/faqs";

interface FaqItemEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` → create a new item. Non-null → edit the existing row. */
  item: FaqItem | null;
  /** Section the item currently belongs to (only meaningful in edit mode). */
  currentCategoryKey: string;
  /** Live category list for the section dropdown. */
  categories: FaqSection[];
}

interface FormState {
  itemKey: string;
  question: string;
  answer: string;
  categoryKey: string;
  sortOrder: string;
}

function slugifyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fromItem(
  item: FaqItem | null,
  currentCategoryKey: string,
  fallbackCategoryKey: string,
): FormState {
  if (!item) {
    return {
      itemKey: "",
      question: "",
      answer: "",
      categoryKey: fallbackCategoryKey,
      sortOrder: "",
    };
  }
  return {
    itemKey: item.itemKey,
    question: item.question ?? "",
    answer: item.answer ?? "",
    categoryKey: currentCategoryKey,
    sortOrder: String(item.sortOrder ?? ""),
  };
}

export function FaqItemEditorModal({
  open,
  onOpenChange,
  item,
  currentCategoryKey,
  categories,
}: FaqItemEditorModalProps) {
  const isCreate = item === null;
  const fallbackCategoryKey =
    currentCategoryKey || categories[0]?.categoryKey || "general";

  const [form, setForm] = useState<FormState>(() =>
    fromItem(item, currentCategoryKey, fallbackCategoryKey),
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);

  const update = useUpdateFaqs();
  const remove = useDeleteFaqRow();

  useEffect(() => {
    if (open) {
      setForm(fromItem(item, currentCategoryKey, fallbackCategoryKey));
      setKeyTouched(false);
    }
  }, [open, item, currentCategoryKey, fallbackCategoryKey]);

  const itemKeyForSave = isCreate
    ? form.itemKey.trim() || slugifyKey(form.question)
    : form.itemKey;

  const canSave =
    form.question.trim().length > 0 &&
    form.answer.trim().length > 0 &&
    itemKeyForSave.length > 0;

  function handleSave() {
    const sortOrderNumber = Number(form.sortOrder);
    const sortOrder = Number.isFinite(sortOrderNumber) && form.sortOrder.trim() !== ""
      ? Math.floor(sortOrderNumber)
      : undefined;

    update.mutate(
      {
        items: [
          {
            itemKey: itemKeyForSave,
            question: form.question.trim(),
            answer: form.answer.trim(),
            categoryKey: form.categoryKey || null,
            ...(sortOrder !== undefined ? { sortOrder } : {}),
          },
        ],
      },
      {
        onSuccess: () => {
          toast.success(
            isCreate
              ? "FAQ added."
              : `${form.question.trim() || "Item"}: saved.`,
          );
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't save the item.",
          ),
      },
    );
  }

  function handleDelete() {
    if (!item) return;
    remove.mutate(
      { kind: "item", key: item.itemKey },
      {
        onSuccess: () => {
          toast.success(`${item.question}: removed.`);
          setResetOpen(false);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't delete the item.",
          ),
      },
    );
  }

  const saving = update.isPending;
  const deleting = remove.isPending;

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title={isCreate ? "Add FAQ" : "Edit FAQ"}
        description={
          isCreate
            ? "Add a new entry to the public FAQ page. Pick a stable slug — re-using it later will update this same row."
            : "Update the question, answer, section, or position for this FAQ row."
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="faq-item-key">
              Item key {isCreate ? "(slug)" : ""}
            </Label>
            <Input
              id="faq-item-key"
              value={isCreate ? form.itemKey : form.itemKey}
              onChange={(e) => {
                if (!isCreate) return;
                setKeyTouched(true);
                setForm((prev) => ({
                  ...prev,
                  itemKey: slugifyKey(e.target.value),
                }));
              }}
              placeholder={
                isCreate
                  ? form.question
                    ? slugifyKey(form.question)
                    : "billing-how-it-works"
                  : ""
              }
              disabled={!isCreate}
              className="text-base md:text-sm font-mono"
              aria-describedby="faq-item-key-hint"
            />
            <p
              id="faq-item-key-hint"
              className="text-[11px] text-muted-foreground"
            >
              {isCreate
                ? "Lower-case, kebab-style. Auto-generated from the question if you leave it blank. Cannot be changed after save."
                : "Natural key for this row — cannot be changed. Delete and re-create to rename."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-question">Question</Label>
            <Input
              id="faq-question"
              value={form.question}
              onChange={(e) => {
                const next = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  question: next,
                  itemKey:
                    isCreate && !keyTouched ? slugifyKey(next) : prev.itemKey,
                }));
              }}
              placeholder="How does billing work?"
              className="text-base md:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-answer">Answer</Label>
            <Textarea
              id="faq-answer"
              value={form.answer}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, answer: e.target.value }))
              }
              placeholder="<p>Subscriptions renew monthly. Annual plans are billed upfront.</p>"
              className="text-base md:text-sm font-mono"
              rows={6}
            />
            <p className="text-[11px] text-muted-foreground">
              HTML or markdown — rendered directly on the public page.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="faq-category">Section</Label>
              <Select
                value={form.categoryKey}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, categoryKey: value }))
                }
              >
                <SelectTrigger id="faq-category">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((section) => (
                    <SelectItem
                      key={section.categoryKey}
                      value={section.categoryKey}
                    >
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Items without a section fall under "General".
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="faq-sort">Sort order</Label>
              <Input
                id="faq-sort"
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
                Lower = higher in the section.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-between">
            {!isCreate ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setResetOpen(true)}
                    disabled={saving || deleting}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Delete item
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Permanently remove this FAQ row from the public page.
                </TooltipContent>
              </Tooltip>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex gap-2 md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || deleting}
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
                {isCreate ? "Add FAQ" : "Save changes"}
              </LoadingButton>
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {item && (
        <ConfirmDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Delete this FAQ?"
          description={`"${item.question}" will be removed from the public FAQ page on the next render. This cannot be undone.`}
          confirmLabel="Delete item"
          variant="destructive"
          isLoading={deleting}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
