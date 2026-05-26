import type { InlineText } from "@/types/blog";

/**
 * Inline run (de)serialization for the block editor.
 *
 * A block's `content` is an array of styled text runs (`InlineText`). The
 * contentEditable surface needs to render those runs as HTML and, on input,
 * read the DOM back into runs WITHOUT losing bold / italic / underline /
 * strike / code styling. Keeping both directions in this one module means the
 * editable round-trips cleanly: the HTML we emit is the same HTML we expect to
 * read back, so the model→DOM sync effect can compare normalized strings and
 * avoid clobbering the caret while the user types.
 *
 * We deliberately only model the five boolean styles the read-only renderer
 * (`legal-content-renderer`) understands. Colors and font families pasted from
 * Google Docs / Word are dropped on purpose — storing styles nothing renders
 * would just bloat the payload and desync the round-trip.
 */

/** The subset of inline styles the editor and renderer both support. */
export interface RunStyles {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
}

const STYLE_KEYS = ["bold", "italic", "underline", "strike", "code"] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** True when at least one supported style flag is set. */
function hasAnyStyle(styles: RunStyles): boolean {
  return STYLE_KEYS.some((k) => styles[k]);
}

/** Drop falsy flags so two runs with the "same" styling compare equal. */
function normalizeStyles(styles: RunStyles): RunStyles {
  const out: RunStyles = {};
  for (const k of STYLE_KEYS) if (styles[k]) out[k] = true;
  return out;
}

function sameStyles(a: RunStyles, b: RunStyles): boolean {
  return STYLE_KEYS.every((k) => Boolean(a[k]) === Boolean(b[k]));
}

/**
 * Render a run array to HTML for the contentEditable surface. Tag nesting is
 * deterministic (strong › em › u › s › code) so the output is stable and
 * matches what `readInlineRuns` produces after a round-trip.
 */
export function inlineToHtml(runs: InlineText[] | undefined | null): string {
  if (!runs || runs.length === 0) return "";
  return runs
    .map((run) => {
      const text = run.text ?? "";
      if (text === "") return "";
      let html = escapeHtml(text);
      const s = run.styles ?? {};
      if (s.code) html = `<code>${html}</code>`;
      if (s.strike) html = `<s>${html}</s>`;
      if (s.underline) html = `<u>${html}</u>`;
      if (s.italic) html = `<em>${html}</em>`;
      if (s.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

/**
 * Derive the active styles for an element from both its tag and its inline
 * `style` attribute. Inline styles take precedence over tags so the Google
 * Docs wrapper (`<b style="font-weight:normal">`) does NOT make everything
 * bold, while inner `<span style="font-weight:700">` runs do.
 */
function deriveStyles(el: HTMLElement, base: RunStyles): RunStyles {
  const next: RunStyles = { ...base };
  const tag = el.tagName.toLowerCase();

  if (tag === "b" || tag === "strong") next.bold = true;
  if (tag === "i" || tag === "em") next.italic = true;
  if (tag === "u" || tag === "ins") next.underline = true;
  if (tag === "s" || tag === "strike" || tag === "del") next.strike = true;
  if (tag === "code" || tag === "kbd" || tag === "samp") next.code = true;

  const style = el.style;

  const weight = style.fontWeight;
  if (weight) {
    const numeric = parseInt(weight, 10);
    if (weight === "bold" || weight === "bolder" || (!Number.isNaN(numeric) && numeric >= 600)) {
      next.bold = true;
    } else if (
      weight === "normal" ||
      weight === "lighter" ||
      (!Number.isNaN(numeric) && numeric < 600)
    ) {
      next.bold = false;
    }
  }

  const fontStyle = style.fontStyle;
  if (fontStyle === "italic" || fontStyle === "oblique") next.italic = true;
  else if (fontStyle === "normal") next.italic = false;

  // `textDecoration` is the shorthand; `textDecorationLine` is the longhand —
  // pasted markup uses either, so check both.
  const decoration = `${style.textDecorationLine || ""} ${style.textDecoration || ""}`;
  if (decoration.includes("underline")) next.underline = true;
  if (decoration.includes("line-through")) next.strike = true;

  return next;
}

/**
 * Read a DOM subtree into a normalized run array, merging adjacent runs that
 * share styling and dropping empty ones. `skipTags` lets list parsing exclude
 * nested `<ul>`/`<ol>` so a list item's text isn't polluted by its sublist.
 */
export function readInlineRuns(root: Node, skipTags?: Set<string>): InlineText[] {
  const runs: InlineText[] = [];

  const push = (text: string, styles: RunStyles) => {
    if (!text) return;
    const clean = normalizeStyles(styles);
    const last = runs[runs.length - 1];
    if (last && sameStyles(last.styles ?? {}, clean)) {
      last.text = (last.text ?? "") + text;
      return;
    }
    runs.push({ type: "text", text, ...(hasAnyStyle(clean) ? { styles: clean } : {}) });
  };

  const walk = (node: Node, styles: RunStyles) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3 /* text */) {
        push(child.textContent ?? "", styles);
        return;
      }
      if (child.nodeType !== 1 /* element */) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (skipTags?.has(tag)) return;
      if (tag === "br") {
        push("\n", styles);
        return;
      }
      walk(el, deriveStyles(el, styles));
    });
  };

  walk(root, {});
  return runs;
}
