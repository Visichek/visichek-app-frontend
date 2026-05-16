"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { FreePlanBanner } from "@/components/billing/free-plan-banner";
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
  ClipboardCheck,
  Briefcase,
  ShieldCheck,
  Headphones,
} from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/navigation/app-sidebar";
import { MobileNavSheet } from "@/components/navigation/mobile-nav-sheet";
import { Topbar } from "@/components/navigation/topbar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { useAppSelector } from "@/lib/store/hooks";
import { selectBranding } from "@/lib/store/branding-slice";

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
import { requestUserLocation } from "@/lib/geolocation/user-location";
import { useCapability } from "@/features/limitations/hooks/use-limitations";
import { UpgradePromptProvider } from "@/features/limitations/components/upgrade-prompt-provider";
import { useNotificationBuckets } from "@/features/notifications/hooks";
import type { PlanFeatureKey } from "@/types/billing";

// Roles that act as geofencing approvers in approver-proximity mode. When
// a tenant has not configured a fixed reference coordinate, visitor submits
// are accepted only if one of these users is physically within radius. We
// warm up the browser's location permission for them on shell mount so the
// presence beacon (the `X-User-Location` header on every authenticated
// request) starts populating Redis before a visitor actually tries to check in.
const GEOFENCE_APPROVER_ROLES = new Set([
  "super_admin",
  "dept_admin",
  "receptionist",
]);

/**
 * Map a nav item to a plan feature key OR an API prefix.
 * - `feature` matches against `Limitations.deniedFeatures` (stable short keys)
 * - `apiPrefix` matches against `Limitations.deniedEndpoints` (URL patterns)
 *   and is used for areas with no stable feature key (incidents, audit, dpo,
 *   compliance — entirely blocked on Free per the backend manifest)
 * When either match denies the item we render it as locked rather than
 * hiding it, so the tenant can see what the paid tiers unlock.
 */
type GatedNavItem = NavItem & {
  feature?: PlanFeatureKey;
  apiPrefix?: string;
  /** Fallback key passed to the upgrade modal when only `apiPrefix` matches. */
  lockKey?: PlanFeatureKey | string;
};

type GatedNavGroup = NavItem & { children: GatedNavItem[] };

const ALL_TENANT_NAV_ITEMS: (GatedNavItem | GatedNavGroup)[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    description: "Overview of today's visitors, appointments, and key metrics for your organization",
  },
  {
    label: "Front Desk",
    icon: ClipboardCheck,
    description: "Day-to-day visitor and appointment workflows for the reception team",
    children: [
      {
        label: "Visitors",
        href: "/app/visitors/pending",
        icon: Users,
        description: "Check in and check out visitors, view active sessions, and manage visitor profiles",
        notificationBucket: "visitors",
      },
      {
        label: "Appointments",
        href: "/app/appointments",
        icon: CalendarDays,
        description: "Schedule, view, and manage visitor appointments with hosts in your organization",
        feature: "appointments",
        notificationBucket: "appointments",
      },
    ],
  },
  {
    label: "Organization",
    icon: Briefcase,
    description: "Configure your departments, branch locations, and staff accounts",
    children: [
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
        feature: "multi_location",
      },
      {
        label: "Users",
        href: "/app/users",
        icon: UserCog,
        description: "Add, edit, and manage staff accounts and their roles within your organization",
      },
    ],
  },
  {
    label: "Compliance",
    icon: ShieldCheck,
    description: "Incidents, audit trail, and NDPA data-protection tooling in one place",
    children: [
      {
        label: "Incidents",
        href: "/app/incidents",
        icon: ShieldAlert,
        description: "Report and track security incidents, manage NDPC notification deadlines",
        notificationBucket: "incidents",
        apiPrefix: "/v1/incidents",
        lockKey: "incidents",
      },
      {
        label: "Audit Log",
        href: "/app/audit",
        icon: ScrollText,
        description: "View a read-only trail of all system actions for compliance and accountability",
        apiPrefix: "/v1/audit-logs",
        lockKey: "audit",
      },
      {
        label: "Data Protection",
        href: "/app/dpo",
        icon: Shield,
        description: "Handle data subject requests, manage retention policies, and track compliance",
        apiPrefix: "/v1/dsr",
        lockKey: "dpo",
      },
    ],
  },
  {
    label: "Billing",
    href: "/app/billing",
    icon: CreditCard,
    description: "View your subscription plan, invoices, and manage payment details",
  },
  {
    label: "Support",
    icon: Headphones,
    description: "Open support tickets and review your recent background jobs",
    children: [
      {
        label: "Support Cases",
        href: "/app/support-cases",
        icon: LifeBuoy,
        description: "Open support tickets, reply to the VisiChek team, and track resolution of issues",
        notificationBucket: "support_cases",
      },
      {
        label: "Recent Activity",
        href: "/app/jobs",
        icon: Activity,
        description: "Review the background writes you've triggered — pending, succeeded, or failed — and open any failure to debug it",
        notificationBucket: "jobs",
      },
    ],
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
  // CRITICAL: do NOT call any data-fetching hooks here. AuthGuard's children
  // are only instantiated when the gate decides to render — that's how we
  // guarantee zero API traffic (no /me, no /settings, no /limitations,
  // no /branding) for users without a valid session. All shell hooks live
  // inside <TenantShellInner>, which only mounts when AuthGuard renders
  // its children.
  return (
    <AuthGuard shell="system_user">
      <TenantShellInner>{children}</TenantShellInner>
    </AuthGuard>
  );
}

