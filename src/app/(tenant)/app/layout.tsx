import { TenantShell } from "./tenant-shell";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantShell>{children}</TenantShell>;
}
