# Premium Interaction Spec For Admin Surfaces

This file replaces a rough motion request with an explicit product and implementation guide for premium-feeling admin interactions in VisiChek.

The goal is not "more animation." The goal is to make the interface feel considerate, calm, and well-crafted. Motion should reassure the user that the product is alive and attentive. It should never feel ornamental, noisy, or sales-driven.

## Product Intent

The admin experience should communicate:

- this product is precise
- this product respects the user's focus
- this product acknowledges every action
- this product cares about the quality of the experience, not only the transaction

That means:

- no ambient decorative motion
- no repeated bouncing or pulsing loops
- no flashy transitions across dense data views
- no animation that delays comprehension

For application admin, motion intensity stays low. "Premium" here means refinement, not spectacle.

## Core Motion Philosophy

Follow the shared rules already established in `frontend-docs/design-docs/shared/design-rules.md` and `frontend-docs/design-docs/application-admin/design-system.md`.

Interpret them this way:

- motion is used for acknowledgement, orientation, and polish
- motion should cluster around state changes, not idle states
- the strongest animation on the page should happen rarely
- dense tables remain quiet
- micro-interactions should reward attention without competing for it

## Motion Budget

Use these timings as defaults unless a component has a strong reason not to:

- hover and focus feedback: `140-180ms`
- icon state swaps: `160-220ms`
- dropdown, popover, and sheet entrances: `180-240ms`
- theme transition reveal: `420-560ms`
- notification arrival emphasis: `360-520ms` total, then stop completely

Use these easing patterns:

- standard UI feedback: `ease-out`
- premium reveal moments: gentle custom ease or soft spring
- nothing should feel elastic, rubbery, or playful in a consumer-app way

Animate primarily:

- `opacity`
- `transform`
- very light `filter` or `backdrop` accents only if performance remains stable

Avoid animating:

- layout-heavy properties
- shadows with large blur changes on repeated surfaces
- table row heights for decorative reasons
- background effects that constantly move

## Theme Change: Desired Experience

There are two approved theme-change modes.

### 1. Topbar theme toggle: signature transition

When the user clicks the sun or moon icon in the topbar, the theme change should feel intentional and delightful.

Desired behavior:

- the transition originates from the toggle button itself
- a circular reveal expands from the exact toggle hit area
- the reveal carries the incoming theme tone, not a random accent color
- the rest of the UI updates as the circle expands, not before it
- the effect should feel smooth and premium, not fast and gimmicky

Emotional target:

- "the app noticed my choice and is carefully reshaping itself"

Not acceptable:

- instant hard swap with no transition
- dramatic flash or strobe-like inversion
- exaggerated zoom or long theatrical reveal
- a reveal so slow that the app feels blocked

### 2. Settings page theme change: quiet fade

If the user changes theme from settings, use a much calmer transition.

Desired behavior:

- short cross-fade between theme states
- no expanding circle
- no flourish competing with the settings task
- state should feel confirmed, but subdued

Emotional target:

- "setting saved and applied cleanly"

## Theme Change: Explicit Design Decisions

### Visual source

The reveal must originate from the topbar theme toggle button in `src/components/theme/theme-toggle.tsx`, not from screen center.

### Reveal shape

Use a perfect circle, not a blob, wave, or radial burst.

Reason:

- a circle feels precise
- it maps cleanly to the icon button
- it reads as controlled rather than decorative

### Color treatment

The reveal color should be derived from the incoming theme background.

Use:

- light mode transition: reveal with the incoming light surface/background tone
- dark mode transition: reveal with the incoming dark surface/background tone

Do not use:

- brand gradients
- saturated accent colors
- rainbow interpolation

This is a theme transition, not a marketing animation.

### Content response during reveal

As the reveal expands:

- background surfaces should appear to transform with it
- icons and text may cross-fade slightly to avoid a harsh palette snap
- the icon inside the toggle should rotate or morph subtly while swapping

Do not:

