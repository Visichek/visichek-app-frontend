"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Search, X } from "lucide-react";

interface CommandItemType {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  onSelect?: () => void;
}

interface CommandGroupType {
  heading: string;
  items: CommandItemType[];
}

interface CommandProps {
  items?: CommandGroupType[];
  onSelect?: (item: CommandItemType) => void;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Command({
  items = [],
  onSelect,
  placeholder = "Search...",
  open = false,
  onOpenChange,
  children,
}: CommandProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [filteredItems, setFilteredItems] = React.useState<CommandGroupType[]>(
    []
  );
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Filter items based on input
  React.useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredItems(items);
      setSelectedIndex(0);
      return;
    }

    const query = inputValue.toLowerCase();
    const filtered = items
      .map((group) => ({
        heading: group.heading,
        items: group.items.filter((item) => {
          const label = item.label.toLowerCase();
          const description = (item.description || "").toLowerCase();
          const keywords = (item.keywords || []).map((k) => k.toLowerCase());

          return (
            label.includes(query) ||
            description.includes(query) ||
            keywords.some((k) => k.includes(query))
          );
        }),
      }))
      .filter((group) => group.items.length > 0);

    setFilteredItems(filtered);
    setSelectedIndex(0);
  }, [inputValue, items]);

  // Get all items in order
  const allFilteredItems = filteredItems.flatMap((g) => g.items);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!allFilteredItems.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < allFilteredItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : allFilteredItems.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        const item = allFilteredItems[selectedIndex];
        if (item) {
          item.onSelect?.();
          onSelect?.(item);
        }
        break;
      case "Escape":
        e.preventDefault();
        onOpenChange?.(false);
        break;
    }
  };

  // Auto-scroll selected item into view
  React.useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Focus input when opening
  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (children) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Input */}
      <div className="relative flex items-center gap-2">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full bg-background rounded-md border border-input pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
          )}
        />
        {inputValue && (
          <button
            onClick={() => setInputValue("")}
            className="absolute right-3 p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* List */}
      <div
        ref={listRef}
        className="flex flex-col max-h-72 overflow-y-auto gap-1"
      >
        {filteredItems.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        ) : (
          filteredItems.map((group) => (
            <div key={group.heading} className="space-y-1">
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.heading}
              </div>
              {group.items.map((item, idx) => {
                const globalIndex = allFilteredItems.indexOf(item);
                const isSelected = selectedIndex === globalIndex;

                return (
                  <button
                    key={item.id}
                    data-index={globalIndex}
                    onClick={() => {
                      item.onSelect?.();
                      onSelect?.(item);
                    }}
                    className={cn(
                      "flex items-start gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors cursor-pointer text-left",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-foreground"
                    )}
                  >
                    {item.icon && (
                      <div className="h-5 w-5 flex-shrink-0 mt-0.5 text-current">
                        {item.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export interface CommandRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CommandRoot({
  className,
  children,
  ...props
}: CommandRootProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-popover shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CommandInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export function CommandInput({ className, ...props }: CommandInputProps) {
  return (
    <div className="flex items-center border-b px-3">
      <Search className="h-4 w-4 shrink-0 opacity-50" />
      <input
        className={cn(
          "flex h-11 w-full bg-transparent py-3 px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

export interface CommandListProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CommandList({
  className,
  ...props
}: CommandListProps) {
  return (
    <div
      className={cn(
        "max-h-[300px] overflow-y-auto overflow-x-hidden",
        className
      )}
      {...props}
    />
  );
}

export interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CommandEmpty(props: CommandEmptyProps) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground" {...props}>
      No results found.
    </div>
  );
}

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string;
}

export function CommandGroup({
  heading,
  className,
  ...props
}: CommandGroupProps) {
  return (
    <div className={cn("overflow-hidden", className)} {...props}>
      {heading && (
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      )}
      <div className="space-y-1">{props.children}</div>
    </div>
  );
}

export interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  onSelect?: () => void;
}

export function CommandItem({
  onSelect,
  className,
  ...props
}: CommandItemProps) {
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent/50",
        className
      )}
      onClick={onSelect}
      {...props}
    />
  );
}

export interface CommandSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CommandSeparator({
  className,
  ...props
}: CommandSeparatorProps) {
  return <div className={cn("mx-2 my-1 h-px bg-border", className)} {...props} />;
}
