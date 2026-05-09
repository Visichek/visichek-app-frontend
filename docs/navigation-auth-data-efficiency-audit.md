# VisiChek Frontend Navigation/Auth/Data Efficiency Audit

Date: 2026-05-09

Scope: navigation loading loops, auth/session boot, React Query polling, and speed/security tradeoffs. This is not a whole-frontend audit.

Source of truth used: `AGENTS.md`, `docs/`, package metadata, and source code. `frontend-docs/` and `api-docs/` were not present in this checkout.

## Executive Summary

The main performance issue is not a single slow component. It is the navigation safety workaround: tenant-shell navigation currently forces full page loads to avoid stuck App Router transitions. That improves reliability, but it discards Next.js prefetching, shared layout persistence, client-side cache continuity, and makes every route change pay the session bootstrap cost again.

The highest-risk security issue is a direct auth-model violation in the compliance export hook. It reads `localStorage.getItem("accessToken")` and sends an `Authorization` header even though the frontend contract requires httpOnly cookies and `credentials`/`withCredentials` only.

Polling is mostly disciplined: hot lists disable background refetching, jobs and checkout use bounded polling, and query stale times are generally intentional. The bigger data efficiency problems are broad invalidation, low-value SSR prefetch paths that cannot see backend-domain cookies, and mixed navigation APIs that make loading state inconsistent.

## Ranked Findings

### Critical

#### 1. Compliance export bypasses the httpOnly-cookie auth model

Evidence: `src/features/privacy/hooks/use-compliance.ts:129`

The hook calls `fetch("/compliance/export")`, reads `localStorage.getItem("accessToken")`, and sends `Authorization: Bearer ...`.

Impact:

- Violates the app-wide rule that frontend code must never read, store, or attach auth tokens.
- Can silently fail because no access token should exist in local storage.
- Creates a second auth path that will not participate in axios refresh, error normalization, request IDs, or `withCredentials`.
- Increases future leakage risk if any stale token ever lands in local storage.

Suggested fix:

- Replace the raw `fetch` with the shared API layer or a dedicated blob-download helper that uses `withCredentials: true`.
- Do not set an `Authorization` header.
- Ensure the endpoint path is the backend API path (`/v1/compliance/export` through the configured API client), not an accidental same-origin frontend path unless a Next route proxy intentionally exists.
- Return a typed `Blob` and surface `ApiError` feedback through the same visible error pattern as other mutations.

### High

#### 2. Tenant-shell navigation forces MPA reloads for same-origin links

Evidence:

- `src/components/navigation/full-reload-nav-interceptor.tsx:8`
- `src/components/navigation/full-reload-nav-interceptor.tsx:58`
- `src/app/(tenant)/app/tenant-shell.tsx:192`
- `src/lib/routing/navigation-context.tsx:105`
- `src/hooks/use-nav-loading.ts:72`

The tenant shell mounts a capture-phase click interceptor that catches same-origin anchors and calls `window.location.assign`. The shared navigation context also uses `window.location.assign` for programmatic navigation.

Impact:

- Every tenant route change tears down the React tree, Redux state, React Query cache, open UI state, and prefetched route payloads.
- Each navigation re-runs `bootstrapSession()` and branding bootstrapping, increasing latency and load on auth/profile endpoints.
- Next.js App Router prefetching and shared layout persistence cannot help.
- The current approach prevents stuck SPA transitions by making all tenant navigation expensive.

Suggested fix:

- Replace the full-reload interceptor with a guarded Next navigation wrapper.
- Use `router.push`/`router.replace` for internal app routes and keep plain browser navigation only as an explicit fallback.
- Track a navigation request id, target href, start time, and committed pathname/search.
- Clear the clicked-item spinner when pathname/search commits or when the target is already current.
- Add a bounded fallback: if no commit happens within a short window, show inline recovery UI or perform one full reload as a last resort. Do not poll and do not silently loop reloads.
- Preserve modifier-key, external-link, download, and target behavior.

#### 3. Production dependency audit currently reports known advisories

Evidence:

- `npm audit --omit=dev --json` reports 3 production vulnerability groups: 1 high and 2 moderate.
- Installed versions from lock/package metadata: `axios@1.15.0`, `next@16.2.5`, `react@19.2.4`, `react-dom@19.2.4`, `postcss@8.5.8`.
- Reported vulnerable package groups: `axios`, `postcss`, and `next` via bundled/root PostCSS.

Impact:

- `axios@1.15.0` is within multiple advisory ranges; the reported fix is available.
- PostCSS advisory remains for `<8.5.10`; root `postcss` is `8.5.8`.
- `npm audit` also reports a `next` entry via PostCSS. Its suggested `next@9.3.3` is not a valid modern remediation path; treat that as an npm advisory resolution artifact, not a downgrade recommendation.

Suggested fix:

- Upgrade axios to the latest patched compatible version.
- Upgrade root PostCSS to a patched version (`>=8.5.10`) and refresh the lockfile.
- Re-run `npm audit --omit=dev`.
- If bundled `next/node_modules/postcss` remains flagged, verify upstream Next.js release notes/advisory state before changing Next versions.

