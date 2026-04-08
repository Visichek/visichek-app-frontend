"use client";

import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface PermissionDeniedProps {
  message?: string;
}

export function PermissionDenied({
  message = "You do not have permission to access this feature. Contact your administrator if you believe this is an error.",
}: PermissionDeniedProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <ShieldOff className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Insufficient Permissions</h3>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>
      <Button
        variant="outline"
        onClick={() => router.back()}
        className="min-h-[44px]"
      >
        Go back
      </Button>
    </div>
  );
}
