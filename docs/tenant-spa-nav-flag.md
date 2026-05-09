# Tenant SPA-Nav Feature Flag

## What this is

The tenant shell (`/app/*`) currently force-reloads the page on every
internal click. That MPA pattern was put in place to sidestep a Radix
Tooltip portal cleanup race against React 19's reconciler that crashed
App Router transitions with `removeChild on null` and left navigation
stuck mid-flight.

This flag turns the SPA path back on for individual sessions so a real
human can verify in a browser whether the underlying race is fixed
before flipping the default for everyone. It is intentionally per-user,
not per-deploy.

## How to enable it (test session)

Append `?spa-nav=on` to any tenant URL once. The flag is sticky: it
writes `visichek-tenant-spa-nav=on` to `localStorage` and every
subsequent navigation in the same browser session will use the SPA
path.

```
https://app.visichek.com/app/dashboard?spa-nav=on
```

To turn it back off:

```
https://app.visichek.com/app/dashboard?spa-nav=off
```

…or clear the `visichek-tenant-spa-nav` key from the browser's
localStorage in DevTools.

## How to enable it as a build-time default

Set `NEXT_PUBLIC_TENANT_SPA_NAV=on` in the environment for the build.
Useful for staging where you want the whole team on the SPA path
without each person setting the flag manually.

User-set values still win — a user who explicitly chose `off` won't be
flipped back on by the env default.

## What changes when the flag is on

- `FullReloadNavInterceptor` does nothing — no `click` listener gets
  registered, so Next.js Link's default SPA behaviour takes over.
- `NavigationLoadingProvider.navigate` calls `router.push` instead of
  `window.location.assign`, and starts a 4-second commit watchdog. If
  the route hasn't committed in that window (the documented hung-
  transition signature), the provider hard-reloads to the same target.
  The timer is cleared as soon as `usePathname()` reports the new
  pathname.
- The `useNavLoading({ scope: "local" })` fallback applies the same
  rule for components that opt out of the global provider.

## What does NOT change

- The admin shell (`/admin/*`) was already SPA. This flag is tenant-
  only.
- Per-anchor `data-full-reload="off"` opt-outs continue to work; in SPA
  mode they're effectively no-ops because no interceptor runs.
- Modifier-key clicks, downloads, target=`_blank`, and external links
  keep their default browser semantics in both modes.

## Verification checklist

When testing the SPA path in a browser, watch for:

1. **No `removeChild on null` in the console** when navigating between
   pages that both render Radix Tooltips (sidebar, topbar, data tables
   all qualify).
2. **No stuck spinner** on a sidebar item — the per-item `Loader2`
   should clear within ~500 ms on a normal page.
3. **No fallback reload** — if the watchdog fires, you'll see a fresh
   document load with the URL you clicked. That means the underlying
   race re-occurred and we should NOT flip the default yet.
4. **React Query cache survives** a route change — pending-approvals
   counters don't blink to zero on navigation.

Report any observed `removeChild on null` or stuck-transition
symptoms in the navigation audit issue before flipping the default.

## Removal plan

Once the SPA path passes the verification checklist for a sustained
period in real use:

1. Default `NEXT_PUBLIC_TENANT_SPA_NAV=on` in production.
2. After a quiet window with no regressions, delete
   `FullReloadNavInterceptor`, the MPA branch in
   `NavigationLoadingProvider.navigate`, and this doc.
3. Re-evaluate the DOM-reconciler monkey patch in
   `src/app/layout.tsx` per the navigation audit's Low-priority item
   #9 — once full reloads are no longer the recovery path, the patch
   may not be needed.
