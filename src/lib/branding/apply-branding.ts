import type { TenantBranding } from "@/types/tenant";

const DEFAULT_TITLE = "VisiChek";
const TENANT_FAVICON_ATTR = "data-tenant-favicon";

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

  applyDocumentBranding(branding);
}

/**
 * Set document.title and favicon from the tenant's branding, when available.
 * Leaves defaults in place for any field the tenant hasn't configured yet.
 */
export function applyDocumentBranding(branding: TenantBranding): void {
  if (typeof document === "undefined") return;

  if (branding.companyName) {
    document.title = `${branding.companyName} · ${DEFAULT_TITLE}`;
  }

  if (branding.logoUrl) {
    setTenantFavicon(branding.logoUrl);
  }
}

function setTenantFavicon(href: string): void {
  // Hide the default favicons so the tenant logo wins
  document.head
    .querySelectorAll<HTMLLinkElement>('link[rel~="icon"]:not([' + TENANT_FAVICON_ATTR + "])")
    .forEach((link) => {
      link.dataset.tenantOriginal = link.dataset.tenantOriginal ?? link.href;
      link.remove();
    });

  let link = document.head.querySelector<HTMLLinkElement>(
    `link[${TENANT_FAVICON_ATTR}]`
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute(TENANT_FAVICON_ATTR, "true");
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Remove all tenant branding overrides from the root element and reset
 * the document title + favicon back to defaults.
 */
export function clearBrandingStyles(): void {
  const root = document.documentElement;
  root.style.removeProperty("--tenant-primary");
  root.style.removeProperty("--tenant-secondary");
  root.style.removeProperty("--tenant-accent");

  clearDocumentBranding();
}

export function clearDocumentBranding(): void {
  if (typeof document === "undefined") return;

  document.title = DEFAULT_TITLE;

  document.head
    .querySelectorAll<HTMLLinkElement>(`link[${TENANT_FAVICON_ATTR}]`)
    .forEach((link) => link.remove());
}
