"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Bell,
  Settings,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { CommandLauncher } from "@/components/navigation/command-launcher";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_ROUTES } from "@/lib/permissions/route-access";
import { NavigationLoadingProvider } from "@/lib/routing/navigation-context";
import { NavigationOverlay } from "@/components/feedback/navigation-overlay";
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
    label: "Branding",
    href: "/app/branding",
    icon: Palette,
    description: "Customize your organization's colors, logo, and visitor-facing badge appearance",
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
    label: "Alerts",
    href: "/app/alerts",
    icon: Bell,
    description: "View notifications and system alerts for your organization",
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: Settings,
    description: "Manage your preferences, theme, and notification settings",
  },
];

/** Pretty-print a role slug for display */
function formatRole(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { currentRole, systemUserProfile } = useSession();
  const { logout } = useAuth();
  const router = useRouter();

  // Bootstrap tenant branding
  useTenantBranding();

  // Sync API-persisted theme preference into next-themes on first load
  useThemeSync();

  // Filter nav items based on the current user's role
  const visibleNavItems = useMemo(() => {
    if (!currentRole) return [];
    const allowedRoutes = ROLE_ROUTES[currentRole] ?? [];
    return ALL_TENANT_NAV_ITEMS.filter((item) =>
      allowedRoutes.some((route) => item.href.startsWith(route))
    );
  }, [currentRole]);

  return (
    <NavigationLoadingProvider>
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — tenant branding applied via CSS variables */}
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
        onSettingsClick={() => router.push("/app/settings")}
        settingsHref="/app/settings"
        onLogoutClick={logout}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Mobile nav sheet */}
      <MobileNavSheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        items={visibleNavItems}
      />

      {/* Main content area */}
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

      {/* Command launcher overlay */}
      <CommandLauncher externalOpen={commandOpen} onExternalOpenChange={setCommandOpen} />

      {/* Full-screen navigation loading overlay */}
      <NavigationOverlay />
    </div>
    </NavigationLoadingProvider>
  );
}
