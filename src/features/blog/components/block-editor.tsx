"use client";

import * as React from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Image as ImageIcon,
  Video,
  Type,
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUploadMediaFile } from "@/features/blog/hooks/use-media";
import { resolveDocumentUrl } from "@/lib/utils/document-url";
import { toast } from "sonner";
import type { Block, BlockType, InlineText } from "@/types/blog";
import {
  blockText,
  buildBlock,
  emptyParagraph,
  isBlockEmpty,
} from "@/features/blog/lib/blocks";
import { inlineToHtml, readInlineRuns } from "@/features/blog/lib/inline";
import { htmlToBlocks, plainTextToBlocks } from "@/features/blog/lib/html-to-blocks";

interface BlockEditorProps {
  value: Block[];
  onChange: (value: Block[]) => void;
  placeholder?: string;
}

interface SlashMenuOption {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  level?: 1 | 2 | 3;
}

const SLASH_OPTIONS: SlashMenuOption[] = [
  {
    type: "paragraph",
    label: "Text",
    description: "Plain paragraph text",
    icon: Type,
  },
  {
    type: "heading",
    level: 1,
    label: "Heading 1",
    description: "Big section heading",
    icon: Heading1,
    shortcut: "#",
  },
  {
    type: "heading",
    level: 2,
    label: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    shortcut: "##",
  },
  {
    type: "heading",
    level: 3,
    label: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    shortcut: "###",
  },
  {
    type: "bulletListItem",
    label: "Bullet list",
    description: "Simple bulleted list",
    icon: List,
    shortcut: "-",
  },
  {
    type: "numberedListItem",
    label: "Numbered list",
    description: "Ordered list with numbers",
    icon: ListOrdered,
    shortcut: "1.",
  },
  {
    type: "quote",
    label: "Quote",
    description: "Pull quote or callout",
    icon: Quote,
    shortcut: ">",
  },
  {
    type: "codeBlock",
    label: "Code block",
    description: "Monospaced code snippet",
    icon: Code,
    shortcut: "```",
  },
  {
    type: "divider",
    label: "Divider",
    description: "Horizontal rule between sections",
    icon: Minus,
    shortcut: "---",
  },
  {
    type: "image",
    label: "Image",
    description: "Upload an image and add a caption",
    icon: ImageIcon,
  },
  {
    type: "video",
    label: "Video",
    description: "Upload a video clip",
    icon: Video,
  },
];

/** Apply a slash menu choice to the existing block: changes type + level. */
function applyBlockTypeChange(block: Block, opt: SlashMenuOption): Block {
  if (opt.type === "heading") {
    return {
      ...block,
      type: "heading",
      props: { ...block.props, level: opt.level ?? 1 },
    };
  }
  if (opt.type === "divider") {
    return {
      ...block,
      type: "divider",
      props: {},
      content: [],
    };
  }
  if (opt.type === "image" || opt.type === "video") {
    return {
      ...block,
      type: opt.type,
      props: { ...block.props, url: block.props?.url ?? "" },
      content: [],
    };
  }
  return {
    ...block,
    type: opt.type,
    props: { ...block.props, level: undefined },
  };
}

/**
 * Markdown-style auto-conversion: if the user types a recognized prefix
 * followed by a space at the start of an empty paragraph, convert the block.
 * Returns the converted block or null when no rule matches.
 */
function autoConvertMarkdown(block: Block, text: string): Block | null {
  if (block.type !== "paragraph") return null;
  const map: Record<string, () => Block> = {
    "# ": () => ({ ...block, type: "heading", props: { level: 1 }, content: [] }),
    "## ": () => ({ ...block, type: "heading", props: { level: 2 }, content: [] }),
    "### ": () => ({ ...block, type: "heading", props: { level: 3 }, content: [] }),
    "- ": () => ({ ...block, type: "bulletListItem", content: [] }),
    "* ": () => ({ ...block, type: "bulletListItem", content: [] }),
    "1. ": () => ({ ...block, type: "numberedListItem", content: [] }),
    "> ": () => ({ ...block, type: "quote", content: [] }),
    "``` ": () => ({ ...block, type: "codeBlock", content: [] }),
    "--- ": () => ({ ...block, type: "divider", content: [] }),
  };
  for (const key of Object.keys(map)) {
    if (text === key) return map[key]();
  }
  return null;
}

