"use client";

import { useState } from "react";
import {
  ExternalLink,
  Pencil,
  RefreshCw,
  Star,
  Table as TableIcon,
  Tags,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { usePricingMarketing } from "@/features/pricing-marketing/hooks";
import { PageHeaderEditor } from "@/features/pricing-marketing/components/page-header-editor";
import { PlanCardEditorModal } from "@/features/pricing-marketing/components/plan-card-editor-modal";
import { FeatureRowEditorModal } from "@/features/pricing-marketing/components/feature-row-editor-modal";
import { CategoryEditorModal } from "@/features/pricing-marketing/components/category-editor-modal";
import type {
  PricingMarketingPlanCard,
  PricingMarketingRow,
  PricingMarketingSection,
} from "@/types/pricing-marketing";

const PUBLIC_PRICING_URL = "https://visichek.app/pricing";

function formatPrice(value: number | null, currency: string): string {
  if (value == null) return "Contact sales";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export default function PricingContentClient() {
  const query = usePricingMarketing();
  const [editingCard, setEditingCard] =
    useState<PricingMarketingPlanCard | null>(null);
  const [editingRow, setEditingRow] = useState<{
    row: PricingMarketingRow;
    categoryKey: string;
  } | null>(null);
  const [editingSection, setEditingSection] =
    useState<PricingMarketingSection | null>(null);

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={query.refetch} />;
  }
  if (!query.data) {
    return (
      <EmptyState
        title="No pricing data yet"
        description="The backend hasn't returned any rendered pricing payload."
      />
    );
  }

  const data = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing"
        description="Editorial overlay for the public marketing pricing page. Prices, caps, and feature toggles still come from the live billing plans — this page only controls the marketing copy that wraps them."
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
                Re-fetch the rendered pricing payload so changes from the plan
                editor or other admins appear here.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={PUBLIC_PRICING_URL}
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
                Open the live marketing pricing page in a new tab so you can
                confirm what visitors see.
              </TooltipContent>
            </Tooltip>
          </>
        }
      />

      <p className="text-xs text-muted-foreground tabular-nums">
        Backend payload last refreshed {formatRelative(data.lastUpdated)} ·{" "}
        {data.plans.length} card{data.plans.length === 1 ? "" : "s"} ·{" "}
        {data.sections.reduce((sum, s) => sum + s.rows.length, 0)} comparison
        rows across {data.sections.length} sections
      </p>

      <PageHeaderEditor data={data} />

      <Card>
        <CardHeader>
          <CardTitle>Plan cards ({data.plans.length})</CardTitle>
          <CardDescription>
            One card per active &amp; public plan. The values shown below come
            from the live plan; the tagline, badge, CTA, and highlight bullets
            come from this editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.plans.length === 0 ? (
            <EmptyState
              icon={<Tags className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
              title="No public plans"
              description="Mark a plan as public from Billing → Plans to surface it here."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.plans.map((card) => (
                <PlanCardPreview
                  key={card.planId}
                  card={card}
                  onEdit={() => setEditingCard(card)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Comparison table ({data.sections.length} section
            {data.sections.length === 1 ? "" : "s"})
          </CardTitle>
          <CardDescription>
            The feature comparison table below the cards. Click a section
            header to rename or re-order it. Click any row to override its
            label or move it to a different section. The cell values
            themselves come from the live plans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.sections.length === 0 ? (
            <EmptyState
              icon={
                <TableIcon
                  className="h-6 w-6 text-muted-foreground"
                  aria-hidden="true"
                />
              }
              title="No comparison sections"
              description="Sections appear automatically once plans expose any caps, quotas, or feature flags."
            />
          ) : (
            data.sections.map((section) => (
              <SectionBlock
                key={section.categoryKey}
                section={section}
                plans={data.plans}
                onEditSection={() => setEditingSection(section)}
                onEditRow={(row) =>
                  setEditingRow({ row, categoryKey: section.categoryKey })
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {editingCard && (
        <PlanCardEditorModal
          open={editingCard !== null}
          onOpenChange={(open) => {
            if (!open) setEditingCard(null);
          }}
          card={editingCard}
        />
      )}

      {editingRow && (
        <FeatureRowEditorModal
          open={editingRow !== null}
          onOpenChange={(open) => {
            if (!open) setEditingRow(null);
          }}
          row={editingRow.row}
          currentCategoryKey={editingRow.categoryKey}
          categories={data.sections}
        />
      )}

      {editingSection && (
        <CategoryEditorModal
          open={editingSection !== null}
          onOpenChange={(open) => {
            if (!open) setEditingSection(null);
          }}
          section={editingSection}
        />
      )}
    </div>
  );
}

interface PlanCardPreviewProps {
  card: PricingMarketingPlanCard;
  onEdit: () => void;
}

function PlanCardPreview({ card, onEdit }: PlanCardPreviewProps) {
  return (
    <div className="flex flex-col rounded-lg border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Tags
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold">{card.displayName}</span>
          <Badge variant="outline" className="text-[10px] uppercase">
            {card.tier}
          </Badge>
        </div>
        {card.badge && (
          <Badge
            variant="default"
            className="text-[10px] uppercase whitespace-nowrap"
          >
            <Star className="mr-1 h-3 w-3" aria-hidden="true" />
            {card.badge}
          </Badge>
        )}
      </div>

      <p className="mt-2 min-h-[2.5rem] text-xs text-muted-foreground line-clamp-2">
        {card.tagline || (
          <em className="text-muted-foreground/70">No tagline set</em>
        )}
      </p>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">
          {formatPrice(card.priceMonthly, card.currency)}
        </span>
        {card.priceMonthly != null && (
          <span className="text-xs text-muted-foreground">/month</span>
        )}
      </div>
      {card.priceYearly != null && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {formatPrice(card.priceYearly, card.currency)} / year
        </p>
      )}

      <ul className="mt-3 space-y-1 text-xs">
        {card.highlightBullets.length === 0 ? (
          <li className="text-muted-foreground/70 italic">
            No highlight bullets yet
          </li>
        ) : (
          card.highlightBullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span
                className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden="true"
              />
              <span>{bullet}</span>
            </li>
          ))
        )}
      </ul>

      <div className="mt-4 rounded-md border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
        CTA:{" "}
        <span className="font-medium text-foreground">{card.ctaLabel}</span>
        {card.ctaUrl && (
          <span className="ml-1 truncate">→ {card.ctaUrl}</span>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={onEdit}
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit marketing copy
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Edit the tagline, CTA, badge, and highlight bullets shown on this
          plan card.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface SectionBlockProps {
  section: PricingMarketingSection;
  plans: PricingMarketingPlanCard[];
  onEditSection: () => void;
  onEditRow: (row: PricingMarketingRow) => void;
}

function SectionBlock({
  section,
  plans,
  onEditSection,
  onEditRow,
}: SectionBlockProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{section.label}</h3>
          <p className="text-[11px] text-muted-foreground font-mono">
            {section.categoryKey} · sort {section.sortOrder} ·{" "}
            {section.rows.length} row{section.rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEditSection}
              className="shrink-0"
            >
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Edit section
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Rename this section or change its position in the comparison table.
          </TooltipContent>
        </Tooltip>
      </div>

      {section.rows.length === 0 ? (
        <p className="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          No rows in this section yet.
        </p>
      ) : (
        <>
          {/* Desktop / tablet: real table */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Feature</TableHead>
                  {plans.map((plan) => (
                    <TableHead
                      key={plan.planId}
                      className="text-center whitespace-nowrap"
                    >
                      {plan.displayName}
                    </TableHead>
                  ))}
                  <TableHead className="w-[1%]" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => (
                  <TableRow
                    key={row.rowKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEditRow(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onEditRow(row);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TableCell>
                      <div className="text-sm font-medium">{row.label}</div>
                      {row.description && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {row.description}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground/70 font-mono">
                        {row.rowKey}
                      </div>
                    </TableCell>
                    {plans.map((plan) => {
                      const cell = row.cells.find(
                        (c) => c.planName === plan.planName,
                      );
                      return (
                        <TableCell
                          key={plan.planId}
                          className="text-center text-sm tabular-nums"
                        >
                          {cell?.display ?? "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRow(row);
                            }}
                            aria-label={`Edit ${row.label}`}
                          >
                            <Pencil
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Edit this row's label, description, or section.
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: card list */}
          <ul className="space-y-2 md:hidden">
            {section.rows.map((row) => (
              <li key={row.rowKey}>
                <button
                  type="button"
                  onClick={() => onEditRow(row)}
                  className="w-full rounded-md border bg-background/40 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{row.label}</div>
                      {row.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {row.description}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground/70 font-mono">
                        {row.rowKey}
                      </div>
                    </div>
                    <Pencil
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <ul className="mt-2 grid gap-1 text-[11px]">
                    {plans.map((plan) => {
                      const cell = row.cells.find(
                        (c) => c.planName === plan.planName,
                      );
                      return (
                        <li
                          key={plan.planId}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-muted-foreground">
                            {plan.displayName}
                          </span>
                          <span className="tabular-nums">
                            {cell?.display ?? "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
