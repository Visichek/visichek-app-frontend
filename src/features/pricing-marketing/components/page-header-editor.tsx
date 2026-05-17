"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useUpdatePricingMarketing } from "@/features/pricing-marketing/hooks";
import type { PricingMarketingResponse } from "@/types/pricing-marketing";

interface PageHeaderEditorProps {
  data: PricingMarketingResponse;
}

interface FormState {
  headline: string;
  subheadline: string;
  currencyDisplay: string;
}

function fromData(data: PricingMarketingResponse): FormState {
  return {
    headline: data.headline ?? "",
    subheadline: data.subheadline ?? "",
    currencyDisplay: "",
  };
}

export function PageHeaderEditor({ data }: PageHeaderEditorProps) {
  const [form, setForm] = useState<FormState>(() => fromData(data));
  const update = useUpdatePricingMarketing();

  useEffect(() => {
    setForm(fromData(data));
  }, [data]);

  const dirty =
    form.headline.trim() !== (data.headline ?? "").trim() ||
    form.subheadline.trim() !== (data.subheadline ?? "").trim() ||
    form.currencyDisplay.trim().length > 0;

  function handleSave() {
    const headline = form.headline.trim();
    const subheadline = form.subheadline.trim();
    const currencyDisplay = form.currencyDisplay.trim();

    const payload: Parameters<typeof update.mutate>[0] = {};
    if (headline !== (data.headline ?? "").trim()) payload.headline = headline;
    if (subheadline !== (data.subheadline ?? "").trim()) {
      payload.subheadline = subheadline;
    }
    if (currencyDisplay) payload.currencyDisplay = currencyDisplay;

    update.mutate(payload, {
      onSuccess: () => {
        toast.success("Hero copy saved.");
        setForm((prev) => ({ ...prev, currencyDisplay: "" }));
      },
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "Couldn't save the hero copy.",
        ),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hero copy</CardTitle>
        <CardDescription>
          Headline and subheadline shown above the pricing card grid. Currency
          on each plan card still comes from the live plan — set a display
          override only if you want a symbol different from the plan's
          configured currency code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hero-headline">Headline</Label>
          <Input
            id="hero-headline"
            value={form.headline}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, headline: e.target.value }))
            }
            placeholder="Predictable pricing that scales with you."
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-subheadline">Subheadline</Label>
          <Textarea
            id="hero-subheadline"
            value={form.subheadline}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, subheadline: e.target.value }))
            }
            placeholder="Sensible, scalable, prorated by the second."
            className="text-base md:text-sm"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-currency">
            Currency symbol override (optional)
          </Label>
          <Input
            id="hero-currency"
            value={form.currencyDisplay}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, currencyDisplay: e.target.value }))
            }
            placeholder={`Currently rendered as "${data.currency}"`}
            maxLength={8}
            className="text-base md:text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank to keep using the plan's configured currency code in
            the UI. Fill in to override the visible symbol (e.g. "$" or "₦").
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <LoadingButton
            type="button"
            onClick={handleSave}
            isLoading={update.isPending}
            loadingText="Saving…"
            disabled={!dirty}
            className="w-full md:w-auto"
          >
            Save hero copy
          </LoadingButton>
        </div>
      </CardContent>
    </Card>
  );
}
