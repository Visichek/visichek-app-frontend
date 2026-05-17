/**
 * /admin/content/faqs — public FAQ page management.
 *
 * Editorial overlay on top of the public marketing FAQ page. Same
 * singleton-overlay pattern as `/admin/content/pricing`: the page
 * renders the live rendered payload from `GET /v1/faqs`, and
 * writes go through `PATCH /v1/faqs` /
 * `DELETE /v1/faqs/{kind}/{key}`.
 */
import type { Metadata } from "next";
import FaqsContentClient from "./faqs-content-client";

export const metadata: Metadata = {
  title: "FAQs — Content · VisiChek Admin",
  description:
    "Manage the public marketing FAQ page — questions, answers, sections, and footer copy.",
};

export default function FaqsContentPage() {
  return <FaqsContentClient />;
}
