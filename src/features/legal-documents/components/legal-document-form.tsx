"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Archive,
  Download,
  Globe,
  History,
  Loader2,
  MoreHorizontal,
  Save,
  Settings2,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { NavButton } from "@/components/recipes/nav-button";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ConfirmDialog } from "@/components/recipes/confirm-dialog";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { BlockEditor } from "@/features/blog/components/block-editor";
import { blockText, normalizeBlocks } from "@/features/blog/lib/blocks";
import { LegalDocumentVersionsSheet } from "./legal-document-versions-sheet";
import {
  fetchLegalDocumentSource,
  useArchiveLegalDocument,
  useCreateLegalDocument,
  useDeleteLegalDocument,
  usePublishLegalDocument,
  useUpdateLegalDocument,
} from "@/features/legal-documents/hooks/use-legal-documents";
import {
  LEGAL_DOC_TYPES,
  type LegalDocType,
  type LegalDocument,
} from "@/types/legal-document";
import type { Block } from "@/types/blog";

const BACK_HREF = "/admin/legal-documents";

function docTypeLabel(value: LegalDocType): string {
  return LEGAL_DOC_TYPES.find((t) => t.value === value)?.label ?? value;
}

function hasRenderableContent(body: Block[]): boolean {
  return body.some((b) =>
    b.type === "image" ? !!b.props?.url : blockText(b).trim().length > 0,
  );
}

interface FormState {
  title: string;
  docType: LegalDocType;
  summary: string;
  slug: string;
  body: Block[];
}

function initialFromDoc(doc: LegalDocument | undefined): FormState {
  return {
    title: doc?.title ?? "",
    docType: doc?.docType ?? "other",
    summary: doc?.summary ?? "",
    slug: doc?.slug ?? "",
    body: normalizeBlocks(doc?.body),
  };
}

