"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useSearchAdmins } from "@/features/support-cases/hooks/use-admin-support-cases";
import type { AdminSearchResult } from "@/types/admin";
import type { AccountStatus } from "@/types/enums";

interface AdminSearchComboboxProps {
  selected: AdminSearchResult | null;
  onSelect: (admin: AdminSearchResult | null) => void;
  id?: string;
  placeholder?: string;
  labelText?: string;
}

/**
 * Async admin directory combobox — searches `/admins/search` as the user
 * types and surfaces a single selection. The parent owns what to do with the
 * choice (assign one case, bulk-assign many, etc.).
 */
export function AdminSearchCombobox({
  selected,
  onSelect,
  id = "admin-search",
  placeholder = "Search by email, name, or admin ID…",
  labelText = "Search admin by email, name, or ID",
}: AdminSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const searchQuery = !selected ? debouncedQuery.trim() : "";
  const { data: results = [], isFetching, isError } = useSearchAdmins(searchQuery);

  const showDropdown = isOpen && !selected && searchQuery.length >= 1;

  const handleSelect = (admin: AdminSearchResult) => {
    onSelect(admin);
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <Label htmlFor={id} className="sr-only">
        {labelText}
      </Label>

      {selected ? (
        <SelectedAdminPreview admin={selected} onClear={handleClear} />
      ) : (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={id}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={`${id}-results`}
            className="min-h-[44px] pl-9 text-base md:text-sm"
          />
          {isFetching && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {showDropdown && (
        <div
          id={`${id}-results`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-dropdown mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {isError ? (
            <div className="px-3 py-6 text-center text-sm text-destructive">
              Couldn&apos;t reach the admin directory. Try again in a moment.
            </div>
          ) : results.length === 0 && !isFetching ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No admins matched &ldquo;{searchQuery}&rdquo;. Try an email, name, or full ID.
            </div>
          ) : (
            results.map((admin) => (
              <AdminResultRow
                key={admin.id}
                admin={admin}
                onSelect={() => handleSelect(admin)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SelectedAdminPreview({
  admin,
  onClear,
}: {
  admin: AdminSearchResult;
  onClear: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {getInitials(admin.fullName)}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{admin.fullName}</span>
          <AccountStatusPill status={admin.accountStatus} />
          {admin.mfaEnabled && <MfaPill />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{admin.email}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {admin.id}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClear}
            aria-label="Clear selected admin"
            className="h-11 w-11 shrink-0 md:h-8 md:w-8"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Clear the selection and search for a different admin
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function AdminResultRow({
  admin,
  onSelect,
}: {
  admin: AdminSearchResult;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected="false"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-accent/60 focus:bg-accent/60 focus:outline-none"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {getInitials(admin.fullName)}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {admin.fullName}
          </span>
          <AccountStatusPill status={admin.accountStatus} />
          {admin.mfaEnabled && <MfaPill />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{admin.email}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {admin.id}
        </div>
      </div>
    </button>
  );
}

function AccountStatusPill({ status }: { status: AccountStatus }) {
  const styles: Record<AccountStatus, string> = {
    ACTIVE: "border-success/50 bg-success/10 text-success",
    INACTIVE: "border-border bg-muted text-muted-foreground",
    SUSPENDED: "border-destructive/50 bg-destructive/10 text-destructive",
  };
  const label: Record<AccountStatus, string> = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    SUSPENDED: "Suspended",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}
    >
      {label[status]}
    </span>
  );
}

function MfaPill() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-full border border-info/50 bg-info/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-info">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          MFA
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        This admin has two-factor authentication enabled
      </TooltipContent>
    </Tooltip>
  );
}

export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
