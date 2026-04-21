"use client";

import Link from "next/link";
import { FileQuestion, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@/hooks/use-session";
import { useNavigationLoading } from "@/lib/routing/navigation-context";

function homeHrefFor(isAdmin: boolean, isSystemUser: boolean): string {
  if (isAdmin) return "/admin/dashboard";
  if (isSystemUser) return "/app/dashboard";
  return "/";
}

export default function NotFound() {
  const { isAuthenticated, isAdmin, isSystemUser } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const href = homeHrefFor(isAdmin, isSystemUser);
  const label = isAuthenticated ? "Back to dashboard" : "Go back home";
  const isLoading = loadingHref === href;
  const tooltipCopy = isAuthenticated
    ? "Return to your dashboard — we won't send you back through login"
    : "Return to the VisiChek home page";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild className="min-h-[44px]">
            <Link href={href} onClick={() => handleNavClick(href)}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {label}
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipCopy}</TooltipContent>
      </Tooltip>
    </div>
  );
}
