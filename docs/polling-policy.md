# Polling Policy

This is the rule book for any React Query polling on the frontend. Read it
before adding `refetchInterval` to a new hook. Adding unbounded or
overlapping polling is the fastest way to make the app feel slow and to
hammer the backend with avoidable traffic.

## Core rules

1. **Foreground only by default.** Always set
   `refetchIntervalInBackground: false` unless there is a specific written
   reason the data must keep ticking when the tab is hidden. The default
   helps battery life on iPad receptionist kiosks and avoids waking idle
   sessions for read-only data.
2. **Terminal-aware for jobs and webhooks.** When the resource has a
   terminal state (job done, KYC settled, payment confirmed), use a
   function `refetchInterval: (query) => …` and return `false` once the
   state is terminal. Never poll past a known final state.
3. **No race-prone timeouts.** Don't compose polling with `Promise.race`
   + `setTimeout`; if you must add a timeout, clear the timer in `finally`
   so a losing branch can't fire side effects (see auto-memory note
   "Promise.race + setTimeout side effects").
4. **One source of truth.** A list and its counters share the same query
   namespace; mutations should patch both via `setQueryData` first, and
   only invalidate when patching is impractical.
5. **Stale time stays under poll interval.** `staleTime` should generally
   be ≤ half the `refetchInterval`. Otherwise React Query may serve stale
   data for longer than the poll cadence promises.

## Cadence table

| Use case                                                              | Interval | Background? | Notes                                                                                                                                |
| --------------------------------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Live receptionist queues** (pending approvals, awaiting checkout)   | 5 s      | foreground  | New submissions must show up without manual refresh. `staleTime: 2_000`. See `usePendingApprovals`, `useAwaitingCheckout`.            |
| **Pending check-ins on the receptionist tab**                         | 5 s      | foreground  | Implemented via `useTenantCheckins({ state: "pending_approval" })`; intervals disabled on every other tab.                            |
| **Notifications list + unread-count bell**                            | 30 s     | foreground  | `staleTime: 15_000`, refetch on focus, mark-read/delete patches the cache via `setQueryData` so polling is the safety net only.       |
| **Support cases — tenant view**                                       | 10 s     | foreground  | Tenant is actively triaging; surface admin replies fast. Detail/messages are not polled — the list is the entry point.                |
| **Support cases — admin queue**                                       | 10–60 s  | foreground  | Active queue 10 s; backlog 60 s. Pick the longer interval when the role is supervisory rather than triaging.                          |
| **Incidents approaching deadline banner**                             | 60 s     | foreground  | NDPC 72-hour countdown — once-a-minute is plenty.                                                                                     |
| **Admin dashboard tiles**                                             | 60 s     | foreground  | Aggregated counters; no need for sub-minute resolution.                                                                               |
| **Tenant dashboard tiles**                                            | 60 s     | foreground  | `useDashboardStats` uses `REFETCH_INTERVAL_MS = 60_000`.                                                                              |
| **Job list (the "Jobs" page)**                                        | 5 s      | foreground  | Reused for queue health; falls back to status-aware detail polling.                                                                   |
| **Job detail (single job)**                                           | adaptive | foreground  | `refetchInterval` returns `false` once the job is `succeeded`/`failed`. Implemented in `use-jobs.ts` and `use-job-polling.ts`.        |
| **Checkout / payment confirmation**                                   | adaptive | foreground  | Status-dependent; stops polling when terminal. See `use-checkout.ts`.                                                                 |
| **KYC widget status fallback (`/v1/kyc/status/{checkinId}`)**         | 4 s      | background OK | Polls only after the Dojah widget closes inconclusively. Stops when status leaves `ongoing`. Background allowed because the kiosk window may be deliberately left open while the visitor steps away. |

## When NOT to add polling

- **The data does not change between user actions.** Cached fetch + manual
  refetch on the relevant mutation is enough. Examples: tenant branding,
  enum bundles, check-in configs, plans/discounts catalogs.
- **The page is just rendering a single record the user is editing.**
  React Query's default focus refetch is sufficient; polling overlaps
  with their typing and creates flicker.
- **Server-Sent Events or WebSocket exists.** Prefer the push channel and
  keep a long-interval poll as a watchdog only.

## Adding a new polling hook — checklist

1. Pick a row in the cadence table above. If your use case doesn't fit any,
   add a new row to this doc in the same PR — don't ship a new interval
   without documenting it.
2. Set `refetchIntervalInBackground: false` unless you have a documented
   reason to override.
3. If the resource has a terminal state, use a function form for
   `refetchInterval` and return `false` on terminal.
4. Set `staleTime` ≤ half the interval.
5. Wire mutations to patch the cache via `setQueryData` for deterministic
   row updates; reserve `invalidateQueries` for cross-collection effects
   the backend's response can't describe locally.
6. If you find yourself wanting to poll faster than 5 s, stop and ask
   whether a push channel or a server-driven optimistic update is the
   right answer instead.

## Existing inventory (snapshot)

The cadence table above is sourced from current code as of 2026-05-09.
When you add or change polling, update this doc in the same PR. If the doc
and code disagree, treat the code as authoritative and fix the doc; do
NOT leave them out of sync.
