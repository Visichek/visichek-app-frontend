"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Upload,
  Edit2,
  Trash2,
  Archive,
  MoreHorizontal,
  Loader2,
  ScrollText,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import {
  DataTable,
  type DataTableBulkAction,
} from "@/components/recipes/data-table";
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
import {
  useLegalDocuments,
  useArchiveLegalDocument,
  useDeleteLegalDocument,
} from "@/features/legal-documents/hooks/use-legal-documents";
import { ImportLegalDocumentDialog } from "@/features/legal-documents/components/import-legal-document-dialog";
import {
  LEGAL_DOC_TYPES,
  type LegalDocStatus,
  type LegalDocType,
  type LegalDocumentListRow,
} from "@/types/legal-document";

const NEW_HREF = "/admin/legal-documents/new";

function editHref(id: string) {
  return `/admin/legal-documents/${id}/edit`;
}

function docTypeLabel(value: LegalDocType): string {
  return LEGAL_DOC_TYPES.find((t) => t.value === value)?.label ?? value;
}

type StatusTab = "all" | "draft" | "published" | "archived";

const STATUS_TABS: { value: StatusTab; label: string; description: string }[] =
  [
    {
      value: "all",
      label: "All",
      description: "Every legal document across all states",
    },
    {
      value: "published",
      label: "Published",
      description: "Documents currently live on the public website",
    },
    {
      value: "draft",
      label: "Drafts",
      description: "Unpublished drafts — only visible to admins",
    },
    {
      value: "archived",
      label: "Archived",
      description: "Documents removed from the public site; history retained",
    },
  ];

