# SSR Migration — Todo

Goal: eliminate the client-side hydration + fetch round-trip that currently delays first paint on every page. Ship HTML with data already resolved, then let React Query take over on the client.

**Do NOT attempt this as one big-bang PR.** Phases 1–3 are the whole commitment; phases 4+ are optional based on measured wins.

---

## ⚠️ Blocker discovered during Phase 1

The httpOnly auth cookies are scoped to the API origin (`api.visichek.app`), not the frontend domain. That means the Next.js server **cannot read** the refresh-token cookie via `cookies()` from `next/headers`, so `POST /auth/refresh` on the server has no token to send.

Until one of these changes lands, no authenticated page can be SSR-prefetched:

1. Introduce a BFF session cookie on the frontend domain that the server can exchange for an API access token.
2. Proxy API calls through Next.js route handlers that keep a session server-side.
3. Host frontend and API under a shared parent domain so one cookie is visible to both.

Phase 1 infra is still built and useful (`server-session.ts` will start working automatically once the blocker is resolved — see its inline TODO). Phase 2+ is paused because building it now with a broken auth path would add complexity for zero perf win, which is exactly what findings.md warned against.

---

## Phase 0 — Baseline (do this first or the rest is guesswork)

- [ ] **Record a perf baseline** on 3 representative pages: `/app/dashboard`, `/app/billing`, `/app/visitors`. For each, capture in Chrome DevTools Performance panel (Fast 3G throttle, 4× CPU slowdown):
  - Time to First Contentful Paint (FCP)
  - Time to Largest Contentful Paint (LCP)
  - Time from navigation start → first data-dependent element visible
  - Save screenshots / trace files in a gist or `perf-baseline/` (untracked)
- [ ] **Decide the success bar** before starting work: e.g., "LCP on /app/billing drops by ≥400ms". If the pilot doesn't hit it, don't expand.
- _(Skipped in this pass — requires running the app in a browser.)_

---

## Phase 1 — Server-side infrastructure

These pieces are needed before any page can be converted. Build them once, reuse everywhere.

- [x] **1.1 Server-only API client** at `src/lib/api/server-client.ts` — built with `fetch`, forwards cookies, unwraps envelope, throws `ApiError` for non-success.

- [x] **1.2 Server auth helper** at `src/lib/auth/server-session.ts` — built, but returns `null` today because of the cookie-domain blocker above. Inline TODO flags where to fix once the blocker is resolved. Memoised with React's `cache()` so multiple prefetches share one refresh.

- [x] **1.3 Server prefetch helper** at `src/lib/api/server-prefetch.ts` — `createServerQueryClient`, `ssrPrefetch` (never-throw wrapper), `dehydrateState`.

- [x] **1.4 Shared `HydrationBoundary` wrapper** at `src/components/hydration-boundary.tsx` — thin client wrapper over TanStack's.

- [ ] **1.5 Smoke test the infra** — _(skipped: requires running the dev server and inspecting DevTools. Once the cookie blocker is resolved, drop a throwaway page under `src/app/(public)/_ssr-test/page.tsx` that prefetches `GET /v1/plans?status=active` and inspect the HTML payload for the dehydrated queryCache.)_

---

## Phase 2 — Pilot on `/app/billing` (code prepped; prefetch is no-op until cookie change lands)

Picked because its queries are independent, the page already exists, and the data isn't polling-critical (good fit for SSR). Because the client hooks haven't changed, the page works identically to before while `getServerTenantSession()` returns `null`; the moment the backend sets the refresh cookie on `.visichek.app`, the server prefetch activates with zero further code changes.

- [x] **2.1 Split the page into server + client.** `src/app/(tenant)/app/billing/page.tsx` is now a server component that calls `getServerTenantSession()`, runs four parallel prefetches (`/usage/my-usage`, `/invoices/tenant/{id}`, `/subscriptions/tenant/{id}/active`, `/checkout/sessions?limit=50`), dehydrates, and wraps `<BillingPageClient />` in `<HydrationBoundary>`. The client UI moved to `billing-page-client.tsx` (same logic as before, named export instead of default).

- [x] **2.2 Query-key alignment confirmed.** Server prefetches use exactly the same keys the client hooks use:
  - `useMyUsage` → `['usage', 'my-usage']`
  - `useTenantInvoices(tenantId)` → `['invoices', 'tenant', tenantId]`
  - `useActiveSubscription(tenantId)` → `['subscriptions', 'tenant', tenantId, 'active']`
  - `useCheckoutSessions({ limit: 50 })` → `['checkout', 'sessions', 'list', { limit: 50 }]` (matches the default "all" filter in `CheckoutHistoryTable`)

- [x] **2.3 Auth failure path = graceful no-op.** Chose this over a hard redirect so the page degrades cleanly today (`getServerTenantSession()` returns `null`, prefetch skipped, client hooks run normally). Once the backend change lands and auth succeeds, a session gets returned and prefetches activate. The client interceptor still handles runtime 401s for refresh expiry.

- [ ] **2.4 Re-measure against the Phase 0 baseline.** _(Pending — requires running the app after the backend cookie change is deployed. Target: LCP on `/app/billing` drops by ≥200ms. If not, stop.)_

---

## Phase 3 — Expand to high-traffic pages (prepped in parallel with Phase 2)

