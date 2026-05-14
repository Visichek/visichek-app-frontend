"use client";

import * as React from "react";
import {
  Upload,
  Image as ImageIcon,
  Video,
  Trash2,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/recipes/page-header";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  useMediaList,
  useCreateMedia,
  useDeleteMedia,
} from "@/features/blog/hooks/use-media";
import { BLOG_CATEGORIES, type MediaItem, type MediaType } from "@/types/blog";

type TypeTab = "all" | MediaType;

const TYPE_TABS: { value: TypeTab; label: string; description: string }[] = [
  {
    value: "all",
    label: "All media",
    description: "Every image and video in the library",
  },
  {
    value: "image",
    label: "Images",
    description: "Photos, illustrations, and graphics",
  },
  {
    value: "video",
    label: "Videos",
    description: "MP4, MOV, WebM, and other clip formats",
  },
];

export function MediaPageClient() {
  const [typeTab, setTypeTab] = React.useState<TypeTab>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [uploadCategory, setUploadCategory] = React.useState<string>(
    BLOG_CATEGORIES[0].name,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<MediaItem | undefined>();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const params = React.useMemo(() => {
    const p: Record<string, unknown> = {
      skip: 0,
      limit: 60,
      sort: "-dateCreated",
      facets: "mediaType",
    };
    if (typeTab !== "all") p.mediaType = typeTab;
    if (categoryFilter !== "all") p.category = categoryFilter;
    return p;
  }, [typeTab, categoryFilter]);

  const { data, isLoading } = useMediaList(params);
  const items = data?.items ?? [];

  const createMutation = useCreateMedia();
  const deleteMutation = useDeleteMedia();

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await createMutation.mutateAsync({ file, category: uploadCategory });
      toast.success("Media uploaded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload media",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Media deleted");
      setDeleteTarget(undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function copyUrl(item: MediaItem) {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedId(item.id);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1500);
    } catch {
      toast.error("Couldn't copy URL — check clipboard permissions");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media library"
        description="Images and videos used across blog articles"
        actions={
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger className="min-h-[44px] w-44">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  The category the next uploaded file will be assigned to
                </TooltipContent>
              </Tooltip>
              <SelectContent>
                {BLOG_CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChosen}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={createMutation.isPending}
                  className="min-h-[44px]"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Upload a new image or video to the library and tag it with the
                selected category
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={typeTab}
          onValueChange={(v) => setTypeTab(v as TypeTab)}
        >
          <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
            {TYPE_TABS.map((tab) => (
              <Tooltip key={tab.value}>
                <TooltipTrigger asChild>
                  <TabsTrigger value={tab.value} className="min-h-[44px]">
                    {tab.label}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {tab.description}
                </TooltipContent>
              </Tooltip>
            ))}
          </TabsList>
        </Tabs>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger className="min-h-[44px] md:w-56">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Filter the media grid by category
            </TooltipContent>
          </Tooltip>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {BLOG_CATEGORIES.map((c) => (
              <SelectItem key={c.slug} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-8 w-8" />}
          title="No media yet"
          description="Upload your first image or video to use in articles."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onCopy={() => copyUrl(item)}
              onDelete={() => setDeleteTarget(item)}
              copied={copiedId === item.id}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title="Delete media?"
        description={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}". Articles that embed this file will keep their URL, but the library entry will be gone.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function MediaCard({
  item,
  onCopy,
  onDelete,
  copied,
}: {
  item: MediaItem;
  onCopy: () => void;
  onDelete: () => void;
  copied: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-square w-full bg-muted">
        {item.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <video
              src={item.url}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
              onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
            <Video className="absolute h-6 w-6 text-white/90 drop-shadow" />
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="line-clamp-1 text-sm font-medium" title={item.name}>
          {item.name}
        </p>
        <div className="flex items-center justify-between gap-1">
          <Badge variant="outline" className="text-[10px]">
            {item.category}
          </Badge>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onCopy}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Copy URL"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Copy the public URL of this media to your clipboard
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete media"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Remove this media row from the library
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
