"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  Globe,
  Loader2,
  Save,
  Settings2,
  FileText,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { NavButton } from "@/components/recipes/nav-button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { BlockEditor } from "@/features/blog/components/block-editor";
import { FeatureImagePicker } from "@/features/blog/components/feature-image-picker";
import { AuthorAvatarPicker } from "@/features/blog/components/author-avatar-picker";
import {
  useCreateBlog,
  useUpdateBlog,
} from "@/features/blog/hooks/use-blogs";
import {
  blockText,
  deriveExcerpt,
  normalizeBlocks,
} from "@/features/blog/lib/blocks";
import {
  BLOG_CATEGORIES,
  BLOG_TYPES,
  type Author,
  type Block,
  type Blog,
  type BlogState,
  type BlogType,
  type CategoryEntry,
  type MediaAsset,
} from "@/types/blog";

interface BlogFormProps {
  blog?: Blog;
}

interface FormState {
  title: string;
  authorName: string;
  authorAvatarUrl: string;
  categorySlug: string;
  blogType: BlogType;
  excerpt: string;
  featureImage: MediaAsset | null;
  body: Block[];
  state: BlogState;
}

function initialFromBlog(blog: Blog | undefined): FormState {
  return {
    title: blog?.title ?? "",
    authorName: blog?.author?.name ?? "",
    authorAvatarUrl: blog?.author?.avatarUrl ?? "",
    categorySlug: blog?.category?.slug ?? BLOG_CATEGORIES[0].slug,
    blogType: blog?.blogType ?? "normal",
    excerpt: blog?.excerpt ?? "",
    featureImage: blog?.featureImage ?? null,
    body: normalizeBlocks(blog?.currentPageBody),
    state: blog?.state ?? "draft",
  };
}

