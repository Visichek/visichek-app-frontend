"use client";

import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalContentRenderer } from "@/features/legal-documents/components/legal-content-renderer";
import type { PublicPrivacyNotice } from "@/types/public";

interface PrivacyNoticeDisplayProps {
  notice: PublicPrivacyNotice;
}

/**
 * Read-only display of the tenant's privacy notice.
 * Shown before meaningful data capture on the public registration form.
 */
export function PrivacyNoticeDisplay({ notice }: PrivacyNoticeDisplayProps) {
  // `body` is the canonical rich copy; `fullText` is the plain-text fallback
  // for notices that predate the BlockNote migration.
  const hasBody = !!notice.body && notice.body.length > 0;

  return (
    <Card className="border-info/30 bg-info/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-info" aria-hidden="true" />
          <CardTitle className="text-base font-semibold">{notice.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notice.summary && (
          <p className="text-sm leading-relaxed text-foreground/80">
            {notice.summary}
          </p>
        )}
        {(hasBody || notice.fullText) && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-info hover:underline">
              Read full privacy notice
            </summary>
            <div className="mt-2 rounded-md bg-background p-3 text-sm leading-relaxed text-foreground/70">
              {hasBody ? (
                <LegalContentRenderer blocks={notice.body} />
              ) : (
                <p className="whitespace-pre-wrap">{notice.fullText}</p>
              )}
            </div>
          </details>
        )}
        {notice.versionId && (
          <p className="text-xs text-muted-foreground">
            Notice version: {notice.versionId}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
