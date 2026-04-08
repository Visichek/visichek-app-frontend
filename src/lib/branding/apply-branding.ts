import type { TenantBranding } from "@/types/tenant";

/**
 * Apply tenant branding by injecting CSS custom properties on the root element.
 * Called once after branding is fetched; not called in the platform-admin shell.
 */
export function applyBranding(branding: TenantBranding): void {
  const root = document.documentElement;

  if (branding.primaryColor) {
    root.style.setProperty("--tenant-primary", branding.primaryColor);
  }
  if (branding.secondaryColor) {
    root.style.setProperty("--tenant-secondary", branding.secondaryColor);
  }
  if (branding.accentColor) {
    root.style.setProperty("--tenant-accent", branding.accentColor);
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
