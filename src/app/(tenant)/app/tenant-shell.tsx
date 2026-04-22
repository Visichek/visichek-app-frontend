"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Building,
  GitBranch,
  UserCog,
  ShieldAlert,
  ScrollText,
  Shield,
  CreditCard,
  LifeBuoy,
  Activity,
  Settings,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useTenantBranding } from "@/hooks/use-tenant-branding";

const CommandLauncher = dynamic(
  () =>
    import("@/components/navigation/command-launcher").then((m) => ({
      default: m.CommandLauncher,
    })),
  { ssr: false }
);
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_ROUTES } from "@/lib/permissions/route-access";
import { cn } from "@/lib/utils/cn";
import { useThemeSync } from "@/hooks/use-theme-sync";

const ALL_TENANT_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    description: "Overview of today's visitors, appointments, and key metrics for your organization",
  },
  {
    label: "Visitors",
    href: "/app/visitors",
    icon: Users,
    description: "Check in and check out visitors, view active sessions, and manage visitor profiles",
  },
  {
    label: "Appointments",
    href: "/app/appointments",
    icon: CalendarDays,
    description: "Schedule, view, and manage visitor appointments with hosts in your organization",
  },
  {
    label: "Departments",
    href: "/app/departments",
    icon: Building,
    description: "Configure departments, assign managers, and set department-specific visitor rules",
  },
  {
    label: "Branches",
    href: "/app/branches",
    icon: GitBranch,
    description: "Manage physical branch locations and their operational status",
  },
  {
    label: "Users",
    href: "/app/users",
    icon: UserCog,
    description: "Add, edit, and manage staff accounts and their roles within your organization",
  },
  {
    label: "Incidents",
    href: "/app/incidents",
    icon: ShieldAlert,
    description: "Report and track security incidents, manage NDPC notification deadlines",
  },
  {
    label: "Audit Log",
    href: "/app/audit",
    icon: ScrollText,
    description: "View a read-only trail of all system actions for compliance and accountability",
  },
  {
    label: "Data Protection",
    href: "/app/dpo",
    icon: Shield,
    description: "Handle data subject requests, manage retention policies, and track compliance",
  },
  {
    label: "Billing",
    href: "/app/billing",
    icon: CreditCard,
    description: "View your subscription plan, invoices, and manage payment details",
  },
  {
    label: "Support Cases",
    href: "/app/support-cases",
    icon: LifeBuoy,
    description: "Open support tickets, reply to the VisiChek team, and track resolution of issues",
  },
  {
    label: "Recent Activity",
    href: "/app/jobs",
    icon: Activity,
    description: "Review the background writes you've triggered — pending, succeeded, or failed — and open any failure to debug it",
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: Settings,
    description: "Manage your preferences, theme, and notification settings",
  },
];

function formatRole(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TenantShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { currentRole, systemUserProfile } = useSession();
  const { logout } = useAuth();
  const { navigate } = useNavigationLoading();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useTenantBranding();
  useThemeSync();

  const visibleNavItems = useMemo(() => {
    if (!currentRole) return [];
    const allowedRoutes = ROLE_ROUTES[currentRole] ?? [];
    return ALL_TENANT_NAV_ITEMS.filter((item) =>
      allowedRoutes.some((route) => item.href.startsWith(route))
    );
  }, [currentRole]);

  return (
    <AuthGuard shell="system_user">
      <div className="min-h-screen bg-background">
        <AppSidebar
          items={visibleNavItems}
          header={
            <span className="text-lg font-bold font-display tracking-tight">
              VisiChek
            </span>
          }
          userInfo={{
            name: systemUserProfile?.fullName ?? "User",
            detail: currentRole ? formatRole(currentRole) : systemUserProfile?.email ?? "",
            initial: systemUserProfile?.fullName?.charAt(0) ?? "U",
          }}
          onSearchClick={() => setCommandOpen(true)}
          onSettingsClick={() => navigate("/app/settings")}
          settingsHref="/app/settings"
          onLogoutClick={logout}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <MobileNavSheet
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          items={visibleNavItems}
        />

        <div
          className={cn(
            "transition-[padding-left] duration-200 ease-in-out",
            sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
          )}
        >
          <Topbar
            onMenuClick={() => setMobileNavOpen(true)}
            onSearchClick={() => setCommandOpen(true)}
          />
          <main id="main-content" className="p-4 lg:p-6">
            {children}
          </main>
        </div>

        {commandOpen && (
          <CommandLauncher externalOpen={commandOpen} onExternalOpenChange={setCommandOpen} />
        )}
      </div>
    </AuthGuard>
  );
}
