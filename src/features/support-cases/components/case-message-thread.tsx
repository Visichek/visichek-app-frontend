"use client";

import { ShieldCheck, UserRound, Info, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatRelative } from "@/lib/utils/format-date";
import { AttachmentChip } from "./attachment-chip";
import type {
  SupportCaseMessage,
  SupportCaseAttachment,
} from "@/types/support-case";

/** The case's original description, rendered as the opening bubble of the thread. */
export interface CaseConversationOpening {
  body: string;
  dateCreated: number;
  /** Who opened the case, e.g. a role label or "You". Defaults to "Original request". */
  authorLabel?: string;
}

interface CaseMessageThreadProps {
  messages: SupportCaseMessage[];
  /** When true, yellow-highlighted internal notes are included. Admin-only. */
  showInternalNotes?: boolean;
  onOpenAttachment?: (attachment: SupportCaseAttachment) => void;
  /** Folds the case description in as the first requester bubble. */
  openingRequest?: CaseConversationOpening;
  emptyText?: string;
}

type RenderItem =
  | { kind: "opening"; body: string; dateCreated: number; label: string }
  | { kind: "message"; message: SupportCaseMessage };

/**
 * Grouping lane — consecutive items in the same lane hide the repeated
 * avatar + name header so a back-and-forth reads as grouped runs, not a
 * wall of headers. Internal notes are their own lane so a normal admin
 * reply after a note still shows its header.
 */
function laneOf(item: RenderItem): string {
  if (item.kind === "opening") return "tenant:pub";
  const m = item.message;
  if (m.authorType === "system") return "system";
  return `${m.authorType}:${m.internalNote ? "int" : "pub"}`;
}

export function CaseMessageThread({
  messages,
  showInternalNotes = false,
  onOpenAttachment,
  openingRequest,
  emptyText = "No replies yet.",
}: CaseMessageThreadProps) {
  const visible = (showInternalNotes
    ? messages
    : messages.filter((m) => !m.internalNote)
  ).filter(
    // We render the case description ourselves as `openingRequest`. Guard
    // against the backend ever also returning it as the first message by
    // dropping an exact duplicate (same body + creation time).
    (m) =>
      !(
        openingRequest &&
        m.dateCreated === openingRequest.dateCreated &&
        m.body.trim() === openingRequest.body.trim()
      ),
  );

  const items: RenderItem[] = [];
  if (openingRequest) {
    items.push({
      kind: "opening",
      body: openingRequest.body,
      dateCreated: openingRequest.dateCreated,
      label: openingRequest.authorLabel ?? "Original request",
    });
  }
  for (const m of visible) items.push({ kind: "message", message: m });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <ol className="space-y-2" aria-label="Case conversation thread">
      {items.map((item, i) => {
        const showHeader = i === 0 || laneOf(items[i - 1]) !== laneOf(item);

        if (item.kind === "message" && item.message.authorType === "system") {
          const m = item.message;
          return (
            <li
              key={m.id ?? m._id}
              className="my-3 flex items-center gap-2 px-2 text-xs text-muted-foreground"
            >
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{m.body}</span>
              <time
                dateTime={String(m.dateCreated)}
                title={formatDateTime(m.dateCreated)}
              >
                {formatRelative(m.dateCreated)}
              </time>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
            </li>
          );
        }

        if (item.kind === "opening") {
          return (
            <ConversationBubble
              key="opening-request"
              side="user"
              tone="user"
              showHeader={showHeader}
              authorName={item.label}
              dateCreated={item.dateCreated}
              body={item.body}
            />
          );
        }

        const m = item.message;
        const isAdmin = m.authorType === "admin";
        return (
          <ConversationBubble
            key={m.id ?? m._id}
            side={isAdmin ? "admin" : "user"}
            tone={m.internalNote ? "internal" : isAdmin ? "admin" : "user"}
            showHeader={showHeader}
            authorName={
              isAdmin
                ? "VisiChek Support"
                : m.authorRole
                  ? formatRole(String(m.authorRole))
                  : "You"
            }
            dateCreated={m.dateCreated}
            body={m.body}
            internalNote={m.internalNote}
            attachments={m.attachments}
            onOpenAttachment={onOpenAttachment}
          />
        );
      })}
    </ol>
  );
}

function ConversationBubble({
  side,
  tone,
  showHeader,
  authorName,
  dateCreated,
  body,
  internalNote = false,
  attachments = [],
  onOpenAttachment,
}: {
  side: "admin" | "user";
  tone: "admin" | "user" | "internal";
  showHeader: boolean;
  authorName: string;
  dateCreated: number;
  body: string;
  internalNote?: boolean;
  attachments?: SupportCaseAttachment[];
  onOpenAttachment?: (attachment: SupportCaseAttachment) => void;
}) {
  const isUser = side === "user";
  return (
    <li className="flex w-full">
      <div
        className={cn(
          "flex max-w-[88%] gap-2 md:max-w-[78%]",
          isUser ? "ml-auto flex-row-reverse" : "mr-auto flex-row",
        )}
      >
        {showHeader ? (
          <Avatar tone={tone} />
        ) : (
          <span className="w-8 shrink-0" aria-hidden="true" />
        )}

        <div className="flex min-w-0 flex-col gap-1">
          {showHeader ? (
            <div
              className={cn(
                "flex items-center gap-2 text-xs",
                isUser && "flex-row-reverse",
              )}
            >
              <span className="font-semibold text-foreground">{authorName}</span>
              <time
                className="text-muted-foreground"
                dateTime={String(dateCreated)}
                title={formatDateTime(dateCreated)}
              >
                {formatRelative(dateCreated)}
              </time>
              {internalNote && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                  Internal note
                </span>
              )}
            </div>
          ) : (
            // Grouped run — keep author + time off-screen so assistive tech
            // still attributes each bubble even though the header is hidden.
            <span className="sr-only">
              {authorName}, {formatRelative(dateCreated)}
            </span>
          )}

          <div
            className={cn(
              "flex flex-col gap-2 rounded-lg border px-3 py-2",
              tone === "internal"
                ? "border-warning/50 bg-warning/10"
                : tone === "admin"
                  ? "border-border bg-muted/40"
                  : "border-primary/20 bg-primary/5",
            )}
          >
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {body}
            </p>

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att) => (
                  <AttachmentChip
                    key={att.objectKey}
                    attachment={att}
                    onOpen={onOpenAttachment}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Avatar({ tone }: { tone: "admin" | "user" | "internal" }) {
  if (tone === "admin" || tone === "internal") {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <ShieldCheck className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-hidden="true"
    >
      <UserRound className="h-4 w-4" />
    </span>
  );
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
