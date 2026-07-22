import { redirect } from "next/navigation";

// Kept so bookmarks/links to the old /app/select-tenant URL keep working.
// The live page (and its user-visible copy) now lives at /app/select-organization.
export default function SelectTenantRedirectPage() {
  redirect("/app/select-organization");
}
