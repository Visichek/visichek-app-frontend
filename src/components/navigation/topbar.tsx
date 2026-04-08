"use client";

import { Menu, Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";

interface TopbarProps {
  onMenuClick: () => void;
  title?: string;
}

export function Topbar({ onMenuClick, title }: TopbarProps) {
  const { adminProfile, systemUserProfile, isAdmin } = useSession();
  const { logout } = useAuth();
  const displayName = isAdmin
    ? adminProfile?.fullName
    : systemUserProfile?.fullName;

  return (
    <header className="sticky top-0 z-sticky flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden min-h-[44px] min-w-[44px]"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title */}
      {title && (
        <h2 className="text-lg font-semibold tracking-tight hidden md:block">
          {title}
        </h2>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications placeholder */}
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
        </Button>

        {/* User info */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" aria-hidden="true" />
          <span>{displayName || "User"}</span>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={logout}
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