- animate every child independently
- stagger table cells
- create a chain reaction through cards and widgets

### Timing

Target total duration: `420-560ms`

Suggested pacing:

- first `80-120ms`: toggle press acknowledgement
- next `320-420ms`: circular reveal expansion and theme variable swap
- final `40-80ms`: small settle on icon/state

### Icon behavior

The sun/moon icon should not just disappear and pop in.

Preferred behavior:

- slight rotate plus fade between states
- tiny scale shift, no more than about `0.92 -> 1.0` or `1.0 -> 0.92 -> 1.0`

The icon animation should support the reveal, not become the main event.

## Theme Change: Engineering Notes

### Component ownership

Current relevant surfaces:

- topbar trigger: `src/components/theme/theme-toggle.tsx`
- topbar container: `src/components/navigation/topbar.tsx`
- settings theme picker: `src/app/(platform-admin)/admin/settings/page.tsx`
- oosettings theme picker: `src/app/(tenant)/app/settings/page.tsx`

### Recommended implementation direction

Use `motion/react` only. Do not add another animation system for this.

Recommended structure:

1. capture the toggle button bounding rect on click
2. render a fixed overlay reveal layer above the app shell
3. compute the radius needed to cover the viewport from the click origin
4. begin the reveal animation
5. switch theme during the reveal, not long before it
6. remove the overlay as soon as the transition completes

The overlay should be:

- fixed
- pointer-events none
- isolated from layout
- short-lived

### Theme swap timing rule

If the theme variables swap too early, the reveal looks fake.
If they swap too late, the UI flashes.

The implementation should switch theme around the early-middle of the reveal, when the expanding circle has already established visual ownership of the transition.

### Fallback behavior

If geometry capture fails for any reason:

- fall back to a simple opacity transition
- do not block theme switching

### Hydration and first paint

Do not animate:

- initial theme hydration
- server/client reconciliation
- automatic sync from stored user preference on app boot

The signature reveal is only for direct user-triggered theme toggles from the topbar.

## Notification Bell: Desired Experience

The notifications button in `src/components/navigation/notification-dropdown.tsx` should acknowledge new unread notifications in a tasteful way.

The request is for the button to "jump" when there is a new notification. That should be interpreted carefully.

Desired behavior:

- when unread count increases, the bell performs one brief upward pop or soft nudge
- the badge appears or updates with crisp emphasis
- the effect happens once per newly received notification event batch
- the interaction stops completely after the acknowledgment

Emotional target:

- "something new arrived"
- not "click me now"

## Notification Bell: Explicit Design Decisions

### Bell motion style

Use a restrained vertical pop with a tiny rotational accent if needed.

Good:

- 1 quick upward movement
- 1 controlled return
- optional tiny ring-like tilt

Bad:

- infinite bounce
- cartoon wobble
- attention-seeking shake
- repeated pulsing while unread count remains non-zero

### Badge behavior

The unread badge should feel more precise than loud.

Use:

- a quick scale-in when the badge first appears
- a subtle number update transition when count changes

Avoid:

- explosive badge growth
- repeated pulse loops
- harsh color flash

### Trigger condition

Animate only when unread count increases compared to the last known count.

Do not animate when:

- the component first mounts with existing unread notifications
- polling returns the same unread count
- unread count decreases because the user reads items
- the dropdown is merely opened

This avoids the cheap feeling of recycled attention hooks.

### Timing

Target total duration: `360-520ms`

Suggested sequence:

- bell pop: `180-240ms`
- badge settle: `140-220ms`

This should read as one composed event, not two disconnected animations.

## Notification Bell: Engineering Notes

Recommended state logic:

- keep previous unread count in a ref
- compare previous and current count after each successful unread-count fetch
- animate only if `current > previous` and the previous value is not the initial unknown state

Animation implementation guidance:

- prefer a one-shot motion value or keyed animation state
- reset cleanly after completion
- keep the button target size and layout stable

The button must remain fully usable during the animation.

