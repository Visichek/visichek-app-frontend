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

// The href the tenant favicon should currently hold, or `null` when tenant
// branding is not active (platform-admin shell, logged out). The
// head-watching observer reads this to decide whether to keep enforcing.
let activeTenantFaviconHref: string | null = null;
// Watches <head> so that any default `<link rel="icon">` Next.js re-injects on
// a soft navigation is stripped again immediately — without it, the tab snaps
// back to the default VisiChek mark and only a hard refresh (which re-runs
// applyBranding) restores the tenant logo.
let faviconObserver: MutationObserver | null = null;

/** Drop every icon link that isn't ours, and ensure ours exists with `href`. */
function enforceTenantFavicon(href: string): void {
  document.head
    .querySelectorAll<HTMLLinkElement>(
      `link[rel~="icon"]:not([${TENANT_FAVICON_ATTR}])`,
    )
    .forEach((link) => link.remove());

  let link = document.head.querySelector<HTMLLinkElement>(
    `link[${TENANT_FAVICON_ATTR}]`,
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute(TENANT_FAVICON_ATTR, "true");
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

function setTenantFavicon(href: string): void {
  activeTenantFaviconHref = href;
  enforceTenantFavicon(href);

  // Re-enforce whenever Next.js (or anything else) mutates <head>. childList
  // is enough — we only care about link tags being added/removed. The
  // callback is idempotent and never re-adds what it just removed, so it
  // can't loop against the framework's own render cycle.
  if (!faviconObserver) {
    faviconObserver = new MutationObserver(() => {
      if (activeTenantFaviconHref) enforceTenantFavicon(activeTenantFaviconHref);
    });
    faviconObserver.observe(document.head, { childList: true });
  }
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

  // Stop enforcing before we remove our link, otherwise the observer would
  // see the removal and try to re-add it.
  activeTenantFaviconHref = null;
  faviconObserver?.disconnect();
  faviconObserver = null;

  document.head
    .querySelectorAll<HTMLLinkElement>(`link[${TENANT_FAVICON_ATTR}]`)
    .forEach((link) => link.remove());
}