#### 4. Frontend proxy cannot enforce protected routes because auth cookies are not visible

Evidence:

- `src/proxy.ts:1`
- `src/proxy.ts` comments document that auth enforcement is intentionally a no-op.
- `src/lib/auth/server-session.ts` documents the same blocker for server-side auth and prefetch.

Impact:

- Hard reloads cannot be rejected at the edge based on current auth state.
- Protected shell pages rely on client bootstrapping and `AuthGuard` after render begins.
- Full reload navigation magnifies this cost because every route transition becomes a fresh document request followed by client boot.
- Server Components cannot consistently prefetch authenticated data.

Suggested fix:

- Choose one auth architecture for frontend-domain enforcement:
  - BFF session cookie on the frontend domain.
  - API proxy through Next route handlers that owns a frontend-readable server session.
  - Shared parent-domain cookie that both frontend and API runtimes can see.
- Until then, keep client guard enforcement but avoid intentionally increasing reload frequency.

### Medium

#### 5. Navigation APIs are mixed, so loading behavior is inconsistent

Evidence:

- `router.push` appears in form submit flows such as `src/features/incidents/components/incident-form.tsx:113`, `src/features/branches/components/branch-form.tsx:81`, `src/features/departments/components/department-form.tsx:68`, and several settings/checkin-config pages.
- Shared navigation hook appears across sidebar, command launcher, notifications, quick actions, and many page links.
- Public guards and auth redirects use `router.replace`.

Impact:

- Some navigation clicks show per-item spinners; others do not.
- Some tenant links full reload through the interceptor; programmatic router calls can still SPA-transition.
- Debugging stuck navigation is harder because several mechanisms coexist.

Suggested fix:

- Introduce a single `useAppNavigation()` facade with:
  - `push(href, options)`
  - `replace(href, options)`
  - `markLinkClick(href)`
  - `isLoading(href)`
  - `clearOnCommit()`
- Migrate form redirects, dropdown menu items, command launcher, notification links, sidebar/mobile nav, and breadcrumbs to that facade.
- Keep auth guards as a narrow exception if they need immediate `replace` semantics, but still ensure spinner state clears.

#### 6. Server prefetch is often low-value because authenticated cookies are unavailable

Evidence:

- `src/lib/auth/server-session.ts:42`
- `src/lib/auth/server-session.ts:93`
- `src/lib/auth/server-session.ts:134`
- `ssrPrefetch` is used across tenant/admin pages, but `getServerSession()` returns `null` unless a frontend-domain `refresh_token` exists.

Impact:

- Server pages still allocate query clients and hydration boundaries, but often skip the useful prefetch work.
- Developers may assume pages are SSR-prefetched when most authenticated data still comes from client hooks.
- Full reload navigation amplifies the empty prefetch path.

Suggested fix:

- Keep `ssrPrefetch` only on pages where server cookies actually exist or where public data can be fetched without auth.
- For protected tenant/admin data, either implement the auth architecture fix above or remove low-value prefetch scaffolding from hot routes.
- Add lightweight instrumentation in `HydrationBoundary` or `ssrPrefetch` during development to expose dehydration size and skipped prefetches.

#### 7. Broad query invalidations can trigger avoidable refetches

Evidence:

- `src/features/visitors/hooks/use-visitors.ts` invalidates `visitorKeys.active`, `visitorKeys.sessions`, `visitorKeys.awaitingCheckout`, `["checkins"]`, and `["appointments"]` after checkout.
- `src/features/notifications/hooks/use-notifications.ts` invalidates the broad notifications namespace after several mutations.
- Support case mutations invalidate detail, message, and list namespaces together.

Impact:

- Correct but potentially noisy on data-heavy pages.
- Multiple active lists can refetch after one mutation even when only one affected row changed.

Suggested fix:

- Keep broad invalidation for correctness first, then tighten high-traffic paths with direct `setQueryData` updates and narrower invalidation.
- Prefer row-level cache updates after deterministic mutations: mark notification read/delete, support-case reply append, checkout removal from awaiting list.
- Keep broad fallback invalidation for cross-collection workflows where backend side effects are hard to model.

#### 8. Polling is reasonable but should be centralized as a policy

Evidence:

- Active visitors and awaiting checkout poll every 5 seconds.
- Pending check-ins poll every 5 seconds.
- Notifications poll every 30 seconds.
- Jobs list polls every 5 seconds, job details use status-dependent polling.
- Checkout sessions use adaptive polling.

Impact:

- Current intervals are mostly defensible and background polling is usually disabled.
- Without a shared policy table, future features can easily add unbounded or duplicate polling.

Suggested fix:

- Document a `Polling Policy` table in code/docs:
  - live receptionist queues: 5 seconds, foreground only.
  - notifications: 30 seconds, foreground only, focus refetch enabled.
  - jobs: adaptive until terminal, bounded timeout.
  - checkout/payment confirmation: adaptive and terminal-aware.
