"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarRange,
  ClipboardCheck,
  Loader2,
  Percent,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import {
  StepIndicator,
  ReviewRow,
  useStepForm,
  type StepDef,
} from "@/components/recipes/step-indicator";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCreateDiscount } from "@/features/discounts/hooks/use-discounts";

/* ------------------------------------------------------------------ */
/* Schema                                                               */
/* ------------------------------------------------------------------ */

const discountSchema = z
  .object({
    code: z
      .string()
      .min(1, "Code is required")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Code may only contain letters, numbers, underscores, or hyphens",
      ),
    name: z.string().min(1, "Name is required"),
    type: z.enum(["percentage", "fixed"]),
    value: z.coerce
      .number({ invalid_type_error: "Value must be a number" })
      .min(0, "Value cannot be negative"),
    scope: z.enum(["global", "tenant", "plan"]),
    targetTenantId: z.string().optional(),
    description: z.string().optional(),
    maxRedemptions: z.coerce
      .number()
      .int()
      .min(1, "Must be at least 1")
      .optional()
      .or(z.literal("")),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "percentage" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 100,
        type: "number",
        inclusive: true,
        path: ["value"],
        message: "Percentage value must be between 0 and 100",
      });
    }
    if (data.scope === "tenant" && !data.targetTenantId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetTenantId"],
        message: "Tenant ID is required for tenant-scoped discounts",
      });
    }
  });

type DiscountFormData = z.infer<typeof discountSchema>;

/* ------------------------------------------------------------------ */
/* Step definitions                                                     */
/* ------------------------------------------------------------------ */

const STEPS: StepDef[] = [
  { id: 1, label: "Basics", icon: Percent },
  { id: 2, label: "Targeting", icon: Target },
  { id: 3, label: "Rules", icon: CalendarRange },
  { id: 4, label: "Review", icon: ClipboardCheck },
];

const STEP_FIELDS: Record<number, (keyof DiscountFormData)[]> = {
  1: ["code", "name", "type", "value"],
  2: ["scope", "targetTenantId"],
  3: [],
  4: [],
};

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Enter the discount code, name, and value.",
  2: "Choose who this discount applies to.",
  3: "Set validity dates and redemption limits.",
  4: "Review everything before creating the discount.",
};

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

const LIST_HREF = "/admin/discounts";

/**
 * Dedicated page-level form for creating a discount.
 *
 * Replaces the modal at discount-form-modal.tsx. The step navigation uses the
 * shared StepIndicator + useStepForm recipe so multi-step wizards stay
 * consistent whether they live in a page or a modal.
 */