## Premium Micro-Interaction Rules Across The Admin App

These rules should shape future polish work, not just the two requested interactions.

### Buttons

- primary buttons should acknowledge press immediately
- loading buttons must preserve width
- hover changes should feel crisp, never syrupy
- destructive buttons should gain clarity, not drama

### Menus and dropdowns

- open with quick fade + slight translate
- no overshoot
- no long scale animations
- row action menus should feel instant and controlled

### Tables

- no decorative row hover dancing
- row hover may use a light surface tint only
- pending row actions should use inline status, not page-wide spinners
- refreshed data can use a very soft opacity refresh if necessary

### Sheets and dialogs

- short entrance, strong readability
- background dimming should support focus, not create spectacle
- close interactions should feel faster than open interactions

### Inputs and filters

- search should acknowledge pending fetch without clearing existing results
- focus rings must feel deliberate and visible
- filter chips and badges may animate in lightly, but never bounce

## Accessibility And Trust Rules

Premium means accessible and respectful.

Mandatory:

- support `prefers-reduced-motion`
- preserve keyboard usability during all animated states
- keep icon-only controls labeled
- never communicate state change through motion alone
- keep all touch targets at or above `44x44`

Reduced motion behavior:

- topbar theme toggle uses quick fade instead of circular reveal
- settings theme change stays a quick fade
- notification bell uses opacity or tiny scale emphasis only, or no movement if needed

## Performance Rules

These interactions must feel expensive in craft, not expensive in frame time.

Required:

- no frame drops on common admin hardware
- no heavy paints on every render
- no persistent animation loops
- no global reflow-heavy choreography

Prefer:

- fixed overlay for the theme reveal
- transforms over layout changes
- small isolated motion surfaces

## Acceptance Criteria

The work is successful when all of the following are true:

- clicking the topbar theme toggle produces a circular reveal from the toggle origin
- the reveal feels smooth, not flashy
- changing theme from settings uses only a short fade
- unread notification increases cause one tasteful bell acknowledgment
- the bell does not bounce repeatedly while unread notifications remain
- reduced-motion users get simpler equivalents
- no core admin workflow feels slower because of the motion
- the result feels premium, calm, and user-respectful

## Anti-Goals

Do not turn the admin app into:

- a showcase animation site
- a playful consumer social app
- a dashboard with ambient motion noise
- a product that begs for attention

The standard is quiet delight.
The user should feel cared for, not manipulated.




# Discount Creation

## How discounts are created

Discounts are created by application admins through:

- `POST /v1/discounts`

This endpoint accepts a `DiscountCreate` payload and creates a discount code that can later be applied to subscriptions.

## Who can create discounts

Only application admins can create and manage discounts. Tenant users cannot create discounts.

## Minimum fields required

At minimum, a discount needs:

- `code`
- `name`
- `value`

Example:

```json
{
  "code": "LAUNCH50",
  "name": "Launch Discount",
  "value": 50
}
```

## What can be configured during creation

When creating a discount, the admin can also define:

- `description`
- `discount_type` as `percentage` or `fixed`
- `scope` as `global`, `tenant`, or `plan`
- `status`
- `target_tenant_id`
- `target_plan_ids`
- `valid_from`
- `valid_until`
- `max_redemptions`
- `stackable`
- `min_subscription_value`

## Discount scopes

- `global` means the code can be used across tenants
- `tenant` means the code is only for one tenant and requires `target_tenant_id`
- `plan` means the code is limited to specific plans and uses `target_plan_ids`

## Important creation rules

- Discount `code` must be unique
- Discount `code` must contain only letters, numbers, underscores, or hyphens
- If `discount_type` is `percentage`, `value` must be between `0` and `100`
- If `discount_type` is `fixed`, `value` cannot be negative
- If `scope` is `tenant`, `target_tenant_id` is required
- If no status is provided, the discount is created as `active`
- `current_redemptions` starts at `0`

## How discounts are validated later

