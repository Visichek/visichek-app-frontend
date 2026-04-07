"use client";

import type { ReactNode } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}

/**
 * DetailSheet: Side panel for viewing record details.
 * - Desktop/tablet: Dialog from center (max 480px)
 * - Mobile: Sheet from bottom (full screen)
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
}: DetailSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            {children}
          </div>

          {actions && (
            <div className="flex gap-2 justify-end border-t pt-4">
              {actions}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Sheet from bottom
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] max-h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="overflow-y-auto flex-1 py-4 space-y-6">
          {children}
        </div>

        {actions && (
          <SheetFooter className="flex gap-2">
            {actions}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
