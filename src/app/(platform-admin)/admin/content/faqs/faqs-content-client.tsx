"use client";

import { useState } from "react";
import {
  ExternalLink,
  HelpCircle,
  LayoutList,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/recipes/page-header";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatRelative } from "@/lib/utils/format-date";
import { useFaqs } from "@/features/faqs/hooks";
import { PageHeaderEditor } from "@/features/faqs/components/page-header-editor";
import { FaqItemEditorModal } from "@/features/faqs/components/faq-item-editor-modal";
import { FaqCategoryEditorModal } from "@/features/faqs/components/faq-category-editor-modal";
import type { FaqItem, FaqSection } from "@/types/faqs";

const PUBLIC_FAQS_URL = "https://visichek.app/faqs";

interface ItemEditorState {
  item: FaqItem | null;
  categoryKey: string;
}

export default function FaqsContentClient() {
  const query = useFaqs();
  const [editingItem, setEditingItem] = useState<ItemEditorState | null>(null);
  const [editingSection, setEditingSection] = useState<{
    section: FaqSection | null;
  } | null>(null);

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={query.refetch} />;
  }
  if (!query.data) {
    return (
      <EmptyState
        title="No FAQ data yet"
        description="The backend hasn't returned any rendered FAQ payload."
      />
    );
  }

  const data = query.data;
  const totalItems = data.sections.reduce((sum, s) => sum + s.items.length, 0);
  const fallbackCategoryKey =
    data.sections[0]?.categoryKey ?? "general";

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQs"
        description="Editorial overlay for the public marketing FAQ page. Add, edit, and group the questions visitors see."
        actions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => query.refetch()}
                  disabled={query.isFetching}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${
                      query.isFetching ? "animate-spin" : ""
                    }`}
                    aria-hidden="true"
                  />
                  Refresh preview
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Re-fetch the rendered FAQ payload so changes from other admins
                appear here.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={PUBLIC_FAQS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open public page
                    <ExternalLink
                      className="ml-2 h-4 w-4"
                      aria-hidden="true"
                    />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Open the live marketing FAQ page in a new tab to confirm what
                visitors see.
              </TooltipContent>
            </Tooltip>
          </>
        }
      />

      <p className="text-xs text-muted-foreground tabular-nums">
        Backend payload last refreshed {formatRelative(data.lastUpdated)} ·{" "}
        {totalItems} item{totalItems === 1 ? "" : "s"} across{" "}
        {data.sections.length} section{data.sections.length === 1 ? "" : "s"}
      </p>

      <PageHeaderEditor data={data} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <CardTitle>
                FAQ sections ({data.sections.length})
              </CardTitle>
              <CardDescription>
                Sections group items on the public page. Default sections
                (General, Billing, Security, Support) are code-shipped — you
                can rename and re-order them but resetting brings them back.
                Custom sections you add can be deleted entirely.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSection({ section: null })}
                  >
                    <LayoutList
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                    Add section
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Create a new custom section to group FAQ items under.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setEditingItem({
                        item: null,
                        categoryKey: fallbackCategoryKey,
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Add FAQ
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Add a new question and answer to the public FAQ page.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.sections.length === 0 ? (
            <EmptyState
              icon={
                <HelpCircle
                  className="h-6 w-6 text-muted-foreground"
                  aria-hidden="true"
                />
              }
              title="No FAQs yet"
              description='Add your first question with "Add FAQ" above. Items without a section land under "General".'
            />
          ) : (
            data.sections.map((section) => (
              <SectionBlock
                key={section.categoryKey}
                section={section}
                onEditSection={() => setEditingSection({ section })}
                onAddItem={() =>
                  setEditingItem({
                    item: null,
                    categoryKey: section.categoryKey,
                  })
                }
                onEditItem={(item) =>
                  setEditingItem({ item, categoryKey: section.categoryKey })
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {editingItem && (
        <FaqItemEditorModal
          open={editingItem !== null}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null);
          }}
          item={editingItem.item}
          currentCategoryKey={editingItem.categoryKey}
          categories={data.sections}
        />
      )}

      {editingSection && (
        <FaqCategoryEditorModal
          open={editingSection !== null}
          onOpenChange={(open) => {
            if (!open) setEditingSection(null);
          }}
          section={editingSection.section}
        />
      )}
    </div>
  );
}

interface SectionBlockProps {
  section: FaqSection;
  onEditSection: () => void;
  onAddItem: () => void;
  onEditItem: (item: FaqItem) => void;
}

function SectionBlock({
  section,
  onEditSection,
  onAddItem,
  onEditItem,
}: SectionBlockProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{section.label}</h3>
          <p className="text-[11px] text-muted-foreground font-mono">
            {section.categoryKey} · sort {section.sortOrder} ·{" "}
            {section.items.length} item
            {section.items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAddItem}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add item
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Add a new FAQ to this section.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onEditSection}
              >
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                Edit section
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Rename, re-order, or remove this section.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {section.items.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          No items in this section yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {section.items.map((item) => (
            <li key={item.itemKey}>
              <button
                type="button"
                onClick={() => onEditItem(item)}
                className="w-full rounded-md border bg-background/40 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{item.question}</div>
                    <div
                      className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                      // Answer can be HTML/markdown — strip tags for the
                      // preview line so we don't render arbitrary markup
                      // here. Use raw text for line-clamping.
                    >
                      {stripTagsForPreview(item.answer)}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground/70 font-mono">
                      {item.itemKey} · sort {item.sortOrder}
                    </div>
                  </div>
                  <Pencil
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function stripTagsForPreview(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
