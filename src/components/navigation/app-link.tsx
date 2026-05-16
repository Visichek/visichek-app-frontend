"use client";

import { forwardRef, useCallback } from "react";
import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";

export interface AppLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /**
   * Same-origin internal path (e.g. `/admin/dashboard`). External URLs
   * (different origin or protocol) fall through to a normal browser GET so
   * they keep their target / rel / new-tab behavior.
   */
  href: string;
  /**
   * When provided, called BEFORE `router.push` so callers can close
   * overlays, mark optimistic state, etc. The handler still runs even
   * when navigation is short-circuited (modifier keys, external link)
   * so it shouldn't depend on the SPA path being taken.
   */
  onBeforeNavigate?: () => void;
  /**
   * Use `router.replace` instead of `router.push` (no history entry).
   */
  replace?: boolean;
  /**
   * Use the overlay-safe navigation path. Set this when AppLink is
   * rendered inside a Radix DropdownMenu / Sheet / Popover so the
   * portal teardown finishes before the router swaps the page tree.
   * See `navigateFromOverlay` in `navigation-context.tsx`.
   */
  fromOverlay?: boolean;
}

function isExternalHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("#")) return true; // Pure anchor — don't intercept.
  // Anything that has a protocol other than relative/absolute path.
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

/**
 * AppLink — the single internal navigation primitive.
 *
 * Renders a real `<a>` so modifier-key gestures (⌘/Ctrl/Shift/Alt click,
 * middle-click, right-click "open in new tab") work exactly like a
 * regular browser link. Plain left-clicks are intercepted and routed
 * via Next's router, keeping the App Router tree alive — layouts,
 * React Query cache, sidebar state, branding, and the /me bootstrap
 * survive between pages.
 *
 * This is the foundation for Issue 8 ("Use SPA navigation so pages do
 * not reload from scratch"). Previously the sidebars rendered plain
 * `<a href>` which forced a full document GET on every nav click.
 *
 * Loading state: hooks into `useNavigationLoading` so the existing
 * `loadingHref` machinery (sidebar spinners, NavItem loaders) keeps
 * working with zero extra plumbing.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink(
    {
      href,
      onBeforeNavigate,
      onClick,
      replace = false,
      fromOverlay = false,
      target,
      rel,
      children,
      ...rest
    },
    ref,
  ) {
    const { navigate, replace: routerReplace, navigateFromOverlay } =
      useNavigationLoading();

    const handleClick = useCallback(
      (event: MouseEvent<HTMLAnchorElement>) => {
        // Always give parent click handlers a chance first (close menus,
        // log clicks, etc.). If they preventDefault we bail out.
        onClick?.(event);
        if (event.defaultPrevented) return;

        // Don't intercept opt-in browser gestures or non-default buttons.
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          // The browser will handle the navigation; still fire the hook so
          // overlays can close.
          onBeforeNavigate?.();
          return;
        }

        // _blank / external — let the browser open the new tab/window.
        if (target && target !== "_self") {
          onBeforeNavigate?.();
          return;
        }

        if (isExternalHref(href)) {
          onBeforeNavigate?.();
          return;
        }

        event.preventDefault();
        onBeforeNavigate?.();

        if (fromOverlay) {
          navigateFromOverlay(href);
          return;
        }
        if (replace) {
          routerReplace(href);
          return;
        }
        navigate(href);
      },
      [
        fromOverlay,
        href,
        navigate,
        navigateFromOverlay,
        onBeforeNavigate,
        onClick,
        replace,
        routerReplace,
        target,
      ],
    );

    return (
      <a
        ref={ref}
        href={href}
        target={target}
        rel={
          rel ??
          (target === "_blank" || isExternalHref(href)
            ? "noopener noreferrer"
            : undefined)
        }
        onClick={handleClick}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
