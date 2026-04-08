"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Building2, UserCircle, ClipboardCheck } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useBootstrapTenant } from "@/features/auth/hooks/use-admin-dashboard";

/* ------------------------------------------------------------------ */
/* Schema                                                               */
/* ------------------------------------------------------------------ */

const bootstrapSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  adminFullName: z.string().min(1, "Full name is required"),
  adminEmail: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  lawfulBasis: z.enum(["consent", "legitimate_interest"]).optional(),
  dpoContactEmail: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  countryOfHosting: z.string().optional(),
});

type BootstrapFormData = z.infer<typeof bootstrapSchema>;

/* ------------------------------------------------------------------ */
/* Step definitions                                                     */
/* ------------------------------------------------------------------ */

const STEPS: StepDef[] = [
  { id: 1, label: "Tenant", icon: Building2 },
  { id: 2, label: "Admin", icon: UserCircle },
  { id: 3, label: "Review", icon: ClipboardCheck },
];

const STEP_FIELDS: Record<number, (keyof BootstrapFormData)[]> = {
  1: ["companyName"],
  2: ["adminFullName", "adminEmail", "adminPassword"],
  3: [],
};

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Enter the organisation details for the new tenant.",
  2: "Create the first super admin account for this tenant.",
  3: "Review the details before creating the tenant.",
};

/* ------------------------------------------------------------------ */
/* Modal                                                                */
/* ------------------------------------------------------------------ */

interface BootstrapTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BootstrapTenantModal({
  open,
  onOpenChange,
}: BootstrapTenantModalProps) {
  const bootstrapMutation = useBootstrapTenant();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
    reset: resetForm,
  } = useForm<BootstrapFormData>({
    resolver: zodResolver(bootstrapSchema),
    defaultValues: {
      companyName: "",
      adminFullName: "",
      adminEmail: "",
      adminPassword: "",
      lawfulBasis: undefined,
      dpoContactEmail: "",
      countryOfHosting: "",
    },
    mode: "onTouched",
  });

  const values = watch();

  const handleClose = () => {
    resetForm();
    stepForm.reset();
    setShowPassword(false);
    onOpenChange(false);
  };

  const stepForm = useStepForm<BootstrapFormData>({
    totalSteps: 3,
    stepFields: STEP_FIELDS,
    trigger,
    onClose: handleClose,
  });

  const onSubmit = async (data: BootstrapFormData) => {
    try {
      await bootstrapMutation.mutateAsync({
        companyName: data.companyName,
        adminFullName: data.adminFullName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
        lawfulBasis: data.lawfulBasis,
        dpoContactEmail: data.dpoContactEmail || undefined,
        countryOfHosting: data.countryOfHosting || undefined,
      });
      toast.success(
        `Tenant "${data.companyName}" bootstrapped — super admin account created.`
      );
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to bootstrap tenant"
      );
    }
  };

  // Pass undefined (not "") so Radix Select doesn't get confused
  const lawfulBasis = values.lawfulBasis || undefined;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
      title="Bootstrap Tenant"
      description={STEP_DESCRIPTIONS[stepForm.currentStep]}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <StepIndicator
          steps={STEPS}
          currentStep={stepForm.currentStep}
          completedSteps={stepForm.completedSteps}
        />

        {/* ---- Step 1: Tenant Details ---- */}
        {stepForm.currentStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bt-companyName">
                Company Name <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="bt-companyName"
                placeholder="Acme Corp"
                autoFocus
                {...register("companyName")}
                aria-invalid={!!errors.companyName}
                aria-describedby={
                  errors.companyName ? "bt-companyName-error" : undefined
                }
              />
              {errors.companyName && (
                <p id="bt-companyName-error" className="text-sm text-destructive" role="alert">
                  {errors.companyName.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bt-lawfulBasis">Lawful Basis</Label>
                <Select
                  value={lawfulBasis}
                  onValueChange={(v) =>
                    setValue("lawfulBasis", v as BootstrapFormData["lawfulBasis"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="bt-lawfulBasis" className="min-h-[44px]">
                    <SelectValue placeholder="Select (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consent">Consent</SelectItem>
                    <SelectItem value="legitimate_interest">
                      Legitimate Interest
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bt-countryOfHosting">Country of Hosting</Label>
                <Input
                  id="bt-countryOfHosting"
                  placeholder="NG"
                  {...register("countryOfHosting")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bt-dpoContactEmail">DPO Contact Email</Label>
              <Input
                id="bt-dpoContactEmail"
                type="email"
                inputMode="email"
                placeholder="dpo@acmecorp.com (optional)"
                {...register("dpoContactEmail")}
                aria-invalid={!!errors.dpoContactEmail}
                aria-describedby={
                  errors.dpoContactEmail ? "bt-dpoContactEmail-error" : undefined
                }
              />
              {errors.dpoContactEmail && (
                <p id="bt-dpoContactEmail-error" className="text-sm text-destructive" role="alert">
                  {errors.dpoContactEmail.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ---- Step 2: Super Admin ---- */}
        {stepForm.currentStep === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bt-adminFullName">
                Full Name <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="bt-adminFullName"
                placeholder="Jane Smith"
                autoFocus
                {...register("adminFullName")}
                aria-invalid={!!errors.adminFullName}
                aria-describedby={
                  errors.adminFullName ? "bt-adminFullName-error" : undefined
                }
              />
              {errors.adminFullName && (
                <p id="bt-adminFullName-error" className="text-sm text-destructive" role="alert">
                  {errors.adminFullName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bt-adminEmail">
                Email <span aria-hidden="true">*</span>
              </Label>
              <Input
                id="bt-adminEmail"
                type="email"
                inputMode="email"
                placeholder="jane@acmecorp.com"
                {...register("adminEmail")}
                aria-invalid={!!errors.adminEmail}
                aria-describedby={
                  errors.adminEmail ? "bt-adminEmail-error" : undefined
                }
              />
              {errors.adminEmail && (
                <p id="bt-adminEmail-error" className="text-sm text-destructive" role="alert">
                  {errors.adminEmail.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bt-adminPassword">
                Password <span aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="bt-adminPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  {...register("adminPassword")}
                  aria-invalid={!!errors.adminPassword}
                  aria-describedby={
                    errors.adminPassword ? "bt-adminPassword-error" : undefined
                  }
                  className="pr-11"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {showPassword ? "Hide password" : "Show password"}
                  </TooltipContent>
                </Tooltip>
              </div>
              {errors.adminPassword && (
                <p id="bt-adminPassword-error" className="text-sm text-destructive" role="alert">
                  {errors.adminPassword.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ---- Step 3: Review ---- */}
        {stepForm.currentStep === 3 && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-1">
            <ReviewRow label="Company Name" value={values.companyName} />
            <ReviewRow
              label="Lawful Basis"
              value={
                values.lawfulBasis === "consent"
                  ? "Consent"
                  : values.lawfulBasis === "legitimate_interest"
                  ? "Legitimate Interest"
                  : "Not specified"
              }
            />
            <ReviewRow label="Country of Hosting" value={values.countryOfHosting || "Not specified"} />
            <ReviewRow label="DPO Email" value={values.dpoContactEmail || "Not specified"} />
            <ReviewRow label="Admin Name" value={values.adminFullName} />
            <ReviewRow label="Admin Email" value={values.adminEmail} />
            <ReviewRow label="Password" value="••••••••" />
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
              isLoading={bootstrapMutation.isPending}
              loadingText="Bootstrapping..."
              className="w-full md:w-auto min-h-[44px]"
            >
              Bootstrap Tenant
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
