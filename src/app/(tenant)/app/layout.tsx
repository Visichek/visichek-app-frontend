"use client";

import { useState, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Building,
  GitBranch,
  UserCog,
  Palette,
  ShieldAlert,
  ScrollText,
  Shield,
  CreditCard,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { CommandLauncher } from "@/components/navigation/command-launcher";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { useSession } from "@/hooks/use-session";
import { ROLE_ROUTES } from "@/lib/permissions/route-access";

const ALL_TENANT_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Visitors", href: "/app/visitors", icon: Users },
  { label: "Appointments", href: "/app/appointments", icon: CalendarDays },
  { label: "Departments", href: "/app/departments", icon: Building },
  { label: "Branches", href: "/app/branches", icon: GitBranch },
  { label: "Users", href: "/app/users", icon: UserCog },
  { label: "Branding", href: "/app/branding", icon: Palette },
  { label: "Incidents", href: "/app/incidents", icon: ShieldAlert },
  { label: "Audit Log", href: "/app/audit", icon: ScrollText },
  { label: "Data Protection", href: "/app/dpo", icon: Shield },
  { label: "Billing", href: "/app/billing", icon: CreditCard },
];

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { currentRole, systemUserProfile } = useSession();

  // Bootstrap tenant branding
  useTenantBranding();

  // Filter nav items based on the current user's role
  const visibleNavItems = useMemo(() => {
    if (!currentRole) return [];
    const allowedRoutes = ROLE_ROUTES[currentRole] ?? [];
    return ALL_TENANT_NAV_ITEMS.filter((item) =>
      allowedRoutes.some((route) => item.href.startsWith(route))
    );
  }, [currentRole]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — tenant branding applied via CSS variables */}
      <AppSidebar
        items={visibleNavItems}
        header={
          <span className="text-lg font-bold font-display">VisiChek</span>
        }
      />

      {/* Mobile nav sheet */}
      <MobileNavSheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        items={visibleNavItems}
      />

      {/* Main content area */}
      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main id="main-content" className="p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Command launcher overlay */}
      <CommandLauncher />
    </div>
  );
}
