"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { resolveDocumentUrl } from "@/lib/utils/document-url";
import type { Block, InlineText } from "@/types/blog";

/**
 * Read-only renderer for BlockNote `Block[]` content. Used to preview an
 * immutable version snapshot or the current live copy without exposing the
 * editable contentEditable surface. Covers the block dialect the backend
 * emits for legal documents (paragraph, heading, lists, quote, code, divider,
 * image). Unknown block types fall back to their plain text.
 */
export function LegalContentRenderer({
  blocks,
  className,
}: {
  blocks: Block[] | null | undefined;
  className?: string;
}) {
  if (!blocks || blocks.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        This version has no content.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed", className)}>
      {renderBlocks(blocks)}
    </div>
  );
}

function blockKey(block: Block, index: number): string {
  return block.id || `${block.type}-${index}`;
}

/**
 * Walk the block array and render in order, but greedily group runs of
 * adjacent `bulletListItem` / `numberedListItem` blocks into a single `<ul>` /
 * `<ol>` — otherwise each item lives in its own list and numbered items
 * restart counting at 1 on every row.
 */
function renderBlocks(blocks: Block[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === "bulletListItem" || block.type === "numberedListItem") {
      const listType = block.type;
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === listType) {
        items.push(blocks[i]);
        i += 1;
      }
      nodes.push(
        <ListGroup key={blockKey(block, i)} type={listType} items={items} />,
      );
      continue;
    }
    nodes.push(<RenderedBlock key={blockKey(block, i)} block={block} />);
    i += 1;
  }
  return nodes;
}

function ListGroup({
  type,
  items,
}: {
  type: "bulletListItem" | "numberedListItem";
  items: Block[];
}) {
  const align = alignClass(items[0]);
  const ListTag = type === "numberedListItem" ? "ol" : "ul";
  const listClass = cn(
    type === "numberedListItem" ? "list-decimal" : "list-disc",
    "pl-6 space-y-1",
    align,
  );
  return (
    <ListTag className={listClass}>
      {items.map((item, idx) => (
        <li key={blockKey(item, idx)}>
          <Inline content={item.content} />
          {item.children && item.children.length > 0 ? (
            <div className="mt-1">{renderBlocks(item.children)}</div>
          ) : null}
        </li>
      ))}
    </ListTag>
  );
}

function alignClass(block: Block): string {
  switch (block.props?.textAlignment) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
}

function RenderedBlock({ block }: { block: Block }) {
  const align = alignClass(block);

  switch (block.type) {
    case "heading": {
      const level = block.props?.level ?? 1;
      const styles: Record<number, string> = {
        1: "text-2xl font-bold font-display",
        2: "text-xl font-semibold font-display",
        3: "text-lg font-semibold",
      };
      return (
        <p className={cn(styles[level] ?? styles[3], "tracking-tight", align)}>
          <Inline content={block.content} />
        </p>
      );
    }
    // bulletListItem / numberedListItem are grouped into a single <ul>/<ol>
    // in renderBlocks so adjacent items share one list and numbered items
    // count 1, 2, 3 instead of restarting on every row.
    case "quote":
      return (
        <blockquote
          className={cn(
            "border-l-2 border-border pl-4 italic text-muted-foreground",
            align,
          )}
        >
          <Inline content={block.content} />
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
          <code>{plainText(block.content)}</code>
        </pre>
      );
    case "divider":
      return <hr className="border-border" />;
    case "image": {
      const url = block.props?.url;
      if (!url) return null;
      const resolved = resolveDocumentUrl(url) ?? url;
      return (
        <figure className="space-y-1">
          <Image
            src={resolved}
            alt={block.props?.alt ?? block.props?.caption ?? ""}
            width={800}
            height={450}
            className="h-auto w-full rounded-md object-contain"
            unoptimized
          />
          {block.props?.caption ? (
            <figcaption className="text-center text-xs text-muted-foreground">
              {block.props.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    default:
      return (
        <p className={align}>
          <Inline content={block.content} />
        </p>
      );
  }
}

/**
 * BlockNote's inline content array can include plain strings (the whitespace
 * between styled runs is often serialized that way), `{ type: "text", ... }`
 * runs, and `{ type: "link", href, content: [...] }` runs. We accept all three
 * — dropping plain-string entries collapses bold/italic phrases together with
 * no space between them ("**DPA**or**Agreement**" instead of "**DPA** or
 * **Agreement**").
 */
type InlineLink = {
  type: "link";
  href?: string;
  content?: InlineNode[];
};
type InlineNode = string | InlineText | InlineLink;

function isInlineLink(node: unknown): node is InlineLink {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { type?: unknown }).type === "link"
  );
}

function Inline({ content }: { content?: InlineNode[] | InlineText[] }) {
  if (!content || content.length === 0) {
    return <span className="text-muted-foreground">&nbsp;</span>;
  }
  return (
    <>
      {(content as InlineNode[]).map((run, i) => (
        <React.Fragment key={i}>{renderInlineNode(run)}</React.Fragment>
      ))}
    </>
  );
}

function renderInlineNode(run: InlineNode): React.ReactNode {
  // Plain string entries are how BlockNote serializes whitespace between
  // styled runs — render them verbatim or the spaces disappear.
  if (typeof run === "string") return renderTextWithBreaks(run);

  if (isInlineLink(run)) {
    return (
      <a
        href={run.href ?? "#"}
        target={run.href?.startsWith("http") ? "_blank" : undefined}
        rel={run.href?.startsWith("http") ? "noreferrer" : undefined}
        className="font-medium text-primary underline underline-offset-2"
      >
        <Inline content={run.content} />
      </a>
    );
  }

  // Text run with optional inline marks.
  const styles = run.styles ?? {};
  let node: React.ReactNode = renderTextWithBreaks(run.text ?? "");
  if (styles.code)
    node = (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
        {node}
      </code>
    );
  if (styles.bold) node = <strong>{node}</strong>;
  if (styles.italic) node = <em>{node}</em>;
  if (styles.underline) node = <u>{node}</u>;
  if (styles.strike) node = <s>{node}</s>;
  return node;
}

/**
 * Split a text run on `\n` so literal newlines authored inside a single run
 * survive HTML's whitespace collapsing.
 */
function renderTextWithBreaks(text: string): React.ReactNode {
  if (!text) return null;
  if (!text.includes("\n")) return text;
  const parts = text.split("\n");
  return parts.map((part, idx) => (
    <React.Fragment key={idx}>
      {idx > 0 ? <br /> : null}
      {part}
    </React.Fragment>
  ));
}

/** Flatten any inline-content shape down to its raw text — used by codeBlock. */
function plainText(content: InlineNode[] | InlineText[] | undefined): string {
  if (!content) return "";
  return (content as InlineNode[])
    .map((run) => {
      if (typeof run === "string") return run;
      if (isInlineLink(run)) return plainText(run.content);
      return run.text ?? "";
    })
    .join("");
}
