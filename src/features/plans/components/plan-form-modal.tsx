// DEPRECATED — create/edit is now a dedicated page at
// /admin/plans/new and /admin/plans/{id}/edit. Use `PlanForm`
// from plan-form.tsx instead. This no-op stub keeps straggling
// imports compiling until all call sites are cleaned up.
import type { Plan } from "@/types/billing";

interface PlanFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the modal was in edit mode */
  plan?: Plan;
}

/**
 * @deprecated Navigate to `/admin/plans/new` or `/admin/plans/{id}/edit`
 * and render `<PlanForm />`. Rendering this component now produces nothing.
 */
export function PlanFormModal(_props: PlanFormModalProps) {
  void _props;
  return null;
}
