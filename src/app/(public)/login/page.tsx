import { redirect } from "next/navigation";

/**
 * The dual-portal chooser that used to live at /login is retired. Anyone
 * landing here is sent to the tenant portal sign-in; platform admins reach
 * their console only by intentionally visiting /admin/login.
 *
 * A next.config redirect handles this at the edge — this page is
 * defense-in-depth for any path that bypasses it (e.g. direct render in
 * dev, stale service-worker route caches).
 */
export default function LoginRedirectPage() {
  redirect("/app/login");
}
