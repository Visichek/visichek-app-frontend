"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Palette,
  Image as ImageIcon,
  Layout,
  AlignLeft,
  AlignCenter,
  AlignRight,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/recipes/page-header";
import { useSession } from "@/hooks/use-session";
import {
  useTenantBrandingConfig,
  useUpdateBranding,
  useResetBranding,
  type UpdateBrandingInput,
} from "@/features/branding/hooks/use-branding";
import type { LogoPosition } from "@/types/enums";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrandingFormData {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoPosition: LogoPosition;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BRANDING: BrandingFormData = {
  primaryColor: "#1e293b",
  secondaryColor: "#f8fafc",
  accentColor: "#3b82f6",
  logoPosition: "top_left",
};

interface ThemePreset {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

const THEME_PRESETS: ThemePreset[] = [
  { name: "Default", primary: "#1e293b", secondary: "#f8fafc", accent: "#3b82f6" },
  { name: "Ocean",   primary: "#083344", secondary: "#ecfeff", accent: "#06b6d4" },
  { name: "Forest",  primary: "#14532d", secondary: "#f0fdf4", accent: "#22c55e" },
  { name: "Sunset",  primary: "#7c2d12", secondary: "#fff7ed", accent: "#f97316" },
  { name: "Berry",   primary: "#4c1d95", secondary: "#faf5ff", accent: "#d946ef" },
];

// nav-alignment options map to backend LogoPosition
const LOGO_ALIGNMENT_OPTIONS = [
  { id: "top_left"   as LogoPosition, icon: AlignLeft,   label: "Left"   },
  { id: "top_center" as LogoPosition, icon: AlignCenter, label: "Center" },
  { id: "top_right"  as LogoPosition, icon: AlignRight,  label: "Right"  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ColorInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
}

function ColorInput({ id, label, value, onChange }: ColorInputProps) {
  const safeValue = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {/* Color swatch + native picker */}
        <div className="relative h-10 w-14 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-sm transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
          <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: safeValue }} />
          <input
            type="color"
            id={id}
            value={safeValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        {/* Hex text input */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            #
          </span>
          <input
            type="text"
            value={value.replace("#", "").toUpperCase()}
            onChange={(e) => {
              const raw = e.target.value;
              if (/^[0-9A-Fa-f]{0,6}$/.test(raw)) {
                onChange(raw ? `#${raw}` : "#");
              }
            }}
            className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 font-mono text-sm uppercase text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            placeholder="000000"
            maxLength={6}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

interface LivePreviewProps {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoPosition: LogoPosition;
  companyName: string;
  logoPreviewUrl: string | null;
}

function LivePreview({
  primaryColor,
  secondaryColor,
  accentColor,
  logoPosition,
  companyName,
  logoPreviewUrl,
}: LivePreviewProps) {
  const logoAlignClass =
    logoPosition === "top_center"
      ? "left-1/2 -translate-x-1/2"
      : logoPosition === "top_right"
      ? "right-0"
      : "left-0";

  return (
    <div className="rounded-xl border border-border shadow-lg overflow-hidden flex flex-col h-[500px] bg-background">
      {/* Mock app header */}
      <div
        className="h-14 shrink-0 px-6 flex items-center transition-colors duration-300"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="relative flex w-full items-center">
          {/* Logo / company name */}
          <div
            className={`absolute flex items-center gap-2 transition-all duration-500 ${logoAlignClass}`}
          >
            {logoPreviewUrl ? (
              <img
                src={logoPreviewUrl}
                alt="Logo preview"
                className="h-8 max-w-[120px] rounded object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-white/20 backdrop-blur-sm">
                <div className="h-4 w-4 rounded-sm bg-white" />
              </div>
            )}
            <span className="hidden font-bold tracking-wide text-white sm:block">
              {companyName || "ACME"}
            </span>
          </div>

          {/* Fake nav links opposite to logo */}
          {logoPosition !== "top_right" && (
            <div className="ml-auto flex gap-4">
              <div className="h-2 w-16 rounded-full bg-white/20" />
              <div className="h-2 w-10 rounded-full bg-white/20" />
            </div>
          )}
          {logoPosition === "top_right" && (
            <div className="mr-auto flex gap-4">
              <div className="h-2 w-16 rounded-full bg-white/20" />
              <div className="h-2 w-10 rounded-full bg-white/20" />
            </div>
          )}
        </div>
      </div>

      {/* Mock app body */}
      <div
        className="flex flex-1 flex-col overflow-hidden p-6 transition-colors duration-300"
        style={{ backgroundColor: secondaryColor }}
      >
        <div className="flex flex-1 flex-col rounded-lg border border-border/40 bg-white p-5 shadow-sm">
          <div className="mb-6 h-4 w-1/3 rounded bg-gray-200" />

          <div className="mb-auto space-y-3">
            <div className="h-2 w-full rounded bg-gray-100" />
            <div className="h-2 w-full rounded bg-gray-100" />
            <div className="h-2 w-3/4 rounded bg-gray-100" />
          </div>

          <div className="mt-8 flex gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-300"
              style={{ backgroundColor: accentColor }}
            >
              Primary Action
            </button>
            <button
              type="button"
              className="flex-1 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-300"
              style={{ backgroundColor: primaryColor }}
            >
              Secondary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandingPage() {
  const { tenantId, systemUserProfile } = useSession();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>("Default");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL when component unmounts to avoid memory leaks
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const {
    data: brandingConfig,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    error: brandingError,
    refetch: refetchBranding,
  } = useTenantBrandingConfig(tenantId || "");

  const updateMutation = useUpdateBranding();
  const resetMutation = useResetBranding();

  const { register, handleSubmit, watch, setValue, reset, formState: { isDirty } } =
    useForm<BrandingFormData>({
      defaultValues: DEFAULT_BRANDING,
    });

  // Sync form when config loads
  useEffect(() => {
    if (brandingConfig) {
      reset({
        primaryColor:   brandingConfig.primaryColor   || DEFAULT_BRANDING.primaryColor,
        secondaryColor: brandingConfig.secondaryColor || DEFAULT_BRANDING.secondaryColor,
        accentColor:    brandingConfig.accentColor    || DEFAULT_BRANDING.accentColor,
        logoPosition:   brandingConfig.logoPosition   || DEFAULT_BRANDING.logoPosition,
      });
    }
  }, [brandingConfig, reset]);

  const watched = watch();

  const handlePresetApply = (preset: ThemePreset) => {
    setValue("primaryColor",   preset.primary,   { shouldDirty: true });
    setValue("secondaryColor", preset.secondary, { shouldDirty: true });
    setValue("accentColor",    preset.accent,    { shouldDirty: true });
    setActivePreset(preset.name);
  };

  const handleColorChange =
    (field: keyof Pick<BrandingFormData, "primaryColor" | "secondaryColor" | "accentColor">) =>
    (val: string) => {
      setValue(field, val, { shouldDirty: true });
      setActivePreset(null);
    };

  const onSubmit = async (data: BrandingFormData) => {
    if (!tenantId) {
      toast.error("Tenant ID not found.");
      return;
    }
    const input: UpdateBrandingInput = {
      branding: {
        tenantId,
        primaryColor:   data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor:    data.accentColor,
        logoPosition:   data.logoPosition,
      },
      logoFile: logoFile ?? undefined,
    };
    await toast.promise(updateMutation.mutateAsync(input), {
      loading: logoFile ? "Uploading logo and saving branding…" : "Saving branding…",
      success: () => {
        reset(data);
        setLogoFile(null);
        return "Branding saved.";
      },
      error: (err) =>
        err instanceof Error ? err.message : "Failed to save branding.",
    });
  };

  const handleReset = async () => {
    if (!tenantId) return;
    await toast.promise(resetMutation.mutateAsync(tenantId), {
      loading: "Resetting branding…",
      success: () => {
        refetchBranding();
        reset(DEFAULT_BRANDING);
        setActivePreset("Default");
        setShowResetDialog(false);
        return "Branding reset to defaults.";
      },
      error: "Failed to reset branding.",
    });
  };

  if (isLoadingConfig || !tenantId) return <PageSkeleton />;

  if (isErrorConfig) {
    return (
      <ErrorState
        title="Failed to load branding"
        error={brandingError}
        onRetry={refetchBranding}
      />
    );
  }

  const companyName = systemUserProfile?.companyName || "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Brand Appearance"
        description="Customize how your application looks and feels to your users."
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* ── Left column: settings ────────────────────────────── */}
          <div className="space-y-8 lg:col-span-7">

            {/* Color Palette card */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 border-b bg-muted/30 px-6 py-4">
                <Palette className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Color Palette</CardTitle>
              </CardHeader>

              <CardContent className="space-y-8 p-6">
                {/* Quick theme presets */}
                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">Quick Themes</p>
                  <div className="flex flex-wrap gap-3">
                    {THEME_PRESETS.map((preset) => (
                      <Tooltip key={preset.name}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handlePresetApply(preset)}
                            className={`group relative flex flex-col items-center gap-2 rounded-lg border p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              activePreset === preset.name
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-muted-foreground/50 hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex h-8 w-16 overflow-hidden rounded-md border border-black/5 shadow-sm">
                              <div className="h-full w-1/3" style={{ backgroundColor: preset.primary }} />
                              <div className="h-full w-1/3" style={{ backgroundColor: preset.secondary }} />
                              <div className="h-full w-1/3" style={{ backgroundColor: preset.accent }} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                              {preset.name}
                            </span>
                            {activePreset === preset.name && (
                              <CheckCircle2 className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-background text-primary" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Apply the {preset.name} theme preset to all three colors
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Custom color inputs */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <ColorInput
                    id="primary-color"
                    label="Primary (Header)"
                    value={watched.primaryColor}
                    onChange={handleColorChange("primaryColor")}
                  />
                  <ColorInput
                    id="secondary-color"
                    label="Secondary (Background)"
                    value={watched.secondaryColor}
                    onChange={handleColorChange("secondaryColor")}
                  />
                  <ColorInput
                    id="accent-color"
                    label="Accent (Buttons)"
                    value={watched.accentColor}
                    onChange={handleColorChange("accentColor")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Logo & Branding card */}
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-2 border-b bg-muted/30 px-6 py-4">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Logo &amp; Branding</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6 p-6">
                {/* Upload area */}
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Upload Logo</p>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/svg+xml,image/png,image/jpeg,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLogoFile(file);
                        setLogoFileName(file.name);
                        if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
                        setLogoPreviewUrl(URL.createObjectURL(file));
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary transition-transform group-hover:scale-110">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    {logoFileName ? (
                      <p className="mb-1 text-sm font-medium text-foreground">{logoFileName}</p>
                    ) : (
                      <p className="mb-1 text-sm font-medium text-foreground">
                        Click to upload or drag and drop
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">SVG, PNG, JPG or GIF (max. 800×400 px)</p>
                  </button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Logo upload uses a two-step process — request a presigned URL via{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      POST /v1/documents/upload-intents
                    </code>{" "}
                    then complete with{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                      POST /v1/documents/complete
                    </code>
                    .
                  </p>
                </div>

                {/* Navigation alignment (logo position) */}
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Navigation Alignment
                  </p>
                  <div className="flex w-fit rounded-lg bg-muted p-1">
                    {LOGO_ALIGNMENT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = watched.logoPosition === opt.id;
                      return (
                        <Tooltip key={opt.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() =>
                                setValue("logoPosition", opt.id, { shouldDirty: true })
                              }
                              className={`flex min-h-[44px] items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                isActive
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {opt.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Align the logo to the {opt.label.toLowerCase()} of the navigation bar
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* Company name (read-only) */}
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Company Name</p>
                  <input
                    type="text"
                    disabled
                    value={companyName}
                    className="w-full cursor-not-allowed rounded-lg border border-input bg-muted px-4 py-2.5 text-sm text-muted-foreground"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Managed in global tenant settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right column: live preview ────────────────────────── */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Layout className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Live Application Preview</h2>
              </div>

              <LivePreview
                primaryColor={watched.primaryColor}
                secondaryColor={watched.secondaryColor}
                accentColor={watched.accentColor}
                logoPosition={watched.logoPosition}
                companyName={companyName}
                logoPreviewUrl={logoPreviewUrl ?? brandingConfig?.logoUrl ?? null}
              />

              <p className="text-center text-sm text-muted-foreground">
                Changes are previewed instantly. Don&apos;t forget to save.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer actions ──────────────────────────────────────── */}
        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setShowResetDialog(true)}
                disabled={updateMutation.isPending || resetMutation.isPending}
              >
                Reset to Defaults
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Remove all custom branding and restore the default platform styling
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <LoadingButton
                type="submit"
                disabled={!isDirty && !logoFile}
                isLoading={updateMutation.isPending}
                className="h-11 w-full sm:w-auto"
              >
                Save Changes
              </LoadingButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Apply and save your branding changes across the tenant
            </TooltipContent>
          </Tooltip>
        </div>
      </form>

      {/* Reset confirmation dialog */}
      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset branding to defaults?"
        description="This removes all custom colors and logo settings and restores the default platform styling. This action cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleReset}
        variant="destructive"
        isLoading={resetMutation.isPending}
      />
    </div>
  );
}
