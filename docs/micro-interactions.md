# VisiChek Micro-Interactions Map

This document captures small, intentional micro-interactions that can be added across the current VisiChek application without turning the product into an animation showcase.

The goal is simple: make the interface feel attentive, trustworthy, and precise. Each interaction should improve feedback, orientation, or confidence. Nothing here should feel ornamental.

## Current Baseline

The product already has a few strong interaction cues worth preserving and extending:

- `Theme toggle`: circular reveal and icon swap already make theme change feel intentional.
- `Notification dropdown`: unread bell pop and badge scale-in already add life without looping.
- `OTP input`: slot focus, auto-advance, paste handling, and completion behavior already feel deliberate.
- `Sidebar and mobile nav`: loading spinners on navigation items already acknowledge route transitions.
- `Quick actions`: drag-and-drop reorder already gives platform admin a tactile control moment.
- `Auth screens`: hover, active, and focus states already create a premium baseline for public-facing entry flows.

## Shared Principles

- Keep motion short: `140-220ms` for hover, focus, state swaps, and inline feedback.
- Use stronger motion only for real milestones: completion, verification success, or high-confidence confirmations.
- Favor `opacity`, `transform`, and subtle color changes over layout-heavy animation.
- Respect `prefers-reduced-motion`: keep the same state changes, remove movement intensity.
- Dense data views should stay quiet. The interaction should guide the eye, not entertain it.

## Shared Components And Patterns

### Buttons and loading buttons

- `Primary buttons`: add a tiny press response on click, then a short settle back to rest. This makes submit actions feel acknowledged before network latency becomes visible.
- `Loading buttons`: fade the label into the spinner state instead of swapping abruptly. This reduces the feeling of UI flicker during saves and submissions.
- `Success-followed buttons`: after successful inline actions, briefly show a check icon or success tint before returning to the default state. Good for copy, save, resend, and apply actions.

### Inputs, selects, checkboxes, switches, textarea, OTP

- `Inputs and textarea`: add soft focus elevation or border emphasis that appears quickly and leaves quickly. The form should feel responsive as soon as the user enters it.
- `Validation`: when a field becomes valid after an error, remove the error state with a small fade rather than a hard snap.
- `Selects`: rotate the chevron slightly on open and close. This helps users read dropdown state instantly.
- `Checkboxes and switches`: add a subtle thumb/check settle on toggle so preference changes feel intentional, especially in settings.
- `OTP input`: add a brief success sweep across the six cells when the final digit is accepted. This would reinforce secure progress without adding noise.

### Page headers, stat cards, and summary surfaces

- `Page headers`: when navigating between pages, fade and slide the title block in slightly. This gives route changes a clear beginning without slowing navigation.
- `Stat cards`: animate number changes with a very short count-up or digit transition only when values refresh or filters change. Static loads should remain simple.
- `Trend or status chips`: add a soft tint flash when the underlying metric updates so users notice that data is live.

### Data tables, search, sorting, and pagination

- `Search fields`: debounce visually as well as functionally by showing a searching state in the input or table header. This reassures users that filtering is in progress.
- `Table sorting`: animate sort arrows with a clean flip or rotate instead of a plain text arrow swap.
- `Row actions`: after a successful action like delete, approve, deny, checkout, or archive, fade the row out or highlight the updated row briefly so the result is obvious.
- `Pagination`: on page change, fade table rows quickly while keeping the table shell stable. This preserves context better than a full skeleton reset.
- `Column toggles`: when columns are shown or hidden, use a short opacity transition so the table does not feel like it jumps.

### Modals, dialogs, sheets, and detail views

- `Responsive modals`: make desktop dialogs rise slightly and mobile sheets settle upward from the bottom with the same timing curve. This keeps the interaction language consistent across devices.
- `Destructive confirms`: emphasize the primary/destructive action only after the dialog is fully visible. This reduces accidental clicks while still keeping momentum.
- `Detail sheets`: animate internal sections in sequence when opening long detail panels so large information blocks are easier to scan.
- `Modal success states`: keep success confirmation inside the same surface when possible before dismissing. This gives closure to the task.

### Upload, toast, errors, skeletons, and offline feedback

- `File upload zone`: strengthen drag-enter feedback with a slight scale or border glow, then lock into upload progress once the file is accepted.
- `Upload success`: briefly replace the file icon with a success state before clearing the upload card.
- `Toasts`: let them rise and fade with a consistent direction so success, warning, and error feedback all feel part of one system.
- `Error states`: bring retry actions into focus with a subtle emphasis pulse on first appearance, then stop.
- `Skeletons`: shimmer lightly on first load only; avoid shimmer on every background refetch.
- `Offline banner`: slide in once from the top and hold steady; avoid repeated attention-seeking motion.

