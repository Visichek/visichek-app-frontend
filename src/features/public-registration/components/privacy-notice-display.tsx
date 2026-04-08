"use client";

import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicPrivacyNotice } from "@/types/public";

interface PrivacyNoticeDisplayProps {
  notice: PublicPrivacyNotice;
}

/**
 * Read-only display of the tenant's privacy notice.
 * Shown before meaningful data capture on the public registration form.
 */
export function PrivacyNoticeDisplay({ notice }: PrivacyNoticeDisplayProps) {
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
        {notice.full_text && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-info hover:underline">
              Read full privacy notice
            </summary>
            <div className="mt-2 rounded-md bg-background p-3 text-sm leading-relaxed text-foreground/70">
              {notice.full_text}
            </div>
          </details>
        )}
        {notice.version_id && (
          <p className="text-xs text-muted-foreground">
            Notice version: {notice.version_id}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
