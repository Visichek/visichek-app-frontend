/**
 * Public pricing-marketing payload (see backend
 * `GET /v1/pricing-marketing`). The page is rendered live from active +
 * public subscription plans; this overlay only stores marketing copy
 * (taglines, CTAs, bullets, row labels, category names). Values
 * (prices, caps, quotas, feature on/off) always come from the live
 * plan.
 */
import type { PlanTier } from "./enums";

/** A single rendered card on the public pricing grid. */
export interface PricingMarketingPlanCard {
  planId: string;
  /** Plan slug (matches `Plan.name`). */
  planName: string;
  /** Human display name (e.g. "Premium"). */
  displayName: string;
  tier: PlanTier;
  tagline: string | null;
  /** `null` → render "Contact sales" (Enterprise). */
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string;
  ctaLabel: string;
  /** Optional URL — `null` falls back to in-app signup. */
  ctaUrl: string | null;
  /** Optional callout badge (e.g. "Most popular"). */
  badge: string | null;
  highlightBullets: string[];
  sortOrder: number;
}

/** Raw value for a comparison-table cell. */
export type PricingMarketingCellValue = boolean | number | string | null;

/** A single cell in the comparison table — one per plan, in `plans` order. */
export interface PricingMarketingCell {
  planName: string;
  value: PricingMarketingCellValue;
  /** Human display string (e.g. "✓", "—", "5 GB", "Unlimited"). */
  display: string;
}

export interface PricingMarketingRow {
  /** Stable backend row key — see "row keys reference" in the brief. */
  rowKey: string;
  label: string;
  description: string | null;
  /** Same order as `PricingMarketingResponse.plans`. */
  cells: PricingMarketingCell[];
}

export interface PricingMarketingSection {
  categoryKey: string;
  label: string;
  sortOrder: number;
  rows: PricingMarketingRow[];
}

export interface PricingMarketingResponse {
  headline: string;
  subheadline: string;
  currency: string;
  /** Unix seconds. */
  lastUpdated: number;
  plans: PricingMarketingPlanCard[];
  sections: PricingMarketingSection[];
}

// ── PATCH payload ────────────────────────────────────────────────────

/** Per-plan overlay slice in the PATCH body. `planName` is the key. */
export interface PricingMarketingPlanPatch {
  planName: string;
  tagline?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  highlightBullets?: string[];
  badge?: string | null;
}

/** Per-row overlay slice — `rowKey` is the key. */
export interface PricingMarketingFeaturePatch {
  rowKey: string;
  label?: string | null;
  description?: string | null;
  /** Move the row into a different section. */
  categoryKey?: string;
}

/** Per-category overlay slice — `categoryKey` is the key. */
export interface PricingMarketingCategoryPatch {
  categoryKey: string;
  label?: string | null;
  sortOrder?: number;
}

/**
 * PATCH body for `PATCH /v1/pricing-marketing`. All fields optional;
 * omit to leave untouched, send `[]` to clear a list.
 *
 * Upsert semantics for `plans` / `features` / `categories`: matched by
 * natural key; existing → replace in place, new → append.
 */
export interface PricingMarketingPatchPayload {
  headline?: string | null;
  subheadline?: string | null;
  /** Symbol override (e.g. "$"); does not change plan currency codes. */
  currencyDisplay?: string | null;
  plans?: PricingMarketingPlanPatch[];
  features?: PricingMarketingFeaturePatch[];
  categories?: PricingMarketingCategoryPatch[];
}

/** Path-param value for `DELETE /v1/pricing-marketing/{kind}/{key}`. */
export type PricingMarketingDeleteKind = "plan" | "feature" | "category";
