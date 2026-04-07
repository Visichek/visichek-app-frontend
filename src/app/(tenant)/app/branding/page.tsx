"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/recipes/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { useSession } from "@/hooks/use-session";
import { useTenantBrandingConfig, useUpdateBranding, useResetBranding } from "@/features/branding/hooks/use-branding";
import type { TenantBranding } from "@/types/tenant";
import type { LogoPosition } from "@/types/enums";

interface BrandingFormData {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_position: LogoPosition;
  company_name?: string;
}

const LOGO_POSITION_OPTIONS: { value: LogoPosition; label: string }[] = [
  { value: "top_left", label: "Top Left" },
  { value: "top_center", label: "Top Center" },
  { value: "top_right", label: "Top Right" },
  { value: "center", label: "Center" },
];

export default function BrandingPage() {
  const { tenantId, systemUserProfile } = useSession();
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Fetch branding config
  const {
    data: brandingConfig,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    refetch: refetchBranding,
  } = useTenantBrandingConfig(tenantId || "");

  // Mutations
  const updateMutation = useUpdateBranding();
  const resetMutation = useResetBranding();

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isDirty },
  } = useForm<BrandingFormData>({
    defaultValues: {
      primary_color: brandingConfig?.primary_color || "#1a1a2e",
      secondary_color: brandingConfig?.secondary_color || "#e2e8f0",
      accent_color: brandingConfig?.accent_color || "#3b82f6",
      logo_position: brandingConfig?.logo_position || "top_left",
      company_name: systemUserProfile?.company_name || "",
    },
  });

  // Watch form values for preview
  const watchedValues = watch();

  // Update form when config loads
  useMemo(() => {
    if (brandingConfig) {
      setValue("primary_color", brandingConfig.primary_color || "#1a1a2e");
      setValue("secondary_color", brandingConfig.secondary_color || "#e2e8f0");
      setValue("accent_color", brandingConfig.accent_color || "#3b82f6");
      setValue("logo_position", brandingConfig.logo_position || "top_left");
    }
  }, [brandingConfig, setValue]);

  // Handle save
  const onSubmit = async (data: BrandingFormData) => {
    if (!tenantId) {
      toast.error("Tenant ID not found");
      return;
    }

    try {
      const payload: Partial<TenantBranding> = {
        tenant_id: tenantId,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        accent_color: data.accent_color,
        logo_position: data.logo_position,
      };

      await updateMutation.mutateAsync(payload);
      toast.success("Branding updated successfully");
      reset(data);
    } catch (error) {
      console.error("Failed to update branding:", error);
      toast.error("Failed to update branding");
    }
  };

  // Handle reset to defaults
  const handleReset = async () => {
    if (!tenantId) {
      toast.error("Tenant ID not found");
      return;
    }

    try {
      await resetMutation.mutateAsync(tenantId);
      toast.success("Branding reset to defaults");
      refetchBranding();
      reset({
        primary_color: "#1a1a2e",
        secondary_color: "#e2e8f0",
        accent_color: "#3b82f6",
        logo_position: "top_left",
      });
    } catch (error) {
      console.error("Failed to reset branding:", error);
      toast.error("Failed to reset branding");
    }
  };

  // Show loading state
  if (isLoadingConfig || !tenantId) {
    return <PageSkeleton />;
  }

  // Show error state
  if (isErrorConfig) {
    return (
      <ErrorState
        title="Failed to load branding"
        onRetry={refetchBranding}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding"
        description="Customize your organization's look and feel"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Color Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div className="space-y-2">
                <label htmlFor="primary_color" className="text-sm font-medium">
                  Primary Color
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="color"
                    id="primary_color"
                    {...register("primary_color")}
                    className="h-10 w-20 cursor-pointer rounded-md border border-input"
                  />
                  <Input
                    type="text"
                    placeholder="#1a1a2e"
                    value={watchedValues.primary_color}
                    onChange={(e) => setValue("primary_color", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-2">
                <label htmlFor="secondary_color" className="text-sm font-medium">
                  Secondary Color
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="color"
                    id="secondary_color"
                    {...register("secondary_color")}
                    className="h-10 w-20 cursor-pointer rounded-md border border-input"
                  />
                  <Input
                    type="text"
                    placeholder="#e2e8f0"
                    value={watchedValues.secondary_color}
                    onChange={(e) => setValue("secondary_color", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <label htmlFor="accent_color" className="text-sm font-medium">
                  Accent Color
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="color"
                    id="accent_color"
                    {...register("accent_color")}
                    className="h-10 w-20 cursor-pointer rounded-md border border-input"
                  />
                  <Input
                    type="text"
                    placeholder="#3b82f6"
                    value={watchedValues.accent_color}
                    onChange={(e) => setValue("accent_color", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Display */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Logo</label>
                <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-muted bg-muted/30">
                  {brandingConfig?.logo_url ? (
                    <img
                      src={brandingConfig.logo_url}
                      alt="Tenant logo"
                      className="max-h-20 max-w-48 object-contain"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No logo uploaded
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Logo upload is a 2-step process. Use the API to upload files.
                </p>
              </div>

              {/* Logo Position */}
              <div className="space-y-2">
                <label htmlFor="logo_position" className="text-sm font-medium">
                  Logo Position
                </label>
                <Select
                  value={watchedValues.logo_position}
                  onValueChange={(value) =>
                    setValue("logo_position", value as LogoPosition, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="logo_position">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGO_POSITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Company Name (Display Only) */}
              <div className="space-y-2">
                <label htmlFor="company_name" className="text-sm font-medium">
                  Company Name
                </label>
                <Input
                  id="company_name"
                  type="text"
                  value={watchedValues.company_name || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Managed in tenant settings
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="space-y-3 rounded-lg p-6"
              style={{
                backgroundColor: watchedValues.secondary_color,
              }}
            >
              <div
                className="inline-block rounded px-3 py-2 text-white"
                style={{
                  backgroundColor: watchedValues.primary_color,
                }}
              >
                <span className="text-sm font-medium">Primary Button</span>
              </div>
              <div
                className="inline-block rounded px-3 py-2 text-white"
                style={{
                  backgroundColor: watchedValues.accent_color,
                  marginLeft: "1rem",
                }}
              >
                <span className="text-sm font-medium">Accent Button</span>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium">Color Palette</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="h-12 w-12 rounded border"
                      style={{
                        backgroundColor: watchedValues.primary_color,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      Primary
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="h-12 w-12 rounded border"
                      style={{
                        backgroundColor: watchedValues.secondary_color,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      Secondary
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="h-12 w-12 rounded border"
                      style={{
                        backgroundColor: watchedValues.accent_color,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      Accent
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            disabled={updateMutation.isPending || resetMutation.isPending}
            className="h-11"
          >
            Reset to Defaults
          </Button>
          <LoadingButton
            type="submit"
            disabled={!isDirty}
            isLoading={updateMutation.isPending}
            className="h-11 w-full sm:w-auto"
          >
            Save Changes
          </LoadingButton>
        </div>
      </form>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset Branding to Defaults?"
        description="This will remove all custom branding and restore the default platform styling. This action cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleReset}
        variant="destructive"
        isLoading={resetMutation.isPending}
      />
    </div>
  );
}
