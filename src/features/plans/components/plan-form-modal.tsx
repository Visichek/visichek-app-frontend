"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Tag, CircleDollarSign, ClipboardCheck, Settings2 } from "lucide-react";
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
import { useCreatePlan, useUpdatePlan } from "@/features/plans/hooks/use-plans";
import type { Plan } from "@/types/billing";

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
  basePriceMonthly: z.coerce
    .number()
    .min(0, "Price cannot be negative")
    .optional()
    .or(z.literal("")),
  basePriceYearly: z.coerce
    .number()
    .min(0, "Price cannot be negative")
    .optional()
    .or(z.literal("")),
  currency: z.string().optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional().or(z.literal("")),
  prioritySupport: z.boolean().optional(),
  customBranding: z.boolean().optional(),
  apiAccess: z.boolean().optional(),
  slaResponseHours: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .or(z.literal("")),
  // Tenant caps
  maxSystemUsers: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxDepartments: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxBranches: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxVisitorsPerMonth: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .or(z.literal("")),
  maxAppointmentsPerMonth: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .or(z.literal("")),
  // Storage limits
  maxDocuments: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxStorageMb: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxFileSizeMb: z.coerce.number().int().min(1).optional().or(z.literal("")),
});

// In edit mode `name` is read-only and not sent in the update payload,
// so the strict regex is relaxed to prevent silent validation failure on submit.
const editPlanSchema = planSchema.extend({
  name: z.string(),
});

type PlanFormData = z.infer<typeof planSchema>;

/* ------------------------------------------------------------------ */
/* Step definitions                                                     */
/* ------------------------------------------------------------------ */

const CREATE_STEPS: StepDef[] = [
  { id: 1, label: "Identity", icon: Tag },
  { id: 2, label: "Pricing", icon: CircleDollarSign },
  { id: 3, label: "Review", icon: ClipboardCheck },
];

const EDIT_STEPS: StepDef[] = [
  { id: 1, label: "Identity", icon: Tag },
  { id: 2, label: "Pricing", icon: CircleDollarSign },
  { id: 3, label: "Limits", icon: Settings2 },
  { id: 4, label: "Review", icon: ClipboardCheck },
];

const CREATE_STEP_FIELDS: Record<number, (keyof PlanFormData)[]> = {
  1: ["name", "displayName", "tier"],
  2: [],
  3: [],
};

const EDIT_STEP_FIELDS: Record<number, (keyof PlanFormData)[]> = {
  1: ["displayName", "tier"],
  2: [],
  3: [],
  4: [],
};

const STEP_DESCRIPTIONS_CREATE: Record<number, string> = {
  1: "Name and classify the plan.",
  2: "Set the pricing and visibility for this plan.",
  3: "Review the plan details before creating.",
};

const STEP_DESCRIPTIONS_EDIT: Record<number, string> = {
  1: "Update the plan identity and visibility.",
  2: "Update pricing, SLA, and feature flags.",
  3: "Set tenant capacity and storage limits.",
  4: "Review all changes before saving.",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function nullableInt(val: number | null | undefined): number | "" {
  return val != null ? val : "";
}

/* ------------------------------------------------------------------ */
/* Modal                                                                */
/* ------------------------------------------------------------------ */

interface PlanFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the modal is in edit mode */
  plan?: Plan;
}

