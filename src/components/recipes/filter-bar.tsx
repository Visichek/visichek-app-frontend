"use client";

import * as React from "react";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  type: "select" | "date-range";
}

export interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;

  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;

  className?: string;
}

export function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  className,
}: FilterBarProps) {
  // Count active filters
  const activeFilterCount = Object.values(values).filter((v) => v).length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search input */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Filters */}
      {filters.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={values[filter.key] || ""}
              onValueChange={(value) => onChange(filter.key, value)}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {/* Clear button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-10 gap-2 md:ml-auto"
            >
              <X className="h-4 w-4" />
              <span>Clear</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-6 min-w-6 rounded-full p-0 text-xs flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
