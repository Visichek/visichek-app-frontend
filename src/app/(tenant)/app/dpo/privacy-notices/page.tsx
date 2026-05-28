"use client";

import { Info, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { PrivacyNoticeDisplay } from "@/features/public-registration/components/privacy-notice-display";
import { useActivePrivacyNotice } from "@/features/privacy/hooks/use-privacy-notices";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES } from "@/lib/permissions/capabilities";
import { PATHS } from "@/lib/routing/paths";
import type { PublicPrivacyNotice } from "@/types/public";

/**
 * Read-only view of the visitor privacy notice. The notice is now DERIVED from
 * the platform-managed Visitor Privacy Policy master (templated per tenant), so
 * tenants no longer author it here — it's reviewed/accepted under Agreements.
 */
export default function PrivacyNoticesPage() {
  const { hasCapability } = useCapabilities();
  const canView = hasCapability(CAPABILITIES.PRIVACY_NOTICE_VIEW);

  const { data, isLoading, isError, refetch } = useActivePrivacyNotice();

  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Visitor privacy notice"
          description="The privacy notice visitors see when they check in."
        />
        <EmptyState
          title="You don't have access to the privacy notice"
          description="Ask your super admin or DPO to review the visitor privacy notice."
        />
      </div>
    );
  }

  const preview: PublicPrivacyNotice | null = data
    ? {
        id: data.id,
        title: data.title,
        summary: data.summary,
        fullText: data.fullText,
        body: data.body,
        displayMode: data.displayMode,
        versionId: data.versionId,
        effectiveDate: data.effectiveDate,
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Visitor privacy notice"
        description="This is the privacy policy and terms visitors see at your QR / kiosk check-in. It is managed by VisiChek and tailored to your organization."
      />

      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        <div className="space-y-2 text-foreground/80">
          <p>
            The visitor privacy notice is now derived from VisiChek&apos;s{" "}
            <span className="font-medium">Visitor Privacy Policy</span> and
            filled in with your organization&apos;s details automatically. It
            updates whenever VisiChek publishes a new version, so it always
            reflects the current text — you no longer edit it here.
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={PATHS.APP_AGREEMENTS}
                variant="outline"
                size="sm"
                className="min-h-[44px]"
              >
                Review platform agreements
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the agreements page to read the Visitor Privacy Policy and
              accept new versions when they&apos;re published
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isError ? (
        // A 404 here simply means no notice is configured yet — show a soft
        // empty state rather than a hard error for that case.
        <EmptyState
          icon={<ScrollText className="h-6 w-6 text-muted-foreground" />}
          title="No visitor privacy notice yet"
          description="Once VisiChek publishes the Visitor Privacy Policy, the tailored notice your visitors see will appear here."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : isLoading ? (
        <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
      ) : preview ? (
        <PrivacyNoticeDisplay notice={preview} />
      ) : (
        <EmptyState
          icon={<ScrollText className="h-6 w-6 text-muted-foreground" />}
          title="No visitor privacy notice yet"
          description="Once VisiChek publishes the Visitor Privacy Policy, the tailored notice your visitors see will appear here."
        />
      )}
    </div>
  );
}
