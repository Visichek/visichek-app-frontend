"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import type {
  RequiredField,
  RequiredFieldCategory,
} from "@/types/checkin";
import { cn } from "@/lib/utils/cn";

export interface RequiredFieldsFormProps {
  /** Every field to render — config-driven. */
  fields: RequiredField[];
  /** Current values keyed by field.key. */
  values: Record<string, unknown>;
  /** Called when any field changes. */
  onChange: (key: string, value: unknown) => void;
  /** Optional category filter — show only fields in this bucket. */
  category?: RequiredFieldCategory;
  /** Field keys that should display an inline error. */
  errors?: Record<string, string>;
  /** Keys the user should not be able to edit (e.g. OCR-filled fields until they tap edit). */
  readOnlyKeys?: string[];
  className?: string;
}

/**
 * Renders a config-driven set of input fields.
 *
 * Each field's input type is chosen from RequiredField.type. Fields are
 * stacked vertically on mobile, in a two-column grid on tablet+.
 *
 * All inputs use `text-base md:text-sm` to hit the 16px minimum font size
 * on mobile Safari (prevents the iOS zoom-on-focus behaviour).
 */
export function RequiredFieldsForm({
  fields,
  values,
  onChange,
  category,
  errors = {},
  readOnlyKeys = [],
  className,
}: RequiredFieldsFormProps) {
  const visible = category
    ? fields.filter((f) => f.category === category)
    : fields;

  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-4",
        className
      )}
    >
      {visible.map((field) => {
        const value = values[field.key];
        const error = errors[field.key];
        const readOnly = readOnlyKeys.includes(field.key);
        const id = `field-${field.key}`;

        return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={id} className="text-sm">
                {field.label}
                {field.required && (
                  <span className="text-destructive ml-0.5" aria-hidden="true">
                    *
                  </span>
                )}
              </Label>
              {field.helperText && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Help for ${field.label}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    {field.helperText}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {renderInput(field, id, value, readOnly, (v) =>
              onChange(field.key, v)
            )}

            {error && (
              <p
                role="alert"
                className="text-xs text-destructive mt-0.5"
              >
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderInput(
  field: RequiredField,
  id: string,
  value: unknown,
  readOnly: boolean,
  onChange: (v: unknown) => void
) {
  const common = {
    id,
    placeholder: field.placeholder,
    disabled: readOnly,
    className: "text-base md:text-sm min-h-[44px]",
  };

  switch (field.type) {
    case "email":
      return (
        <Input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "phone":
    case "tel":
      return (
        <PhoneInput
          id={id}
          value={(value as string) ?? ""}
          onChange={(v) => onChange(v)}
          disabled={readOnly}
          placeholder={field.placeholder ?? "Phone number"}
        />
      );
    case "number":
      return (
        <Input
          {...common}
          type="number"
          inputMode="numeric"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          {...common}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id={id}
            checked={Boolean(value)}
            disabled={readOnly}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <Label htmlFor={id} className="text-sm text-muted-foreground">
            {field.placeholder || "Yes"}
          </Label>
        </div>
      );
    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={onChange}
          disabled={readOnly}
        >
          <SelectTrigger className="text-base md:text-sm min-h-[44px]">
            <SelectValue placeholder={field.placeholder || "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "string":
    default:
      return (
        <Input
          {...common}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
