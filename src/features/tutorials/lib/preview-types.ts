/**
 * Shared types for the tutorial *page previews*.
 *
 * A preview is the lightweight, token-styled mock of an app screen shown
 * inside a tutorial step so the user can "see the page" while they read.
 * It is purely illustrative — never a screenshot, never real data — so it
 * stays themeable, never goes stale, and carries no binary assets.
 *
 * Lives in its own module (no React, no catalog imports) so both the
 * static catalog and the `<TutorialPreview>` renderer can depend on it
 * without a cycle.
 */

/**
 * Which mock layout a preview renders. Each maps to a sub-mock inside
 * `<TutorialPreview>`; unknown kinds fall back to the bare shell frame.
 */
export type PreviewKind =
  | "shell" // generic sidebar + topbar frame, empty content
  | "table" // a list / data table
  | "form" // a form (check-in, settings, create)
  | "cards" // a grid of metric / summary cards
  | "chart" // a dashboard with a chart + KPI row
  | "detail" // a detail sheet / record page
  | "settings" // settings with a left tab rail
  | "wizard" // a staged / multi-step flow
  | "badge" // a printable visitor badge
  | "qr" // a QR code generator
  | "log" // an audit / visitor log with timeline rows
  | "banner"; // a page with an alert / deadline banner on top

/**
 * The region of the mock to spotlight with a pulsing ring. `none` draws
 * the layout with no emphasis.
 */
export type PreviewHighlight =
  | "none"
  | "sidebar"
  | "topbar"
  | "search"
  | "bell"
  | "primary-action"
  | "row"
  | "field"
  | "tab"
  | "checkbox"
  | "bulk-bar"
  | "status"
  | "chart"
  | "badge-doc"
  | "qr-code"
  | "banner"
  | "timeline";

export interface PreviewSpec {
  kind: PreviewKind;
  /** Region to spotlight. Defaults to `none`. */
  highlight?: PreviewHighlight;
  /** Optional title rendered into the mock's content header. */
  label?: string;
}
