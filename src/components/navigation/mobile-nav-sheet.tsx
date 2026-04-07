"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-lg font-bold font-display">
            VisiChek
          </SheetTitle>
        </SheetHeader>
        <nav className="px-3 py-4" aria-label="Mobile navigation">
          <ul className="space-y-1">
            {items.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
