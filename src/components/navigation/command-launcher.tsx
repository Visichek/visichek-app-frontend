"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { useCapabilities } from "@/hooks/use-capabilities";
import { PATHS } from "@/lib/routing/paths";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Building2,
  MapPin,
  Settings,
  Zap,
  LogOut,
  Palette,
  CreditCard,
  AlertTriangle,
  FileText,
  Lock,
  Plus,
  Search,
  X,
} from "lucide-react";

interface CommandItemType {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  action?: () => void;
  href?: string;
}

interface CommandGroupType {
  heading: string;
  items: CommandItemType[];
}

interface CommandLauncherProps {
  /** Allow parent to control open state (e.g. from sidebar search button) */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function CommandLauncher({ externalOpen, onExternalOpenChange }: CommandLauncherProps = {}) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, currentRole } = useSession();
  const { hasCapability, canAccess } = useCapabilities();

  const [internalOpen, setInternalOpen] = useState(false);

  // Merge internal and external open state
  const open = externalOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onExternalOpenChange?.(value);
  };
  const [inputValue, setInputValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Sync external open state
  useEffect(() => {
    if (externalOpen !== undefined && externalOpen !== internalOpen) {
      setInternalOpen(externalOpen);
    }
  }, [externalOpen]);

  // Keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Build command groups based on user role and shell
  const groups = useMemo<CommandGroupType[]>(() => {
    if (!isAuthenticated || !currentRole) return [];

    const navigationItems: CommandItemType[] = [];
    const actionItems: CommandItemType[] = [];
    const settingsItems: CommandItemType[] = [];

    // NAVIGATION: Tenant shell routes
    if (!isAdmin && currentRole) {
      // Dashboard
      if (canAccess(PATHS.APP_DASHBOARD)) {
        navigationItems.push({
          id: "nav-dashboard",
          label: "Dashboard",
          description: "View dashboard overview",
          icon: <LayoutDashboard className="h-4 w-4" />,
          keywords: ["dashboard", "home", "overview"],
          href: PATHS.APP_DASHBOARD,
        });
      }

      // Visitors (super_admin, dept_admin, receptionist)
      if (canAccess(PATHS.APP_VISITORS)) {
        navigationItems.push({
          id: "nav-visitors",
          label: "Visitors",
          description: "Manage visitor records",
          icon: <Users className="h-4 w-4" />,
          keywords: ["visitors", "check-in", "check-out", "profiles"],
          href: PATHS.APP_VISITORS,
        });
      }

      // Appointments
      if (canAccess(PATHS.APP_APPOINTMENTS)) {
        navigationItems.push({
          id: "nav-appointments",
          label: "Appointments",
          description: "Manage appointments",
          icon: <Calendar className="h-4 w-4" />,
          keywords: ["appointments", "schedule", "calendar"],
          href: PATHS.APP_APPOINTMENTS,
        });
      }

      // Departments (super_admin, dept_admin)
      if (canAccess(PATHS.APP_DEPARTMENTS)) {
        navigationItems.push({
          id: "nav-departments",
          label: "Departments",
          description: "Configure departments",
          icon: <Building2 className="h-4 w-4" />,
          keywords: ["departments", "config"],
          href: PATHS.APP_DEPARTMENTS,
        });
      }

      // Branches (super_admin)
      if (canAccess(PATHS.APP_BRANCHES)) {
        navigationItems.push({
          id: "nav-branches",
          label: "Branches",
          description: "Manage branch locations",
          icon: <MapPin className="h-4 w-4" />,
          keywords: ["branches", "locations"],
          href: PATHS.APP_BRANCHES,
        });
      }

      // Users (super_admin)
      if (canAccess(PATHS.APP_USERS)) {
        navigationItems.push({
          id: "nav-users",
          label: "Users",
          description: "Manage team members",
          icon: <Users className="h-4 w-4" />,
          keywords: ["users", "team", "members", "staff"],
          href: PATHS.APP_USERS,
        });
      }

      // Incidents (security_officer, super_admin)
      if (canAccess(PATHS.APP_INCIDENTS)) {
        navigationItems.push({
          id: "nav-incidents",
          label: "Incidents",
          description: "Report and manage incidents",
          icon: <AlertTriangle className="h-4 w-4" />,
          keywords: ["incidents", "security", "breach"],
          href: PATHS.APP_INCIDENTS,
        });
      }

      // Audit (auditor, dpo, super_admin)
      if (canAccess(PATHS.APP_AUDIT)) {
        navigationItems.push({
          id: "nav-audit",
          label: "Audit Log",
          description: "View system audit trail",
          icon: <FileText className="h-4 w-4" />,
          keywords: ["audit", "log", "history"],
          href: PATHS.APP_AUDIT,
        });
      }

      // DPO / Compliance (dpo, super_admin)
      if (canAccess(PATHS.APP_DPO)) {
        navigationItems.push({
          id: "nav-dpo",
          label: "Compliance",
          description: "Data subject requests and compliance",
          icon: <Lock className="h-4 w-4" />,
          keywords: ["compliance", "dpo", "dsr", "gdpr"],
          href: PATHS.APP_DPO,
        });
      }
    }

    // NAVIGATION: Platform admin routes
    if (isAdmin) {
      navigationItems.push({
        id: "nav-admin-dashboard",
        label: "Dashboard",
        description: "Admin dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
        keywords: ["dashboard", "admin", "overview"],
        href: PATHS.ADMIN_DASHBOARD,
      });

      navigationItems.push({
        id: "nav-tenants",
        label: "Tenants",
        description: "Manage tenant organizations",
        icon: <Building2 className="h-4 w-4" />,
        keywords: ["tenants", "organizations"],
        href: PATHS.ADMIN_TENANTS,
      });

      navigationItems.push({
        id: "nav-plans",
        label: "Plans",
        description: "Manage pricing plans",
        icon: <Zap className="h-4 w-4" />,
        keywords: ["plans", "pricing", "tiers"],
        href: PATHS.ADMIN_PLANS,
      });

      navigationItems.push({
        id: "nav-subscriptions",
        label: "Subscriptions",
        description: "Manage subscriptions",
        icon: <CreditCard className="h-4 w-4" />,
        keywords: ["subscriptions", "billing"],
        href: PATHS.ADMIN_SUBSCRIPTIONS,
      });

      navigationItems.push({
        id: "nav-discounts",
        label: "Discounts",
        description: "Manage discount codes",
        icon: <Zap className="h-4 w-4" />,
        keywords: ["discounts", "codes", "coupons"],
        href: PATHS.ADMIN_DISCOUNTS,
      });

      navigationItems.push({
        id: "nav-payments",
        label: "Payments",
        description: "View payment history",
        icon: <CreditCard className="h-4 w-4" />,
        keywords: ["payments", "invoices", "transactions"],
        href: PATHS.ADMIN_PAYMENTS,
      });
    }

    // ACTIONS: Quick actions based on capabilities
    if (!isAdmin && currentRole) {
      // Visitor actions
      if (hasCapability("visitor:check_in")) {
        actionItems.push({
          id: "action-check-in",
          label: "Check In Visitor",
          description: "Quick check-in for a new visitor",
          icon: <Plus className="h-4 w-4" />,
          keywords: ["check-in", "visitor", "add"],
          href: PATHS.APP_VISITORS,
        });
      }

      // Appointment actions
      if (hasCapability("appointment:create")) {
        actionItems.push({
          id: "action-appointment",
          label: "Create Appointment",
          description: "Schedule a new appointment",
          icon: <Plus className="h-4 w-4" />,
          keywords: ["appointment", "schedule", "new"],
          href: PATHS.APP_APPOINTMENTS,
        });
      }

      // Incident actions
      if (hasCapability("incident:create")) {
        actionItems.push({
          id: "action-incident",
          label: "Report Incident",
          description: "Report a security incident",
          icon: <AlertTriangle className="h-4 w-4" />,
          keywords: ["incident", "security", "report"],
          href: PATHS.APP_INCIDENTS,
        });
      }
    }

    // SETTINGS: Always available for authenticated users
    if (!isAdmin && currentRole) {
      if (canAccess(PATHS.APP_BRANDING)) {
        settingsItems.push({
          id: "settings-branding",
          label: "Branding",
          description: "Customize organization appearance",
          icon: <Palette className="h-4 w-4" />,
          keywords: ["branding", "colors", "logo", "theme"],
          href: PATHS.APP_BRANDING,
        });
      }

      if (canAccess(PATHS.APP_BILLING)) {
        settingsItems.push({
          id: "settings-billing",
          label: "Billing",
          description: "Manage subscription and payments",
          icon: <CreditCard className="h-4 w-4" />,
          keywords: ["billing", "subscription", "payment", "invoice"],
          href: PATHS.APP_BILLING,
        });
      }
    }

    const result: CommandGroupType[] = [];

    if (navigationItems.length > 0) {
      result.push({
        heading: "Navigation",
        items: navigationItems,
      });
    }

    if (actionItems.length > 0) {
      result.push({
        heading: "Actions",
        items: actionItems,
      });
    }

    if (settingsItems.length > 0) {
      result.push({
        heading: "Settings",
        items: settingsItems,
      });
    }

    return result;
  }, [isAuthenticated, isAdmin, currentRole, canAccess, hasCapability]);

  // Filter items based on input
  const filteredGroups = useMemo<CommandGroupType[]>(() => {
    if (!inputValue.trim()) return groups;

    const query = inputValue.toLowerCase();
    return groups
      .map((group) => ({
        heading: group.heading,
        items: group.items.filter((item) => {
          const label = item.label.toLowerCase();
          const description = (item.description || "").toLowerCase();
          const keywords = (item.keywords || []).map((k) => k.toLowerCase());

          return (
            label.includes(query) ||
            description.includes(query) ||
            keywords.some((k) => k.includes(query))
          );
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [inputValue, groups]);

  const allFilteredItems = useMemo(
    () => filteredGroups.flatMap((g) => g.items),
    [filteredGroups]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!allFilteredItems.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < allFilteredItems.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : allFilteredItems.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          const item = allFilteredItems[selectedIndex];
          if (item) {
            if (item.href) {
              router.push(item.href);
            }
            item.action?.();
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [allFilteredItems, selectedIndex, router]
  );

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setInputValue("");
      setSelectedIndex(0);
    }
  }, [open]);

  const handleSelect = useCallback(
    (item: CommandItemType) => {
      if (item.href) {
        router.push(item.href);
      }
      item.action?.();
      setOpen(false);
    },
    [router]
  );

  return (
    <>
      {/* Cmd+K hint in topbar or accessible via keyboard */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay className="z-modal" />
          <div className="fixed inset-0 z-modal flex items-start justify-center pt-[20vh]">
            <div className="w-full max-w-2xl mx-4 rounded-lg border bg-background shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-10">
              {/* Input Section */}
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search navigation, actions, settings..."
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {inputValue && (
                  <button
                    onClick={() => setInputValue("")}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Results List */}
              <div
                ref={listRef}
                className="flex flex-col max-h-80 overflow-y-auto"
              >
                {allFilteredItems.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No results found. Try searching for a page or action.
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.heading}>
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.heading}
                      </div>
                      {group.items.map((item, idx) => {
                        const globalIndex = allFilteredItems.indexOf(item);
                        const isSelected = selectedIndex === globalIndex;

                        return (
                          <button
                            key={item.id}
                            data-index={globalIndex}
                            onClick={() => handleSelect(item)}
                            className={cn(
                              "flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors cursor-pointer text-left",
                              isSelected
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50 text-foreground"
                            )}
                          >
                            {item.icon && (
                              <div className="h-4 w-4 flex-shrink-0 text-current">
                                {item.icon}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{item.label}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer with keyboard shortcuts */}
              {allFilteredItems.length > 0 && (
                <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex gap-4">
                    <span>
                      <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        ↑↓
                      </kbd>{" "}
                      navigate
                    </span>
                    <span>
                      <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        ↵
                      </kbd>{" "}
                      select
                    </span>
                  </div>
                  <span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      esc
                    </kbd>{" "}
                    close
                  </span>
                </div>
              )}
            </div>
          </div>
        </DialogPortal>
      </Dialog>
    </>
  );
}
