"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNavLoading } from "@/hooks/use-nav-loading";
import { cn } from "@/lib/utils/cn";

export interface DropdownMenuNavItemProps {
  /** Destination path. The item closes the menu, then pushes after the
   * portal has unmounted. */
  href: string;
  /** Visible label. */
  label: React.ReactNode;
  /** Optional leading icon (rendered at h-4 w-4); replaced by a spinner
   * while the route is loading. */
  icon?: React.ReactNode;
  /** Optional secondary helper text rendered under the label. */
  description?: React.ReactNode;
  /** Disable selection. */
  disabled?: boolean;
  /** Render in destructive style (used for Reject / Delete entries). */
  destructive?: boolean;
  className?: string;
}

/**
 * Dropdown menu entry that navigates without crashing the React 19
 * reconciler.
 *
 * Replaces the `<DropdownMenuItem asChild><Link .../></DropdownMenuItem>`
 * pattern, which races the page-tree swap against the Radix portal
 * unmount and triggers `Cannot read properties of null (reading
 * 'removeChild')` — see [[project_tooltip_link_portal_race]] and the
 * root layout DOM_RECONCILER_GUARD.
 *
 * Mechanism: `onSelect` does NOT call `preventDefault`, so Radix runs
 * its default close behavior (commits `setOpen(false)` and unmounts the
 * portal in the same React tick). `navigateFromOverlay()` then defers
 * `router.push` until two animation frames later, after the portal has
 * fully unmounted and the browser has painted, so the page-tree swap
 * never collides with portal teardown.
 *
 * Note: calling `event.preventDefault()` here would *keep the menu
 * open*, which reintroduces the race — don't add it back.
 */
export function DropdownMenuNavItem({
  href,
  label,
  icon,
  description,
  disabled,
  destructive,
  className,
}: DropdownMenuNavItemProps) {
  const { loadingHref, navigateFromOverlay } = useNavLoading();
  const isLoading = loadingHref === href;

  return (
    <DropdownMenuItem
      onSelect={() => {
        if (disabled) return;
        navigateFromOverlay(href);
      }}
      disabled={disabled}
      className={cn(
        "flex items-start gap-2",
        destructive && "text-destructive focus:text-destructive",
        className,
      )}
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          icon
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </DropdownMenuItem>
  );
}
