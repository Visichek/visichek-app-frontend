"use client";

import { Eye, EyeOff } from "lucide-react";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { useCapability } from "../hooks/use-limitations";
import { useHideLocked } from "../hooks/use-hide-locked";

/**
 * Sidebar user-menu entry that lets a Free-plan tenant collapse every
 * padlocked affordance — nav rows, dashboard tiles, settings sections —
 * out of their UI for the next 4 hours.
 *
 * Only renders for users on the Free plan. Paid users have no locked
 * UI to hide, so the toggle would just add noise to their menu.
 *
 * Per-device only: the preference is stored in `localStorage`, never
 * synced. It auto-disables after 4 hours so the upgrade affordance
 * can't go missing forever; the matching `<HideLockedExpiryToast />`
 * mounted in the shell surfaces a one-time notice when that happens.
 */
export function HideLockedMenuItem() {
  const { isFreePlan, isLoading } = useCapability();
  const { hideLocked, setHideLocked } = useHideLocked();

  if (isLoading) return null;
  if (!isFreePlan) return null;

  return (
    <DropdownMenuCheckboxItem
      checked={hideLocked}
      // Radix CheckboxItem closes on select by default; keep the menu
      // open so the user can immediately see the toggle's effect on
      // adjacent items without re-opening the dropdown.
      onSelect={(event) => event.preventDefault()}
      onCheckedChange={(next) => setHideLocked(!!next)}
      className="gap-2 min-h-[36px]"
    >
      {hideLocked ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="flex flex-col text-left">
        <span>Hide locked items</span>
        <span className="text-[11px] text-muted-foreground leading-tight">
          {hideLocked
            ? "Resets in up to 4 hours · this device only"
            : "Collapse upgrade prompts · this device only"}
        </span>
      </span>
    </DropdownMenuCheckboxItem>
  );
}
