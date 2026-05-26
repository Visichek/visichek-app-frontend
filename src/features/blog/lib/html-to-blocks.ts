import type { Block, BlockType, InlineText } from "@/types/blog";
import { newBlockId, plainTextContent } from "./blocks";
import { readInlineRuns } from "./inline";

/**
 * Clipboard → blocks parsing for the rich-paste flow.
 *
 * When a user pastes from Google Docs, Word-on-the-web, or any HTML source,
 * the browser hands us a `text/html` payload. We parse that into the editor's
 * own block model so the structure (headings, paragraphs, lists, quotes, code)
 * and inline styling survive a save → refresh round-trip. Without this, the
 * contentEditable would flatten the whole paste into one plain-text block and
 * the formatting would be lost the moment the page reloads.
 *
 * Falls back to splitting `text/plain` on newlines when there is no usable
 * HTML.
 */

/** Headings beyond h3 collapse to level 3 — the editor only models 1–3. */
const HEADING_LEVELS: Record<string, 1 | 2 | 3> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 3,
  h5: 3,
  h6: 3,
};

/** Tags that introduce their own block boundary. */
const BLOCK_SELECTOR =
  "p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,hr,div,section,article,table";

const SKIP_LIST_TAGS = new Set(["ul", "ol"]);

function makeBlock(type: BlockType, content: InlineText[], props: Block["props"] = {}): Block {
  return { id: newBlockId(), type, props, content, children: [] };
}

function hasText(runs: InlineText[]): boolean {
  return runs.some((r) => (r.text ?? "").trim() !== "");
}

function containsBlockLevel(el: Element): boolean {
  return el.querySelector(BLOCK_SELECTOR) !== null;
}

/** Emit one block per `<li>`, recursing into nested lists as further items. */
function processList(listEl: Element, out: Block[]): void {
  const liType: BlockType =
    listEl.tagName.toLowerCase() === "ol" ? "numberedListItem" : "bulletListItem";
  listEl.querySelectorAll(":scope > li").forEach((li) => {
    const runs = readInlineRuns(li, SKIP_LIST_TAGS);
    if (hasText(runs)) out.push(makeBlock(liType, runs));
    li.querySelectorAll(":scope > ul, :scope > ol").forEach((nested) =>
      processList(nested, out),
    );
  });
}

/**
 * Walk a container's children, emitting a block for every block-level element
 * and buffering stray inline content into paragraphs at block boundaries.
 */
function walkBlocks(container: Node, out: Block[]): void {
  let inlineBuffer: Node[] = [];

  const flushInline = () => {
    if (inlineBuffer.length === 0) return;
    const wrapper = container.ownerDocument!.createElement("div");
    inlineBuffer.forEach((n) => wrapper.appendChild(n.cloneNode(true)));
    const runs = readInlineRuns(wrapper);
    inlineBuffer = [];
    if (hasText(runs)) out.push(makeBlock("paragraph", runs));
  };

  container.childNodes.forEach((node) => {
    if (node.nodeType === 3 /* text */) {
      if ((node.textContent ?? "").trim() !== "") inlineBuffer.push(node);
      return;
    }
    if (node.nodeType !== 1 /* element */) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag in HEADING_LEVELS) {
      flushInline();
      const runs = readInlineRuns(el);
      if (hasText(runs)) out.push(makeBlock("heading", runs, { level: HEADING_LEVELS[tag] }));
      return;
    }

    switch (tag) {
      case "p": {
        flushInline();
        const runs = readInlineRuns(el);
        if (hasText(runs)) out.push(makeBlock("paragraph", runs));
        return;
      }
      case "blockquote": {
        flushInline();
        const runs = readInlineRuns(el);
        if (hasText(runs)) out.push(makeBlock("quote", runs));
        return;
      }
      case "pre": {
        flushInline();
        const text = el.textContent ?? "";
        if (text.trim() !== "") out.push(makeBlock("codeBlock", plainTextContent(text)));
        return;
      }
      case "hr": {
        flushInline();
        out.push(makeBlock("divider", []));
        return;
      }
      case "ul":
      case "ol": {
        flushInline();
        processList(el, out);
        return;
      }
      case "li": {
        // A stray <li> outside a list — treat as a bullet item.
        flushInline();
        const runs = readInlineRuns(el, SKIP_LIST_TAGS);
        if (hasText(runs)) out.push(makeBlock("bulletListItem", runs));
        return;
      }
      case "br": {
        // Block-level line break between inline runs — ignore; paragraph
        // boundaries already split the content.
        return;
      }
      case "div":
      case "section":
      case "article": {
        // Block-level container: its own line if it has no block children,
        // otherwise recurse so inner paragraphs/lists are preserved.
        flushInline();
        if (containsBlockLevel(el)) {
          walkBlocks(el, out);
        } else {
          const runs = readInlineRuns(el);
          if (hasText(runs)) out.push(makeBlock("paragraph", runs));
        }
        return;
      }
      default: {
        // Inline wrappers (span, b, font, a, …). The Google Docs export wraps
        // everything in <b style="font-weight:normal">, so recurse when it
        // contains block-level descendants; otherwise buffer as inline.
        if (containsBlockLevel(el)) {
          flushInline();
          walkBlocks(el, out);
        } else {
          inlineBuffer.push(el);
        }
        return;
      }
    }
  });

  flushInline();
}

/** Parse a `text/html` clipboard payload into editor blocks. */
export function htmlToBlocks(html: string): Block[] {
  if (typeof window === "undefined" || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: Block[] = [];
  walkBlocks(doc.body, out);
  return out;
}

/** Split a plain-text clipboard payload into one paragraph per non-empty line. */
export function plainTextToBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    out.push(makeBlock("paragraph", plainTextContent(line)));
  }
  return out;
}
