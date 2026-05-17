"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Edit2,
  Trash2,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { DataTable } from "@/components/recipes/data-table";
import { DropdownMenuNavItem } from "@/components/recipes/dropdown-menu-nav-item";
import { NavButton } from "@/components/recipes/nav-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useBlogs, useDeleteBlog } from "@/features/blog/hooks/use-blogs";
import {
  BLOG_CATEGORIES,
  BLOG_TYPES,
  type BlogListItem,
} from "@/types/blog";
import { resolveDocumentUrl } from "@/lib/utils/document-url";

const NEW_BLOG_HREF = "/admin/blogs/new";

function editHref(id: string) {
  return `/admin/blogs/${id}/edit`;
}

type StateTab = "all" | "draft" | "published";

const STATE_TABS: { value: StateTab; label: string; description: string }[] = [
  {
    value: "all",
    label: "All",
    description: "Every article across all states — drafts and published",
  },
  {
    value: "published",
    label: "Published",
    description: "Articles currently live on the public website",
  },
  {
    value: "draft",
    label: "Drafts",
    description: "Unpublished drafts — only visible to admins",
  },
];

function formatDate(unix?: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const BLOGS_PAGE_SIZE = 25;

export function BlogsPageClient() {
  const { loadingHref } = useNavigationLoading();
  const [stateTab, setStateTab] = useState<StateTab>("all");
  const [deleteTarget, setDeleteTarget] = useState<BlogListItem | undefined>();
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [stateTab]);

  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * BLOGS_PAGE_SIZE,
      limit: BLOGS_PAGE_SIZE,
      sort: "-dateCreated",
      facets: "state",
    };
    if (stateTab !== "all") params.state = stateTab;
    return params;
  }, [pageIndex, stateTab]);

  const { data, isLoading } = useBlogs(listFilters);
  const blogs = data?.items ?? [];
  const meta = data?.meta;

  const counts = useMemo(() => {
    const facet = meta?.facets?.state ?? {};
    return {
      all: meta?.total ?? 0,
      draft: facet.draft ?? 0,
      published: facet.published ?? 0,
    };
  }, [meta]);

  const deleteMutation = useDeleteBlog();

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Blog deleted");
      setDeleteTarget(undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete blog");
    }
  }

  const columns: ColumnDef<BlogListItem>[] = [
    {
      id: "article",
      header: "Article",
      cell: ({ row }) => {
        const blog = row.original;
        const category =
          BLOG_CATEGORIES.find((c) => c.slug === blog.category?.slug)?.name ??
          blog.category?.name ??
          "—";
        return (
          <div className="flex items-start gap-3">
            {blog.featureImage?.url ? (
              <Image
                src={resolveDocumentUrl(blog.featureImage.url) ?? blog.featureImage.url}
                alt={blog.featureImage.altText ?? ""}
                width={64}
                height={48}
                className="h-12 w-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="h-12 w-16 shrink-0 rounded-md bg-muted" />
            )}
            <div className="min-w-0">
              <p className="font-medium leading-tight">
                {blog.title || <span className="text-muted-foreground italic">Untitled</span>}
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {category} · by {blog.author?.name ?? "—"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "blogType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">
          {BLOG_TYPES.find((t) => t.value === row.original.blogType)?.label ??
            row.original.blogType}
        </Badge>
      ),
    },
    {
      id: "state",
      header: "State",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.state === "published" ? "success" : "secondary"
          }
        >
          {row.original.state}
        </Badge>
      ),
    },
    {
      id: "updated",
      header: "Updated",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.lastUpdated ?? row.original.dateCreated)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Blog actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Open actions for this blog post</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuNavItem
              href={editHref(row.original.id)}
              label="Edit"
              icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
              description="Open the editor to write or update this article"
            />
            <DropdownMenuItem
              onSelect={() => setDeleteTarget(row.original)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableHiding: false,
    },
  ];

  const mobileCard = (blog: BlogListItem) => (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {blog.featureImage?.url ? (
          <Image
            src={resolveDocumentUrl(blog.featureImage.url) ?? blog.featureImage.url}
            alt={blog.featureImage.altText ?? ""}
            width={80}
            height={64}
            className="h-16 w-20 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="h-16 w-20 shrink-0 rounded-md bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium">
            {blog.title || (
              <span className="text-muted-foreground italic">Untitled</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {blog.author?.name ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Badge variant={blog.state === "published" ? "success" : "secondary"}>
          {blog.state}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuNavItem
              href={editHref(blog.id)}
              label="Edit"
              icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
            />
            <DropdownMenuItem
              onSelect={() => setDeleteTarget(blog)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const isNavigatingNew = loadingHref === NEW_BLOG_HREF;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog"
        description="Write, edit, and publish articles for the public website"
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={NEW_BLOG_HREF}
                className="w-full md:w-auto min-h-[44px]"
              >
                {isNavigatingNew ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                New article
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the editor to start writing a new article from scratch
            </TooltipContent>
          </Tooltip>
        }
      />

      <Tabs
        value={stateTab}
        onValueChange={(v) => setStateTab(v as StateTab)}
      >
        <TabsList className="flex w-full flex-wrap gap-1 h-auto md:w-auto">
          {STATE_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-[44px]"
              title={tab.description}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">
                {counts[tab.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={blogs}
        isLoading={isLoading}
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: BLOGS_PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        searchKey="article"
        searchPlaceholder="Search articles by title…"
        emptyTitle={
          stateTab === "published"
            ? "No published articles yet"
            : stateTab === "draft"
              ? "No drafts"
              : "No articles yet"
        }
        emptyDescription={
          stateTab === "published"
            ? "Publish a draft to make it appear on the public site."
            : stateTab === "draft"
              ? "Drafts you create will show up here until they are published."
              : "Start by writing your first article."
        }
        mobileCard={mobileCard}
        getRowId={(blog) => blog.id}
        itemNoun="article"
        getRowHref={(blog) => `/admin/blogs/${blog.id}/edit`}
        rowClickAriaLabel={(blog) => `Edit article ${blog.title ?? "untitled draft"}`}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
        title="Delete article?"
        description={
          deleteTarget?.title
            ? `Permanently delete "${deleteTarget.title}". This cannot be undone.`
            : "Permanently delete this draft. This cannot be undone."
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />

    </div>
  );
}