export function BlogForm({ blog }: BlogFormProps) {
  const router = useRouter();
  const { loadingHref } = useNavigationLoading();
  const isEdit = !!blog;

  const [state, setState] = React.useState<FormState>(() =>
    initialFromBlog(blog),
  );
  const [metaOpen, setMetaOpen] = React.useState(false);

  const createMutation = useCreateBlog();
  const updateMutation = useUpdateBlog(blog?.id ?? "");

  const categoryEntry: CategoryEntry =
    BLOG_CATEGORIES.find((c) => c.slug === state.categorySlug) ??
    BLOG_CATEGORIES[0];

  const author: Author = {
    name: state.authorName.trim(),
    avatarUrl: state.authorAvatarUrl.trim() || null,
  };

  /** Validate form prior to submit. Returns the first error message. */
  function validate(target: BlogState): string | null {
    if (!state.title.trim()) return "Title is required";
    if (!author.name) return "Author name is required";
    if (!categoryEntry) return "Pick a category";
    if (target === "published") {
      const hasContent = state.body.some(
        (b) =>
          (b.type === "image" || b.type === "video") && b.props?.url
            ? true
            : blockText(b).trim().length > 0,
      );
      if (!hasContent)
        return "Add some content before publishing — write at least one block";
    }
    return null;
  }

  async function submit(target: BlogState) {
    const err = validate(target);
    if (err) {
      toast.error(err);
      return;
    }

    const computedExcerpt = state.excerpt.trim() || deriveExcerpt(state.body);

    try {
      if (isEdit && blog) {
        const wasPublished = blog.state === "published";
        await updateMutation.mutateAsync({
          title: state.title.trim(),
          author,
          category: categoryEntry,
          blogType: state.blogType,
          featureImage: state.featureImage,
          excerpt: computedExcerpt,
          currentPageBody: state.body,
          state: target,
          ...(target === "published" && !wasPublished
            ? { publishDate: Math.floor(Date.now() / 1000) }
            : {}),
        });
        toast.success(
          target === "published"
            ? "Blog published"
            : target === "draft" && wasPublished
              ? "Reverted to draft"
              : "Draft saved",
        );
      } else {
        const created = await createMutation.mutateAsync({
          title: state.title.trim(),
          author,
          category: categoryEntry,
          blogType: state.blogType,
          featureImage: state.featureImage,
          currentPageBody: state.body,
        });
        toast.success("Draft created");

        // If the caller asked for an immediate publish, run a second update.
        if (target === "published" && created?.id) {
          await updateMutation.mutateAsync({
            state: "published",
            publishDate: Math.floor(Date.now() / 1000),
          });
          toast.success("Blog published");
        }
        if (created?.id) {
          router.push(`/admin/blogs/${created.id}/edit`);
          return;
        }
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save this blog post",
      );
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const backHref = "/admin/blogs";

  return (
    <div className="space-y-6">
      {/* Top toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={backHref}
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
              >
                {loadingHref === backHref ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to blogs
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Return to the blog list without saving any unsaved changes
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-2">
            <Badge
              variant={state.state === "published" ? "success" : "secondary"}
            >
              {state.state === "published" ? "Published" : "Draft"}
            </Badge>
            <Badge variant="outline">{categoryEntry.name}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMetaOpen(true)}
                className="min-h-[44px]"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Article settings
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Edit the article metadata — author, category, type, feature image, and excerpt
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => submit("draft")}
                isLoading={isPending}
                className="min-h-[44px]"
              >
                <Save className="mr-2 h-4 w-4" />
                {state.state === "published" ? "Save & unpublish" : "Save draft"}
              </LoadingButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {state.state === "published"
                ? "Save changes and revert the article back to draft state"
                : "Save your work as a draft. Drafts are not visible on the public site."}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <LoadingButton
                type="button"
                size="sm"
                onClick={() => submit("published")}
                isLoading={isPending}
                className="min-h-[44px]"
              >
                <Globe className="mr-2 h-4 w-4" />
                {state.state === "published" ? "Update" : "Publish"}
              </LoadingButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {state.state === "published"
                ? "Save changes and keep this blog post live on the public site"
                : "Save and publish this blog post so it appears on the public site"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Editor canvas */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 md:px-6">
          <Input
            value={state.title}
            onChange={(e) =>
              setState((s) => ({ ...s, title: e.target.value }))
            }
            placeholder="Article title"
            className="h-auto border-0 bg-transparent px-0 py-2 font-display text-3xl font-bold tracking-tight shadow-none focus-visible:ring-0 md:text-4xl"
            aria-label="Article title"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {author.name || (
                <button
                  type="button"
                  onClick={() => setMetaOpen(true)}
                  className="underline-offset-2 hover:underline"
                >
                  Set an author
                </button>
              )}
            </span>
            <span>·</span>
            <span>{categoryEntry.name}</span>
            <span>·</span>
            <span>
              {BLOG_TYPES.find((t) => t.value === state.blogType)?.label ??
                state.blogType}
            </span>
          </div>
        </div>

        <div className="px-3 py-6 md:px-6 md:py-10">
          <BlockEditor
            value={state.body}
            onChange={(body) => setState((s) => ({ ...s, body }))}
            placeholder="Start writing, or press '/' for blocks…"
          />
        </div>
      </div>

      {/* Metadata sheet */}
      <Sheet open={metaOpen} onOpenChange={setMetaOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Article settings</SheetTitle>
            <SheetDescription>
              Author, category, type, feature image, and excerpt. These power
              the article card on the public site.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Feature image
              </h3>
              <FeatureImagePicker
                value={state.featureImage}
                onChange={(v) =>
                  setState((s) => ({ ...s, featureImage: v }))
                }
              />
            </section>

            <section className="space-y-2">
              <Label htmlFor="author-name">Author name</Label>
              <Input
                id="author-name"
                value={state.authorName}
                onChange={(e) =>
                  setState((s) => ({ ...s, authorName: e.target.value }))
                }
                placeholder="Jane Doe"
              />
              <Label className="pt-2">Author avatar</Label>
              <AuthorAvatarPicker
                value={state.authorAvatarUrl}
                onChange={(url) =>
                  setState((s) => ({ ...s, authorAvatarUrl: url }))
                }
              />
            </section>

            <section className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={state.categorySlug}
                onValueChange={(v) =>
                  setState((s) => ({ ...s, categorySlug: v }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_CATEGORIES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2">
              <Label htmlFor="blog-type">Article type</Label>
              <Select
                value={state.blogType}
                onValueChange={(v) =>
                  setState((s) => ({ ...s, blogType: v as BlogType }))
                }
              >
                <SelectTrigger id="blog-type">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2">
              <Label htmlFor="excerpt">
                Excerpt
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (auto-generated if left blank)
                </span>
              </Label>
              <textarea
                id="excerpt"
                value={state.excerpt}
                onChange={(e) =>
                  setState((s) => ({ ...s, excerpt: e.target.value }))
                }
                placeholder="A short summary used on the public listing card"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                {state.excerpt.length > 0
                  ? `${state.excerpt.length} characters`
                  : "Auto-generated from the first 200 characters of body text"}
              </p>
            </section>

            {isEdit && blog?.publishDate ? (
              <section className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  Published on{" "}
                  {new Date(blog.publishDate * 1000).toLocaleString()}
                </div>
              </section>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
