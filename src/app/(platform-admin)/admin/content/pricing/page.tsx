/**
 * /admin/content/pricing — marketing pricing display management.
 *
 * Editorial overlay on top of the live billing plans. Prices, caps,
 * and feature toggles still come from `/v1/plans/*`; this page owns
 * only the marketing copy that wraps them — headline / subheadline,
 * per-plan tagline / CTA / badge / highlight bullets, and
 * per-comparison-row label / description / section assignment.
 *
 * Backed by `GET/PATCH /v1/pricing-marketing` and
 * `DELETE /v1/pricing-marketing/{kind}/{key}`.
 */
import type { Metadata } from "next";
import PricingContentClient from "./pricing-content-client";

export const metadata: Metadata = {
  title: "Pricing — Content · VisiChek Admin",
  description:
    "Manage the public marketing pricing display, kept in sync with the live billing plans.",
};

export default function PricingContentPage() {
  return <PricingContentClient />;
}
