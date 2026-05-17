/**
 * Public FAQ payload (see backend `GET /v1/faqs`). Same singleton-
 * overlay pattern as `/v1/pricing-marketing`: the response is the
 * fully rendered page, and PATCH/DELETE upsert/remove rows by
 * natural key (`itemKey` for items, `categoryKey` for sections).
 */

/** A single rendered FAQ entry. */
export interface FaqItem {
  itemKey: string;
  question: string;
  /** HTML or markdown — rendered directly on the public page. */
  answer: string;
  sortOrder: number;
}

/** One grouped section of the rendered FAQ page. */
export interface FaqSection {
  categoryKey: string;
  label: string;
  sortOrder: number;
  items: FaqItem[];
}

export interface FaqsResponse {
  headline: string;
  subheadline: string | null;
  footerHtml: string;
  /** Unix seconds. */
  lastUpdated: number;
  sections: FaqSection[];
}

// ── PATCH payload ────────────────────────────────────────────────────

/** Per-item overlay slice — `itemKey` is the merge key. */
export interface FaqItemPatch {
  itemKey: string;
  question?: string | null;
  answer?: string | null;
  /** `null` parks the item under the default "general" section. */
  categoryKey?: string | null;
  sortOrder?: number;
}

/** Per-category overlay slice — `categoryKey` is the merge key. */
export interface FaqCategoryPatch {
  categoryKey: string;
  label?: string | null;
  sortOrder?: number;
}

/**
 * PATCH body for `PATCH /v1/faqs`. All fields optional; omit to
 * leave untouched, send `[]` to clear a list.
 *
 * Upsert semantics for `items` / `categories`: matched by natural
 * key; existing → replace in place, new → append.
 */
export interface FaqsPatchPayload {
  headline?: string | null;
  subheadline?: string | null;
  footerHtml?: string | null;
  items?: FaqItemPatch[];
  categories?: FaqCategoryPatch[];
}

/** Path-param value for `DELETE /v1/faqs/{kind}/{key}`. */
export type FaqsDeleteKind = "item" | "category";
