"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileText, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/recipes/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PrivacyNoticeDisplay } from "@/features/public-registration/components/privacy-notice-display";
import { BlockEditor } from "@/features/blog/components/block-editor";
import { blockText, normalizeBlocks } from "@/features/blog/lib/blocks";
import { plainTextToBlocks } from "@/features/blog/lib/html-to-blocks";
import {
  usePrivacyNotices,
  useCreatePrivacyNotice,
  useUpdatePrivacyNotice,
} from "@/features/privacy/hooks/use-privacy-notices";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import type { PrivacyNotice } from "@/types/dpo";
import type { NoticeDisplayMode } from "@/types/enums";
import type { Block } from "@/types/blog";
import type { PublicPrivacyNotice } from "@/types/public";

interface FormState {
  title: string;
  summary: string;
  /** Canonical rich content authored in the BlockNote editor. */
  body: Block[];
  displayMode: NoticeDisplayMode;
  isActive: boolean;
  /** yyyy-mm-dd for the native date input; "" when unset. */
  effectiveDate: string;
}

const EMPTY_FORM: FormState = {
  title: "Visitor privacy notice",
  summary: "",
  body: [],
  displayMode: "active_consent",
  isActive: true,
  effectiveDate: "",
};

/**
 * Resolve the editor's starting blocks: prefer the notice's canonical `body`,
 * and fall back to deriving blocks from the legacy `fullText` for any notice
 * that predates the BlockNote migration so its text isn't lost on first edit.
 */
function initialBody(notice: PrivacyNotice): Block[] {
  if (notice.body && notice.body.length > 0) return normalizeBlocks(notice.body);
  if (notice.fullText?.trim()) return plainTextToBlocks(notice.fullText);
  return [];
}

/** Whether the body has any visible text — used to gate the live preview. */
function bodyHasContent(body: Block[]): boolean {
  return body.some((b) => blockText(b).trim().length > 0);
}

const DISPLAY_MODE_OPTIONS: {
  value: NoticeDisplayMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "active_consent",
    label: "Require explicit consent",
    hint: "Visitors must tick an “I accept” checkbox before they can check in.",
  },
  {
    value: "passive",
    label: "Display only",
    hint: "The notice is shown to visitors but they are not asked to accept it.",
  },
];

