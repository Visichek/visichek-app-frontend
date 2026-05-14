"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useNavLoading } from "@/hooks/use-nav-loading";

export interface NavButtonProps extends Omit<ButtonProps, "asChild"> {
  /** Destination path. */
  href: string;
  /**
   * Optional pre-navigation hook. Runs before navigation. If you call
   * `event.preventDefault()` inside it, the navigation is skipped.
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Overlay-safe link-as-button.
 *
 * Use anywhere a clickable button needs to navigate from inside (or
 * adjacent to) a Radix portal — i.e. wrapped in `<Tooltip>`, inside a
 * `<Dialog>` / `<Sheet>` / `<Popover>` / `<CommandDialog>`, or any
 * other floating UI. Replaces the
 * `<Button asChild><Link href onClick={handleNavClick}/></Button>`
 * pattern, which races the page-tree swap against the portal unmount
 * and crashes the React 19 reconciler with
 * `Cannot read properties of null (reading 'removeChild')`.
 *
 * Mechanism: renders a real `<button>` (so it works as a Radix
 * `TooltipTrigger asChild`, `DialogTrigger asChild`, etc.) and, on
 * click, calls `navigateFromOverlay()` from the navigation context,
 * which defers `router.push` for two animation frames so the surrounding
 * portal has finished its close + unmount commit before the route
 * changes.
 *
 * Tooltip-wrapping example:
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <NavButton href="/admin/plans/new" size="sm">New plan</NavButton>
 *   </TooltipTrigger>
 *   <TooltipContent>Create a new subscription plan</TooltipContent>
 * </Tooltip>
 * ```
 */
export const NavButton = React.forwardRef<HTMLButtonElement, NavButtonProps>(
  function NavButton({ href, onClick, type = "button", ...rest }, ref) {
    const { navigateFromOverlay } = useNavLoading();

    return (
      <Button
        ref={ref}
        type={type}
        {...rest}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          navigateFromOverlay(href);
        }}
      />
    );
  },
);
