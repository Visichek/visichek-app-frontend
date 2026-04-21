"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCreateSupportCase } from "@/features/support-cases/hooks/use-support-cases";
import { CASE_CATEGORY_LABELS } from "@/features/support-cases/components";
import { ApiError } from "@/types/api";
import type {
  SupportCasePriority,
  SupportCaseCategory,
} from "@/types/enums";

const SUBJECT_MIN = 5;
const SUBJECT_MAX = 200;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 10_000;

const schema = z.object({
  subject: z
    .string()
    .trim()
    .min(SUBJECT_MIN, `Subject must be at least ${SUBJECT_MIN} characters`)
    .max(SUBJECT_MAX, `Subject must be ${SUBJECT_MAX} characters or fewer`),
  description: z
    .string()
    .trim()
    .min(DESCRIPTION_MIN, `Please provide at least ${DESCRIPTION_MIN} characters so we can help quickly`)
    .max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or fewer`),
  category: z.enum([
    "billing",
    "technical",
    "account",
    "feature_request",
    "data_privacy",
    "other",
  ] as const),
  priority: z.enum(["low", "medium", "high", "critical"] as const),
});

type FormData = z.infer<typeof schema>;

export default function NewSupportCasePage() {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const createMutation = useCreateSupportCase();
  const [isNavigating, setIsNavigating] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "",
      description: "",
      category: "technical",
      priority: "medium",
    },
  });

  const category = watch("category");
  const priority = watch("priority");
  const descriptionLength = watch("description")?.length ?? 0;

  const onSubmit = handleSubmit(async (data) => {
    try {
      // Optimistic: the ack carries the final resource id — navigate straight
      // to the detail page and let the job settle in the background. The
      // detail page will pick up the new case from the cache on invalidation.
      const ack = await createMutation.mutateAsync(data);
      toast.success("Support case opened — we'll pick it up shortly.");
      setIsNavigating(true);
      router.push(`/app/support-cases/${ack.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "QUOTA_EXCEEDED") {
        toast.error(
          "You've hit the 10-open-case cap. Resolve an existing case before opening another.",
        );
        return;
      }
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't open the case. Please try again.",
      );
    }
  });

  const submitting = isSubmitting || createMutation.isPending || isNavigating;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/support-cases"
                onClick={() => handleNavClick("/app/support-cases")}
              >
                {loadingHref === "/app/support-cases" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to cases
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the support cases list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="Open a support case"
        description="Describe the issue you're running into. More detail = faster resolution."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Input
            id="subject"
            placeholder="Short summary of the issue"
            maxLength={SUBJECT_MAX}
            {...register("subject")}
            aria-invalid={!!errors.subject}
            aria-describedby={errors.subject ? "error-subject" : undefined}
          />
          {errors.subject && (
            <p id="error-subject" className="text-sm text-destructive" role="alert">
              {errors.subject.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">
            Description *{" "}
            <span className="font-normal text-muted-foreground">
              ({descriptionLength}/{DESCRIPTION_MAX})
            </span>
          </Label>
          <Textarea
            id="description"
            rows={8}
            placeholder="What happened? When did it start? Who's affected? Include any error messages you've seen."
            maxLength={DESCRIPTION_MAX}
            {...register("description")}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "error-description" : undefined}
          />
          {errors.description && (
            <p id="error-description" className="text-sm text-destructive" role="alert">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={category}
                    onValueChange={(v) => setValue("category", v as SupportCaseCategory)}
                  >
                    <SelectTrigger id="category" className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CASE_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                Pick the closest subject area. This helps route your case to the right team.
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={priority}
                    onValueChange={(v) => setValue("priority", v as SupportCasePriority)}
                  >
                    <SelectTrigger id="priority" className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low — no immediate impact</SelectItem>
                      <SelectItem value="medium">Medium — some users affected</SelectItem>
                      <SelectItem value="high">High — significant impact on operations</SelectItem>
                      <SelectItem value="critical">
                        Critical — system is down or unusable
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                How urgent is this for your organisation? We use this to set response expectations.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          You can attach screenshots, logs, and other files from the case detail page
          once it's created.
        </p>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                <Link
                  href="/app/support-cases"
                  onClick={() => handleNavClick("/app/support-cases")}
                >
                  Cancel
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to your cases list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText="Opening…"
                  className="w-full md:w-auto"
                >
                  Open case
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Submit this case. You'll be taken to the case detail page to continue the conversation.
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
