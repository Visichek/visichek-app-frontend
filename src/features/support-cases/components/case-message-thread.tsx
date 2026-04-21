"use client";

import { ShieldCheck, UserRound, Info, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format-date";
import { AttachmentChip } from "./attachment-chip";
import type {
  SupportCaseMessage,
  SupportCaseAttachment,
} from "@/types/support-case";

interface CaseMessageThreadProps {
  messages: SupportCaseMessage[];
  /** When true, yellow-highlighted internal notes are included. Admin-only. */
  showInternalNotes?: boolean;
  onOpenAttachment?: (attachment: SupportCaseAttachment) => void;
  emptyText?: string;
}

export function CaseMessageThread({
  messages,
  showInternalNotes = false,
  onOpenAttachment,
  emptyText = "No replies yet.",
}: CaseMessageThreadProps) {
  const visible = showInternalNotes
    ? messages
    : messages.filter((m) => !m.internalNote);

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <ol className="space-y-4" aria-label="Case conversation thread">
      {visible.map((msg) => (
        <CaseMessageItem
          key={msg.id ?? msg._id}
          message={msg}
          onOpenAttachment={onOpenAttachment}
        />
      ))}
    </ol>
  );
}

function CaseMessageItem({
  message,
  onOpenAttachment,
}: {
  message: SupportCaseMessage;
  onOpenAttachment?: (attachment: SupportCaseAttachment) => void;
}) {
  // System messages are full-width event rows
  if (message.authorType === "system") {
    return (
      <li className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{message.body}</span>
        <time className="shrink-0" dateTime={String(message.dateCreated)}>
          {formatDateTime(message.dateCreated)}
        </time>
      </li>
    );
  }

  const isAdmin = message.authorType === "admin";
  const isInternal = message.internalNote;

  return (
    <li
      className={cn(
        "flex w-full",
        isAdmin ? "justify-start" : "justify-end",
      )}
    >
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2 rounded-lg border p-3 md:max-w-[70%]",
          isInternal
            ? "border-warning/50 bg-warning/10"
            : isAdmin
              ? "border-border bg-muted/30"
              : "border-primary/20 bg-primary/5",
        )}
      >
        <div className="flex items-center gap-2 text-xs">
          {isAdmin ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-foreground">VisiChek Support</span>
            </>
          ) : (
            <>
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-semibold text-foreground">
                {message.authorRole ? formatRole(String(message.authorRole)) : "You"}
              </span>
            </>
          )}
          {isInternal && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
              <EyeOff className="h-3 w-3" aria-hidden="true" />
              Internal note
            </span>
          )}
          <time
            className="ml-auto text-muted-foreground"
            dateTime={String(message.dateCreated)}
          >
            {formatDateTime(message.dateCreated)}
          </time>
        </div>

        <p className="whitespace-pre-wrap text-sm text-foreground">{message.body}</p>

        {message.attachments.length > 0 && (
          <div className="space-y-1.5">
            {message.attachments.map((att) => (
              <AttachmentChip
                key={att.objectKey}
                attachment={att}
                onOpen={onOpenAttachment}
              />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
