"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import {
  Loader2,
  Settings,
  LogOut,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { useAppSelector } from "@/lib/store/hooks";
import { selectBranding } from "@/lib/store/branding-slice";
import type { NavItem } from "./app-sidebar";

function isGroup(item: NavItem): item is NavItem & { children: NavItem[] } {
  return Array.isArray(item.children) && item.children.length > 0;
}

function groupContainsPath(item: NavItem, pathname: string): boolean {
  if (!isGroup(item)) return false;
  return item.children.some(
    (child) => child.href && pathname.startsWith(child.href),
  );
}

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
}

export function MobileNavSheet({
  open,
  onOpenChange,
  items,
}: MobileNavSheetProps) {
  const pathname = usePathname();
  const { loadingHref, handleNavClick, navigate } = useNavigationLoading();
  const { adminProfile, systemUserProfile, isAdmin, currentRole } =
    useSession();
  const { logout } = useAuth();
  const branding = useAppSelector(selectBranding);
  const workspaceName = isAdmin
    ? "VisiChek Admin"
    : branding?.companyName ?? "VisiChek";
  const workspaceLogo = isAdmin ? undefined : branding?.logoUrl;

  const displayName = isAdmin
    ? adminProfile?.fullName
    : systemUserProfile?.fullName;
  const displayDetail = isAdmin
    ? adminProfile?.email
    : currentRole
      ? currentRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : systemUserProfile?.email;

  const settingsPath = isAdmin ? "/admin/settings" : "/app/settings";
  // Help only exists in the tenant shell — platform admins have no support
  // cases page they own (they triage tenant cases, not their own).
  const helpPath = isAdmin ? null : "/app/support-cases";
  const isHelpLoading = helpPath ? loadingHref === helpPath : false;

  // Filter Settings from main nav since it's in the footer
  const mainNavItems = items.filter(
    (item) => item.label.toLowerCase() !== "settings",
  );

  // Mirror the AppSidebar grouping behavior: groups are collapsed by default
  // and auto-opened when the current path lives inside them. User toggles
  // are preserved within the same mount.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const item of mainNavItems) {
      if (groupContainsPath(item, pathname ?? "")) open.add(item.label);
    }
    return open;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const item of mainNavItems) {
        if (groupContainsPath(item, pathname ?? "") && !next.has(item.label)) {
          next.add(item.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, mainNavItems]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function renderLeaf(item: NavItem, nested = false) {
    const isActive = item.href ? pathname.startsWith(item.href) : false;
    const isLoading = loadingHref === item.href;
    const Icon = item.icon;
    return (
      <li key={item.href ?? item.label}>
        <a
          href={item.href ?? "#"}
          onClick={() => {
            if (item.href) handleNavClick(item.href);
            onOpenChange(false);
          }}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
            nested && "pl-10 text-[13px]",
            isActive
              ? "bg-accent text-accent-foreground"
              : "text-foreground/70 hover:bg-accent hover:text-foreground",
          )}
          aria-current={isActive ? "page" : undefined}
        >
          {isLoading ? (
            <Loader2
              className={cn(
                "shrink-0 animate-spin text-foreground",
                nested ? "h-4 w-4" : "h-[18px] w-[18px]",
              )}
              aria-hidden="true"
            />
          ) : (
            <Icon
              className={cn(
                "shrink-0",
                nested ? "h-4 w-4" : "h-[18px] w-[18px]",
                isActive ? "text-foreground" : "text-foreground/50",
              )}
              aria-hidden="true"
            />
          )}
          <div className="flex-1 min-w-0">
            <span>{item.label}</span>
            {!nested && item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {item.description}
              </p>
            )}
          </div>
        </a>
      </li>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle asChild>
            <div className="flex min-w-0 items-center gap-2 text-left">
              {workspaceLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={workspaceLogo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded object-contain"
                />
              ) : null}
              <span className="truncate text-lg font-bold font-display tracking-tight">
                {workspaceName}
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile navigation">
          <ul className="space-y-0.5">
            {mainNavItems.map((item) => {
              if (isGroup(item)) {
                const open = openGroups.has(item.label);
                const containsActive = groupContainsPath(item, pathname ?? "");
                const GroupIcon = item.icon;
                return (
                  <li key={`group:${item.label}`}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.label)}
                      aria-expanded={open}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                        containsActive
                          ? "text-foreground"
                          : "text-foreground/70 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <GroupIcon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          containsActive ? "text-foreground" : "text-foreground/50",
                        )}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <span>{item.label}</span>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-foreground/40 transition-transform",
                          open && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {open && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.children.map((child) => renderLeaf(child, true))}
                      </ul>
                    )}
                  </li>
                );
              }
              return renderLeaf(item);
            })}
          </ul>
        </nav>

        {/* Footer: user info + settings + logout */}
        <div className="border-t px-3 py-3 space-y-1">
          {/* User identity */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {(displayName?.charAt(0) ?? "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight truncate">
                {displayName ?? "User"}
              </p>
              {displayDetail && (
                <p className="text-xs text-muted-foreground leading-tight truncate">
                  {displayDetail}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Settings link */}
          <button
            onClick={() => {
              navigate(settingsPath);
              onOpenChange(false);
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors w-full min-h-[44px]"
          >
            <Settings className="h-[18px] w-[18px] shrink-0 text-foreground/50" aria-hidden="true" />
            Settings
          </button>

          {/* Help — tenant shell only; opens the user's support cases page */}
          {helpPath && (
            <button
              onClick={() => {
                navigate(helpPath);
                onOpenChange(false);
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors w-full min-h-[44px]"
            >
              {isHelpLoading ? (
                <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-foreground" aria-hidden="true" />
              ) : (
                <HelpCircle className="h-[18px] w-[18px] shrink-0 text-foreground/50" aria-hidden="true" />
              )}
              Get help
            </button>
          )}

          {/* Logout */}
          <button
            onClick={() => {
              onOpenChange(false);
              logout();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full min-h-[44px]"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            Log out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
