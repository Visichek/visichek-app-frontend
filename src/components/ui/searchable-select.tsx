"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Show the search input only when option count exceeds this threshold. Defaults to 6. */
  searchThreshold?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const PANEL_MAX_HEIGHT = 384;

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  searchThreshold = 6,
  disabled,
  id,
  className,
  triggerClassName,
  ...ariaProps
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
    maxHeight: number;
  } | null>(null);
  const [mounted, setMounted] = React.useState(false);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const generatedId = React.useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const showSearch = options.length > searchThreshold;

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const computePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 8;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const placement: "bottom" | "top" =
      spaceBelow < 240 && spaceAbove > spaceBelow ? "top" : "bottom";
    const available = placement === "bottom" ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(160, Math.min(PANEL_MAX_HEIGHT, available));

    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      placement,
      maxHeight,
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    computePosition();
    const onResize = () => computePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, computePosition]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    if (open && showSearch) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
  }, [open, showSearch]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    setQuery("");
  }, [open, options, value]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const selectAt = (idx: number) => {
    const o = filtered[idx];
    if (!o || o.disabled) return;
    onValueChange?.(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectAt(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const panelStyle: React.CSSProperties = position
    ? {
        position: "fixed",
        top:
          position.placement === "bottom"
            ? position.top
            : Math.max(8, position.top - 8 - position.maxHeight - 36),
        left: position.left,
        width: position.width,
        minWidth: "12rem",
        maxHeight: position.maxHeight + (showSearch ? 56 : 0),
        zIndex: 65,
      }
    : {};

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-invalid={ariaProps["aria-invalid"]}
        aria-describedby={ariaProps["aria-describedby"]}
        aria-label={ariaProps["aria-label"]}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName
        )}
      >
        <span
          className={cn(
            "line-clamp-1 text-left",
            !selectedOption && "text-muted-foreground"
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              id={listboxId}
              aria-activedescendant={
                filtered[activeIndex]
                  ? `${listboxId}-opt-${activeIndex}`
                  : undefined
              }
              tabIndex={-1}
              onKeyDown={onListKeyDown}
              style={panelStyle}
              className="flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
            >
              {showSearch ? (
                <div className="relative flex items-center border-b p-2">
                  <Search className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onListKeyDown}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        inputRef.current?.focus();
                      }}
                      className="absolute right-4 rounded-sm p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div
                ref={listRef}
                className="overflow-y-auto p-1"
                style={{ maxHeight: position.maxHeight }}
              >
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </div>
                ) : (
                  filtered.map((opt, idx) => {
                    const isSelected = opt.value === value;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        id={`${listboxId}-opt-${idx}`}
                        aria-selected={isSelected}
                        data-index={idx}
                        disabled={opt.disabled}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => selectAt(idx)}
                        className={cn(
                          "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-base md:text-sm outline-none text-left",
                          isActive && "bg-accent text-accent-foreground",
                          opt.disabled && "pointer-events-none opacity-50"
                        )}
                      >
                        {isSelected ? (
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            <Check className="h-4 w-4" />
                          </span>
                        ) : null}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{opt.label}</span>
                          {opt.description ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {opt.description}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