function TenantShellInner({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { currentRole, systemUserProfile } = useSession();
  const { logout } = useAuth();
  const { navigateFromOverlay } = useNavigationLoading();
  const pathname = usePathname() ?? "";

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

  // Warm up the geolocation cache for approver roles. A single
  // `getCurrentPosition` call on mount triggers the browser's permission
  // prompt (if still "prompt"); once granted, the interceptor can start
  // attaching `X-User-Location` to every authenticated request. Denial
  // is sticky inside `requestUserLocation`, so we don't re-prompt on
  // navigation.
  useEffect(() => {
    if (!currentRole || !GEOFENCE_APPROVER_ROLES.has(currentRole)) return;
    requestUserLocation().catch(() => {
      // Best-effort — a missing header is a valid "no recent location"
      // signal to the backend, so swallow the rejection silently.
    });
  }, [currentRole]);
  const branding = useAppSelector(selectBranding);
  const workspaceName = branding?.companyName ?? "VisiChek";
  const workspaceLogo = branding?.logoUrl;

  const { can, isEndpointDenied, isLoading: limitationsLoading } = useCapability();
  // Issue 2: tenant-side notification badges. Reuses the same
  // bucket-classification path the admin shell uses so the topbar bell,
  // sidebar badges, and any page-level alerts stay in sync.
  const notificationCounts = useNotificationBuckets("tenant");

  const visibleNavItems = useMemo<NavItem[]>(() => {
    if (!currentRole) return [];
    const allowedRoutes = ROLE_ROUTES[currentRole] ?? [];

    function roleAllowsLeaf(leaf: GatedNavItem): boolean {
      if (!leaf.href) return false;
      return allowedRoutes.some((route) => leaf.href!.startsWith(route));
    }

    // Plan-denied items are kept visible but rendered as locked rows so
    // the tenant can see what the paid tiers unlock. The sidebar primitive
    // intercepts the click and opens the upgrade modal instead of
    // navigating. Role-denied items are still filtered out — those are not
    // upgrade prompts, they're role-scoped.
    function toNavItem(leaf: GatedNavItem): NavItem | null {
      if (!roleAllowsLeaf(leaf)) return null;
      if (limitationsLoading) return leaf;

      const featureDenied = !!leaf.feature && !can(leaf.feature);
      const endpointDenied =
        !!leaf.apiPrefix && isEndpointDenied(leaf.apiPrefix);

      if (!featureDenied && !endpointDenied) return leaf;
      return {
        ...leaf,
        locked: true,
        lockedFeatureKey: leaf.feature ?? leaf.lockKey,
      };
    }

    const visible: NavItem[] = [];
    for (const item of ALL_TENANT_NAV_ITEMS) {
      if (item.children) {
        const kids = (item.children as GatedNavItem[])
          .map(toNavItem)
          .filter((x): x is NavItem => x !== null);
        if (kids.length === 0) continue;
        visible.push({ ...item, children: kids });
      } else {
        const next = toNavItem(item as GatedNavItem);
        if (next) visible.push(next);
      }
    }
    return visible;
  }, [currentRole, can, isEndpointDenied, limitationsLoading]);

  return (
    <UpgradePromptProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar
          items={visibleNavItems}
          notificationCounts={notificationCounts}
          logoUrl={workspaceLogo}
          brandName={workspaceName}
          userInfo={{
            name: systemUserProfile?.fullName ?? "User",
            detail: currentRole ? formatRole(currentRole) : systemUserProfile?.email ?? "",
            initial: systemUserProfile?.fullName?.charAt(0) ?? "U",
          }}
          onSearchClick={() => setCommandOpen(true)}
          onSettingsClick={() => navigateFromOverlay("/app/settings")}
          settingsHref="/app/settings"
          onHelpClick={() => navigateFromOverlay("/app/support-cases")}
          helpHref="/app/support-cases"
          onLogoutClick={logout}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <MobileNavSheet
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          items={visibleNavItems}
          notificationCounts={notificationCounts}
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
          <FreePlanBanner pathname={pathname} />
          <main id="main-content" className="p-4 lg:p-6">
            {children}
          </main>
        </div>

        {commandOpen && (
          <CommandLauncher externalOpen={commandOpen} onExternalOpenChange={setCommandOpen} />
        )}
      </div>
    </UpgradePromptProvider>
  );
}
