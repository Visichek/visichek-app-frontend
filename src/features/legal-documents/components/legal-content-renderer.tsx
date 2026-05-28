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
          <code>{(block.content ?? []).map((r) => r.text).join("")}</code>
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

function Inline({ content }: { content?: InlineText[] }) {
  if (!content || content.length === 0) {
    return <span className="text-muted-foreground">&nbsp;</span>;
  }
  return (
    <>
      {content.map((run, i) => {
        const styles = run.styles ?? {};
        let node: React.ReactNode = run.text;
        if (styles.bold) node = <strong>{node}</strong>;
        if (styles.italic) node = <em>{node}</em>;
        if (styles.underline) node = <u>{node}</u>;
        if (styles.strike) node = <s>{node}</s>;
        if (styles.code)
          node = (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {node}
            </code>
          );
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}