function unixToDateInput(unix?: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateInputToUnix(value: string): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

export default function PrivacyNoticesPage() {
  const { hasCapability } = useCapabilities();
  const canView = hasCapability(CAPABILITIES.PRIVACY_NOTICE_VIEW);
  const canEdit = hasCapability(CAPABILITIES.PRIVACY_NOTICE_EDIT);

  const { data, isLoading, isError, error, refetch } = usePrivacyNotices({
    limit: 50,
  });

  // The notice we edit: the active one if present, otherwise the most
  // recently touched. `null` means the tenant has none yet → create mode.
  const current: PrivacyNotice | null = useMemo(() => {
    const notices = data?.data ?? [];
    if (notices.length === 0) return null;
    return notices.find((n) => n.isActive) ?? notices[0];
  }, [data]);

  const create = useCreatePrivacyNotice();
  const update = useUpdatePrivacyNotice(current?.id ?? "");

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prefill once the notice arrives (or reset to defaults in create mode).
  useEffect(() => {
    if (current) {
      setForm({
        title: current.title ?? "",
        summary: current.summary ?? "",
        body: initialBody(current),
        displayMode: current.displayMode,
        isActive: current.isActive,
        effectiveDate: unixToDateInput(current.effectiveDate),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [current]);

  const preview: PublicPrivacyNotice = {
    id: current?.id ?? "preview",
    title: form.title.trim() || "Visitor privacy notice",
    summary: form.summary.trim() || undefined,
    body: bodyHasContent(form.body) ? form.body : undefined,
    displayMode: form.displayMode,
    versionId: current?.versionId ?? current?.id,
    effectiveDate: dateInputToUnix(form.effectiveDate),
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Visitor privacy notice"
          description="The privacy notice visitors see when they check in."
        />
        <EmptyState
          title="You don't have access to privacy notices"
          description="Ask your super admin or DPO to manage the visitor privacy notice."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="Couldn't load the privacy notice"
          message={error instanceof Error ? error.message : "Something went wrong"}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "title") setTitleError(null);
  }

  function validate(): boolean {
    const title = form.title.trim();
    if (title.length < 1) {
      setTitleError("A title is required.");
      return false;
    }
    return true;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    const base = {
      title: form.title.trim(),
      summary: form.summary.trim() || undefined,
      body: form.body,
      displayMode: form.displayMode,
      effectiveDate: dateInputToUnix(form.effectiveDate),
    };

    try {
      if (current) {
        await update.mutateAsync({ ...base, isActive: form.isActive });
        toast.success("Privacy notice updated.");
      } else {
        await create.mutateAsync(base);
        toast.success("Privacy notice created.");
      }
      await refetch();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Couldn't save the privacy notice. Please try again.",
      );
    }
  }

  const saving = create.isPending || update.isPending;
  const activeModeHint = DISPLAY_MODE_OPTIONS.find(
    (o) => o.value === form.displayMode,
  )?.hint;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Visitor privacy notice"
        description="This is the privacy policy and terms visitors see at your QR / kiosk check-in. When set to require explicit consent, visitors must accept it before they can check in."
      />

      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        <p className="text-foreground/80">
          {current
            ? "Edit the notice below. Changes apply to your kiosk and QR check-in immediately after saving."
            : "You don't have a visitor privacy notice yet. Create one below — it will appear at your kiosk and QR check-in."}
        </p>
      </div>

      {submitError && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Notice content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pn-title">
                Title<span aria-hidden="true"> *</span>
              </Label>
              <Input
                id="pn-title"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Visitor privacy notice"
                maxLength={200}
                disabled={!canEdit}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? "pn-title-error" : undefined}
                className="text-base md:text-sm"
              />
              {titleError && (
                <p id="pn-title-error" className="text-xs text-destructive">
                  {titleError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pn-summary">Summary</Label>
              <Textarea
                id="pn-summary"
                value={form.summary}
                onChange={(e) => setField("summary", e.target.value)}
                placeholder="A short, plain-language explanation shown up front (e.g. why you collect visitor data and how it's used)."
                rows={3}
                disabled={!canEdit}
                className="text-base md:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Shown directly under the title at check-in.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pn-body">Full notice</Label>
              <div
                id="pn-body"
                className="rounded-md border border-input bg-background px-2 py-3 md:px-4"
                aria-label="Full privacy notice content"
              >
                {canEdit ? (
                  <BlockEditor
                    value={form.body}
                    onChange={(body) => setField("body", body)}
                    placeholder="Write the privacy policy and terms, or press '/' for blocks…"
                  />
                ) : (
                  <PrivacyNoticeDisplay notice={preview} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The complete privacy policy and terms. Use headings and lists to
                structure it — visitors expand “Read full privacy notice” to see
                this. Tenant details are filled in automatically; you don’t need
                to add them.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pn-displayMode">How visitors respond</Label>
                <Select
                  value={form.displayMode}
                  onValueChange={(v) =>
                    setField("displayMode", v as NoticeDisplayMode)
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger id="pn-displayMode" className="text-base md:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeModeHint && (
                  <p className="text-xs text-muted-foreground">{activeModeHint}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pn-effectiveDate">Effective date</Label>
                <Input
                  id="pn-effectiveDate"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setField("effectiveDate", e.target.value)}
                  disabled={!canEdit}
                  className="text-base md:text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Optional — when this version of the notice takes effect.
                </p>
              </div>
            </div>

            {current && (
              <div className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="pn-isActive" className="cursor-pointer">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only the active notice is shown to visitors. Turn this off to
                    take the notice down without deleting it.
                  </p>
                </div>
                <Switch
                  id="pn-isActive"
                  checked={form.isActive}
                  onCheckedChange={(v) => setField("isActive", v)}
                  disabled={!canEdit}
                  aria-label="Toggle whether this privacy notice is active"
                />
              </div>
            )}

            {canEdit && (
              <div className="flex justify-end pt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <LoadingButton
                        type="submit"
                        isLoading={saving}
                        loadingText="Saving…"
                        className="min-h-[44px] w-full md:w-auto"
                      >
                        {current ? "Save changes" : "Create notice"}
                      </LoadingButton>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {current
                      ? "Save the privacy notice; changes apply to kiosk and QR check-in immediately"
                      : "Create the privacy notice and show it at kiosk and QR check-in"}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Eye className="h-4 w-4" aria-hidden="true" />
          Visitor preview
        </div>
        <PrivacyNoticeDisplay notice={preview} />
        {form.displayMode === "active_consent" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            At check-in, visitors will see an “I accept” checkbox under this notice
            and cannot continue until they tick it.
          </p>
        )}
      </div>
    </div>
  );
}
