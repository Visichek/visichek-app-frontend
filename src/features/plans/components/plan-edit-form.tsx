"use client";

import { useEffect, useMemo, useRef } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Lock, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useUpdatePlan,
  type UpdatePlanRequest,
} from "@/features/plans/hooks/use-plans";
import { PlanFeaturesChecklist } from "@/features/plans/components/plan-features-checklist";
import type { Plan } from "@/types/billing";
import type { PlanTier } from "@/types/enums";

const editSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  tier: z.enum([
    "free",
    "starter",
    "premium",
    "enterprise",
    "professional",
    "custom",
  ]),
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
  maxDocuments: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxStorageMb: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxFileSizeMb: z.coerce.number().int().min(1).optional().or(z.literal("")),
});

type EditFormData = z.infer<typeof editSchema>;

const LIST_HREF = "/admin/plans";

const TENANT_CAP_KEYS = [
  "maxSystemUsers",
  "maxDepartments",
  "maxBranches",
  "maxVisitorsPerMonth",
  "maxAppointmentsPerMonth",
] as const satisfies readonly (keyof EditFormData)[];

const STORAGE_KEYS = [
  "maxDocuments",
  "maxStorageMb",
  "maxFileSizeMb",
] as const satisfies readonly (keyof EditFormData)[];

// Tier-locked field allowlists. Mirrors backend `config/plan_tiers.py`:
// the API rejects PATCHes that touch any field outside the tier's allowlist
// with HTTP 400, so the form has to refuse to send those fields at all.
const TIER_ADJUSTABLE_CAP_FIELDS: Record<PlanTier, ReadonlySet<keyof EditFormData>> = {
  free: new Set(["maxVisitorsPerMonth"]),
  starter: new Set([
    "maxVisitorsPerMonth",
    "maxDepartments",
    "maxSystemUsers",
  ]),
  premium: new Set([
    "maxVisitorsPerMonth",
    "maxDepartments",
    "maxSystemUsers",
    "maxBranches",
    "maxAppointmentsPerMonth",
  ]),
  enterprise: new Set([
    "maxVisitorsPerMonth",
    "maxDepartments",
    "maxSystemUsers",
    "maxBranches",
    "maxAppointmentsPerMonth",
  ]),
  professional: new Set([
    "maxVisitorsPerMonth",
    "maxDepartments",
    "maxSystemUsers",
    "maxBranches",
    "maxAppointmentsPerMonth",
  ]),
  custom: new Set([
    "maxVisitorsPerMonth",
    "maxDepartments",
    "maxSystemUsers",
    "maxBranches",
    "maxAppointmentsPerMonth",
  ]),
};

const TIER_ADJUSTABLE_PLAN_FIELDS: Record<PlanTier, ReadonlySet<keyof EditFormData>> = {
  free: new Set(),
  starter: new Set(),
  premium: new Set([
    "basePriceMonthly",
    "basePriceYearly",
    "slaResponseHours",
  ]),
  enterprise: new Set([
    "basePriceMonthly",
    "basePriceYearly",
    "slaResponseHours",
    "customBranding",
    "apiAccess",
    "prioritySupport",
  ]),
  professional: new Set([
    "basePriceMonthly",
    "basePriceYearly",
    "slaResponseHours",
    "customBranding",
    "apiAccess",
    "prioritySupport",
  ]),
  custom: new Set([
    "basePriceMonthly",
    "basePriceYearly",
    "slaResponseHours",
    "customBranding",
    "apiAccess",
    "prioritySupport",
  ]),
};

// Singleton tiers — exactly one plan record each, name-locked. Enterprise
// is plural; each enterprise plan is bespoke and freely editable.
const SINGLETON_TIERS = new Set<PlanTier>(["free", "starter", "premium"]);

const TIER_LABEL: Record<PlanTier, string> = {
  free: "Free",
  starter: "Starter",
  premium: "Premium",
  enterprise: "Enterprise",
  professional: "Professional (legacy)",
  custom: "Custom (legacy)",
};