### Navigation, command launcher, notifications, theme

- `Sidebar items`: add a short active-pill settle when route changes complete. This makes navigation feel precise rather than just recolored.
- `Command launcher`: animate matched results with a quick fade/shift as the query changes. This makes global search feel more intelligent.
- `Notification items`: when marking one notification as read, fade the unread background rather than removing it instantly.
- `Theme toggle`: keep as the signature motion moment. Do not add competing high-drama transitions elsewhere.

## Public Flows

### App login and admin login

- `Mode switch to OTP`: transition from credential form to OTP state with a soft content swap instead of a hard replacement. This makes the security step feel like progress, not interruption.
- `Password reveal`: add a quick icon morph or crossfade when toggling visibility so the affordance feels deliberate.
- `Error banner`: animate in from slight vertical offset, then stay still. Users should notice errors immediately without feeling punished.
- `OTP success`: if verification passes, briefly show a completed state on the code cells before redirecting.

### Visitor self-registration

- `Tenant header`: if branding assets load late, fade the logo and brand color treatment in instead of snapping.
- `Appointment-prefill`: briefly highlight auto-filled fields so visitors understand which data came from their appointment.
- `Consent checkbox`: add a clear check confirmation and slight scroll guidance when consent is required and the user tries to submit without it.
- `Submit success`: keep the success card as a calm completion moment with a short icon scale-in and content fade.

### Public checkout

- `Token-in-URL auto-submit`: show a deliberate auto-checkout progress state with a short transition from idle to processing. This turns a technical shortcut into a trustworthy experience.
- `Badge token input`: treat paste as a positive event by briefly highlighting the field and enabling the CTA immediately.
- `Checkout success`: animate the success icon and visit-duration block in sequence so the confirmation feels complete and human.

### Rights request and rights status

- `Request type selection`: show the chosen rights type card or helper text with a small reveal so users understand the consequence of their selection.
- `Verification token copy`: after copy, replace the icon and add a short success tint on the token row. This is already partly present and should become a consistent pattern.
- `Status lookup`: when a request is found, reveal the result summary first and secondary details after. This prioritizes reassurance.

## Tenant App Flows

### Dashboard

- `Stat cards`: animate metrics in only on initial load and on explicit refresh moments, not on every render.
- `Charts or summary blocks`: if filters are added later, use shared filter-settle motion so the dashboard stays coherent with tables elsewhere.

### Visitors

- `Tab switch between active and pending`: animate the active underline and crossfade table content rather than snapping between views.
- `Check-in flow`: after submission, briefly highlight the newly created or confirmed visitor row so reception immediately sees the outcome.
- `Confirm check-in`: use a two-step confirmation feel where the action button acknowledges the click before the success state appears.
- `Deny visitor`: after deny, fade the row out and show a toast tied to the session name for strong clarity.
- `Session detail sheet`: reveal identity, visit, and verification blocks progressively to make long sheets easier to read.
- `OCR verification`: this should be one of the strongest micro-interaction flows in the app:
  - drag or upload area should react decisively when a file is added
  - extracted fields should populate with a slight reveal so users can compare scan results with confidence
  - applying verification should end with a strong but brief success state before dismissal
- `Check-out`: after successful check-out, use a row highlight or removal transition so staff trust that the person has been processed.

### Appointments, departments, branches, users

- `CRUD modals`: when editing existing records, prefilled values should appear already stable; only new validation and save feedback should animate.
- `Create success`: briefly highlight the new row or card after create.
- `Delete or deactivate`: fade the removed item or shift its badge/status with a short transition instead of instant disappearance.
- `Status badges`: if a user, branch, or appointment changes state, animate the badge color transition to make the update easier to register.

### Branding

- `Color input and preview`: show brand changes live with a soft preview transition rather than an immediate harsh swap.
- `Logo upload`: after upload, animate from placeholder to real image so admins can verify the asset changed successfully.
- `Reset branding`: keep the confirm dialog calm, then fade preview surfaces back to defaults rather than snapping.

### Incidents

- `Priority or severity selection`: give selected severity a stronger visual settle because this choice carries real operational weight.
- `Deadline-sensitive updates`: when an approaching-deadline incident changes status, briefly emphasize the row or badge update.
- `Incident create/edit`: after save, return users to the updated list with the touched item highlighted.

