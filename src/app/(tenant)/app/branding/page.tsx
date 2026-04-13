"use client";

import { PageHeader } from "@/components/recipes/page-header";
import { BrandingTab } from "../settings/_sections/branding-tab";

export default function BrandingPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Brand Appearance"
        description="Customize your tenant's colors, logo, and visitor badge appearance. Also available in Settings → Branding."
      />
      <BrandingTab />
    </div>
  );
}
