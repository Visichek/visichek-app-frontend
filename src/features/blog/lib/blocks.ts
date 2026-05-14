import type { Block, BlockType, InlineText } from "@/types/blog";

/**
 * Generate a short, monotonic-ish id for a freshly-created block. The
 * backend reassigns ids on insert anyway, but the editor needs stable keys
 * locally so React can identify rows across re-renders.
 */
export function newBlockId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

/** Plain-text helper: flatten a block's inline content array to a string. */
export function blockText(block: Block): string {
  const runs = block.content ?? [];
  return runs.map((r) => r.text ?? "").join("");
}

/** Build a block content array from a single plain-text string. */
export function plainTextContent(text: string): InlineText[] {
  if (!text) return [];
  return [{ type: "text", text }];
}

/** Convenience builder for an empty paragraph. */
export function emptyParagraph(): Block {
  return {
    id: newBlockId(),
    type: "paragraph",
    props: {},
    content: [],
    children: [],
  };
}

export function buildBlock(
  type: BlockType,
  text = "",
  extraProps: Block["props"] = {},
): Block {
  return {
    id: newBlockId(),
    type,
    props: extraProps,
    content: plainTextContent(text),
    children: [],
  };
}

/**
 * Compute a short excerpt from the body blocks — first 200 characters of
 * visible text, trimmed at the nearest word.
 */
export function deriveExcerpt(blocks: Block[], maxLength = 200): string {
  let text = "";
  for (const block of blocks) {
    if (block.type === "image" || block.type === "video" || block.type === "divider") {
      continue;
    }
    const t = blockText(block).trim();
    if (!t) continue;
    text += (text ? " " : "") + t;
    if (text.length >= maxLength) break;
  }
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

/** Detect whether a block has no visible text and no media. */
export function isBlockEmpty(block: Block): boolean {
  if (block.type === "image" || block.type === "video") {
    return !block.props?.url;
  }
  if (block.type === "divider") return false;
  return blockText(block).trim().length === 0;
}

/** Normalize blocks coming back from the API — fill in missing ids/content. */
export function normalizeBlocks(blocks: Block[] | null | undefined): Block[] {
  if (!blocks || blocks.length === 0) return [emptyParagraph()];
  return blocks.map((b) => ({
    id: b.id || newBlockId(),
    type: b.type ?? "paragraph",
    props: b.props ?? {},
    content: b.content ?? [],
    children: b.children ?? [],
  }));
}
