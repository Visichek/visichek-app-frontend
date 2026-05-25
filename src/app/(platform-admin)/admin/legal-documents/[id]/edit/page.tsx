"use client";

import { use } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ErrorState } from "@/components/feedback/error-state";
import { NavButton } from "@/components/recipes/nav-button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useLegalDocument } from "@/features/legal-documents/hooks/use-legal-documents";
import { LegalDocumentForm } from "@/features/legal-documents/components/legal-document-form";

const BACK_HREF = "/admin/legal-documents";

export default function EditLegalDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { loadingHref } = useNavigationLoading();
  const { data, isLoading, isError, refetch } = useLegalDocument(id);

  if (isError || (!isLoading && !data)) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={BACK_HREF}
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
              >
                {loadingHref === BACK_HREF ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to legal documents
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Return to the legal documents list
            </TooltipContent>
          </Tooltip>
          <ErrorState
            title="Couldn't load this document"
            message="It may have been deleted, or your connection dropped."
            onRetry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-12 w-3/4 animate-pulse rounded-md bg-muted" />
          <div className="h-72 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <LegalDocumentForm document={data} />
    </div>
  );
}
