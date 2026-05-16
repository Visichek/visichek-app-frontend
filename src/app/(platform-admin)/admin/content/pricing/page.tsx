/**
 * /admin/content/pricing — marketing pricing display management
 * (Issue 10).
 *
 * This is the editorial layer that sits on top of the live plans
 * data. Plans (and their prices, feature rules, entity caps) remain
 * billing's source of truth; this page lets content / marketing ops
 * tweak display names, marketing descriptions, feature highlights,
 * CTAs, ordering, and visibility for the public pricing card grid.
 *
 * Until the backend ships the pricing-content tables + endpoints,
 * the page renders the existing plan list with a "review for drift"
 * call to action and a placeholder banner so the page is wired into
 * the sidebar and the route guards land somewhere meaningful.
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