export function PlanFormModal({ open, onOpenChange, plan }: PlanFormModalProps) {
  const isEdit = !!plan;
  const createMutation = useCreatePlan();
  const updateMutation = useUpdatePlan(plan?.id ?? "");

  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
    reset: resetForm,
  } = useForm<PlanFormData>({
    resolver: zodResolver(isEdit ? editPlanSchema : planSchema),
    defaultValues: {
      name: "",
      displayName: "",
      tier: "starter",
      description: "",
      basePriceMonthly: "",
      basePriceYearly: "",
      currency: "NGN",
      isPublic: false,
      sortOrder: "",
      prioritySupport: false,
      customBranding: false,
      apiAccess: false,
      slaResponseHours: "",
      maxSystemUsers: "",
      maxDepartments: "",
      maxBranches: "",
      maxVisitorsPerMonth: "",
      maxAppointmentsPerMonth: "",
      maxDocuments: "",
      maxStorageMb: "",
      maxFileSizeMb: "",
    },
    mode: "onTouched",
  });

  // Populate form when editing
  useEffect(() => {
    if (plan && open) {
      resetForm({
        name: plan.name,
        displayName: plan.displayName ?? "",
        tier: plan.tier,
        description: plan.description ?? "",
        basePriceMonthly: plan.basePriceMonthly ?? "",
        basePriceYearly: plan.basePriceYearly ?? "",
        currency: plan.currency ?? "NGN",
        isPublic: plan.isPublic ?? false,
        sortOrder: plan.sortOrder != null ? plan.sortOrder : "",
        prioritySupport: plan.prioritySupport ?? false,
        customBranding: plan.customBranding ?? false,
        apiAccess: plan.apiAccess ?? false,
        slaResponseHours: nullableInt(plan.slaResponseHours),
        maxSystemUsers: nullableInt(plan.tenantCaps?.maxSystemUsers),
        maxDepartments: nullableInt(plan.tenantCaps?.maxDepartments),
        maxBranches: nullableInt(plan.tenantCaps?.maxBranches),
        maxVisitorsPerMonth: nullableInt(plan.tenantCaps?.maxVisitorsPerMonth),
        maxAppointmentsPerMonth: nullableInt(
          plan.tenantCaps?.maxAppointmentsPerMonth
        ),
        maxDocuments: nullableInt(plan.storageLimits?.maxDocuments),
        maxStorageMb: nullableInt(plan.storageLimits?.maxStorageMb),
        maxFileSizeMb:
          plan.storageLimits?.maxFileSizeMb != null
            ? plan.storageLimits.maxFileSizeMb
            : "",
      });
    }
  }, [plan, open, resetForm]);

  const values = watch();

  const handleClose = () => {
    resetForm();
    stepForm.reset();
    onOpenChange(false);
  };

  const steps = isEdit ? EDIT_STEPS : CREATE_STEPS;
  const stepFields = isEdit ? EDIT_STEP_FIELDS : CREATE_STEP_FIELDS;
  const stepDescriptions = isEdit
    ? STEP_DESCRIPTIONS_EDIT
    : STEP_DESCRIPTIONS_CREATE;

  const stepForm = useStepForm<PlanFormData>({
    totalSteps: steps.length,
    stepFields,
    trigger,
    onClose: handleClose,
  });

  const toNullableInt = (val: number | "" | undefined): number | null =>
    val !== "" && val !== undefined ? Number(val) : null;

  const onSubmit = async (data: PlanFormData) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          displayName: data.displayName,
          tier: data.tier,
          description: data.description || undefined,
          basePriceMonthly:
            data.basePriceMonthly !== "" ? Number(data.basePriceMonthly) : undefined,
          basePriceYearly:
            data.basePriceYearly !== "" ? Number(data.basePriceYearly) : undefined,
          currency: data.currency || "NGN",
          isPublic: data.isPublic,
          sortOrder: data.sortOrder !== "" ? Number(data.sortOrder) : undefined,
          prioritySupport: data.prioritySupport,
          customBranding: data.customBranding,
          apiAccess: data.apiAccess,
          slaResponseHours: toNullableInt(data.slaResponseHours),
          tenantCaps: {
            maxSystemUsers: toNullableInt(data.maxSystemUsers),
            maxDepartments: toNullableInt(data.maxDepartments),
            maxBranches: toNullableInt(data.maxBranches),
            maxVisitorsPerMonth: toNullableInt(data.maxVisitorsPerMonth),
            maxAppointmentsPerMonth: toNullableInt(data.maxAppointmentsPerMonth),
          },
          storageLimits: {
            maxDocuments: toNullableInt(data.maxDocuments),
            maxStorageMb: toNullableInt(data.maxStorageMb),
            maxFileSizeMb:
              data.maxFileSizeMb !== "" ? Number(data.maxFileSizeMb) : 10,
          },
        });
        toast.success("Plan updated successfully");
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          displayName: data.displayName,
          tier: data.tier,
          description: data.description || undefined,
          basePriceMonthly:
            data.basePriceMonthly !== "" ? Number(data.basePriceMonthly) : undefined,
          basePriceYearly:
            data.basePriceYearly !== "" ? Number(data.basePriceYearly) : undefined,
          currency: data.currency || "NGN",
          isPublic: data.isPublic,
        });
        toast.success("Plan created successfully");
      }
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
          ? "Failed to update plan"
          : "Failed to create plan"
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

  const reviewStep = isEdit ? 4 : 3;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
      title={isEdit ? `Edit Plan: ${plan?.displayName ?? plan?.name}` : "Create Plan"}
      description={stepDescriptions[stepForm.currentStep]}
    >
      <form
        onSubmit={handleSubmit(onSubmit, (errs) => {
          const first = Object.values(errs)[0];
          const msg = (first as { message?: string })?.message;
          toast.error(msg || "Please fix the highlighted fields before saving.");
        })}
        noValidate
      >
        <StepIndicator
          steps={steps}
          currentStep={stepForm.currentStep}
          completedSteps={stepForm.completedSteps}
        />

        {/* ---- Step 1: Identity ---- */}
        {stepForm.currentStep === 1 && (
          <div className="space-y-4">
            {!isEdit && (
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
            )}

            <div className="space-y-2">
              <Label htmlFor="plan-displayName">
                Display Name <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="plan-displayName"
                placeholder="e.g., Professional Plan"
                autoFocus={isEdit}
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

            <div className="space-y-2">
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                placeholder="Describe what this plan includes..."
                rows={3}
                {...register("description")}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="plan-isPublic" className="cursor-pointer">
                    Public plan
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show on public pricing pages
                  </p>
                </div>
                <Switch
                  id="plan-isPublic"
                  checked={values.isPublic ?? false}
                  onCheckedChange={(checked) => setValue("isPublic", checked)}
                />
              </div>

              {isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="plan-sortOrder">Sort Order</Label>
                  <Input
                    id="plan-sortOrder"
                    type="number"
                    min={0}
                    placeholder="0"
                    inputMode="numeric"
                    {...register("sortOrder")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower numbers appear first
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- Step 2: Pricing & Features ---- */}
        {stepForm.currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-price-monthly">Monthly Price (₦)</Label>
                <Input
                  id="plan-price-monthly"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  inputMode="decimal"
                  autoFocus
                  {...register("basePriceMonthly")}
                  aria-invalid={!!errors.basePriceMonthly}
                />
                {errors.basePriceMonthly && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.basePriceMonthly.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-price-yearly">Yearly Price (₦)</Label>
                <Input
                  id="plan-price-yearly"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  inputMode="decimal"
                  {...register("basePriceYearly")}
                  aria-invalid={!!errors.basePriceYearly}
                />
                {errors.basePriceYearly && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.basePriceYearly.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-currency">Currency</Label>
                <Input
                  id="plan-currency"
                  placeholder="NGN"
                  {...register("currency")}
                />
              </div>

              {isEdit && (
                <div className="space-y-2">
                  <Label htmlFor="plan-sla">SLA Response Hours</Label>
                  <Input
                    id="plan-sla"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="e.g., 24"
                    {...register("slaResponseHours")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank for no SLA guarantee
                  </p>
                </div>
              )}
            </div>

            {isEdit && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="plan-priority" className="cursor-pointer text-sm">
                      Priority Support
                    </Label>
                  </div>
                  <Switch
                    id="plan-priority"
                    checked={values.prioritySupport ?? false}
                    onCheckedChange={(c) => setValue("prioritySupport", c)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="plan-branding" className="cursor-pointer text-sm">
                      Custom Branding
                    </Label>
                  </div>
                  <Switch
                    id="plan-branding"
                    checked={values.customBranding ?? false}
                    onCheckedChange={(c) => setValue("customBranding", c)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="plan-api" className="cursor-pointer text-sm">
                      API Access
                    </Label>
                  </div>
                  <Switch
                    id="plan-api"
                    checked={values.apiAccess ?? false}
                    onCheckedChange={(c) => setValue("apiAccess", c)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---- Step 3 (Edit only): Tenant Caps & Storage ---- */}
        {isEdit && stepForm.currentStep === 3 && (
          <div className="space-y-5">
            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Tenant Capacity Limits</p>
              <p className="mb-3 text-xs text-muted-foreground">Leave blank for unlimited.</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan-maxUsers">Max System Users</Label>
                  <Input
                    id="plan-maxUsers"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    {...register("maxSystemUsers")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-maxDepts">Max Departments</Label>
                  <Input
                    id="plan-maxDepts"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    {...register("maxDepartments")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-maxBranches">Max Branches</Label>
                  <Input
                    id="plan-maxBranches"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    {...register("maxBranches")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-maxVisitors">Max Visitors / Month</Label>
                  <Input
                    id="plan-maxVisitors"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    {...register("maxVisitorsPerMonth")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-maxAppts">Max Appointments / Month</Label>
                  <Input
                    id="plan-maxAppts"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    {...register("maxAppointmentsPerMonth")}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Storage Limits</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="plan-maxDocs">Max Documents</Label>
                  <Input
                    id="plan-maxDocs"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    {...register("maxDocuments")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-maxStorage">Max Storage (MB)</Label>
                  <Input
                    id="plan-maxStorage"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="Unlimited"
                    {...register("maxStorageMb")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-maxFile">Max File Size (MB)</Label>
                  <Input
                    id="plan-maxFile"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="10"
                    {...register("maxFileSizeMb")}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Review step ---- */}
        {stepForm.currentStep === reviewStep && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-1">
            {!isEdit && <ReviewRow label="Plan Name (slug)" value={values.name} />}
            <ReviewRow label="Display Name" value={values.displayName} />
            <ReviewRow label="Tier" value={tierLabel[values.tier]} />
            <ReviewRow
              label="Monthly Price"
              value={
                values.basePriceMonthly !== "" && values.basePriceMonthly !== undefined
                  ? `₦${Number(values.basePriceMonthly).toFixed(2)}`
                  : "Not set"
              }
            />
            {isEdit && (
              <ReviewRow
                label="Yearly Price"
                value={
                  values.basePriceYearly !== "" && values.basePriceYearly !== undefined
                    ? `₦${Number(values.basePriceYearly).toFixed(2)}`
                    : "Not set"
                }
              />
            )}
            <ReviewRow label="Currency" value={values.currency || "NGN"} />
            <ReviewRow label="Description" value={values.description || "None"} />
            <ReviewRow label="Public" value={values.isPublic ? "Yes" : "No"} />
            {isEdit && (
              <>
                <ReviewRow
                  label="Priority Support"
                  value={values.prioritySupport ? "Yes" : "No"}
                />
                <ReviewRow
                  label="Custom Branding"
                  value={values.customBranding ? "Yes" : "No"}
                />
                <ReviewRow
                  label="API Access"
                  value={values.apiAccess ? "Yes" : "No"}
                />
                <ReviewRow
                  label="SLA Response"
                  value={
                    values.slaResponseHours !== "" && values.slaResponseHours !== undefined
                      ? `${values.slaResponseHours}h`
                      : "None"
                  }
                />
              </>
            )}
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
              isLoading={isPending}
              loadingText={isEdit ? "Saving..." : "Creating..."}
              className="w-full md:w-auto min-h-[44px]"
            >
              {isEdit ? "Save Changes" : "Create Plan"}
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
