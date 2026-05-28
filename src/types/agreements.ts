/**
 * Tenant agreements — the platform-managed master legal documents that govern
 * every tenant (the Data Processing Agreement and the Visitor Privacy Policy).
 *
 * The application admin authors/publishes the masters through the existing
 * legal-documents editor; the backend substitutes per-tenant placeholder tokens
 * and exposes the resolved copy under `/v1/agreements/*`. Every tenant must
 * accept the current PUBLISHED version of each master to keep running visitor
 * operations — publishing a new version forces re-acceptance.
 *
 * `body` is the same BlockNote dialect as legal documents and visitor privacy
 * notices, so it renders through `LegalContentRenderer`.
 */

import type { Block } from "./blog";

/** The fixed set of platform-managed agreement keys. */
export type AgreementKey = "dpa" | "visitor_privacy_policy";

/** Human-readable labels for each agreement key (kebab → title case). */
export const AGREEMENT_LABELS: Record<AgreementKey, string> = {
  dpa: "Data Processing Agreement",
  visitor_privacy_policy: "Visitor Privacy Policy",
};

/**
 * `TenantAgreement` — the resolved, per-tenant copy of a master plus this
 * tenant's acceptance state. Returned by `GET /v1/agreements`,
 * `GET /v1/agreements/{key}`, and `POST /v1/agreements/{key}/accept`.
 *
 * While unaccepted, `body` is rebuilt from the tenant's current details on each
 * read; `accept` freezes the resolved copy as the immutable record of what was
 * agreed.
 */
export interface TenantAgreement {
  id: string;
  tenantId: string;
  agreementKey: AgreementKey;
  masterSlug: string;
  /** The master version this copy was built from. */
  version: number;
  /** Title with placeholders substituted. */
  title: string;
  summary: string | null;
  /** Flattened plain-text projection used as a fallback. */
  fullText: string | null;
  /** Substituted BlockNote blocks, ready to render. */
  body: Block[];
  accepted: boolean;
  /** Unix seconds. */
  acceptedAt: number | null;
  /** super_admin user id that accepted. */
  acceptedBy: string | null;
  /** Unix seconds of the last decline (acceptance is not deleted on decline). */
  declinedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * `GET /v1/agreements/pending` — the keys this tenant still owes. Used on login
 * to decide whether to surface the acceptance prompt. `mustAccept` is false
 * when nothing is pending (incl. when no master has been published yet).
 */
export interface PendingAgreements {
  pending: AgreementKey[];
  mustAccept: boolean;
}

/**
 * `POST /v1/agreements/{key}/decline` — the decline is recorded but the tenant
 * stays blocked (nothing is deleted).
 */
export interface DeclineAgreementResult {
  declined: boolean;
  stillBlocked: boolean;
}
