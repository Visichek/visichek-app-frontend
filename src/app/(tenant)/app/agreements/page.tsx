"use client";

import { useState } from "react";
import { BadgeCheck, FileText, ScrollText, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/recipes/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { LegalContentRenderer } from "@/features/legal-documents/components/legal-content-renderer";
import {
  useAgreements,
  useAcceptAgreement,
  useDeclineAgreement,
} from "@/features/agreements/hooks";
import { useSession } from "@/hooks/use-session";
import { formatDate } from "@/lib/utils/format-date";
import { AGREEMENT_LABELS, type TenantAgreement } from "@/types/agreements";

export default function AgreementsPage() {
  const { currentRole } = useSession();
  const isSuperAdmin = currentRole === "super_admin";

  const { data, isLoading, isError, error, refetch } = useAgreements();
  const accept = useAcceptAgreement();
  const decline = useDeclineAgreement();

  // The agreement key whose decline is awaiting confirmation.
  const [declineTarget, setDeclineTarget] = useState<TenantAgreement | null>(
    null,
  );

  async function handleAccept(agreement: TenantAgreement) {
    try {
      await accept.mutateAsync(agreement.agreementKey);
      toast.success(`${agreement.title} accepted.`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't record your acceptance. Please try again.",
      );
    }
  }

  async function handleDeclineConfirm() {
    if (!declineTarget) return;
    try {
      const result = await decline.mutateAsync(declineTarget.agreementKey);
      setDeclineTarget(null);
      toast.warning(
        result.stillBlocked
          ? "Decline recorded. Your organization stays blocked from visitor operations until you accept."
          : "Decline recorded.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't record your decision. Please try again.",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
        <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="Couldn't load your agreements"
          message={error instanceof Error ? error.message : "Something went wrong"}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const agreements = data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Platform agreements"
        description="The legal agreements VisiChek requires your organization to accept. When a new version is published you'll be asked to re-accept before you can continue running visitor operations."
      />

      {agreements.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6 text-muted-foreground" />}
          title="No agreements to review"
          description="There are no platform agreements to accept right now. We'll prompt you here if that changes."
        />
      ) : (
        agreements.map((agreement) => (
          <AgreementCard
            key={agreement.id}
            agreement={agreement}
            isSuperAdmin={isSuperAdmin}
            accepting={
              accept.isPending && accept.variables === agreement.agreementKey
            }
            declining={
              decline.isPending && decline.variables === agreement.agreementKey
            }
            onAccept={() => handleAccept(agreement)}
            onDeclineClick={() => setDeclineTarget(agreement)}
          />
        ))
      )}

      <ConfirmDialog
        open={!!declineTarget}
        onOpenChange={(open) => {
          if (!open) setDeclineTarget(null);
        }}
        title={`Decline ${declineTarget?.title ?? "this agreement"}?`}
        description="Your decline is recorded, but your organization stays blocked from creating appointments, checking visitors in/out, and issuing badges until you accept. Nothing is deleted — you can accept at any time."
        confirmLabel="Decline anyway"
        variant="destructive"
        isLoading={decline.isPending}
        onConfirm={handleDeclineConfirm}
      />
    </div>
  );
}

function AgreementCard({
  agreement,
  isSuperAdmin,
  accepting,
  declining,
  onAccept,
  onDeclineClick,
}: {
  agreement: TenantAgreement;
  isSuperAdmin: boolean;
  accepting: boolean;
  declining: boolean;
  onAccept: () => void;
  onDeclineClick: () => void;
}) {
  const label = AGREEMENT_LABELS[agreement.agreementKey] ?? agreement.title;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            {agreement.title}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline">v{agreement.version}</Badge>
            {agreement.accepted ? (
              <Badge variant="success">Accepted</Badge>
            ) : (
              <Badge variant="warning">Action required</Badge>
            )}
          </div>
        </div>
        {agreement.summary && (
          <p className="text-sm text-muted-foreground">{agreement.summary}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="max-h-96 overflow-y-auto rounded-md border border-border bg-muted/20 p-4"
          role="region"
          aria-label={`${label} text`}
          tabIndex={0}
        >
          {agreement.body && agreement.body.length > 0 ? (
            <LegalContentRenderer blocks={agreement.body} />
          ) : agreement.fullText ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {agreement.fullText}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              This agreement has no content yet.
            </p>
          )}
        </div>

        {agreement.accepted ? (
          <div className="flex items-start gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm">
            <BadgeCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="font-medium">Accepted</p>
              <p className="text-muted-foreground">
                Accepted on {formatDate(agreement.acceptedAt)} (version{" "}
                {agreement.version}).
              </p>
            </div>
          </div>
        ) : isSuperAdmin ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDeclineClick}
                  disabled={accepting || declining}
                  className="min-h-[44px] w-full sm:w-auto"
                >
                  <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Decline
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Record that your organization declines this agreement — visitor
                operations stay blocked until you accept
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    type="button"
                    isLoading={accepting}
                    loadingText="Accepting…"
                    onClick={onAccept}
                    disabled={declining}
                    className="min-h-[44px] w-full sm:w-auto"
                  >
                    Accept agreement
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Accept this agreement on behalf of your organization and unblock
                visitor operations
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-4 text-sm">
            <FileText
              className="mt-0.5 h-4 w-4 shrink-0 text-info"
              aria-hidden="true"
            />
            <p className="text-foreground/80">
              Only your super admin can accept this agreement. Ask them to
              review and accept it so your team can continue running visitor
              operations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