export function DiscountForm() {
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();
  const createMutation = useCreateDiscount();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<DiscountFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "percentage",
      value: 0,
      scope: "global",
      targetTenantId: "",
      description: "",
      maxRedemptions: "",
      validFrom: "",
      validUntil: "",
    },
    mode: "onTouched",
  });

  const values = watch();

  const stepForm = useStepForm<DiscountFormData>({
    totalSteps: 4,
    stepFields: STEP_FIELDS,
    trigger,
    onClose: () => navigate(LIST_HREF),
  });

  const onSubmit = async (data: DiscountFormData) => {
    try {
      const toUnix = (dateStr: string) =>
        dateStr ? Math.floor(new Date(dateStr).getTime() / 1000) : undefined;

      await createMutation.mutateAsync({
        code: data.code.toUpperCase(),
        name: data.name,
        type: data.type,
        value: data.value,
        scope: data.scope,
        targetTenantId:
          data.scope === "tenant" ? data.targetTenantId : undefined,
        description: data.description || undefined,
        maxRedemptions:
          data.maxRedemptions !== "" && data.maxRedemptions !== undefined
            ? Number(data.maxRedemptions)
            : undefined,
        validFrom: toUnix(data.validFrom ?? ""),
        validUntil: toUnix(data.validUntil ?? ""),
      });
      toast.success("Discount created successfully");
      navigate(LIST_HREF);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create discount",
      );
    }
  };

  const scopeLabel: Record<DiscountFormData["scope"], string> = {
    global: "Global",
    tenant: "Tenant",
    plan: "Plan",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href={LIST_HREF}
                onClick={() => handleNavClick(LIST_HREF)}
              >
                {loadingHref === LIST_HREF ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to discounts
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the discounts list without creating a new one
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="Create discount"
        description={STEP_DESCRIPTIONS[stepForm.currentStep]}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <StepIndicator
          steps={STEPS}
          currentStep={stepForm.currentStep}
          completedSteps={stepForm.completedSteps}
        />

        {/* ---- Step 1: Basics ---- */}
        {stepForm.currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount-code">
                  Code <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="discount-code"
                  placeholder="LAUNCH50"
                  className="uppercase"
                  autoFocus
                  {...register("code")}
                  aria-invalid={!!errors.code}
                  aria-describedby={
                    errors.code ? "discount-code-error" : undefined
                  }
                />
                {errors.code && (
                  <p
                    id="discount-code-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.code.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-name">
                  Name <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="discount-name"
                  placeholder="Launch Discount"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                  aria-describedby={
                    errors.name ? "discount-name-error" : undefined
                  }
                />
                {errors.name && (
                  <p
                    id="discount-name-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount-type">Type</Label>
                <Select
                  value={values.type}
                  onValueChange={(v) =>
                    setValue("type", v as DiscountFormData["type"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="discount-type" className="min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-value">
                  Value <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  min={0}
                  max={values.type === "percentage" ? 100 : undefined}
                  step={values.type === "percentage" ? 1 : "0.01"}
                  inputMode="decimal"
                  placeholder={values.type === "percentage" ? "50" : "0.00"}
                  {...register("value")}
                  aria-invalid={!!errors.value}
                  aria-describedby={
                    errors.value ? "discount-value-error" : undefined
                  }
                />
                {errors.value && (
                  <p
                    id="discount-value-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.value.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---- Step 2: Targeting ---- */}
        {stepForm.currentStep === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discount-scope">Scope</Label>
              <Select
                value={values.scope}
                onValueChange={(v) =>
                  setValue("scope", v as DiscountFormData["scope"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="discount-scope" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    Global — available to all tenants
                  </SelectItem>
                  <SelectItem value="tenant">
                    Tenant — one specific tenant
                  </SelectItem>
                  <SelectItem value="plan">
                    Plan — specific plans only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {values.scope === "tenant" && (
              <div className="space-y-2">
                <Label htmlFor="discount-tenantId">
                  Target Tenant ID <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="discount-tenantId"
                  placeholder="Tenant ID"
                  autoFocus
                  {...register("targetTenantId")}
                  aria-invalid={!!errors.targetTenantId}
                  aria-describedby={
                    errors.targetTenantId
                      ? "discount-tenantId-error"
                      : undefined
                  }
                />
                {errors.targetTenantId && (
                  <p
                    id="discount-tenantId-error"
                    className="text-sm text-destructive"
                    role="alert"
                  >
                    {errors.targetTenantId.message}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---- Step 3: Rules ---- */}
        {stepForm.currentStep === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount-validFrom">Valid From</Label>
                <Input
                  id="discount-validFrom"
                  type="date"
                  autoFocus
                  {...register("validFrom")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-validUntil">Valid Until</Label>
                <Input
                  id="discount-validUntil"
                  type="date"
                  {...register("validUntil")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-maxRedemptions">Max Redemptions</Label>
              <Input
                id="discount-maxRedemptions"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Unlimited"
                {...register("maxRedemptions")}
                aria-invalid={!!errors.maxRedemptions}
                aria-describedby={
                  errors.maxRedemptions
                    ? "discount-maxRedemptions-error"
                    : undefined
                }
              />
              {errors.maxRedemptions && (
                <p
                  id="discount-maxRedemptions-error"
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {errors.maxRedemptions.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount-description">Description</Label>
              <Textarea
                id="discount-description"
                placeholder="Optional description..."
                rows={2}
                {...register("description")}
              />
            </div>
          </div>
        )}

        {/* ---- Step 4: Review ---- */}
        {stepForm.currentStep === 4 && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-1">
            <ReviewRow label="Code" value={values.code.toUpperCase()} />
            <ReviewRow label="Name" value={values.name} />
            <ReviewRow
              label="Type"
              value={
                values.type === "percentage"
                  ? "Percentage (%)"
                  : "Fixed Amount (₦)"
              }
            />
            <ReviewRow
              label="Value"
              value={
                values.type === "percentage"
                  ? `${values.value}%`
                  : `₦${Number(values.value).toFixed(2)}`
              }
            />
            <ReviewRow label="Scope" value={scopeLabel[values.scope]} />
            {values.scope === "tenant" && (
              <ReviewRow
                label="Target Tenant ID"
                value={values.targetTenantId || "—"}
              />
            )}
            <ReviewRow
              label="Valid From"
              value={values.validFrom || "No start date"}
            />
            <ReviewRow
              label="Valid Until"
              value={values.validUntil || "No expiry"}
            />
            <ReviewRow
              label="Max Redemptions"
              value={
                values.maxRedemptions !== "" &&
                values.maxRedemptions !== undefined
                  ? String(values.maxRedemptions)
                  : "Unlimited"
              }
            />
            <ReviewRow
              label="Description"
              value={values.description || "None"}
            />
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="flex w-full flex-col gap-2 md:flex-row md:justify-between pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              {stepForm.isFirstStep ? (
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="w-full md:w-auto min-h-[44px]"
                >
                  <Link
                    href={LIST_HREF}
                    onClick={() => handleNavClick(LIST_HREF)}
                  >
                    Cancel
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:w-auto min-h-[44px]"
                  onClick={stepForm.handleBack}
                >
                  Back
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="top">
              {stepForm.isFirstStep
                ? "Discard this draft and return to the discounts list"
                : "Go back to the previous step without losing your progress"}
            </TooltipContent>
          </Tooltip>

          {stepForm.isLastStep ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    type="submit"
                    isLoading={createMutation.isPending}
                    loadingText="Creating..."
                    className="w-full md:w-auto min-h-[44px]"
                  >
                    Create Discount
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Save this discount so tenants can start redeeming it
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  className="w-full md:w-auto min-h-[44px]"
                  onClick={stepForm.handleNext}
                >
                  Continue
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Validate this step and move to the next one
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </form>
    </div>
  );
}
