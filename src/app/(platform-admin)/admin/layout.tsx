import { AdminShell } from "./admin-shell";

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
