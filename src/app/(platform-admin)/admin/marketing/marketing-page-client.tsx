"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Loader2,
  Mail,
  Megaphone,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/recipes/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useMarketingOptIns } from "@/features/onboarding/hooks";

const BACK_HREF = "/admin/tenants/onboarding";

// Most mail clients silently truncate or fail on absurdly long mailto URLs;
// past ~100 recipients we point the user to the bulk-copy buttons instead.
const MAILTO_RECIPIENT_CAP = 100;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function buildCsv(emails: string[]): string {
  // Single-column CSV with a header row. Emails are already normalized
  // server-side (lowercased, trimmed) and contain no commas, so no quoting
  // is necessary.
  return ["email", ...emails].join("\n");
}

function downloadCsv(emails: string[]) {
  const blob = new Blob([buildCsv(emails)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `visichek-marketing-opt-ins-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function MarketingPageClient() {
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const { data, isLoading, isError, error, refetch } = useMarketingOptIns();
  const [search, setSearch] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  const allEmails = useMemo(() => data?.emails ?? [], [data]);
  const total = data?.total ?? allEmails.length;

  const visibleEmails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allEmails;
    return allEmails.filter((e) => e.includes(q));
  }, [allEmails, search]);

  async function handleCopyAll() {
    if (allEmails.length === 0) return;
    const ok = await copyToClipboard(allEmails.join(", "));
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
      toast.success(
        `Copied ${allEmails.length} email${allEmails.length === 1 ? "" : "s"} — paste into BCC.`,
      );
    } else {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  async function handleCopyRow(email: string) {
    const ok = await copyToClipboard(email);
    if (ok) {
      setCopiedRow(email);
      setTimeout(
        () => setCopiedRow((current) => (current === email ? null : current)),
        2000,
      );
    } else {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  function handleDownloadCsv() {
    if (allEmails.length === 0) return;
    downloadCsv(allEmails);
    toast.success(`Downloading CSV with ${allEmails.length} email${allEmails.length === 1 ? "" : "s"}.`);
  }

  const mailtoHref =
    allEmails.length > 0 && allEmails.length <= MAILTO_RECIPIENT_CAP
      ? `mailto:?bcc=${encodeURIComponent(allEmails.join(","))}`
      : null;

  return (
    <div className="space-y-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-2 min-h-[44px]"
          >
            <Link href={BACK_HREF} onClick={() => handleNavClick(BACK_HREF)}>
              {loadingHref === BACK_HREF ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to onboarding queue
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Return to the onboarding queue to review individual submissions
        </TooltipContent>
      </Tooltip>

      <PageHeader
        title="Marketing opt-ins"
        description="Deduplicated, normalized work emails of every onboarding lead who consented to product updates. Use this list to compose campaign recipient lists — opting in stays valid even if the tenant application was later rejected."
      />

      {!isLoading && !isError && (
        <div>
          <Badge
            variant="secondary"
            className="gap-1.5 whitespace-nowrap px-3 py-1 text-sm"
          >
            <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
            {total} {total === 1 ? "email" : "emails"}
          </Badge>
        </div>
      )}

      {isError ? (
        <ErrorState
          title="Couldn't load marketing opt-ins"
          message={
            (error as Error)?.message ??
            "The export endpoint returned an error. Try again in a moment."
          }
          error={error}
          onRetry={() => refetch()}
        />
      ) : !isLoading && allEmails.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="No marketing opt-ins yet"
          description="Once leads tick the marketing-consent box on the public onboarding form, their emails will land here."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter emails…"
                aria-label="Filter marketing opt-in emails"
                className="pl-9 text-base md:text-sm"
                disabled={isLoading}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:flex-nowrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleCopyAll}
                    disabled={isLoading || allEmails.length === 0}
                    className="min-h-[44px] w-full md:w-auto"
                  >
                    {copiedAll ? (
                      <Check
                        className="mr-2 h-4 w-4 text-emerald-500"
                        aria-hidden="true"
                      />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {copiedAll ? "Copied" : "Copy all (BCC)"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Copy every opt-in email as a comma-separated list, ready to
                  paste into the BCC field of your mail client
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleDownloadCsv}
                    disabled={isLoading || allEmails.length === 0}
                    className="min-h-[44px] w-full md:w-auto"
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Download CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Download a single-column CSV of the full opt-in list for
                  upload into a mail-merge tool
                </TooltipContent>
              </Tooltip>

              {mailtoHref ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild className="min-h-[44px] w-full md:w-auto">
                      <a href={mailtoHref}>
                        <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                        Open in mail
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Open your default mail client with every opt-in pre-filled
                    in the BCC field
                  </TooltipContent>
                </Tooltip>
              ) : allEmails.length > MAILTO_RECIPIENT_CAP ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        disabled
                        className="min-h-[44px] w-full md:w-auto"
                      >
                        <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                        Open in mail
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Too many recipients ({allEmails.length}) for a mailto link —
                    use Copy all (BCC) or Download CSV instead
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 w-full animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                <span>
                  Showing {visibleEmails.length} of {total}
                </span>
                {search && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSearch("")}
                      >
                        Clear filter
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Clear the email filter and show every recipient again
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {visibleEmails.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No emails match &ldquo;{search}&rdquo;.
                </div>
              ) : (
                <ul className="divide-y">
                  {visibleEmails.map((email) => {
                    const isCopied = copiedRow === email;
                    return (
                      <li
                        key={email}
                        className="flex items-center justify-between gap-2 px-4 py-3"
                      >
                        <span className="truncate font-mono text-sm">
                          {email}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => handleCopyRow(email)}
                              aria-label={
                                isCopied
                                  ? `Copied ${email}`
                                  : `Copy ${email}`
                              }
                            >
                              {isCopied ? (
                                <Check
                                  className="h-4 w-4 text-emerald-500"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Copy
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isCopied
                              ? "Copied to clipboard"
                              : "Copy this email to the clipboard"}
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
