# Tooltip overlap audit

We had a recurring class of bug where Radix tooltips would visually cover and/or
intercept clicks for the controls they describe — most painfully when a tooltip
was attached to a `Select`/`DropdownMenu`/`Popover` trigger and the open
listbox sat directly below the tooltip.

This doc tracks the global mitigations and the per-page fixes so we can sweep
through the remaining hot spots one by one without re-litigating the same
trade-offs.

## Global mitigations (already applied)

These three changes solve the overwhelming majority of overlap reports and
should be left in place even after page-by-page fixes land.

1. **`src/components/ui/tooltip.tsx`** — `TooltipContent` now sets
   `pointer-events: none`, ships at `z-[55]` (below `z-popup` = 65 used by
   Select/Popover/Dropdown portals), and defaults to `sideOffset={8}` +
   `collisionPadding={8}`. Translation: even if a tooltip is still fading out
   on top of an open dropdown, it can never swallow a click and the dropdown
   visually covers it.
2. **`src/app/providers.tsx`** — root `TooltipProvider` now uses
   `delayDuration={250}`, `skipDelayDuration={150}`, and
   `disableHoverableContent`. Tooltips appear faster, leave faster, and the
   user can never "land" inside one to keep it alive.
3. **Trigger composition** — wherever a tooltip wraps a popover trigger we
   prefer `<DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger
   asChild><Button/></DropdownMenuTrigger></TooltipTrigger></Tooltip></DropdownMenu>`
   so both triggers compose onto the actual DOM element. The inverted nesting
   broke the click handler entirely (see the dropdown-actions fix from the
   previous round).

## Per-page status

`Status` legend: ✅ fixed · 🟡 needs review · ⏳ untouched (likely fine, sweep
when convenient).

| Page / component | Status | Notes |
| --- | --- | --- |
| `src/features/jobs/components/jobs-list-view.tsx` (status filter) | ✅ | Tooltip moved to `side="left"` so it can't sit between the trigger and the open `SelectContent`. This was the original report. |
| `src/app/(platform-admin)/admin/payments/payments-page-client.tsx` (status filter) | ✅ | Filter tooltip had no `side` prop — Radix would flip it to bottom near the top of the page and overlap the open `SelectContent`. Pinned to `side="top" align="start"`. |
| `src/components/recipes/settings-section.tsx` (settings rows) | ✅ | Both `SettingsToggle` and `SettingsSelect` already use `<TooltipContent side="left">`. The wrapping `<div>` around the disabled-capable control is intentional (Radix tooltip doesn't fire on `pointer-events: none` children). With the global pointer-events fix this is fully covered. |
| `src/app/(platform-admin)/admin/support-cases/page.tsx` (filter row) | ✅ | `FilterSelect` uses `side="top"`. The `SelectContent` opens below — no rectangle overlap. |
| `src/app/(tenant)/app/support-cases/page.tsx` (filter row) | ✅ | Same `FilterSelect` shape, `side="top"`. |
| `src/app/(tenant)/app/support-cases/new/page.tsx` (priority/category pickers) | ✅ | Both Select wrappers explicitly pin `side="top"`. |
| `src/app/(tenant)/app/users/new/page.tsx` (role + department pickers) | ✅ | Both Select wrappers explicitly pin `side="top"`. |
| `src/app/(platform-admin)/admin/tenants/onboarding/onboarding-queue-client.tsx` (row actions, Turnstile chips, Review button) | ✅ | Row-action menu uses the corrected `DropdownMenu > Tooltip > TooltipTrigger asChild > DropdownMenuTrigger asChild` nesting with `side="left"`. The Turnstile/Review tooltips don't sit next to a popover. |
| `src/app/(tenant)/app/visitors/visitors-page-client.tsx` (row actions menu) | ✅ | Already follows the corrected nesting with `side="left"`. |
| `src/app/(tenant)/app/settings/checkin-configs/page.tsx` (header CTA, row actions, edit) | ✅ | Header CTA uses `side="bottom"` (no dropdown adjacency); row actions use `side="left"`. |
| `src/components/navigation/topbar.tsx` (avatar menu, notif bell) | ⏳ | Dropdown triggers — already follow the corrected nesting order. Spot-check visually if a report comes in. |
| `src/components/navigation/notification-dropdown.tsx` | ⏳ | Same pattern as topbar; revisit only if reports come in. |
| `src/components/navigation/app-sidebar.tsx` | ⏳ | Tooltips on collapsed nav icons. Pop to the right of the rail — no dropdown adjacency. |
| `src/components/settings/theme-picker.tsx`, `copyable-id.tsx`, `sessions-table.tsx`, `security-tab.tsx` | ⏳ | Icon-button tooltips with no popover adjacency. Default top is fine; pointer-events fix is enough. |
| `src/features/account/components/{password-change,two-factor-setup,two-factor-disable}-dialog.tsx` | ⏳ | Tooltips inside dialogs on close/back/show-password buttons. No popover adjacency inside the dialog body. |
| Row-action `…` menus across `departments/page.tsx`, `appointments-page-client.tsx`, `users/page.tsx`, `incidents/page.tsx`, `branches/page.tsx`, `dpo/page.tsx` | ✅ | Migrated to the corrected nesting in the previous round so the actions menu opens on click. |
| Form Save/Cancel button pairs (incident-form, branch-form, plan-form, etc.) | ⏳ | Tooltip wraps `LoadingButton` inside a `<span>`. No dropdown adjacency. Pointer-events fix is enough. |

## How to sweep a page (recipe)

When you tackle one of the 🟡 rows above:

1. Reproduce: hover the tooltip target, then click it. If the popover/dropdown
   that opens lands underneath the tooltip rectangle, it's a hit.
2. Decide on the smallest fix:
   - If the tooltip just describes the trigger, set
     `<TooltipContent side="left">` (or `right`/`top`) to push it away from
     where the popover opens.
   - If the tooltip describes a whole row of controls (settings rows), move
     it onto a small `?` icon next to the label so it stops anchoring on the
     control itself.
   - If the tooltip is purely decorative — drop it. The visible label is
     enough.
3. Re-test on mobile (tooltips don't fire on touch, but the layout has to
   still make sense).
4. Tick the row off in this table.

## What we deliberately did NOT do

- We did **not** raise the dropdown z-index above tooltips. Tooltips are
  globally below dropdowns now; the inverse would put the tooltip above an
  active modal/sheet, which is worse.
- We did **not** add a custom `onOpenChange` -> `setTooltipOpen(false)` shim
  on every wrapping `Select`. The global `pointer-events-none` + faster delay
  makes the lingering tooltip a non-issue in practice; the shim would be
  duplicated boilerplate on every form.
