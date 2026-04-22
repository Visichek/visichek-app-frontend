"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
