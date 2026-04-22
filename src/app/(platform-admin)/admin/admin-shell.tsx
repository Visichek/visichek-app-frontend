"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Tags,
  Wallet,
  LifeBuoy,
  AlarmClock,
  Activity,
  Settings,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useSession } from "@/hooks/use-session";

const CommandLauncher = dynamic(
  () =>
    import("@/components/navigation/command-launcher").then((m) => ({
      default: m.CommandLauncher,
    })),
  { ssr: false }
);
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils/cn";
import { useThemeSync } from "@/hooks/use-theme-sync";
import { clearBrandingStyles } from "@/lib/branding/apply-branding";
import { disableUserLocation } from "@/lib/geolocation/user-location";

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    description: "Platform overview with tenant metrics, revenue, and growth trends",
  },
  {
    label: "Tenants",
    href: "/admin/tenants",
    icon: Building2,
    description: "Manage tenant organizations, bootstrap new tenants, and view their status",
  },
  {
    label: "Plans",
    href: "/admin/plans",
    icon: Package,
    description: "Create and manage pricing plans, feature rules, and usage limits",
  },
  {
    label: "Subscriptions",
    href: "/admin/subscriptions",
    icon: CreditCard,
    description: "View and manage tenant subscriptions, change plans, and handle cancellations",
  },
  {
    label: "Discounts",
    href: "/admin/discounts",
    icon: Tags,
    description: "Create discount codes, set redemption limits, and track usage",
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: Wallet,
    description: "View payment transactions, invoices, and revenue history",
  },
  {
    label: "Support Cases",
    href: "/admin/support-cases",
    icon: LifeBuoy,
    description: "Review tenant support tickets, reply, post internal notes, and move cases through the workflow",
  },
  {
    label: "SLA Watch",
    href: "/admin/support-cases/sla-watch",
    icon: AlarmClock,
    description: "Cases whose SLA deadline falls in the next 24 hours; work these first to stay in compliance",
  },
  {
    label: "Recent Activity",
    href: "/admin/jobs",
    icon: Activity,
    description: "Review the background writes you've triggered — pending, succeeded, or failed — and open any failure to debug it",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Manage your preferences, theme, security, and platform configuration",
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { adminProfile } = useSession();
  const { logout } = useAuth();
  const { navigate } = useNavigationLoading();

  useThemeSync();

  // Platform admin never uses tenant branding — wipe any residual title/favicon
  // left over from a previous tenant session on this device. Also disable
  // geolocation capture: admins are never tenant-side approvers, so they
  // must not leak coordinates into any tenant's presence index.
  useEffect(() => {
    clearBrandingStyles();
    document.title = "VisiChek Admin";
    disableUserLocation();
  }, []);

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

  return (
    <AuthGuard shell="admin">
      <div className="min-h-screen bg-background">
        <AppSidebar
          items={ADMIN_NAV_ITEMS}
          header={
            <span className="text-lg font-bold font-display tracking-tight">
              VisiChek Admin
            </span>
          }
          userInfo={{
            name: adminProfile?.fullName ?? "Admin",
            detail: adminProfile?.email ?? "",
            initial: adminProfile?.fullName?.charAt(0) ?? "A",
          }}
          onSearchClick={() => setCommandOpen(true)}
          onSettingsClick={() => navigate("/admin/settings")}
          settingsHref="/admin/settings"
          onLogoutClick={logout}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <MobileNavSheet
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          items={ADMIN_NAV_ITEMS}
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
