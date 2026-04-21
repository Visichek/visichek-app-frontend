"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { uploadSupportCaseAttachment } from "@/features/support-cases/lib/upload-attachment";
import type { SupportCaseAttachment } from "@/types/support-case";

const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB per file

export interface ReplyComposerValues {
  body: string;
  attachments: SupportCaseAttachment[];
  internalNote?: boolean;
}

interface ReplyComposerProps {
  caseId: string;
  onSubmit: (values: ReplyComposerValues) => Promise<void> | void;
  isSubmitting?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** When true, expose the "Internal note" checkbox (admin console only). */
  allowInternalNote?: boolean;
  placeholder?: string;
  submitLabel?: string;
}

export function ReplyComposer({
  caseId,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  disabledReason,
  allowInternalNote = false,
  placeholder = "Write your reply…",
  submitLabel = "Send reply",
}: ReplyComposerProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<SupportCaseAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = isSubmitting || isUploading;
  const canSubmit =
    !busy && !disabled && body.trim().length > 0;

  const handlePickFiles = () => {
    if (busy || disabled) return;
    fileInputRef.current?.click();
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);

    if (attachments.length + incoming.length > MAX_ATTACHMENTS) {
      toast.error(`You can attach at most ${MAX_ATTACHMENTS} files per message.`);
      return;
    }

    const tooBig = incoming.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" exceeds the 20MB per-file limit.`);
      return;
    }

    setIsUploading(true);
    try {
      const uploaded: SupportCaseAttachment[] = [];
      for (const file of incoming) {
        const att = await uploadSupportCaseAttachment(caseId, file);
        uploaded.push(att);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(
        uploaded.length === 1
          ? "Attachment ready"
          : `${uploaded.length} attachments ready`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (objectKey: string) => {
    setAttachments((prev) => prev.filter((a) => a.objectKey !== objectKey));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      body: body.trim(),
      attachments,
      internalNote: allowInternalNote ? isInternalNote : undefined,
    });
    setBody("");
    setAttachments([]);
    setIsInternalNote(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden="true"
        onChange={(e) => handleFiles(e.currentTarget.files)}
      />

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={disabled || busy}
        aria-label="Reply message"
      />

      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.objectKey}
              className="flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 truncate">{att.fileName}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.objectKey)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Remove ${att.fileName}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Remove this attachment from your reply before sending
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePickFiles}
                disabled={disabled || busy || attachments.length >= MAX_ATTACHMENTS}
                className="min-h-[44px]"
              >
                <Paperclip className="mr-2 h-4 w-4" aria-hidden="true" />
                Attach file{attachments.length > 0 ? ` (${attachments.length}/${MAX_ATTACHMENTS})` : ""}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Upload files to attach to your reply. Up to {MAX_ATTACHMENTS} files, 20MB each.
            </TooltipContent>
          </Tooltip>

          {allowInternalNote && (
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    disabled={disabled || busy}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span>Internal note</span>
                </label>
              </TooltipTrigger>
              <TooltipContent side="top">
                Internal notes are visible to other admins only — the tenant will not see them
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                loadingText="Sending…"
                disabled={!canSubmit}
                className="w-full md:w-auto"
              >
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                {submitLabel}
              </LoadingButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {disabled
              ? disabledReason || "Replies are disabled for this case"
              : "Send your reply to the conversation"}
          </TooltipContent>
        </Tooltip>
      </div>
    </form>
  );
}
