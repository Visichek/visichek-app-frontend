"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Tags,
  Wallet,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { CommandLauncher } from "@/components/navigation/command-launcher";

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Tenants", href: "/admin/tenants", icon: Building2 },
  { label: "Plans", href: "/admin/plans", icon: Package },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Discounts", href: "/admin/discounts", icon: Tags },
  { label: "Payments", href: "/admin/payments", icon: Wallet },
];

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — platform branding only, no tenant branding */}
      <AppSidebar
        items={ADMIN_NAV_ITEMS}
        header={
          <span className="text-lg font-bold font-display">VisiChek Admin</span>
        }
      />

      {/* Mobile nav sheet */}
      <MobileNavSheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        items={ADMIN_NAV_ITEMS}
      />

      {/* Main content area offset by sidebar width on desktop */}
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