export function BlockEditor({ value, onChange, placeholder }: BlockEditorProps) {
  const [slashState, setSlashState] = React.useState<{
    blockId: string;
    query: string;
  } | null>(null);

  // Track which block to autofocus on next render (after insert/delete).
  const pendingFocusRef = React.useRef<{ id: string; caret?: "start" | "end" } | null>(
    null,
  );

  const blocks = value.length === 0 ? [emptyParagraph()] : value;

  const blockRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const registerRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) blockRefs.current.set(id, el);
    else blockRefs.current.delete(id);
  };

  React.useLayoutEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;
    const el = blockRefs.current.get(target.id);
    if (!el) return;
    el.focus();
    if (target.caret === "end") placeCaretAtEnd(el);
    else placeCaretAtStart(el);
  }, [blocks]);

  function updateBlock(id: string, patch: Partial<Block>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function replaceBlock(id: string, next: Block) {
    onChange(blocks.map((b) => (b.id === id ? next : b)));
  }

  function insertBlockAfter(id: string, type: BlockType = "paragraph") {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const next = buildBlock(type);
    const out = [...blocks];
    out.splice(idx + 1, 0, next);
    pendingFocusRef.current = { id: next.id, caret: "start" };
    onChange(out);
  }

  function removeBlock(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    if (blocks.length === 1) {
      // Keep one empty paragraph alive at all times.
      const empty = emptyParagraph();
      pendingFocusRef.current = { id: empty.id, caret: "start" };
      onChange([empty]);
      return;
    }
    const prev = blocks[idx - 1] ?? blocks[idx + 1];
    pendingFocusRef.current = { id: prev.id, caret: "end" };
    onChange(blocks.filter((b) => b.id !== id));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= blocks.length) return;
    const out = [...blocks];
    [out[idx], out[target]] = [out[target], out[idx]];
    onChange(out);
  }

  function handleBlockTextInput(block: Block, runs: InlineText[], text: string) {
    const converted = autoConvertMarkdown(block, text);
    if (converted) {
      replaceBlock(block.id, converted);
      pendingFocusRef.current = { id: block.id, caret: "start" };
      return;
    }

    // Slash menu trigger detection.
    if (text.startsWith("/") && block.type === "paragraph") {
      setSlashState({ blockId: block.id, query: text.slice(1) });
    } else if (slashState?.blockId === block.id) {
      setSlashState(null);
    }

    // Store the styled runs (bold/italic/etc) rather than flattening to plain
    // text, so manual formatting and pasted styling survive a save.
    updateBlock(block.id, { content: runs });
  }

  /**
   * Rich paste: convert clipboard HTML (Google Docs, Word, etc.) into proper
   * blocks instead of letting the contentEditable flatten everything into one
   * plain-text block. Replaces the current block when it's empty, otherwise
   * inserts the parsed blocks after it. A single inline paragraph dropped into
   * a non-empty block is inserted at the caret as text so mid-sentence pastes
   * still feel natural.
   */
  function handleBlockPaste(
    e: React.ClipboardEvent<HTMLDivElement>,
    block: Block,
    index: number,
  ) {
    const cd = e.clipboardData;
    if (!cd) return;

    const html = cd.getData("text/html");
    const plain = cd.getData("text/plain");

    let pasted = html ? htmlToBlocks(html) : [];
    if (pasted.length === 0 && plain) pasted = plainTextToBlocks(plain);
    if (pasted.length === 0) return; // nothing useful — let the browser handle it

    const targetIsTextBlock =
      block.type !== "image" && block.type !== "video" && block.type !== "divider";
    const targetEmpty = isBlockEmpty(block);

    // Single plain paragraph into a non-empty text block → insert at the caret.
    if (
      pasted.length === 1 &&
      pasted[0].type === "paragraph" &&
      targetIsTextBlock &&
      !targetEmpty
    ) {
      e.preventDefault();
      const insertText = plain || blockText(pasted[0]);
      document.execCommand("insertText", false, insertText);
      return;
    }

    e.preventDefault();
    const out = [...blocks];
    if (targetEmpty && targetIsTextBlock) out.splice(index, 1, ...pasted);
    else out.splice(index + 1, 0, ...pasted);

    const last = pasted[pasted.length - 1];
    pendingFocusRef.current = { id: last.id, caret: "end" };
    onChange(out);
  }

  function handleBlockKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    block: Block,
    index: number,
  ) {
    const current = e.currentTarget.textContent ?? "";

    // Slash menu navigation is handled inside SlashMenu — skip here.
    if (slashState?.blockId === block.id) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashState(null);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
        // Let SlashMenu's keyboard listener handle these.
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Empty list item → exit the list (convert to paragraph below).
      const isListLike =
        block.type === "bulletListItem" ||
        block.type === "numberedListItem" ||
        block.type === "quote";
      if (isListLike && current.trim() === "") {
        replaceBlock(block.id, {
          ...block,
          type: "paragraph",
          props: {},
          content: [],
        });
        return;
      }
      const newType: BlockType =
        block.type === "bulletListItem" || block.type === "numberedListItem"
          ? block.type
          : "paragraph";
      insertBlockAfter(block.id, newType);
      return;
    }

    if (e.key === "Backspace" && current === "") {
      e.preventDefault();
      if (block.type !== "paragraph") {
        // First Backspace on an empty non-paragraph: convert back to plain.
        replaceBlock(block.id, {
          ...block,
          type: "paragraph",
          props: {},
        });
        return;
      }
      // Plain empty paragraph: merge with previous block (remove this one).
      removeBlock(block.id);
      return;
    }

    if (e.key === "ArrowUp" && index > 0) {
      const sel = window.getSelection();
      if (sel && sel.anchorOffset === 0) {
        e.preventDefault();
        const prev = blocks[index - 1];
        const el = blockRefs.current.get(prev.id);
        if (el) {
          el.focus();
          placeCaretAtEnd(el);
        }
      }
    }
    if (e.key === "ArrowDown" && index < blocks.length - 1) {
      const sel = window.getSelection();
      const len = current.length;
      if (sel && sel.anchorOffset === len) {
        e.preventDefault();
        const next = blocks[index + 1];
        const el = blockRefs.current.get(next.id);
        if (el) {
          el.focus();
          placeCaretAtStart(el);
        }
      }
    }
  }

  function chooseSlashOption(block: Block, opt: SlashMenuOption) {
    const replaced = applyBlockTypeChange(
      { ...block, content: [] },
      opt,
    );
    replaceBlock(block.id, replaced);
    setSlashState(null);
    pendingFocusRef.current = { id: block.id, caret: "start" };
  }

  return (
    <div className="block-editor mx-auto w-full max-w-3xl">
      {blocks.map((block, index) => (
        <BlockRow
          key={block.id}
          block={block}
          index={index}
          totalBlocks={blocks.length}
          onTextInput={(runs, t) => handleBlockTextInput(block, runs, t)}
          onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
          onPaste={(e) => handleBlockPaste(e, block, index)}
          onMoveUp={() => moveBlock(block.id, -1)}
          onMoveDown={() => moveBlock(block.id, 1)}
          onDelete={() => removeBlock(block.id)}
          onInsertBelow={() => insertBlockAfter(block.id)}
          onPropsChange={(p) =>
            updateBlock(block.id, { props: { ...block.props, ...p } })
          }
          placeholder={index === 0 ? (placeholder ?? "Title or type '/' for blocks") : undefined}
          refSetter={registerRef(block.id)}
          showSlashMenu={slashState?.blockId === block.id}
          slashQuery={slashState?.query ?? ""}
          onSlashSelect={(opt) => chooseSlashOption(block, opt)}
          onSlashClose={() => setSlashState(null)}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-block row                                                       */
/* ------------------------------------------------------------------ */

interface BlockRowProps {
  block: Block;
  index: number;
  totalBlocks: number;
  onTextInput: (runs: InlineText[], plainText: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onInsertBelow: () => void;
  onPropsChange: (props: Block["props"]) => void;
  placeholder?: string;
  refSetter: (el: HTMLDivElement | null) => void;
  showSlashMenu: boolean;
  slashQuery: string;
  onSlashSelect: (opt: SlashMenuOption) => void;
  onSlashClose: () => void;
}

function BlockRow(props: BlockRowProps) {
  const {
    block,
    index,
    totalBlocks,
    onTextInput,
    onKeyDown,
    onPaste,
    onMoveUp,
    onMoveDown,
    onDelete,
    onInsertBelow,
    refSetter,
    showSlashMenu,
    slashQuery,
    onSlashSelect,
    onSlashClose,
    placeholder,
    onPropsChange,
  } = props;

  const isMedia = block.type === "image" || block.type === "video";
  const isDivider = block.type === "divider";

  return (
    <div className="group relative flex items-start gap-1 py-0.5">
      {/* Left gutter: add / drag handle */}
      <div className="flex w-12 shrink-0 items-start justify-end gap-0.5 pt-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onInsertBelow}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Insert a new block below"
            >
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Insert a new block below this one</TooltipContent>
        </Tooltip>
        <BlockHandle
          index={index}
          totalBlocks={totalBlocks}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
        />
      </div>

      {/* Block body */}
      <div className="relative min-w-0 flex-1">
        {isMedia ? (
          <MediaBlock
            block={block}
            onPropsChange={onPropsChange}
            refSetter={refSetter}
          />
        ) : isDivider ? (
          <div className="my-3 flex items-center" tabIndex={-1}>
            <div className="h-px w-full bg-border" />
          </div>
        ) : (
          <ContentEditableBlock
            block={block}
            onTextInput={onTextInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={placeholder ?? defaultPlaceholder(block)}
            refSetter={refSetter}
          />
        )}

        {showSlashMenu && (
          <SlashMenu
            query={slashQuery}
            onSelect={onSlashSelect}
            onClose={onSlashClose}
          />
        )}
      </div>
    </div>
  );
}

function defaultPlaceholder(block: Block): string {
  switch (block.type) {
    case "heading":
      return block.props?.level === 1
        ? "Heading 1"
        : block.props?.level === 2
          ? "Heading 2"
          : "Heading 3";
    case "bulletListItem":
      return "List item";
    case "numberedListItem":
      return "List item";
    case "quote":
      return "Quote";
    case "codeBlock":
      return "Code";
    default:
      return "Type '/' for blocks";
  }
}

/* ------------------------------------------------------------------ */
/* ContentEditable text block                                          */
/* ------------------------------------------------------------------ */

interface ContentEditableBlockProps {
  block: Block;
  onTextInput: (runs: InlineText[], plainText: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  refSetter: (el: HTMLDivElement | null) => void;
}

const ContentEditableBlock = React.memo(function ContentEditableBlock({
  block,
  onTextInput,
  onKeyDown,
  onPaste,
  placeholder,
  refSetter,
}: ContentEditableBlockProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  // The last inline HTML we know the DOM holds, in normalized form. Used to
  // decide whether the model changed externally (slash menu, paste, load) and
  // the DOM must be rewritten, versus our own keystroke (skip — rewriting
  // would reset the caret).
  const lastHtmlRef = React.useRef<string>("");
  const text = blockText(block);

  // Render styled runs into the editable. We compare against the normalized
  // HTML we last emitted so typing never triggers a DOM rewrite (which would
  // jump the caret), while external block changes do.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = inlineToHtml(block.content);
    if (html !== lastHtmlRef.current) {
      el.innerHTML = html;
      lastHtmlRef.current = html;
    }
  }, [block.content]);

  function handleInput(e: React.FormEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const runs = readInlineRuns(el);
    // Record the normalized form so the sync effect treats this as already
    // in-sync and leaves the caret alone.
    lastHtmlRef.current = inlineToHtml(runs);
    onTextInput(runs, el.textContent ?? "");
  }

  return (
    <div
      ref={(el) => {
        ref.current = el;
        refSetter(el);
      }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="false"
      data-empty={text.length === 0 || undefined}
      data-placeholder={placeholder ?? ""}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={cn(
        "block-editable outline-none whitespace-pre-wrap break-words",
        textClassForBlock(block),
      )}
    />
  );
});

function textClassForBlock(block: Block): string {
  switch (block.type) {
    case "heading":
      if (block.props?.level === 1)
        return "font-display text-3xl md:text-4xl font-semibold tracking-tight py-2";
      if (block.props?.level === 2)
        return "font-display text-2xl md:text-3xl font-semibold tracking-tight py-2";
      return "font-display text-xl md:text-2xl font-semibold tracking-tight py-2";
    case "bulletListItem":
      return "relative pl-6 py-1 before:content-['•'] before:absolute before:left-2 before:top-1 before:text-muted-foreground";
    case "numberedListItem":
      return "relative pl-6 py-1 before:content-['1.'] before:absolute before:left-1 before:top-1 before:text-muted-foreground before:text-sm";
    case "quote":
      return "border-l-2 border-primary/40 pl-4 italic text-muted-foreground py-1";
    case "codeBlock":
      return "font-mono text-sm bg-muted rounded-md px-3 py-2 leading-relaxed";
    default:
      return "text-base leading-7 py-1";
  }
}

/* ------------------------------------------------------------------ */
/* Slash menu                                                          */
/* ------------------------------------------------------------------ */

interface SlashMenuProps {
  query: string;
  onSelect: (opt: SlashMenuOption) => void;
  onClose: () => void;
}

function SlashMenu({ query, onSelect, onClose }: SlashMenuProps) {
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_OPTIONS;
    return SLASH_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q),
    );
  }, [query]);

  const [activeIdx, setActiveIdx] = React.useState(0);

  React.useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(filtered[activeIdx]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, activeIdx, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      role="listbox"
      className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
    >
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Basic blocks
      </div>
      <ul className="max-h-80 overflow-y-auto py-1">
        {filtered.map((opt, idx) => {
          const Icon = opt.icon;
          const active = idx === activeIdx;
          return (
            <li key={`${opt.type}-${opt.level ?? ""}`}>
              <button
                type="button"
                onClick={() => onSelect(opt)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <span className="mt-0.5 rounded-md border border-border bg-background p-1 text-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{opt.label}</span>
                    {opt.shortcut && (
                      <span className="text-xs text-muted-foreground">
                        {opt.shortcut}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block handle (drag/move/delete dropdown)                            */
/* ------------------------------------------------------------------ */

interface BlockHandleProps {
  index: number;
  totalBlocks: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function BlockHandle({
  index,
  totalBlocks,
  onMoveUp,
  onMoveDown,
  onDelete,
}: BlockHandleProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Block actions"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Open the block actions menu — move, delete, or change the block type
        </TooltipContent>
      </Tooltip>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-full top-0 z-40 ml-1 w-44 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                onMoveUp();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronUp className="h-4 w-4" />
              Move up
            </button>
            <button
              type="button"
              disabled={index >= totalBlocks - 1}
              onClick={() => {
                onMoveDown();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronDown className="h-4 w-4" />
              Move down
            </button>
            <div className="h-px bg-border" />
            <button
              type="button"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete block
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Media block (image / video)                                         */
/* ------------------------------------------------------------------ */

interface MediaBlockProps {
  block: Block;
  onPropsChange: (props: Block["props"]) => void;
  refSetter: (el: HTMLDivElement | null) => void;
}

function MediaBlock({ block, onPropsChange, refSetter }: MediaBlockProps) {
  const isImage = block.type === "image";
  const upload = useUploadMediaFile();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await upload.mutateAsync(file);
      onPropsChange({ url: result.url });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to upload ${isImage ? "image" : "video"}`,
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const url = block.props?.url ?? "";
  const caption = block.props?.caption ?? "";

  return (
    <div
      ref={refSetter}
      tabIndex={0}
      className="my-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {url ? (
        <div className="space-y-2">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveDocumentUrl(url) ?? url}
              alt={block.props?.alt ?? caption ?? ""}
              className="mx-auto max-h-[480px] w-full rounded-md object-contain"
            />
          ) : (
            <video
              src={resolveDocumentUrl(url) ?? url}
              controls
              className="mx-auto max-h-[480px] w-full rounded-md"
            />
          )}
          <Input
            value={caption}
            onChange={(e) => onPropsChange({ caption: e.target.value })}
            placeholder={isImage ? "Image caption (optional)" : "Video caption (optional)"}
            className="border-0 bg-transparent text-center text-sm text-muted-foreground focus-visible:ring-0"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          {isImage ? (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Video className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {isImage ? "Upload an image" : "Upload a video"}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={upload.isPending}
                className="min-h-[44px]"
              >
                {upload.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>Choose file</>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Choose a {isImage ? "JPG, PNG, GIF, or WebP image" : "MP4, MOV, or WebM video"} to embed in this block
            </TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept={isImage ? "image/*" : "video/*"}
            onChange={handleFileChosen}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Selection / caret helpers                                            */
/* ------------------------------------------------------------------ */

function placeCaretAtEnd(el: HTMLElement) {
  if (typeof window === "undefined") return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function placeCaretAtStart(el: HTMLElement) {
  if (typeof window === "undefined") return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