function statusBadge(status: LegalDocStatus) {
  if (status === "published") return <Badge variant="success">Published</Badge>;
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function formatDate(unix?: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PAGE_SIZE = 25;

/** Run a single-item mutation across many ids and aggregate the outcome. */
async function fanOut(
  ids: string[],
  run: (id: string) => Promise<unknown>,
  noun: string,
): Promise<void> {
  const results = await Promise.allSettled(ids.map((id) => run(id)));
  const failed = results.filter((r) => r.status === "rejected").length;
  const ok = results.length - failed;
  if (failed === 0) {
    toast.success(`${ok} ${noun}${ok === 1 ? "" : "s"} updated`);
  } else if (ok === 0) {
    toast.error(`Could not update ${failed} ${noun}${failed === 1 ? "" : "s"}`);
  } else {
    toast.warning(
      `${ok} of ${results.length} succeeded; ${failed} failed — re-check the list`,
    );
  }
}

interface BulkOp {
  kind: "archive" | "delete";
  ids: string[];
}

export function LegalDocumentsPageClient() {
  const { loadingHref } = useNavigationLoading();
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    LegalDocumentListRow | undefined
  >();
  const [archiveTarget, setArchiveTarget] = useState<
    LegalDocumentListRow | undefined
  >();
  const [bulkOp, setBulkOp] = useState<BulkOp | null>(null);

  useEffect(() => {
    setPageIndex(0);
  }, [statusTab]);

  const listFilters = useMemo(() => {
    const params: Record<string, unknown> = {
      skip: pageIndex * PAGE_SIZE,
      limit: PAGE_SIZE,
      sort: "-dateCreated",
      facets: "status",
    };
    if (statusTab !== "all") params.status = statusTab;
    return params;
  }, [pageIndex, statusTab]);

  const { data, isLoading } = useLegalDocuments(listFilters);
  const documents = data?.items ?? [];
  const meta = data?.meta;

  const counts = useMemo(() => {
    const facet = meta?.facets?.status ?? {};
    return {
      all: meta?.total ?? 0,
      draft: facet.draft ?? 0,
      published: facet.published ?? 0,
      archived: facet.archived ?? 0,
    };
  }, [meta]);

  const archiveMutation = useArchiveLegalDocument();
  const deleteMutation = useDeleteLegalDocument();

  async function handleArchiveOne() {
    if (!archiveTarget) return;
    try {
      await archiveMutation.mutateAsync(archiveTarget.id);
      toast.success("Document archived");
      setArchiveTarget(undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    }
  }

  async function handleDeleteOne() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Document deleted");
      setDeleteTarget(undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function handleBulkConfirm() {
    if (!bulkOp) return;
    const { kind, ids } = bulkOp;
    try {
      if (kind === "archive") {
        await fanOut(ids, (id) => archiveMutation.mutateAsync(id), "document");
      } else {
        await fanOut(ids, (id) => deleteMutation.mutateAsync(id), "document");
      }
    } finally {
      setBulkOp(null);
    }
  }

  const bulkActions: DataTableBulkAction<LegalDocumentListRow>[] = [
    {
      label: "Archive",
      description: "Remove the selected documents from the public site",
      icon: <Archive className="h-4 w-4" />,
      onClick: (ids) => setBulkOp({ kind: "archive", ids }),
    },
    {
      label: "Delete",
      description:
        "Permanently delete the selected documents and their version history",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "destructive",
      onClick: (ids) => setBulkOp({ kind: "delete", ids }),
    },
  ];

  const columns: ColumnDef<LegalDocumentListRow>[] = [
    {
      id: "document",
      header: "Document",
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <ScrollText
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <p className="font-medium leading-tight">
                {doc.title || (
                  <span className="italic text-muted-foreground">Untitled</span>
                )}
              </p>
              <p className="line-clamp-1 font-mono text-xs text-muted-foreground">
                /{doc.slug}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "docType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline">{docTypeLabel(row.original.docType)}</Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {statusBadge(row.original.status)}
          {row.original.hasUnpublishedChanges ? (
            <Badge variant="warning">Unpublished changes</Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "version",
      header: "Version",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.currentVersion ? `v${row.original.currentVersion}` : "—"}
        </span>
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
                  aria-label="Document actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Open actions for this document</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuNavItem
              href={editHref(row.original.id)}
              label="Edit"
              icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
              description="Open the editor to write, publish, or review versions"
            />
            {row.original.status !== "archived" ? (
              <DropdownMenuItem onSelect={() => setArchiveTarget(row.original)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            ) : null}
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

  const mobileCard = (doc: LegalDocumentListRow) => (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium">
            {doc.title || (
              <span className="italic text-muted-foreground">Untitled</span>
            )}
          </p>
          <p className="font-mono text-xs text-muted-foreground">/{doc.slug}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuNavItem
              href={editHref(doc.id)}
              label="Edit"
              icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
            />
            {doc.status !== "archived" ? (
              <DropdownMenuItem onSelect={() => setArchiveTarget(doc)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() => setDeleteTarget(doc)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {statusBadge(doc.status)}
        <Badge variant="outline">{docTypeLabel(doc.docType)}</Badge>
        {doc.hasUnpublishedChanges ? (
          <Badge variant="warning">Unpublished changes</Badge>
        ) : null}
      </div>
    </div>
  );

  const isNavigatingNew = loadingHref === NEW_HREF;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal Documents"
        description="Author, version, and publish Visichek's public legal copy — privacy policy, terms of service, and more."
        actions={
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                  className="w-full min-h-[44px] md:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  Import
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Upload a Word, PDF, or text file and convert it into an editable
                draft
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href={NEW_HREF}
                  className="w-full min-h-[44px] md:w-auto"
                >
                  {isNavigatingNew ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  New document
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open the editor to draft a new legal document from scratch
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as StatusTab)}
      >
        <TabsList className="flex h-auto w-full flex-wrap gap-1 md:w-auto">
          {STATUS_TABS.map((tab) => (
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
        data={documents}
        isLoading={isLoading}
        pagination={true}
        serverPagination={{
          pageIndex,
          pageSize: PAGE_SIZE,
          totalCount: meta?.total ?? null,
          hasMore: meta?.hasMore,
          onPageChange: setPageIndex,
        }}
        searchKey="document"
        searchPlaceholder="Search documents by title or slug…"
        selectable
        getRowId={(doc) => doc.id}
        bulkActions={bulkActions}
        itemNoun="document"
        emptyTitle={
          statusTab === "published"
            ? "No published documents yet"
            : statusTab === "draft"
              ? "No drafts"
              : statusTab === "archived"
                ? "No archived documents"
                : "No legal documents yet"
        }
        emptyDescription={
          statusTab === "archived"
            ? "Documents you archive will show up here."
            : "Create one from scratch or import an existing Word/PDF file."
        }
        mobileCard={mobileCard}
        getRowHref={(doc) => editHref(doc.id)}
        rowClickAriaLabel={(doc) =>
          `Edit ${doc.title || "untitled document"}`
        }
      />

      <ImportLegalDocumentDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(undefined);
        }}
        title="Archive this document?"
        description={
          archiveTarget?.title
            ? `"${archiveTarget.title}" will be removed from the public site. Its version history is retained.`
            : "This document will be removed from the public site. Its version history is retained."
        }
        confirmLabel="Archive"
        isLoading={archiveMutation.isPending}
        onConfirm={handleArchiveOne}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
        title="Delete this document?"
        description={
          deleteTarget?.title
            ? `Permanently delete "${deleteTarget.title}" and its version history. This cannot be undone — prefer Archive for anything that was ever public.`
            : "Permanently delete this document and its version history. This cannot be undone."
        }
        confirmLabel="Delete permanently"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteOne}
      />

      <ConfirmDialog
        open={!!bulkOp}
        onOpenChange={(open) => {
          if (!open) setBulkOp(null);
        }}
        title={
          bulkOp?.kind === "delete"
            ? `Delete ${bulkOp?.ids.length} document${bulkOp && bulkOp.ids.length === 1 ? "" : "s"}?`
            : `Archive ${bulkOp?.ids.length} document${bulkOp && bulkOp.ids.length === 1 ? "" : "s"}?`
        }
        description={
          bulkOp?.kind === "delete"
            ? `Permanently delete ${bulkOp?.ids.length} document(s) and their version history. This cannot be undone.`
            : `Remove ${bulkOp?.ids.length} document(s) from the public site. Version history is retained.`
        }
        confirmLabel={bulkOp?.kind === "delete" ? "Delete permanently" : "Archive"}
        variant={bulkOp?.kind === "delete" ? "destructive" : "default"}
        isLoading={archiveMutation.isPending || deleteMutation.isPending}
        onConfirm={handleBulkConfirm}
      />
    </div>
  );
}
