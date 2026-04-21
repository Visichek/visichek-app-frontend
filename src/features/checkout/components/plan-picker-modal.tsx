// DEPRECATED — plan picking is now a dedicated page at /app/billing/change-plan.
// Use `ChangePlanForm` from `./change-plan-form.tsx` or link directly to
// `/app/billing/change-plan`. This no-op stub keeps any straggling imports
// compiling until all call sites are cleaned up.

export interface PlanPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently active plan id — highlighted and disabled in the picker. */
  currentPlanId?: string;
}

/**
 * @deprecated Navigate to `/app/billing/change-plan` instead. Rendering this
 * component now produces nothing.
 */
export function PlanPickerModal(_props: PlanPickerModalProps) {
  void _props;
  return null;
}