Before a discount is applied, the system checks:

- the code exists
- the discount is `active`
- the current time is within `valid_from` and `valid_until`
- the redemption limit has not been reached
- the tenant matches if the discount is tenant-scoped
- the plan matches if the discount is plan-scoped
- the subscription value meets `min_subscription_value` if one is set

Validation is done through:

- `POST /v1/discounts/validate`

## What happens after creation

Once created, the discount can be used during subscription creation if it passes validation.

After that, an application admin can:

- update it with `PUT /v1/discounts/{discount_id}`
- disable it with `POST /v1/discounts/{discount_id}/disable`
- delete it with `DELETE /v1/discounts/{discount_id}`

Deletion is only allowed when the discount is not active and has never been redeemed.

## Short summary

Discounts are created by application admins through `POST /v1/discounts`. A discount can be global, tenant-specific, or plan-specific, and it can be percentage-based or fixed-value. The system enforces uniqueness, scope rules, validity windows, and redemption limits before the discount is applied.


# Plan Creation

## How plans are created

Plans are created by application admins through:

- `POST /v1/plans`

This endpoint accepts a `PlanCreate` payload and creates a new subscription plan in the `plans` collection.

## Who can create plans

Only application admins can create and manage plans. Tenant users cannot create plans.

## Minimum fields required

At minimum, a plan needs:

- `name`
- `display_name`

Example:

```json
{
  "name": "professional-plan",
  "display_name": "Professional Plan"
}
```

## What can be configured during creation

When creating a plan, the admin can also define:

- `tier` such as `free`, `starter`, `professional`, `enterprise`, or `custom`
- `description`
- `status`
- `base_price_monthly`
- `base_price_yearly`
- `currency`
- `feature_rules`
- `crud_limits`
- `retrieval_quotas`
- `storage_limits`
- `tenant_caps`
- `priority_support`
- `sla_response_hours`
- `custom_branding`
- `api_access`
- `is_public`
- `sort_order`

These fields control what subscribed tenants are allowed to access and how much they can use.

## Important creation rules

- Plan `name` must be unique
- Plan `name` must be slug-like and only contain letters, numbers, hyphens, or underscores
- `base_price_monthly` and `base_price_yearly` cannot be negative
- If no status is provided, the plan is created as `draft`

## What happens after creation

Once created, the plan is stored and returned in the response. The system also records an audit event for plan creation.

After that, an application admin can:

- activate the plan with `POST /v1/plans/{plan_id}/activate`
- update it with `PUT /v1/plans/{plan_id}`
- archive it with `POST /v1/plans/{plan_id}/archive`
- clone it with `POST /v1/plans/{source_plan_id}/clone`

## Short summary

Plans are created by application admins through `POST /v1/plans`. A plan can be created with just `name` and `display_name`, but it can also include pricing, feature access, quotas, storage limits, and tenant caps. New plans default to `draft` unless another status is provided.



# Tenant And System User Creation

## How tenants are created

There are two supported flows:

1. `POST /v1/tenants/`
   This creates only the tenant record. It is meant for application admins.

2. `POST /v1/admins/tenants/bootstrap`
   This creates the tenant and the first tenant user together. The first tenant user is always a `super_admin`. If creating the `super_admin` fails, the tenant creation is rolled back so the system does not leave an orphaned tenant behind.

## How system users are created for tenants

System users belong to a specific tenant through `tenant_id`.

After a tenant has been bootstrapped and has its first `super_admin`, that `super_admin` can create other tenant users through `POST /v1/system-users/signup`.

The created user is attached to the same tenant, and the system assigns permissions automatically based on the selected role, such as:

- `super_admin`
- `dept_admin`
- `receptionist`
- `auditor`
- `security_officer`
- `dpo`

## Short summary

Application admins create tenants. The bootstrap endpoint is the main setup flow because it creates both the tenant and its first `super_admin`. After that, the tenant's `super_admin` creates the rest of the tenant's system users.
