"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useUploadMediaFile } from "@/features/blog/hooks/use-media";
import { resolveDocumentUrl } from "@/lib/utils/document-url";

interface AuthorAvatarPickerProps {
  value: string;
  onChange: (url: string) => void;
}

export function AuthorAvatarPicker({ value, onChange }: AuthorAvatarPickerProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const upload = useUploadMediaFile();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload.mutateAsync(file);
      onChange(result.url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload avatar",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const hasAvatar = value.trim().length > 0;
  const previewSrc = hasAvatar ? (resolveDocumentUrl(value) ?? value) : null;

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
        {previewSrc ? (
          <Image
            src={previewSrc}
            alt="Author avatar"
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <UserIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
              className="min-h-[44px]"
            >
              {upload.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : hasAvatar ? (
                "Replace avatar"
              ) : (
                "Upload avatar"
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {hasAvatar
              ? "Pick a different image to use as the author avatar"
              : "Upload a JPG, PNG, GIF, or WebP image to use as the author avatar"}
          </TooltipContent>
        </Tooltip>

        {hasAvatar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange("")}
                disabled={upload.isPending}
                className="min-h-[44px] text-muted-foreground"
              >
                <X className="mr-1 h-4 w-4" />
                Remove
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Clear the avatar so the author appears without a picture
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