All three pages split into server + client components with the same graceful-degradation pattern as billing. Each activates the moment `getServerTenantSession()` returns a session.

- [x] **3.1 `/app/dashboard`** — server prefetches `['tenant','dashboard','stats']` via `GET /dashboard/stats`. Client moved to `dashboard-page-client.tsx`.
- [x] **3.2 `/app/visitors`** — server prefetches `['checkins','list',tenantId,{state:'pending_approval'}]` via `GET /tenants/{tenantId}/checkins?state=pending_approval`. Feeds both the active-tab query and the pending-count badge query (same key). Client-side 5s polling continues after hydration. Client moved to `visitors-page-client.tsx`.
- [x] **3.3 `/app/appointments`** — server prefetches `['appointments','list',undefined]` via `GET /appointments`. Client moved to `appointments-page-client.tsx`.
- [ ] **3.4 Re-measure** after each page. _(Pending — requires the backend cookie change + a running browser. Target: LCP drops ≥200ms per page. If any page shows negligible improvement, revert that one rather than carrying dead complexity.)_

---

## Phase 4 — Convert the tenant layout to a server component (done)

- [x] **4.1** Interactive shell extracted to `src/app/(tenant)/app/tenant-shell.tsx` (`"use client"`) — keeps mobile-nav state, command launcher, sidebar collapse, branding bootstrap, theme sync, role-filtered nav items, Cmd+K listener.
- [x] **4.2** `src/app/(tenant)/app/layout.tsx` is now a server component that just renders `<TenantShell>{children}</TenantShell>`.
- [ ] **4.3** Fetch branding on the server in the layout — _(deferred: the tenant-scoped branding endpoint requires auth, so it's blocked on the same cookie change that unblocks page-level SSR. `useTenantBranding()` still runs on the client for now.)_

- [ ] **4.1** The current `src/app/(tenant)/app/layout.tsx:1` is `"use client"` because of `useTenantBranding()`, `useThemeSync()`, and the mobile-nav / command-launcher state.
- [ ] **4.2** Extract the interactive shell (sidebar state, command launcher, mobile sheet, theme sync, branding bootstrap) into a client component `TenantShell` that wraps `{children}`.
- [ ] **4.3** Convert `layout.tsx` itself to a server component that renders `<TenantShell>{children}</TenantShell>`. This lets child pages remain server components without being forced into a client boundary by the layout.
- [ ] **4.4** Fetch branding on the server in the layout (`GET /v1/branding/tenant/{tenantId}`) and hydrate it into the Redux store via an initializer, instead of fetching in a client `useEffect`. Saves one round-trip per session.

---

## Phase 5 — Admin shell (done)

- [x] **5.1** Interactive shell extracted to `src/app/(platform-admin)/admin/admin-shell.tsx`; `admin/layout.tsx` is now a server component.
- [x] **5.2** `getServerAdminSession()` helper added to `src/lib/auth/server-session.ts` — calls `/admins/profile` on top of the base session.
- [x] **5.3** Data-driven admin pages split into server + client with the same graceful-degradation pattern:
  - `/admin/dashboard` — prefetches `['admin','dashboard','stats']` via `GET /admins/dashboard/stats`
  - `/admin/tenants` — prefetches `['admin','tenants','list',undefined]` via `GET /tenants`
  - `/admin/plans` — prefetches `['plans',{skip:0,limit:50}]` via `GET /plans?skip=0&limit=50`
  - `/admin/subscriptions` — prefetches `['subscriptions',undefined]` via `GET /subscriptions`
  - `/admin/discounts` — prefetches `['discounts']` via `GET /discounts`
  - `/admin/payments` — prefetches `['invoices','admin']` via `GET /invoices/admin`
- [ ] **5.4** `/admin/settings` intentionally left as client-only — it uses a manifest-driven tab system with no single primary data fetch, so the server-split pattern doesn't apply cleanly. Skip unless a measured bottleneck appears.

---

## Risks to watch for

- **Cookie forwarding gotcha**: Next.js' `cookies()` returns the incoming request cookies. Make sure your server client passes them as a `Cookie` header on outbound calls — this is easy to forget and silently produces an unauthenticated request that the backend rejects with 401.
- **Query key drift**: Any rename of queryKeys on the client-side hooks AFTER server prefetch is wired will silently cause duplicate fetches. Add a simple test (or a runtime console warning in dev) that fails if a page's dehydrated queries are re-fetched on mount.
- **Dynamic rendering default**: Using `cookies()` in a server component makes the route dynamic (no static cache). That's what we want here — just don't accidentally opt into `force-static`.
- **Bundle size**: Server components reduce client JS. Keep an eye on the `.next/analyze` output if you run `@next/bundle-analyzer` to confirm the refactor is actually trimming client bundles.
- **Error boundaries**: A failed server prefetch shouldn't crash the whole page. Wrap each prefetch in try/catch and let the client hook retry — that way the server path is a "nice-to-have" optimization, not a new failure mode.

---

## Deliverable checklist

- [ ] Phase 0 baseline numbers recorded somewhere you can find again.
- [ ] Phases 1–3 merged as **separate** PRs (one for infra, one for billing pilot, one per expanded page). Do not bundle.
- [ ] Each PR includes a before/after LCP screenshot or number in the description.
- [ ] If you abandon the migration partway, remove the server-only files from Phase 1 so they don't rot.
