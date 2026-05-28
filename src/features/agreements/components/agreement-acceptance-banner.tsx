"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import { PATHS } from "@/lib/routing/paths";
import {
  AGREEMENT_GATE_EVENT,
  type AgreementGateEventDetail,
} from "@/lib/api/agreement-gate";
import {
  agreementKeys,
  usePendingAgreements,
} from "@/features/agreements/hooks";
import { AGREEMENT_LABELS, type AgreementKey } from "@/types/agreements";

/**
 * Tenant-wide acceptance prompt for the platform agreements (DPA + Visitor
 * Privacy Policy). Shown whenever the tenant owes acceptance, so a super admin
 * can jump to `/app/agreements` to accept — and any other role understands why
 * visitor operations are blocked.
 *
 * The banner is NOT a hard gate: the rest of the app stays usable while an
 * agreement is pending (only operational writes 403). It also listens for the
 * interceptor's gate event so it appears the moment a blocked write is
 * attempted, not just on login.
 */
export function AgreementAcceptanceBanner() {
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const { currentRole } = useSession();
  const { loadingHref } = useNavigationLoading();

  const { data } = usePendingAgreements();

  // When an operational write trips the gate, refetch so we reflect it without
  // waiting for the next login / window focus.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AgreementGateEventDetail>).detail;
      if (detail?.pending?.length === 0) return;
      void queryClient.invalidateQueries({ queryKey: agreementKeys.pending });
    };
    window.addEventListener(AGREEMENT_GATE_EVENT, handler);
    return () => window.removeEventListener(AGREEMENT_GATE_EVENT, handler);
  }, [queryClient]);

  // Don't nag on the acceptance screen itself or during first-login onboarding
  // (the onboarding confirm screen accepts the DPA inline).
  const onAgreementsPage = pathname.startsWith(PATHS.APP_AGREEMENTS);
  const onOnboarding = pathname.startsWith("/app/onboarding");

  if (!data?.mustAccept || onAgreementsPage || onOnboarding) return null;

  const isSuperAdmin = currentRole === "super_admin";
  const names = data.pending
    .map((key) => AGREEMENT_LABELS[key as AgreementKey] ?? key)
    .join(" and ");
  const navigating = loadingHref === PATHS.APP_AGREEMENTS;

  return (
    <div
      role="alert"
      className="border-b border-warning/30 bg-warning/10 px-4 py-3 lg:px-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="text-foreground/90">
            <span className="font-medium">Action required:</span> your
            organization must accept the latest {names || "platform agreements"}{" "}
            to keep running visitor operations.
            {!isSuperAdmin && (
              <span className="text-muted-foreground">
                {" "}
                Ask your super admin to review and accept the updated
                agreements.
              </span>
            )}
          </p>
        </div>

        {isSuperAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={PATHS.APP_AGREEMENTS}
                size="sm"
                className="min-h-[44px] w-full shrink-0 sm:w-auto"
              >
                {navigating ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                Review &amp; accept
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the agreements page to read and accept the updated platform
              agreements on behalf of your organization
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
