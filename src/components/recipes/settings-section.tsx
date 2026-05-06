"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

// ── Section wrapper ──────────────────────────────────────────────────

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function SettingsSection({ title, description, icon, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {icon}
            </div>
          )}
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">{children}</CardContent>
    </Card>
  );
}

// ── Toggle row ───────────────────────────────────────────────────────

interface SettingsToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /**
   * While true, the switch is disabled and a small spinner sits next to it.
   * Keep this tied to the mutation's `isPending` so the control can't be
   * toggled again until the queued write settles (succeeded or failed).
   */
  isLoading?: boolean;
}

export function SettingsToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  isLoading = false,
}: SettingsToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors min-h-[52px]">
      <div className="flex-1 mr-4">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {isLoading && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Switch
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled || isLoading}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isLoading
              ? "Saving…"
              : checked
                ? `Disable ${label.toLowerCase()}`
                : `Enable ${label.toLowerCase()}`}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Select row ───────────────────────────────────────────────────────

interface SettingsSelectProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  tooltip?: string;
  /**
   * While true, the select is disabled and a small spinner sits next to it.
   * Keep this tied to the mutation's `isPending` so the value can't be
   * changed again until the queued write settles (succeeded or failed).
   */
  isLoading?: boolean;
}

export function SettingsSelect({
  id,
  label,
  description,
  value,
  onValueChange,
  options,
  disabled = false,
  tooltip,
  isLoading = false,
}: SettingsSelectProps) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors min-h-[52px]">
      <div className="flex-1 mr-4">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {isLoading && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={value}
                onValueChange={onValueChange}
                disabled={disabled || isLoading}
              >
                <SelectTrigger id={id} className="w-[160px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isLoading ? "Saving…" : tooltip || description}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Info row (read-only display) ─────────────────────────────────────

interface SettingsInfoProps {
  label: string;
  description?: string;
  value: ReactNode;
  action?: ReactNode;
}

export function SettingsInfo({ label, description, value, action }: SettingsInfoProps) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors min-h-[52px]">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{value}</span>
        {action}
      </div>
    </div>
  );
}

// ── Text edit row (inline editable text/email) ──────────────────────

interface SettingsTextEditProps {
  id: string;
  label: string;
  description: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric";
  emptyDisplay?: string;
  /**
   * If provided, called with the trimmed input. Return a non-empty string to
   * surface as a validation error and block save. Return null/undefined to
   * accept the input.
   */
  validate?: (value: string) => string | null | undefined;
  disabled?: boolean;
  /**
   * While true, the controls are disabled and a small spinner sits next to
   * them. Tied to the mutation's `isPending`.
   */
  isLoading?: boolean;
}

export function SettingsTextEdit({
  id,
  label,
  description,
  value,
  onSave,
  type = "text",
  placeholder,
  inputMode,
  emptyDisplay = "—",
  validate,
  disabled = false,
  isLoading = false,
}: SettingsTextEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync with the canonical value when not actively editing
  // (e.g. after a successful save the parent passes the new value back).
  useEffect(() => {
    if (!isEditing) setDraft(value ?? "");
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      // Defer focus so Radix tooltip portals don't steal it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing]);

  const startEdit = () => {
    setDraft(value ?? "");
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(value ?? "");
    setError(null);
    setIsEditing(false);
  };

  const commit = () => {
    const next = draft.trim();
    if (next === (value ?? "")) {
      setIsEditing(false);
      setError(null);
      return;
    }
    const validationError = validate?.(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(next);
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="flex items-start justify-between rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors min-h-[52px] gap-4">
      <div className="flex-1 min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {isEditing && error && (
          <p className="text-xs text-destructive mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isLoading && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <Input
              ref={inputRef}
              id={id}
              type={type}
              inputMode={inputMode}
              value={draft}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              className="w-[220px] h-9"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={commit}
                  disabled={disabled || isLoading}
                  aria-label={`Save ${label.toLowerCase()}`}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Save the new {label.toLowerCase()}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={cancelEdit}
                  disabled={disabled || isLoading}
                  aria-label={`Cancel editing ${label.toLowerCase()}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Discard changes and keep the current {label.toLowerCase()}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            <span
              className={cn(
                "text-sm max-w-[260px] truncate",
                value ? "text-foreground" : "text-muted-foreground",
              )}
              title={value ?? undefined}
            >
              {value && value.length > 0 ? value : emptyDisplay}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={startEdit}
                  disabled={disabled || isLoading}
                  aria-label={`Edit ${label.toLowerCase()}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Edit the {label.toLowerCase()} for this organisation
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
