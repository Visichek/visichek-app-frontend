"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { PricingMarketingPlanCard } from "@/types/pricing-marketing";

interface PlanCardEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: PricingMarketingPlanCard;
}

interface FormState {
  tagline: string;
  ctaLabel: string;
  ctaUrl: string;
  badge: string;
  bullets: string[];
}

function fromCard(card: PricingMarketingPlanCard): FormState {
  return {
    tagline: card.tagline ?? "",
    ctaLabel: card.ctaLabel ?? "",
    ctaUrl: card.ctaUrl ?? "",
    badge: card.badge ?? "",
    bullets: card.highlightBullets.length ? card.highlightBullets : [""],
  };
}

export function PlanCardEditorModal({
  open,
  onOpenChange,
  card,
}: PlanCardEditorModalProps) {
  const [form, setForm] = useState<FormState>(() => fromCard(card));
  const [resetOpen, setResetOpen] = useState(false);

  const update = useUpdatePricingMarketing();
  const remove = useDeletePricingMarketingRow();

  useEffect(() => {
    if (open) setForm(fromCard(card));
  }, [open, card]);

  function setBullet(idx: number, value: string) {
    setForm((prev) => {
      const next = [...prev.bullets];
      next[idx] = value;
      return { ...prev, bullets: next };
    });
  }

  function addBullet() {
    setForm((prev) => ({ ...prev, bullets: [...prev.bullets, ""] }));
  }

  function removeBullet(idx: number) {
    setForm((prev) => {
      const next = prev.bullets.filter((_, i) => i !== idx);
      return { ...prev, bullets: next.length ? next : [""] };
    });
  }

  function handleSave() {
    const bullets = form.bullets.map((b) => b.trim()).filter((b) => b.length > 0);
    update.mutate(
      {
        plans: [
          {
            planName: card.planName,
            tagline: form.tagline.trim() || null,
            ctaLabel: form.ctaLabel.trim() || null,
            ctaUrl: form.ctaUrl.trim() || null,
            badge: form.badge.trim() || null,
            highlightBullets: bullets,
          },
        ],
      },
      {
        onSuccess: () => {
          toast.success(`${card.displayName}: marketing copy saved.`);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't save the overlay.",
          ),
      },
    );
  }

  function handleReset() {
    remove.mutate(
      { kind: "plan", key: card.planName },
      {
        onSuccess: () => {
          toast.success(`${card.displayName}: overlay reset to defaults.`);
          setResetOpen(false);
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Couldn't reset the overlay.",
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
        title={`Edit ${card.displayName}`}
        description="Marketing copy for this plan card. Prices, caps, and feature toggles still come from the live billing plan."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-tagline">Tagline</Label>
            <Textarea
              id="plan-tagline"
              value={form.tagline}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tagline: e.target.value }))
              }
              placeholder="One short sentence describing who this plan is for."
              className="text-base md:text-sm"
              rows={2}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-cta-label">CTA label</Label>
              <Input
                id="plan-cta-label"
                value={form.ctaLabel}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ctaLabel: e.target.value }))
                }
                placeholder="Start with this plan"
                className="text-base md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-cta-url">CTA URL (optional)</Label>
              <Input
                id="plan-cta-url"
                type="url"
                value={form.ctaUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ctaUrl: e.target.value }))
                }
                placeholder="https://… or mailto:sales@…"
                className="text-base md:text-sm"
                inputMode="url"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-badge">Callout badge (optional)</Label>
            <Input
              id="plan-badge"
              value={form.badge}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, badge: e.target.value }))
              }
              placeholder='e.g. "Most popular"'
              maxLength={32}
              className="text-base md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Highlight bullets</Label>
            <p className="text-xs text-muted-foreground">
              Short list shown on the card itself. The comparison table below
              the cards stays driven by the live plan rules.
            </p>
            <ul className="space-y-2">
              {form.bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <Input
                    value={bullet}
                    onChange={(e) => setBullet(idx, e.target.value)}
                    placeholder={`Bullet ${idx + 1}`}
                    className="text-base md:text-sm"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBullet(idx)}
                        aria-label={`Remove bullet ${idx + 1}`}
                        className="shrink-0 min-h-[44px] min-w-[44px]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Remove this bullet from the plan card.
                    </TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBullet}
                >
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  Add bullet
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Add another highlight bullet to this plan card.
              </TooltipContent>
            </Tooltip>
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
                Remove the marketing overlay for this plan so the
                code-shipped defaults render again.
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
        title={`Reset ${card.displayName} overlay?`}
        description="The card will fall back to the code-shipped defaults on the next page render. The plan itself is not affected."
        confirmLabel="Reset overlay"
        variant="destructive"
        isLoading={resetting}
        onConfirm={handleReset}
      />
    </>
  );
}
