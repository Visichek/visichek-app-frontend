import { Paperclip, FileText, Image as ImageIcon, FileArchive } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SupportCaseAttachment } from "@/types/support-case";

interface AttachmentChipProps {
  attachment: SupportCaseAttachment;
  /** Called when the user clicks the chip — parent should open a signed download URL. */
  onOpen?: (attachment: SupportCaseAttachment) => void;
  className?: string;
}

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf" || mime.includes("text")) return FileText;
  if (mime.includes("zip") || mime.includes("archive")) return FileArchive;
  return Paperclip;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + " " + sizes[i];
}

export function AttachmentChip({ attachment, onOpen, className }: AttachmentChipProps) {
  const Icon = iconFor(attachment.mimeType);
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate font-medium">{attachment.fileName}</span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {formatSize(attachment.size)}
      </span>
    </>
  );

  const baseClasses = cn(
    "flex min-h-[44px] w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm",
    className,
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(attachment)}
        className={cn(
          baseClasses,
          "cursor-pointer text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
