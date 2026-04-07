import type { TenantBranding } from "@/types/tenant";

/**
 * Apply tenant branding by injecting CSS custom properties on the root element.
 * Called once after branding is fetched; not called in the platform-admin shell.
 */
export function applyBranding(branding: TenantBranding): void {
  const root = document.documentElement;

  if (branding.primary_color) {
    root.style.setProperty("--tenant-primary", branding.primary_color);
  }
  if (branding.secondary_color) {
    root.style.setProperty("--tenant-secondary", branding.secondary_color);
  }
  if (branding.accent_color) {
    root.style.setProperty("--tenant-accent", branding.accent_color);
  }
}

/**
 * Remove all tenant branding overrides from the root element.
 */
export function clearBrandingStyles(): void {
  const root = document.documentElement;
  root.style.removeProperty("--tenant-primary");
  root.style.removeProperty("--tenant-secondary");
  root.style.removeProperty("--tenant-accent");
}
