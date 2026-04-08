"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Tag, CircleDollarSign, ClipboardCheck } from "lucide-react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCreatePlan } from "@/features/plans/hooks/use-plans";

/* ------------------------------------------------------------------ */
/* Schema                                                               */
/* ------------------------------------------------------------------ */

const planSchema = z.object({
  name: z
    .string()
    .min(1, "Plan name is required")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Name must only contain letters, numbers, hyphens, or underscores"
    ),
  displayName: z.string().min(1, "Display name is required"),
  tier: z.enum(["free", "starter", "professional", "enterprise", "custom"]),
  description: z.string().optional(),
  priceMonthly: z.coerce
    .number()
    .min(0, "Price cannot be negative")
    .optional()
    .or(z.literal("")),
  currency: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  isPublic: z.boolean().optional(),
});

type PlanFormData = z.infer<typeof planSchema>;

/* ------------------------------------------------------------------ */
/* Step definitions                                                     */
/* ------------------------------------------------------------------ */

const STEPS: StepDef[] = [
  { id: 1, label: "Identity", icon: Tag },
  { id: 2, label: "Pricing", icon: CircleDollarSign },
  { id: 3, label: "Review", icon: ClipboardCheck },
];

const STEP_FIELDS: Record<number, (keyof PlanFormData)[]> = {
  1: ["name", "displayName", "tier"],
  2: [],
  3: [],
};

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Name and classify the plan.",
  2: "Set the pricing and visibility for this plan.",
  3: "Review the plan details before creating.",
};

/* ------------------------------------------------------------------ */
/* Modal                                                                */
/* ------------------------------------------------------------------ */

interface PlanFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanFormModal({ open, onOpenChange }: PlanFormModalProps) {
  const createMutation = useCreatePlan();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
    reset: resetForm,
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      displayName: "",
      tier: "starter",
      description: "",
      priceMonthly: "",
      currency: "NGN",
      isPublic: false,
    },
    mode: "onTouched",
  });

  const values = watch();

  const handleClose = () => {
    resetForm();
    stepForm.reset();
    onOpenChange(false);
  };

  const stepForm = useStepForm<PlanFormData>({
    totalSteps: 3,
    stepFields: STEP_FIELDS,
    trigger,
    onClose: handleClose,
  });

  const onSubmit = async (data: PlanFormData) => {
    try {
      const priceMinor =
        data.priceMonthly !== "" && data.priceMonthly !== undefined
          ? Math.round(Number(data.priceMonthly) * 100)
          : undefined;

      await createMutation.mutateAsync({
        name: data.name,
        displayName: data.displayName,
        tier: data.tier,
        description: data.description || undefined,
        priceMinor,
        currency: data.currency || "NGN",
        billingCycle: data.billingCycle,
        isPublic: data.isPublic,
      });
      toast.success("Plan created successfully");
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create plan"
      );
    }
  };

  const tierLabel: Record<PlanFormData["tier"], string> = {
    free: "Free",
    starter: "Starter",
    professional: "Professional",
    enterprise: "Enterprise",
    custom: "Custom",
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
      title="Create Plan"
      description={STEP_DESCRIPTIONS[stepForm.currentStep]}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <StepIndicator
          steps={STEPS}
          currentStep={stepForm.currentStep}
          completedSteps={stepForm.completedSteps}
        />

        {/* ---- Step 1: Identity ---- */}
        {stepForm.currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-name">
                Plan Name <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="plan-name"
                placeholder="e.g., professional-plan"
                autoFocus
                {...register("name")}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "plan-name-error" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Slug-style identifier — letters, numbers, hyphens, and underscores only.
              </p>
              {errors.name && (
                <p id="plan-name-error" className="text-sm text-destructive" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-displayName">
                Display Name <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="plan-displayName"
                placeholder="e.g., Professional Plan"
                {...register("displayName")}
                aria-invalid={!!errors.displayName}
                aria-describedby={
                  errors.displayName ? "plan-displayName-error" : undefined
                }
              />
              {errors.displayName && (
                <p id="plan-displayName-error" className="text-sm text-destructive" role="alert">
                  {errors.displayName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-tier">Tier</Label>
              <Select
                value={values.tier}
                onValueChange={(v) =>
                  setValue("tier", v as PlanFormData["tier"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="plan-tier" className="min-h-[44px]">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ---- Step 2: Pricing & Settings ---- */}
        {stepForm.currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-price">Monthly Price (₦)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  inputMode="decimal"
                  autoFocus
                  {...register("priceMonthly")}
                  aria-invalid={!!errors.priceMonthly}
                  aria-describedby={
                    errors.priceMonthly ? "plan-price-error" : undefined
                  }
                />
                {errors.priceMonthly && (
                  <p id="plan-price-error" className="text-sm text-destructive" role="alert">
                    {errors.priceMonthly.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-billing">Billing Cycle</Label>
                <Select
                  value={values.billingCycle || undefined}
                  onValueChange={(v) =>
                    setValue("billingCycle", v as PlanFormData["billingCycle"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="plan-billing" className="min-h-[44px]">
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                placeholder="Describe what this plan includes..."
                rows={3}
                {...register("description")}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="plan-isPublic" className="cursor-pointer">
                  Public plan
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show this plan on public pricing pages
                </p>
              </div>
              <Switch
                id="plan-isPublic"
                checked={values.isPublic ?? false}
                onCheckedChange={(checked) => setValue("isPublic", checked)}
              />
            </div>
          </div>
        )}

        {/* ---- Step 3: Review ---- */}
        {stepForm.currentStep === 3 && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-1">
            <ReviewRow label="Plan Name (slug)" value={values.name} />
            <ReviewRow label="Display Name" value={values.displayName} />
            <ReviewRow label="Tier" value={tierLabel[values.tier]} />
            <ReviewRow
              label="Monthly Price"
              value={
                values.priceMonthly !== "" && values.priceMonthly !== undefined
                  ? `₦${Number(values.priceMonthly).toFixed(2)}`
                  : "Not set"
              }
            />
            <ReviewRow
              label="Billing Cycle"
              value={
                values.billingCycle === "monthly"
                  ? "Monthly"
                  : values.billingCycle === "yearly"
                  ? "Yearly"
                  : "Not set"
              }
            />
            <ReviewRow label="Description" value={values.description || "None"} />
            <ReviewRow label="Public" value={values.isPublic ? "Yes" : "No"} />
          </div>
        )}

        {/* ---- Footer ---- */}
        <div className="mt-6 flex w-full flex-col gap-2 md:flex-row md:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full md:w-auto min-h-[44px]"
            onClick={stepForm.isFirstStep ? handleClose : stepForm.handleBack}
          >
            {stepForm.isFirstStep ? "Cancel" : "Back"}
          </Button>

          {stepForm.isLastStep ? (
            <LoadingButton
              type="submit"
              isLoading={createMutation.isPending}
              loadingText="Creating..."
              className="w-full md:w-auto min-h-[44px]"
            >
              Create Plan
            </LoadingButton>
          ) : (
            <Button
              type="button"
              className="w-full md:w-auto min-h-[44px]"
              onClick={stepForm.handleNext}
            >
              Continue
            </Button>
          )}
        </div>
      </form>
    </ResponsiveModal>
  );
}
