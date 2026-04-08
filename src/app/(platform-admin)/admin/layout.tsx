"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Tags,
  Wallet,
  Settings,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { CommandLauncher } from "@/components/navigation/command-launcher";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils/cn";
import { useThemeSync } from "@/hooks/use-theme-sync";

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
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Manage your preferences, theme, security, and platform configuration",
  },
];

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { adminProfile } = useSession();
  const { logout } = useAuth();
  const router = useRouter();

  // Sync API-persisted theme preference into next-themes on first load
  useThemeSync();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — platform branding only, no tenant branding */}
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
        onSettingsClick={() => router.push("/admin/settings")}
        settingsHref="/admin/settings"
        onLogoutClick={logout}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Mobile nav sheet */}
      <MobileNavSheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        items={ADMIN_NAV_ITEMS}
      />

      {/* Main content area offset by sidebar width on desktop */}
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
    </div>
  );
}
