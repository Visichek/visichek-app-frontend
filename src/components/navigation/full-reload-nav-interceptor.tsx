"use client";

import { useEffect } from "react";

/**
 * Tenant-scoped click interceptor. Catches every left-click on an
 * internal `<a href>` (including Next.js `<Link>`, which renders one)
 * and forces a full-page navigation via `window.location.assign`,
 * bypassing the App Router client transition.
 *
 * Why: tenant pages were repeatedly hitting React 19 + Radix portal
 * cleanup races during App Router tree swaps (removeChild on null,
 * stuck mid-transition spinners). MPA-style nav sidesteps the whole
 * class of bug for one cost: a full reload per click. The user opted
 * into this trade explicitly. Admin shell keeps SPA transitions —
 * that surface has been stable.
 *
 * Mounts in TenantShell so it only applies under `/app/*`. Uses the
 * capture phase so it runs before Next's Link click handler.
 *
 * Opt-out: add `data-full-reload="off"` to any anchor that should
 * keep the SPA behaviour (e.g. an in-page anchor that does its own
 * client-side handling).
 */
export function FullReloadNavInterceptor() {
  useEffect(() => {
    function intercept(event: MouseEvent) {
      // Primary button only; modifier keys mean "new tab/window" or
      // "download" — let the browser handle those normally.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.defaultPrevented) return;

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;

      // Respect explicit anchor semantics and opt-outs.
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.fullReload === "off") return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only intercept same-origin http(s) links — leave mailto:,
      // tel:, and external URLs to their defaults.
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      window.location.assign(url.href);
    }

    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, []);

  return null;
}