- Prefer status-dependent `refetchInterval` functions over fixed intervals for anything with terminal states.

### Low

#### 9. DOM reconciler monkey patch masks the likely root cause of navigation freezes

Evidence: `src/app/layout.tsx` injects `DOM_RECONCILER_GUARD` before interactive scripts.

Impact:

- It may keep the app usable around browser-extension DOM mutations.
- It also changes global DOM behavior and can hide root causes in Radix portal cleanup, extension conflicts, or React/Next transition bugs.

Suggested fix:

- Keep as a temporary guard only if production errors justify it.
- Add a follow-up issue to capture before/after error telemetry.
- Once navigation no longer requires full reloads, retest without this patch in a controlled branch.

#### 10. CodeRabbit external review is not currently runnable

Evidence: `coderabbit --version` fails with `CommandNotFoundException`.

Impact:

- This report is a local audit, not a CodeRabbit-produced review.

Suggested fix:

- Install and authenticate the CodeRabbit CLI later.
- Run `coderabbit review --agent -c AGENTS.md` as an external validation pass.
- Do not treat CodeRabbit as blocking for the local roadmap.

## Navigation Mechanism Map

Current mechanisms found in this pass:

- Sidebar desktop links: anchor tags with `handleNavClick`.
- Mobile nav links: anchor tags with `handleNavClick`, then sheet close.
- Tenant shell: `FullReloadNavInterceptor` catches same-origin anchors and forces reload.
- Shared navigation context: `navigate()` calls `window.location.assign`.
- Command launcher: calls shared `navigate()`.
- Notification dropdown: calls shared `navigate()`.
- Auth/logout/login flows: use shared `navigate()` in `useAuth`, while guards use `router.replace`.
- Forms and settings flows: several direct `router.push` calls.
- Public scan/splash/auth helpers: direct `router.replace` for public redirects.

Target state:

- One app navigation facade for internal route changes.
- Native anchors/Next links can still be used, but their click handling should report loading state to the same facade.
- Full reload is a fallback, not the primary tenant navigation strategy.

## Recommended Roadmap

### Stage 1: Security and dependency cleanup

- Fix `useComplianceExport` to use cookie-based API calls and remove `localStorage`/`Authorization`.
- Upgrade patched `axios` and root `postcss`; re-run `npm audit --omit=dev`.
- Confirm no other frontend path reads `accessToken`, `refreshToken`, `document.cookie`, or sets frontend `Authorization` for backend API calls.

### Stage 2: Safe SPA navigation wrapper

- Build `useAppNavigation()` on top of Next router and the existing loading context.
- Track target href including search params; clear on pathname/search commit.
- Handle current-route clicks immediately with no spinner.
- Add a bounded no-commit fallback that surfaces recovery or performs one intentional reload.
- Remove tenant `FullReloadNavInterceptor` after browser verification.

### Stage 3: Normalize callers

- Migrate sidebar, mobile nav, command launcher, notification dropdown, quick actions, account dropdown, breadcrumbs, and form redirects to the facade.
- Replace ad hoc `router.push` in tenant/admin feature forms with the facade where the action changes visible route content.
- Keep public redirect helpers simple, but ensure they do not leave global loading state behind.

### Stage 4: Data efficiency

- Add a polling policy doc/table and align future hooks to it.
- Tighten high-traffic invalidations with `setQueryData` where the affected row is known.
- Remove or instrument low-value authenticated SSR prefetch until frontend-domain auth is available.

### Stage 5: Auth architecture decision

- Decide whether VisiChek wants edge/server route enforcement and reliable authenticated SSR.
- If yes, implement one of: BFF session cookie, Next API proxy, or shared parent-domain cookie.
- If no, keep auth purely client/API enforced but avoid full reload navigations that make bootstrapping the bottleneck.

## Verification Performed

Commands run:

- `git status --short`
- targeted `rg` scans for navigation, auth headers, server prefetch, and polling
- `npm audit --omit=dev --json`
- `coderabbit --version`
- package metadata check for `next`, `react`, `react-dom`, `axios`, `postcss`, and `@tanstack/react-query`

Results:

- Existing dirty worktree was preserved.
- No build command was run.
- `npm audit --omit=dev` currently reports 3 production vulnerability groups.
- CodeRabbit CLI is not installed in this environment.

## Acceptance Criteria For Follow-Up Fixes

- No frontend code reads or stores access/refresh tokens.
- No frontend backend API call sets `Authorization` from browser state.
- Internal tenant/admin navigation preserves React Query cache and shell state for normal route changes.
- Every clickable route-changing element still shows an immediate item-level spinner.
- Spinner clears when the destination content commits, when the target is already current, or when fallback recovery begins.
- No navigation fallback can cause repeated reload loops.
- Polling intervals are foreground-only unless there is a documented reason.
- `npm audit --omit=dev` no longer reports fixable high-severity production advisories.
