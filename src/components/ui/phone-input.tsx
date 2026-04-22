"use client";

import * as React from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  COUNTRIES,
  DEFAULT_COUNTRY_ISO2,
  flagEmoji,
  getCountryByIso2,
  parsePhone,
  type Country,
} from "@/lib/constants/countries";

export interface PhoneInputProps {
  /** Full international phone string, e.g. "+2348012345678". */
  value: string;
  /** Emits the full international phone string on any change. */
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  className?: string;
  /** Country to preselect when `value` doesn't carry a dial code. */
  defaultCountryIso2?: string;
  autoComplete?: string;
}

/**
 * Phone input with a country-code picker anchored to the left of the field.
 *
 * Click the flag button to open a searchable dropdown of countries. The
 * component always emits a full international string — the parent never
 * has to know about country state.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      id,
      name,
      placeholder,
      disabled,
      ariaInvalid,
      ariaDescribedBy,
      className,
      defaultCountryIso2 = DEFAULT_COUNTRY_ISO2,
      autoComplete = "tel",
    },
    ref
  ) => {
    const parsed = parsePhone(value);
    const defaultCountry =
      getCountryByIso2(defaultCountryIso2) ?? COUNTRIES[0];
    const country = parsed?.country ?? defaultCountry;
    const national = parsed
      ? parsed.national
      : // Treat the raw value as national digits when no dial code is present —
        // strip anything non-digit so we don't echo "+" back into the field.
        value.replace(/[^\d]/g, "");

    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);
    const searchRef = React.useRef<HTMLInputElement>(null);

    // Close on outside click and Escape.
    React.useEffect(() => {
      if (!open) return;
      function onDocClick(e: MouseEvent) {
        if (!containerRef.current?.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      }
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDocClick);
        document.removeEventListener("keydown", onKey);
      };
    }, [open]);

    // Focus the search when the panel opens.
    React.useEffect(() => {
      if (open) {
        setQuery("");
        // next tick — the input only mounts after `open` is true
        const t = setTimeout(() => searchRef.current?.focus(), 0);
        return () => clearTimeout(t);
      }
    }, [open]);

    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return COUNTRIES;
      return COUNTRIES.filter((c) => {
        const dial = c.dialCode.toLowerCase();
        // allow searching "234" without the "+"
        const dialNoPlus = dial.replace(/^\+/, "");
        return (
          c.name.toLowerCase().includes(q) ||
          c.iso2.toLowerCase().includes(q) ||
          dial.includes(q) ||
          dialNoPlus.includes(q)
        );
      });
    }, [query]);

    function emit(nextCountry: Country, nextNational: string) {
      const digits = nextNational.replace(/[^\d]/g, "");
      onChange(digits ? `${nextCountry.dialCode}${digits}` : "");
    }

    function pickCountry(next: Country) {
      setOpen(false);
      emit(next, national);
    }

    function onNationalChange(e: React.ChangeEvent<HTMLInputElement>) {
      emit(country, e.target.value);
    }

    return (
      <div
        ref={containerRef}
        className={cn("relative w-full", className)}
      >
        <div
          className={cn(
            "flex w-full rounded-md border border-input bg-background ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            disabled && "opacity-50 cursor-not-allowed",
            ariaInvalid &&
              "border-destructive focus-within:ring-destructive"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                aria-label={`Country code: ${country.name} ${country.dialCode}. Click to change.`}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={cn(
                  "flex items-center gap-1.5 pl-3 pr-2 border-r border-input text-base md:text-sm min-h-[44px]",
                  "hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50 rounded-l-md"
                )}
              >
                <span
                  aria-hidden="true"
                  className="text-lg leading-none"
                >
                  {flagEmoji(country.iso2)}
                </span>
                <span className="font-medium tabular-nums">
                  {country.dialCode}
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Choose the country code that matches your phone number
            </TooltipContent>
          </Tooltip>

          <input
            ref={ref}
            id={id}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete={autoComplete}
            disabled={disabled}
            placeholder={placeholder ?? "Phone number"}
            value={national}
            onChange={onNationalChange}
            aria-invalid={ariaInvalid || undefined}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "flex-1 bg-transparent px-3 py-2 text-base md:text-sm min-h-[44px] rounded-r-md",
              "placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
            )}
          />
        </div>

        {open && (
          <div
            role="dialog"
            aria-label="Select country code"
            className={cn(
              "absolute left-0 z-[40] mt-1 w-full max-w-sm rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
              "animate-in fade-in-0 zoom-in-95"
            )}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search
                className="h-4 w-4 text-muted-foreground flex-shrink-0"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code…"
                aria-label="Search country or dial code"
                className="flex-1 bg-transparent text-base md:text-sm focus:outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul
              role="listbox"
              aria-label="Countries"
              className="max-h-64 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No countries match &ldquo;{query}&rdquo;
                </li>
              ) : (
                filtered.map((c) => {
                  const selected = c.iso2 === country.iso2;
                  return (
                    <li key={c.iso2} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => pickCountry(c)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                          selected && "bg-accent/50"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="text-lg leading-none"
                        >
                          {flagEmoji(c.iso2)}
                        </span>
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {c.dialCode}
                        </span>
                        {selected && (
                          <Check
                            className="h-4 w-4 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";
