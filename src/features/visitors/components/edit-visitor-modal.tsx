"use client";

/**
 * Modal that edits a visitor's profile identity fields (name, email,
 * phone, company) from the receptionist / admin visitors list.
 *
 * Backed by `useUpdateVisitorProfile` → `PATCH /v1/visitors/{visitorId}`
 * (PROPOSED endpoint — see `backend-contract-manual-verify-and-edit-visitor.txt`).
 * Only changed fields are sent; nullable fields cleared to empty are sent
 * as `null` so the backend can distinguish "clear" from "leave unchanged".
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { useUpdateVisitorProfile } from "@/features/checkins/hooks";
import type { VisitorProfileUpdateRequest } from "@/types/checkin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,}$/;

export interface EditVisitorTarget {
  /** Canonical `visitors` record id (checkin.visitorId / checkin.visitor.id). */
  visitorId: string;
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface EditVisitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitor: EditVisitorTarget | null;
}

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  company: string;
}

function initialFormState(visitor: EditVisitorTarget | null): FormState {
  return {
    fullName: visitor?.fullName ?? "",
    email: visitor?.email ?? "",
    phone: visitor?.phone ?? "",
    company: visitor?.company ?? "",
  };
}

export function EditVisitorModal({
  open,
  onOpenChange,
  visitor,
}: EditVisitorModalProps) {
  const updateVisitor = useUpdateVisitorProfile();
  const [form, setForm] = useState<FormState>(() => initialFormState(visitor));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );

  // Re-seed the form whenever a different visitor opens the modal so a
  // stale draft from a previous edit can't leak across rows.
  useEffect(() => {
    if (open) {
      setForm(initialFormState(visitor));
      setErrors({});
    }
  }, [open, visitor]);

  const original = useMemo(() => initialFormState(visitor), [visitor]);

  /**
   * Build the PATCH body from only the fields the user actually changed.
   * Trimmed comparison avoids no-op writes from leading/trailing spaces.
   * Cleared nullable fields (email, company) go out as explicit `null`.
   */
  const diff = useMemo<VisitorProfileUpdateRequest>(() => {
    const body: VisitorProfileUpdateRequest = {};
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const company = form.company.trim();

    if (fullName !== original.fullName.trim()) body.fullName = fullName;
    if (phone !== original.phone.trim()) body.phone = phone;
    if (email !== original.email.trim()) body.email = email === "" ? null : email;
    if (company !== original.company.trim())
      body.company = company === "" ? null : company;
    return body;
  }, [form, original]);

  const hasChanges = Object.keys(diff).length > 0;

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.fullName.trim()) {
      next.fullName = "Full name is required";
    }
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    }
    if (form.phone.trim() && !PHONE_REGEX.test(form.phone.trim())) {
      next.phone = "Enter a valid phone number";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!visitor) return;
    if (!validate()) return;
    if (!hasChanges) {
      onOpenChange(false);
      return;
    }
    try {
      await updateVisitor.mutateAsync({ visitorId: visitor.visitorId, body: diff });
      toast.success("Visitor details updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update visitor details",
      );
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && updateVisitor.isPending) return;
    onOpenChange(next);
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit visitor details"
      description="Update this visitor's name, contact details, and company. Changes apply to their profile and show on future visits."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-visitor-name">Full name</Label>
          <Input
            id="edit-visitor-name"
            value={form.fullName}
            onChange={(e) => handleField("fullName", e.target.value)}
            autoComplete="name"
            className="text-base md:text-sm min-h-[44px]"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "edit-visitor-name-error" : undefined}
            disabled={updateVisitor.isPending}
          />
          {errors.fullName && (
            <p
              id="edit-visitor-name-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-visitor-email">Email</Label>
          <Input
            id="edit-visitor-email"
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => handleField("email", e.target.value)}
            autoComplete="email"
            placeholder="Optional"
            className="text-base md:text-sm min-h-[44px]"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "edit-visitor-email-error" : undefined}
            disabled={updateVisitor.isPending}
          />
          {errors.email && (
            <p
              id="edit-visitor-email-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-visitor-phone">Phone</Label>
          <Input
            id="edit-visitor-phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => handleField("phone", e.target.value)}
            autoComplete="tel"
            placeholder="e.g. +234 801 234 5678"
            className="text-base md:text-sm min-h-[44px]"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "edit-visitor-phone-error" : undefined}
            disabled={updateVisitor.isPending}
          />
          {errors.phone && (
            <p
              id="edit-visitor-phone-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.phone}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-visitor-company">Company</Label>
          <Input
            id="edit-visitor-company"
            value={form.company}
            onChange={(e) => handleField("company", e.target.value)}
            autoComplete="organization"
            placeholder="Optional"
            className="text-base md:text-sm min-h-[44px]"
            disabled={updateVisitor.isPending}
          />
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateVisitor.isPending}
                className="w-full min-h-[44px] md:w-auto"
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard your changes and close this dialog
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={updateVisitor.isPending}
                  loadingText="Saving…"
                  disabled={!hasChanges}
                  className="w-full md:w-auto"
                >
                  Save changes
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Save the updated details to this visitor&apos;s profile
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </ResponsiveModal>
  );
}
