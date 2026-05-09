"use client";

/**
 * Modal that collects a missing field (phone or full name) needed by
 * `POST /v1/appointments/{id}/check-in` so the receptionist doesn't get
 * blocked when the appointment / visitor profile lacks one.
 *
 * Used in two places by the pending-approvals queue:
 *   1. Pre-emptively, before sending the request, when the row already
 *      shows phone / name as missing.
 *   2. As a fallback, when the backend returns
 *      `400 { code: "VALIDATION_FAILED", details: { missing_field, prompt_required: true } }`.
 */

import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type AppointmentCheckInMissingField = "phone" | "fullName";

const PHONE_REGEX = /^\+?[0-9\s\-()]{7,}$/;

interface AppointmentCheckInPromptModalProps {
  open: boolean;
  /** Which field the backend (or a pre-check) flagged as missing. */
  field: AppointmentCheckInMissingField;
  visitorName: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function AppointmentCheckInPromptModal({
  open,
  field,
  visitorName,
  isSubmitting,
  onCancel,
  onSubmit,
}: AppointmentCheckInPromptModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset on every open so a stale value from a previous prompt doesn't leak.
  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
    }
  }, [open, field]);

  const isPhone = field === "phone";
  const title = isPhone ? "Visitor phone number needed" : "Visitor name needed";
  const description = isPhone
    ? `We don't have a phone number for ${visitorName || "this appointment"} on record. Please ask the visitor for their phone number — it's used to create their visitor profile at check-in.`
    : `We don't have a full name for ${visitorName || "this appointment"} on record. Please confirm the visitor's full name before checking them in.`;
  const label = isPhone ? "Phone number" : "Full name";
  const placeholder = isPhone ? "e.g. +234 801 234 5678" : "Full name of visitor";
  const helpText = isPhone
    ? "Digits with optional +, spaces, dashes, or parentheses."
    : undefined;

  function validate(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return isPhone ? "Phone number is required" : "Full name is required";
    }
    if (isPhone && !PHONE_REGEX.test(trimmed)) {
      return "Enter a valid phone number (digits, spaces, +, -, ( ) only)";
    }
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(value.trim());
  }

  function handleOpenChange(next: boolean) {
    if (!next && !isSubmitting) onCancel();
  }

  const inputId = isPhone ? "checkin-prompt-phone" : "checkin-prompt-fullname";
  const errorId = `${inputId}-error`;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={inputId}>{label}</Label>
          <Input
            id={inputId}
            autoFocus
            type={isPhone ? "tel" : "text"}
            inputMode={isPhone ? "tel" : undefined}
            autoComplete={isPhone ? "tel" : "name"}
            placeholder={placeholder}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className="min-h-[44px]"
            disabled={isSubmitting}
          />
          {error ? (
            <p id={errorId} className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : helpText ? (
            <p className="text-xs text-muted-foreground">{helpText}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Close this prompt without checking the visitor in
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Checking in…"
                  className="w-full md:w-auto"
                >
                  Continue check-in
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Save this {isPhone ? "phone number" : "name"} and finish checking
              the visitor in
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </ResponsiveModal>
  );
}
