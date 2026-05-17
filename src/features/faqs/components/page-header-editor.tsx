"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { useUpdateFaqs } from "@/features/faqs/hooks";
import type { FaqsResponse } from "@/types/faqs";

interface PageHeaderEditorProps {
  data: FaqsResponse;
}

interface FormState {
  headline: string;
  subheadline: string;
  footerHtml: string;
}

function fromData(data: FaqsResponse): FormState {
  return {
    headline: data.headline ?? "",
    subheadline: data.subheadline ?? "",
    footerHtml: data.footerHtml ?? "",
  };
}

export function PageHeaderEditor({ data }: PageHeaderEditorProps) {
  const [form, setForm] = useState<FormState>(() => fromData(data));
  const update = useUpdateFaqs();

  useEffect(() => {
    setForm(fromData(data));
  }, [data]);

  const dirty =
    form.headline.trim() !== (data.headline ?? "").trim() ||
    form.subheadline.trim() !== (data.subheadline ?? "").trim() ||
    form.footerHtml.trim() !== (data.footerHtml ?? "").trim();

  function handleSave() {
    const headline = form.headline.trim();
    const subheadline = form.subheadline.trim();
    const footerHtml = form.footerHtml.trim();

    const payload: Parameters<typeof update.mutate>[0] = {};
    if (headline !== (data.headline ?? "").trim()) payload.headline = headline;
    if (subheadline !== (data.subheadline ?? "").trim()) {
      payload.subheadline = subheadline;
    }
    if (footerHtml !== (data.footerHtml ?? "").trim()) {
      payload.footerHtml = footerHtml;
    }

    update.mutate(payload, {
      onSuccess: () => {
        toast.success("Page copy saved.");
      },
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : "Couldn't save the page copy.",
        ),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Page copy</CardTitle>
        <CardDescription>
          Headline, subheadline, and footer shown around the FAQ list on the
          public page. The footer accepts HTML — leave blank to fall back to
          the default support-email line.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="faq-headline">Headline</Label>
          <Input
            id="faq-headline"
            value={form.headline}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, headline: e.target.value }))
            }
            placeholder="Frequently Asked Questions"
            className="text-base md:text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="faq-subheadline">Subheadline (optional)</Label>
          <Textarea
            id="faq-subheadline"
            value={form.subheadline}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, subheadline: e.target.value }))
            }
            placeholder="Quick answers on billing, security, and rollout."
            className="text-base md:text-sm"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="faq-footer">Footer HTML</Label>
          <Textarea
            id="faq-footer"
            value={form.footerHtml}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, footerHtml: e.target.value }))
            }
            placeholder='<p>Have an infrequently asked question? <a href="mailto:support@…">Email support</a>.</p>'
            className="text-base md:text-sm font-mono"
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground">
            Rendered as HTML directly. Use the same anchor / paragraph tags
            you'd use on the marketing site.
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
            Save page copy
          </LoadingButton>
        </div>
      </CardContent>
    </Card>
  );
}
