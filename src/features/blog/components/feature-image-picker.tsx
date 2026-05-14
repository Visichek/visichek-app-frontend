"use client";

import * as React from "react";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useUploadMediaFile } from "@/features/blog/hooks/use-media";
import { resolveDocumentUrl } from "@/lib/utils/document-url";
import type { MediaAsset } from "@/types/blog";

interface FeatureImagePickerProps {
  value: MediaAsset | null | undefined;
  onChange: (asset: MediaAsset | null) => void;
}

export function FeatureImagePicker({ value, onChange }: FeatureImagePickerProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const upload = useUploadMediaFile();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload.mutateAsync(file);
      onChange({ url: result.url, altText: value?.altText ?? "" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload feature image",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {value?.url ? (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveDocumentUrl(value.url) ?? value.url}
              alt={value.altText || "Feature image"}
              className="block aspect-[16/9] w-full object-cover"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="absolute right-2 top-2 inline-flex items-center justify-center rounded-md bg-background/90 p-1.5 text-foreground shadow hover:bg-background"
                  aria-label="Remove feature image"
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Remove the feature image so this blog has no cover
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            value={value.altText}
            onChange={(e) =>
              onChange({ url: value.url, altText: e.target.value })
            }
            placeholder="Image alt text (describe the image for screen readers)"
            className="text-base md:text-sm"
          />
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
                    Replacing…
                  </>
                ) : (
                  "Replace image"
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Pick a different image to use as the article cover
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {upload.isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {upload.isPending ? "Uploading feature image…" : "Add a feature image"}
          </span>
          <span className="text-xs text-muted-foreground">
            JPG, PNG, GIF, or WebP. Used as the cover of this article.
          </span>
        </button>
      )}
    </div>
  );
}