### Audit

- `Filters and search`: show active filter count and a quick filter-chip settle so users know the log is constrained.
- `Table refresh`: highlight newly loaded rows lightly instead of replaying the whole table.
- `Detail or export actions`: acknowledge action start immediately since audit users care about accuracy and trust.

### DPO and compliance

- `Request cards and tables`: when switching between DSR-related surfaces, keep motion restrained and precise.
- `High-stakes status changes`: completion, deletion, or escalation should always have explicit confirmation feedback and a stable final state.
- `Copyable IDs and references`: use the same copy-success pattern as rights request tokens for consistency.

### Billing and usage

- `Usage bars`: animate width changes on first load and on plan changes only. This makes quota consumption feel live without being noisy.
- `Invoice actions`: after clicking view/download, acknowledge with a pressed state and short loading indicator because users may assume nothing happened.
- `Plan/status badges`: animate status transitions softly when billing state changes.

### Alerts

- `Empty state`: if there are no alerts, reveal the empty state icon and copy gently so the page feels intentionally calm, not unfinished.
- `Future alert arrivals`: when alerts are later introduced, use a one-time row/card emphasis rather than looping urgency indicators.

### Settings and account security

- `Tab changes`: current settings tab switch already has loading affordance; add content crossfade so the change feels smoother.
- `Toggles and selects`: after a successful save, show a tiny inline saved confirmation near the changed control, then let it disappear.
- `Theme selection in settings`: keep this much quieter than the topbar theme toggle; a soft fade is enough.
- `Password strength`: if strength bars are shown, animate them progressively as criteria are met.
- `Two-factor setup and disable`: use explicit step-to-step progression so users always know where they are in the security flow.
- `Session revoke`: after revoking a device, fade the row and keep the remaining session list stable.

## Platform Admin Flows

### Platform dashboard and quick actions

- `Quick action cards`: add hover lift and drag-handle emphasis only in edit mode so the dashboard stays clean in normal use.
- `Reorder drop target`: strengthen insertion feedback while dragging so admins know exactly where the card will land.
- `Metric cards`: use the same stat-card update behavior as tenant dashboard for system-wide consistency.

### Tenants and bootstrap

- `Bootstrap tenant modal`: show the tenant creation flow as a guided progression, especially once the submit starts.
- `Tenant list actions`: after creating or bootstrapping, highlight the affected tenant row or card.
- `Status changes`: use a soft badge transition for activated, suspended, or newly created tenants.

### Plans, subscriptions, discounts, payments

- `Plan and discount CRUD`: after archive, activate, disable, or delete, keep users oriented with row-level confirmation instead of relying only on toast.
- `Subscription cancellation`: make the destructive confirmation feel deliberate with strong final-state feedback in the table.
- `Payments`: acknowledge PDF or invoice actions immediately since document retrieval often feels slow.
- `Pricing or discount values`: animate value changes only when changed through an edit flow, not during normal load.

### Platform settings

- `Settings tabs, toggles, session controls`: mirror the tenant settings interaction language exactly so admin and tenant surfaces feel like one product.
- `Advanced or sensitive actions`: use clearer confirmation and post-action feedback than ordinary preference toggles.

## Highest-Priority Additions

These are the best next micro-interaction additions for impact versus effort:

1. Add row highlight or fade transitions after table actions across visitors, users, branches, plans, discounts, and subscriptions.
2. Add a shared search/filter feedback pattern for tables: searching state, active-filter count, and calm clear/reset feedback.
3. Improve the visitors OCR flow with stronger upload acceptance, extracted-field reveal, and apply-success confirmation.
4. Add inline saved confirmations for settings toggles, selects, and security preferences.
5. Smooth the login-to-OTP transition on both auth screens.
6. Add appointment-prefill and consent guidance feedback in public registration.
7. Add upload success and drag-enter emphasis in shared file upload zones.
8. Add modal/sheet open-close consistency across `ResponsiveModal`, confirm dialogs, and detail sheets.
9. Add usage bar and invoice-action acknowledgement in billing.
10. Strengthen drag-and-drop feedback in platform quick actions.

## Default Implementation Notes

- Keep one motion language across public, tenant, and admin surfaces.
- Reuse `motion/react` where animation is needed; do not introduce another motion library just for micro-interactions.
- Prefer reusable wrappers or shared behavior hooks for row highlight, copy success, save confirmation, and modal transitions.
- If a recommended interaction competes with readability, remove the motion and keep the state feedback.
