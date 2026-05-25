"use client";

import * as React from "react";
import { ArrowLeft, History, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LegalContentRenderer } from "./legal-content-renderer";
import {
  useLegalDocumentVersion,
  useLegalDocumentVersions,
} from "@/features/legal-documents/hooks/use-legal-documents";

function formatDateTime(unix?: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LegalDocumentVersionsSheet({
  documentId,
  currentVersion,
  open,
  onOpenChange,
}: {
  documentId: string;
  currentVersion?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = React.useState<number | null>(null);

  // Reset the drill-down whenever the sheet closes.
  React.useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const {
    data: versionsData,
    isLoading,
    isError,
    refetch,
  } = useLegalDocumentVersions(open ? documentId : undefined, {
    skip: 0,
    limit: 50,
  });

  const versions = versionsData?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            {selected === null ? "Version history" : `Version ${selected}`}
          </SheetTitle>
          <SheetDescription>
            {selected === null
              ? "Every publish writes an immutable snapshot — the legal audit trail of which terms were in effect, and when."
              : "A read-only snapshot of the published legal text for this version."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto">
          {selected !== null ? (
            <VersionDetail
              documentId={documentId}
              version={selected}
              onBack={() => setSelected(null)}
            />
          ) : isError ? (
            <ErrorState
              title="Couldn't load version history"
              onRetry={() => refetch()}
            />
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          ) : versions.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="No published versions yet"
              description="Publish this document to create the first immutable version."
            />
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSelected(v.version)}
                        className="flex w-full flex-col gap-1 rounded-md border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-medium">
                            Version {v.version}
                            {currentVersion === v.version ? (
                              <Badge variant="success">Live</Badge>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(v.publishedAt ?? v.dateCreated)}
                          </span>
                        </div>
                        {v.changeNote ? (
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {v.changeNote}
                          </span>
                        ) : (
                          <span className="text-sm italic text-muted-foreground">
                            No change note
                          </span>
                        )}
                        {v.effectiveAt ? (
                          <span className="text-xs text-muted-foreground">
                            Effective {formatDateTime(v.effectiveAt)}
                          </span>
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      Open a read-only preview of the legal text published in
                      version {v.version}
                    </TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VersionDetail({
  documentId,
  version,
  onBack,
}: {
  documentId: string;
  version: number;
  onBack: () => void;
}) {
  const { data, isLoading, isError, refetch } = useLegalDocumentVersion(
    documentId,
    version,
  );

  return (
    <div className="space-y-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="min-h-[44px]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            All versions
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Return to the full list of published versions
        </TooltipContent>
      </Tooltip>

      {isError ? (
        <ErrorState
          title="Couldn't load this version"
          onRetry={() => refetch()}
        />
      ) : isLoading || !data ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <article className="space-y-4">
          <header className="space-y-1 border-b border-border pb-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              {data.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              Published {formatDateTime(data.publishedAt ?? data.dateCreated)}
              {data.effectiveAt
                ? ` · Effective ${formatDateTime(data.effectiveAt)}`
                : ""}
            </p>
            {data.changeNote ? (
              <p className="text-sm text-muted-foreground">
                {data.changeNote}
              </p>
            ) : null}
          </header>
          <LegalContentRenderer blocks={data.body} />
        </article>
      )}
    </div>
  );
}
