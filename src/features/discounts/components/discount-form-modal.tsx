// DEPRECATED — create flow is now a dedicated page at /admin/discounts/new.
// Use `DiscountForm` from discount-form.tsx instead. This no-op stub keeps
// straggling imports compiling until all call sites are cleaned up.

interface DiscountFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * @deprecated Navigate to `/admin/discounts/new` and render `<DiscountForm />`.
 * Rendering this component now produces nothing.
 */
export function DiscountFormModal(_props: DiscountFormModalProps) {
  void _props;
  return null;
}