export function LegalDocumentForm({ document }: { document?: LegalDocument }) {
  const router = useRouter();
  const { loadingHref } = useNavigationLoading();
  const isEdit = !!document;
  const docId = document?.id ?? "";

  const [state, setState] = React.useState<FormState>(() =>
    initialFromDoc(document),
  );
  const [dirty, setDirty] = React.useState(false);
  const [metaOpen, setMetaOpen] = React.useState(false);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [downloadingSource, setDownloadingSource] = React.useState(false);

  // Publish dialog fields.
  const [changeNote, setChangeNote] = React.useState("");
  const [effectiveAtLocal, setEffectiveAtLocal] = React.useState("");

  const createMutation = useCreateLegalDocument();
  const updateMutation = useUpdateLegalDocument(docId);
  const publishMutation = usePublishLegalDocument(docId);
  const archiveMutation = useArchiveLegalDocument();
  const deleteMutation = useDeleteLegalDocument();

  const isPublished = document?.status === "published";
  const isArchived = document?.status === "archived";
  const showUnpublishedBadge =
    isPublished && (dirty || !!document?.hasUnpublishedChanges);

  function patch(partial: Partial<FormState>) {
    setState((s) => ({ ...s, ...partial }));
    setDirty(true);
  }

  function validate(forPublish: boolean): string | null {
    if (!state.title.trim()) return "Title is required";
    if (forPublish && !hasRenderableContent(state.body)) {
      return "Add some content before publishing — the working copy is empty";
    }
    return null;
  }

  /** Persist the working copy + head metadata. Returns the document id. */
  async function saveWorkingCopy(): Promise<string | null> {
    if (isEdit) {
      await updateMutation.mutateAsync({
        title: state.title.trim(),
        docType: state.docType,
        summary: state.summary.trim() || undefined,
        slug: state.slug.trim() || undefined,
        body: state.body,
      });
      return docId;
    }
    const created = await createMutation.mutateAsync({
      title: state.title.trim(),
      docType: state.docType,
      summary: state.summary.trim() || undefined,
      slug: state.slug.trim() || undefined,
      body: state.body,
    });
    return created?.id ?? null;
  }

  async function handleSaveDraft() {
    const err = validate(false);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      const id = await saveWorkingCopy();
      setDirty(false);
      if (!isEdit && id) {
        toast.success("Draft created");
        router.push(`/admin/legal-documents/${id}/edit`);
        return;
      }
      toast.success(
        isPublished ? "Working copy saved (not yet published)" : "Draft saved",
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save this document",
      );
    }
  }

  function openPublishDialog() {
    const err = validate(true);
    if (err) {
      toast.error(err);
      return;
    }
    setChangeNote("");
    setEffectiveAtLocal("");
    setPublishOpen(true);
  }

  async function handlePublish() {
    try {
      // Save the latest working copy first so the publish snapshots current
      // editor content, then promote it to the live version.
      const id = await saveWorkingCopy();
      if (!id) {
        toast.error("Could not save before publishing");
        return;
      }

      const payload: { effectiveAt?: number; changeNote?: string } = {};
      if (effectiveAtLocal) {
        const ts = Math.floor(new Date(effectiveAtLocal).getTime() / 1000);
        if (!Number.isNaN(ts)) payload.effectiveAt = ts;
      }
      if (changeNote.trim()) payload.changeNote = changeNote.trim();

      if (isEdit) {
        await publishMutation.mutateAsync(payload);
      } else {
        // Freshly created — publish via its new id, then route to the editor.
        const { apiPost } = await import("@/lib/api/request");
        await apiPost(`/legal-documents/${id}/publish`, payload);
      }

      setDirty(false);
      setPublishOpen(false);
      toast.success("Published — live on the public site");
      if (!isEdit) {
        router.push(`/admin/legal-documents/${id}/edit`);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not publish this document",
      );
    }
  }

  async function handleArchive() {
    if (!isEdit) return;
    try {
      await archiveMutation.mutateAsync(docId);
      setArchiveOpen(false);
      toast.success("Archived — removed from the public site");
      router.push(BACK_HREF);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not archive this document",
      );
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    try {
      await deleteMutation.mutateAsync(docId);
      setDeleteOpen(false);
      toast.success("Document deleted");
      router.push(BACK_HREF);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not delete this document",
      );
    }
  }

  async function handleDownloadSource() {
    if (!isEdit) return;
    setDownloadingSource(true);
    try {
      const source = await fetchLegalDocumentSource(docId);
      window.open(source.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "No original file is available for this document",
      );
    } finally {
      setDownloadingSource(false);
    }
  }

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    publishMutation.isPending;

  const statusBadge = isArchived ? (
    <Badge variant="secondary">Archived</Badge>
  ) : isPublished ? (
    <Badge variant="success">Published</Badge>
  ) : (
    <Badge variant="secondary">Draft</Badge>
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={BACK_HREF}
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
              >
                {loadingHref === BACK_HREF ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Back to legal documents
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Return to the legal documents list without saving unsaved changes
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-2">
            {statusBadge}
            <Badge variant="outline">{docTypeLabel(state.docType)}</Badge>
            {document?.currentVersion ? (
              <Badge variant="outline">v{document.currentVersion} live</Badge>
            ) : null}
            {showUnpublishedBadge ? (
              <Badge variant="warning">Unpublished changes</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEdit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVersionsOpen(true)}
                  className="min-h-[44px]"
                >
                  <History className="mr-2 h-4 w-4" aria-hidden="true" />
                  History
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Browse the immutable published versions and preview the legal
                text that was in effect at each point
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMetaOpen(true)}
                className="min-h-[44px]"
              >
                <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Settings
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Edit document metadata — type, summary, and public URL slug
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                isLoading={isSaving}
                className="min-h-[44px]"
              >
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {isEdit ? "Save working copy" : "Save draft"}
              </LoadingButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Save your edits to the working copy. The public site keeps showing
              the live version until you publish.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <LoadingButton
                type="button"
                size="sm"
                onClick={openPublishDialog}
                isLoading={isSaving}
                className="min-h-[44px]"
              >
                <Globe className="mr-2 h-4 w-4" aria-hidden="true" />
                {isPublished ? "Publish update" : "Publish"}
              </LoadingButton>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isPublished
                ? "Snapshot the working copy as a new version and update the public site"
                : "Snapshot the working copy as version 1 and make it live on the public site"}
            </TooltipContent>
          </Tooltip>

          {isEdit ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 w-11 p-0"
                      aria-label="More document actions"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  More actions — download the original file, archive, or delete
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {document?.sourceFile || document?.sourceFileUrl ? (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      void handleDownloadSource();
                    }}
                    disabled={downloadingSource}
                  >
                    {downloadingSource ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download original
                  </DropdownMenuItem>
                ) : null}
                {!isArchived ? (
                  <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Editor canvas */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 md:px-6">
          <Input
            value={state.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Document title (e.g. Privacy Policy)"
            className="h-auto border-0 bg-transparent px-0 py-2 font-display text-3xl font-bold tracking-tight shadow-none focus-visible:ring-0 md:text-4xl"
            aria-label="Document title"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{docTypeLabel(state.docType)}</span>
            {state.slug ? (
              <>
                <span>·</span>
                <span className="font-mono text-xs">/{state.slug}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="px-3 py-6 md:px-6 md:py-10">
          <BlockEditor
            value={state.body}
            onChange={(body) => patch({ body })}
            placeholder="Write the legal text, or press '/' for blocks…"
          />
        </div>
      </div>

      {/* Settings sheet */}
      <Sheet open={metaOpen} onOpenChange={setMetaOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Document settings</SheetTitle>
            <SheetDescription>
              Type, summary, and public URL slug. Metadata changes go live
              immediately — only the legal text is version-gated.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <section className="space-y-2">
              <Label htmlFor="doc-type">Document type</Label>
              <Select
                value={state.docType}
                onValueChange={(v) => patch({ docType: v as LegalDocType })}
              >
                <SelectTrigger id="doc-type">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_DOC_TYPES.map((t) => (
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
              <Label htmlFor="slug">
                URL slug
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (auto-generated from the title if left blank)
                </span>
              </Label>
              <Input
                id="slug"
                value={state.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder="privacy-policy"
                className="font-mono text-base md:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The public page will live at /legal/{state.slug || "<slug>"}
              </p>
            </section>

            <section className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <textarea
                id="summary"
                value={state.summary}
                onChange={(e) => patch({ summary: e.target.value })}
                placeholder="A short description shown next to the document on the public listing"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              />
            </section>
          </div>
        </SheetContent>
      </Sheet>

      {/* Publish dialog */}
      <ResponsiveModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={isPublished ? "Publish a new version" : "Publish document"}
        description="Snapshot the current working copy as an immutable version and make it live on the public site."
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="change-note">
              Change note
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional — recorded in the audit trail)
              </span>
            </Label>
            <textarea
              id="change-note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="e.g. Updated the data-retention clause"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective-at">
              Effective date
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional — defaults to now)
              </span>
            </Label>
            <Input
              id="effective-at"
              type="datetime-local"
              value={effectiveAtLocal}
              onChange={(e) => setEffectiveAtLocal(e.target.value)}
              className="text-base md:text-sm"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPublishOpen(false)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              onClick={handlePublish}
              isLoading={isSaving}
              loadingText="Publishing…"
              className="min-h-[44px]"
            >
              <Globe className="mr-2 h-4 w-4" aria-hidden="true" />
              {isPublished ? "Publish update" : "Publish"}
            </LoadingButton>
          </div>
        </div>
      </ResponsiveModal>

      {/* Version history */}
      {isEdit ? (
        <LegalDocumentVersionsSheet
          documentId={docId}
          currentVersion={document?.currentVersion}
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
        />
      ) : null}

      {/* Archive confirm */}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this document?"
        description={`"${state.title || "This document"}" will be removed from the public site. Its version history is retained and you can still view it here.`}
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={handleArchive}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this document?"
        description={`Permanently delete "${state.title || "this document"}" AND its entire version history. This cannot be undone. Prefer Archive for anything that was ever public.`}
        confirmLabel="Delete permanently"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