function isFieldEditableForTier(
  tier: PlanTier,
  field: keyof EditFormData,
): boolean {
  return (
    TIER_ADJUSTABLE_CAP_FIELDS[tier].has(field) ||
    TIER_ADJUSTABLE_PLAN_FIELDS[tier].has(field)
  );
}

function nullableInt(val: number | null | undefined): number | "" {
  return val != null ? val : "";
}

function toNullableInt(val: number | "" | undefined): number | null {
  return val !== "" && val !== undefined ? Number(val) : null;
}

function defaultsFromPlan(plan: Plan): EditFormData {
  return {
    displayName: plan.displayName ?? "",
    tier: plan.tier as EditFormData["tier"],
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
      plan.tenantCaps?.maxAppointmentsPerMonth,
    ),
    maxDocuments: nullableInt(plan.storageLimits?.maxDocuments),
    maxStorageMb: nullableInt(plan.storageLimits?.maxStorageMb),
    maxFileSizeMb:
      plan.storageLimits?.maxFileSizeMb != null
        ? plan.storageLimits.maxFileSizeMb
        : "",
  };
}

interface PlanEditFormProps {
  plan: Plan;
}

export function PlanEditForm({ plan }: PlanEditFormProps) {
  const { loadingHref } = useNavigationLoading();
  const updateMutation = useUpdatePlan(plan.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset: resetForm,
    formState: { errors, dirtyFields },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: defaultsFromPlan(plan),
    mode: "onTouched",
  });

  // Re-seed once per plan id; refetches that change tenant caps inline (e.g.
  // after a feature toggle) shouldn't blow away the user's unsaved field edits.
  const lastResetIdRef = useRef<string>(plan.id);
  useEffect(() => {
    if (lastResetIdRef.current === plan.id) return;
    lastResetIdRef.current = plan.id;
    resetForm(defaultsFromPlan(plan));
  }, [plan, resetForm]);

  const values = watch();

  const planTier = plan.tier as PlanTier;
  const isSingleton = SINGLETON_TIERS.has(planTier);
  const isLocked = isSingleton;
  const fieldDisabled = useMemo(
    () => (field: keyof EditFormData) =>
      isLocked && !isFieldEditableForTier(planTier, field),
    [isLocked, planTier],
  );
  const allowed = (field: keyof EditFormData): boolean =>
    !isLocked || isFieldEditableForTier(planTier, field);

  const dirtyKeys = Object.keys(dirtyFields) as (keyof EditFormData)[];
  const dirtyCount = dirtyKeys.length;
  const hasChanges = dirtyCount > 0;

  const buildPayload = (data: EditFormData): UpdatePlanRequest => {
    const payload: UpdatePlanRequest = {};

    // Identity is always editable.
    if (dirtyFields.displayName) payload.displayName = data.displayName;
    if (dirtyFields.description)
      payload.description = data.description || undefined;
    if (dirtyFields.isPublic) payload.isPublic = data.isPublic;
    if (dirtyFields.sortOrder)
      payload.sortOrder =
        data.sortOrder !== "" ? Number(data.sortOrder) : undefined;

    // Tier itself is immutable for canonical plans — the backend rejects it.
    if (dirtyFields.tier && !isLocked) payload.tier = data.tier;

    if (dirtyFields.basePriceMonthly && allowed("basePriceMonthly"))
      payload.basePriceMonthly =
        data.basePriceMonthly !== "" ? Number(data.basePriceMonthly) : undefined;
    if (dirtyFields.basePriceYearly && allowed("basePriceYearly"))
      payload.basePriceYearly =
        data.basePriceYearly !== "" ? Number(data.basePriceYearly) : undefined;
    // Currency is not in any tier's allowlist; only legacy plans accept it.
    if (dirtyFields.currency && !isLocked)
      payload.currency = data.currency || "NGN";
    if (dirtyFields.prioritySupport && allowed("prioritySupport"))
      payload.prioritySupport = data.prioritySupport;
    if (dirtyFields.customBranding && allowed("customBranding"))
      payload.customBranding = data.customBranding;
    if (dirtyFields.apiAccess && allowed("apiAccess"))
      payload.apiAccess = data.apiAccess;
    if (dirtyFields.slaResponseHours && allowed("slaResponseHours"))
      payload.slaResponseHours = toNullableInt(data.slaResponseHours);

    // Nested objects are sent whole when any inner field is dirty — the
    // backend replaces the embedded doc rather than merging it. Build the
    // nested doc by merging current values with patches, but only include
    // the fields that the tier is allowed to adjust.
    const capsDirty = TENANT_CAP_KEYS.some(
      (k) => dirtyFields[k] && allowed(k),
    );
    if (capsDirty) {
      const nextCaps: NonNullable<UpdatePlanRequest["tenantCaps"]> = {};
      if (allowed("maxSystemUsers"))
        nextCaps.maxSystemUsers = toNullableInt(data.maxSystemUsers);
      if (allowed("maxDepartments"))
        nextCaps.maxDepartments = toNullableInt(data.maxDepartments);
      if (allowed("maxBranches"))
        nextCaps.maxBranches = toNullableInt(data.maxBranches);
      if (allowed("maxVisitorsPerMonth"))
        nextCaps.maxVisitorsPerMonth = toNullableInt(data.maxVisitorsPerMonth);
      if (allowed("maxAppointmentsPerMonth"))
        nextCaps.maxAppointmentsPerMonth = toNullableInt(
          data.maxAppointmentsPerMonth,
        );
      payload.tenantCaps = nextCaps;
    }

    // Storage limits aren't in any singleton tier's allowlist.
    const storageDirty = STORAGE_KEYS.some((k) => dirtyFields[k]);
    if (storageDirty && !isLocked) {
      payload.storageLimits = {
        maxDocuments: toNullableInt(data.maxDocuments),
        maxStorageMb: toNullableInt(data.maxStorageMb),
        maxFileSizeMb:
          data.maxFileSizeMb !== "" ? Number(data.maxFileSizeMb) : 10,
      };
    }

    return payload;
  };

  const onSubmit = async (data: EditFormData) => {
    const payload = buildPayload(data);
    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      return;
    }
    try {
      const updated = await updateMutation.mutateAsync(payload);
      toast.success(
        `Saved ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`,
      );
      resetForm(defaultsFromPlan(updated));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    }
  };

  const handleDiscard = () => {
    resetForm(defaultsFromPlan(plan));
    toast.info("Discarded unsaved changes");
  };

  const submitHandler = handleSubmit(onSubmit, (errs) => {
    const first = Object.values(errs)[0];
    const msg = (first as { message?: string })?.message;
    toast.error(msg || "Please fix the highlighted fields before saving.");
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-32">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href={LIST_HREF} variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === LIST_HREF ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to plans
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the plans list. Unsaved changes will be lost.
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={`Edit plan: ${plan.displayName ?? plan.name}`}
        description="Change just the fields you care about and save. Only changed fields are sent to the server."
      />

      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Plan slug:</span>{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {plan.name}
        </code>
        <span className="ml-2">
          (immutable — clone the plan if you need a different slug)
        </span>
      </div>

      {isLocked && (
        <div
          className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm"
          role="note"
        >
          <Lock
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium">
              {TIER_LABEL[planTier]} plan — most fields are tier-locked
            </p>
            <p className="text-xs text-muted-foreground">
              Singleton plans only expose the fields the backend allows the
              tier to adjust. Locked inputs are shown for reference and
              disabled. Use per-organization overrides from the Subscriptions page
              if a single organization needs a custom value.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={submitHandler} noValidate className="space-y-8">
        {/* ────────────────  Identity & Visibility  ──────────────── */}
        <section className="space-y-4">
          <SectionHeading
            title="Identity & visibility"
            subtitle="Display name, tier, description, and whether the plan is publicly listed."
          />

          <div className="space-y-2">
            <Label htmlFor="plan-displayName">
              Display Name <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="plan-displayName"
              placeholder="e.g., Professional Plan"
              className="text-base md:text-sm"
              {...register("displayName")}
              aria-invalid={!!errors.displayName}
              aria-describedby={
                errors.displayName ? "plan-displayName-error" : undefined
              }
            />
            {errors.displayName && (
              <p
                id="plan-displayName-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.displayName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-tier">Tier</Label>
              <Select
                value={values.tier}
                disabled={isLocked}
                onValueChange={(v) =>
                  setValue("tier", v as EditFormData["tier"], {
                    shouldDirty: true,
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
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="professional" disabled>
                    Professional (legacy)
                  </SelectItem>
                  <SelectItem value="custom" disabled>
                    Custom (legacy)
                  </SelectItem>
                </SelectContent>
              </Select>
              {isLocked && (
                <p className="text-xs text-muted-foreground">
                  Singleton plans cannot change tier — clone to a new plan if
                  you need a different one.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-sortOrder">Sort Order</Label>
              <Input
                id="plan-sortOrder"
                type="number"
                min={0}
                placeholder="0"
                inputMode="numeric"
                className="text-base md:text-sm"
                {...register("sortOrder")}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first on pricing pages
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-description">Description</Label>
            <Textarea
              id="plan-description"
              placeholder="Describe what this plan includes..."
              rows={3}
              className="text-base md:text-sm"
              {...register("description")}
            />
          </div>

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
              onCheckedChange={(c) =>
                setValue("isPublic", c, { shouldDirty: true })
              }
            />
          </div>
        </section>

        {/* ────────────────  Pricing & Billing  ──────────────── */}
        <section className="space-y-4">
          <SectionHeading
            title="Pricing"
            subtitle="Monthly and yearly base price plus the billing currency."
          />

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
                disabled={fieldDisabled("basePriceMonthly")}
                className="text-base md:text-sm"
                {...register("basePriceMonthly")}
                aria-invalid={!!errors.basePriceMonthly}
              />
              {fieldDisabled("basePriceMonthly") && (
                <p className="text-xs text-muted-foreground">
                  Pricing is fixed for {TIER_LABEL[planTier]} plans.
                </p>
              )}
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
                disabled={fieldDisabled("basePriceYearly")}
                className="text-base md:text-sm"
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

          <div className="space-y-2 md:max-w-xs">
            <Label htmlFor="plan-currency">Currency</Label>
            <Input
              id="plan-currency"
              placeholder="NGN"
              disabled={isLocked}
              className="text-base md:text-sm"
              {...register("currency")}
            />
            {isLocked && (
              <p className="text-xs text-muted-foreground">
                Currency is not adjustable on singleton plans.
              </p>
            )}
          </div>
        </section>

        {/* ────────────────  Capabilities & SLA  ──────────────── */}
        <section className="space-y-4">
          <SectionHeading
            title="Capabilities & SLA"
            subtitle="Top-level perks bundled with this plan. Each switch saves only when you click Save."
          />

          <div className="space-y-2 md:max-w-xs">
            <Label htmlFor="plan-sla">SLA Response Hours</Label>
            <Input
              id="plan-sla"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="e.g., 24"
              disabled={fieldDisabled("slaResponseHours")}
              className="text-base md:text-sm"
              {...register("slaResponseHours")}
            />
            <p className="text-xs text-muted-foreground">
              {fieldDisabled("slaResponseHours")
                ? `SLA is fixed for ${TIER_LABEL[planTier]} plans.`
                : "Leave blank for no SLA guarantee"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SwitchRow
              id="plan-priority"
              label="Priority Support"
              checked={values.prioritySupport ?? false}
              disabled={fieldDisabled("prioritySupport")}
              onChange={(c) =>
                setValue("prioritySupport", c, { shouldDirty: true })
              }
            />
            <SwitchRow
              id="plan-branding"
              label="Custom Branding"
              checked={values.customBranding ?? false}
              disabled={fieldDisabled("customBranding")}
              onChange={(c) =>
                setValue("customBranding", c, { shouldDirty: true })
              }
            />
            <SwitchRow
              id="plan-api"
              label="API Access"
              checked={values.apiAccess ?? false}
              disabled={fieldDisabled("apiAccess")}
              onChange={(c) =>
                setValue("apiAccess", c, { shouldDirty: true })
              }
            />
          </div>
        </section>

        {/* ────────────────  Tenant Caps  ──────────────── */}
        <section className="space-y-4">
          <SectionHeading
            title="Organization capacity limits"
            subtitle="Hard caps applied to each organization on this plan. Leave a field blank for unlimited."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <NumberField
              id="plan-maxUsers"
              label="Max System Users"
              register={register("maxSystemUsers")}
              disabled={fieldDisabled("maxSystemUsers")}
            />
            <NumberField
              id="plan-maxDepts"
              label="Max Departments"
              register={register("maxDepartments")}
              disabled={fieldDisabled("maxDepartments")}
            />
            <NumberField
              id="plan-maxBranches"
              label="Max Branches"
              register={register("maxBranches")}
              disabled={fieldDisabled("maxBranches")}
            />
            <NumberField
              id="plan-maxVisitors"
              label="Max Visitors / Month"
              register={register("maxVisitorsPerMonth")}
              disabled={fieldDisabled("maxVisitorsPerMonth")}
            />
            <NumberField
              id="plan-maxAppts"
              label="Max Appointments / Month"
              register={register("maxAppointmentsPerMonth")}
              disabled={fieldDisabled("maxAppointmentsPerMonth")}
            />
          </div>
        </section>

        {/* ────────────────  Storage  ──────────────── */}
        <section className="space-y-4">
          <SectionHeading
            title="Storage limits"
            subtitle={
              isLocked
                ? "Storage limits are fixed on singleton plans. Use a per-organization override from the Subscriptions page if an organization needs more."
                : "Document count, total storage, and per-file size cap."
            }
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <NumberField
              id="plan-maxDocs"
              label="Max Documents"
              register={register("maxDocuments")}
              disabled={isLocked}
            />
            <NumberField
              id="plan-maxStorage"
              label="Max Storage (MB)"
              register={register("maxStorageMb")}
              disabled={isLocked}
            />
            <NumberField
              id="plan-maxFile"
              label="Max File Size (MB)"
              register={register("maxFileSizeMb")}
              placeholder="10"
              disabled={isLocked}
            />
          </div>
        </section>

        {/* ────────────────  Features (live save)  ──────────────── */}
        <section className="space-y-4">
          <SectionHeading
            title="Togglable features"
            subtitle="These flip the feature on or off across every organization on this plan. Each toggle saves immediately — no need to click Save below."
          />
          <PlanFeaturesChecklist plan={plan} />
        </section>
      </form>

      {/* ────────────────  Sticky save bar  ──────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        role="region"
        aria-label="Save changes"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            {hasChanges ? (
              <>
                <span className="font-medium text-foreground">
                  {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
                </span>{" "}
                — only changed fields will be sent.
              </>
            ) : (
              <>No unsaved changes. Edit any field above to enable Save.</>
            )}
          </p>
          <div className="flex flex-col gap-2 md:flex-row">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDiscard}
                    disabled={!hasChanges || updateMutation.isPending}
                    className="w-full min-h-[44px] md:w-auto"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Discard
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Reset every field back to the values currently saved on the
                server
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    type="button"
                    isLoading={updateMutation.isPending}
                    loadingText="Saving..."
                    disabled={!hasChanges}
                    onClick={submitHandler}
                    className="w-full md:w-auto"
                  >
                    Save changes
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {hasChanges
                  ? `Save your ${dirtyCount} change${dirtyCount === 1 ? "" : "s"} to this plan`
                  : "No changes to save yet"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-1 border-b border-border pb-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label htmlFor={id} className="cursor-pointer text-sm">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function NumberField({
  id,
  label,
  register,
  placeholder = "Unlimited",
  disabled,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        inputMode="numeric"
        placeholder={placeholder}
        disabled={disabled}
        className="text-base md:text-sm"
        {...register}
      />
    </div>
  );
}
