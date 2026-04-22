"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";
import { Loader2, Settings, LogOut, HelpCircle } from "lucide-react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { useAppSelector } from "@/lib/store/hooks";
import { selectBranding } from "@/lib/store/branding-slice";
import type { NavItem } from "./app-sidebar";

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

  // Filter Settings from main nav since it's in the footer
  const mainNavItems = items.filter(
    (item) => item.label.toLowerCase() !== "settings",
  );

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
              const isActive = pathname.startsWith(item.href);
              const isLoading = loadingHref === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      handleNavClick(item.href);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/70 hover:bg-accent hover:text-foreground",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {isLoading ? (
                      <Loader2
                        className="h-[18px] w-[18px] shrink-0 animate-spin text-foreground"
                        aria-hidden="true"
                      />
                    ) : (
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          isActive ? "text-foreground" : "text-foreground/50",
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <span>{item.label}</span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
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

          {/* Help */}
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors w-full min-h-[44px]"
          >
            <HelpCircle className="h-[18px] w-[18px] shrink-0 text-foreground/50" aria-hidden="true" />
            Get help
          </button>

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
