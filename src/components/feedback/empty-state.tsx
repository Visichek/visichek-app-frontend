import { InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-full bg-muted p-3">
        {icon || <InboxIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="min-h-[44px]">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
