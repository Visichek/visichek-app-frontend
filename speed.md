# VisiChek Frontend — Compilation Speed Analysis

## What the logs show

Next.js compiles routes lazily in development: a route is only compiled the first time it is visited.
Once compiled it is cached in memory and subsequent visits are fast (typically < 300ms).
The slow numbers in the logs are always **first-visit compilation times**, not a sign that the
app is slow at runtime.

```
✓ Compiled /app/visitors in 47.2s   → first visit  (50832ms total response)
  GET /app/visitors 200 in 231ms    → second visit  (cached)
```

So the question is: why do first-visit compiles take so long?

---

## Root causes

### 1. Webpack (no Turbopack)

The biggest single factor. `next dev` uses **Webpack** by default.
Webpack bundles the full dependency graph from scratch on each cold start, using a single
JavaScript thread. For a project with 232 source files and a large `node_modules` tree, this is
inherently slow.

**Turbopack** (Next.js's Rust-based bundler) can be 10×–70× faster on incremental and cold
compiles. It is stable in Next 15 for `next dev`.

---

### 2. Module count per route varies wildly

The logs expose the module count for each compiled route:

| Route | Modules compiled | First-compile time |
|---|---|---|
| `/admin/subscriptions` | 1 536 | 3.7 s |
| `/admin/dashboard` | 1 548 | 5.7 s – 24 s |
| `/admin/tenants` | 1 551–1 567 | 6 – 73 s |
| `/admin/plans` | 1 537–1 558 | 30 – 64 s |
| `/app/users` | 2 888 | 10.2 s |
| `/app/billing` | 2 905 | 21.1 s |
| `/app/visitors` | 2 886 | 47.2 s |
| `/app/dashboard` | 2 849 | 9.1 – 70.2 s |
| `/admin/discounts` | 2 809 | 45.6 s |

The tenant shell routes (`/app/*`) consistently pull in ~2 800–2 900 modules while the lighter
admin routes pull in ~1 500. This means the tenant shell is importing roughly **twice as much code**
as the admin shell for equivalent functionality. Every extra module adds Webpack work.

---

### 3. The `components/ui/INDEX.ts` barrel file

`src/components/ui/INDEX.ts` re-exports all 22 UI primitives (Button, Dialog, Sheet, Table,
Tooltip, Command, etc.) from a single entry point.

When **any** file in the project imports one component from that barrel:

```ts
import { Button } from "@/components/ui";
```

Webpack must resolve, parse, and tree-shake all 22 components plus their Radix dependencies,
even if only one is used. Barrel files defeat module-level code splitting at the Webpack analysis
stage and inflate the module count of every route that touches any UI component.

---

### 4. Heavy first-party dependencies

Several packages in `package.json` carry large module trees that are pulled in on first visit:

| Package | Why it is heavy |
|---|---|
| `recharts` | SVG charting library; pulls in d3-scale, d3-array, and several other d3 sub-packages |
| `motion` (Framer Motion v12) | Full animation runtime |
| `@tanstack/react-table` | Large generics-heavy table engine |
| `cmdk` | Command palette; depends on `@radix-ui/react-dialog` and React virtual DOM diffing |
| 8 × `@radix-ui/*` packages | Each is separate; Webpack resolves each independently |

These are loaded on the first route that uses them. `/app/dashboard` and `/app/visitors` both
use recharts and react-table, which is why those routes compile the slowest.

---

### 5. Very large page files

TypeScript type-checking during compilation is proportional to the complexity of each file.
These files are unusually large for page components:

| File | Lines |
|---|---|
| `src/app/(tenant)/app/visitors/page.tsx` | 561 |
| `src/features/plans/components/plan-form-modal.tsx` | 784 |
| `src/app/(platform-admin)/admin/settings/page.tsx` | 815 |
| `src/app/(tenant)/app/settings/page.tsx` | 849 |
| `src/features/auth/components/command-launcher.tsx` | 579 |

Each of these defines inline column defs, form schemas, multiple modals, and tab logic all in one
file. TypeScript must infer and check all of that in a single pass. Splitting them into smaller
co-located components significantly reduces per-file type-check time.

---

### 6. Cache eviction between restarts

The wide time variance for the **same route** across sessions (e.g., `/admin/plans` ranged from
232 ms to 64.6 s, `/admin/login` from 208 ms to 70.2 s) is explained by the Webpack **incremental
cache** being dropped when:

- the dev server is restarted
- `node_modules` change
- `next.config.ts` or `tsconfig.json` changes
- the `.next/cache` folder is deleted

After a cache drop, every route is compiled from scratch again. This is expected Webpack behavior.

---

## What will speed this up

### Priority 1 — Enable Turbopack (immediate, large win)

Change the dev script in `package.json`:

```json
"dev": "next dev --turbopack"
```

Turbopack compiles only the modules actually requested for the current route and does incremental
work in Rust. It typically reduces first-visit compile from 30–70 s down to 2–8 s on a project
of this size. The `.next/cache` is incompatible between Webpack and Turbopack, so delete it once
after switching:

```bash
rm -rf .next
```

---

### Priority 2 — Stop importing from the barrel file

Replace all imports from `@/components/ui` (the barrel) with direct file imports:

```ts
// Before — pulls in all 22 components
import { Button, Dialog } from "@/components/ui";

// After — pulls in only what is needed
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
```

This is the single biggest change for reducing the module count per route. Every route that
currently touches the barrel will drop hundreds of modules from its compilation unit.

---

### Priority 3 — Split large page files

Break the large page files (561–849 lines) into smaller co-located components:

```
app/(tenant)/app/visitors/
  page.tsx               ← thin orchestrator, <100 lines
  _components/
    visitor-table.tsx    ← table + columns
    checkin-modal.tsx    ← check-in form
    session-detail.tsx   ← detail sheet
```

This reduces per-file TypeScript complexity and allows Webpack/Turbopack to reuse already-compiled
sub-components across routes.

---

### Priority 4 — Lazy-load heavy libraries

Routes that do not need charts or the command palette on initial render should load those
dependencies lazily:

```ts
import dynamic from "next/dynamic";

// Only loads recharts when the chart section is actually rendered
const VisitorChart = dynamic(() => import("./_components/visitor-chart"), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});
```

This prevents recharts and motion from inflating the module count of every page that imports them
transitively.

---

### Priority 5 — Persist the Webpack cache across restarts

Add this to `next.config.ts` if Turbopack is not used:

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    webpackBuildWorker: true,
  },
};
```

`webpackBuildWorker` runs Webpack in a separate worker thread and preserves its filesystem cache
more aggressively across restarts, reducing cold-start times after a server restart.

---

## Summary

| Cause | Impact | Fix |
|---|---|---|
| Webpack instead of Turbopack | Very high | `next dev --turbopack` |
| `INDEX.ts` barrel re-exports all UI components | High | Use direct file imports |
| Tenant shell pulls in 2× more modules than admin shell | High | Barrel fix + lazy loading |
| `recharts` + `motion` loaded eagerly on every route | Medium | `dynamic()` imports |
| Page files 500–850 lines with inline logic | Medium | Split into sub-components |
| Webpack cache drops on every server restart | Medium | Turbopack (persistent by default) |
