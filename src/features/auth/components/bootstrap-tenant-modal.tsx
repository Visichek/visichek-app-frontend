// DEPRECATED — bootstrap flow is now a dedicated page at /admin/tenants/new.
// Use `BootstrapTenantForm` from bootstrap-tenant-form.tsx instead. This
// no-op stub keeps straggling imports compiling until all call sites are
// cleaned up.

interface BootstrapTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * @deprecated Navigate to `/admin/tenants/new` and render
 * `<BootstrapTenantForm />`. Rendering this component now produces nothing.
 */
export function BootstrapTenantModal(_props: BootstrapTenantModalProps) {
  void _props;
  return null;
}
