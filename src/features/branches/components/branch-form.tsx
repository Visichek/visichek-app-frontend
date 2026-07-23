"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Mail, UserRound } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import {
  useBranchContact,
  useCreateBranch,
  useUpdateBranch,
} from "@/features/branches/hooks/use-branches";
import { ContactUserPicker } from "@/features/branches/components/contact-user-picker";
import type { Branch } from "@/types/tenant";

const branchSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
});

type BranchFormData = z.infer<typeof branchSchema>;

interface BranchFormProps {
  /** When set, the form is in edit mode. */
  branch?: Branch;
}

export function BranchForm({ branch }: BranchFormProps) {
  const router = useRouter();
  const { loadingHref } = useNavigationLoading();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const isEditing = !!branch;

  // Designated point of contact (WS4). Kept outside react-hook-form —
  // it's a custom picker with a nullable value.
  const [contactUserId, setContactUserId] = useState<string | null>(
    branch?.contactUserId ?? null,
  );
  // Resolved POC card for the branch being edited (designated contact →
  // branch email fallback → main administrator; never empty server-side).
  const contactQuery = useBranchContact(branch?.id ?? "", isEditing);
  const contact = contactQuery.data;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: branch?.name ?? "",
      address: branch?.address ?? "",
      city: branch?.city ?? "",
      state: branch?.state ?? "",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      name: data.name,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      // Explicit null clears the designation server-side (WS4).
      contactUserId,
    };

    try {
      if (isEditing && branch) {
        await updateMutation.mutateAsync({
          branchId: branch.id,
          data: payload,
        });
        toast.success("Branch updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Branch created");
      }
      router.push("/app/branches");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} branch`,
      );
    }
  });

  const submitting =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton href="/app/branches" variant="ghost" size="sm" className="min-h-[44px]">
              {loadingHref === "/app/branches" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to branches
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the branches list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit branch" : "New branch"}
        description={
          isEditing
            ? "Update this office location's details. Existing assignments stay intact."
            : "Add a new physical office location for staff and visitors."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Branch name *</Label>
          <Input
            id="name"
            placeholder="e.g. Main Office, Downtown Branch"
            {...register("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "error-name" : undefined}
            className="min-h-[44px]"
          />
          {errors.name && (
            <p id="error-name" className="text-sm text-destructive" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Street address</Label>
          <Input
            id="address"
            placeholder="Street address (optional)"
            {...register("address")}
            className="min-h-[44px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="City (optional)"
              {...register("city")}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State / Province</Label>
            <Input
              id="state"
              placeholder="State or province (optional)"
              {...register("state")}
              className="min-h-[44px]"
            />
          </div>
        </div>

        {isEditing && contact && (contact.fullName || contact.email) && (
          <div className="rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserRound
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Point of contact</p>
                <p className="text-sm truncate">
                  {contact.fullName || contact.email}
                </p>
                {contact.email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.email}
                  </p>
                )}
                {contact.role && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {contact.role.replace(/_/g, " ")}
                  </p>
                )}
                {!contact.userId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No contact designated — showing this branch&apos;s
                    fallback contact. Pick a staff member below to change it.
                  </p>
                )}
              </div>
              {contact.email && (
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(contact.email ?? "")
                            .then(() => toast.success("Email copied"))
                            .catch(() =>
                              toast.error("Couldn't copy the email"),
                            );
                        }}
                        aria-label="Copy contact email"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Copy the contact&apos;s email address
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        asChild
                      >
                        <a
                          href={`mailto:${contact.email}`}
                          aria-label="Email the branch contact"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Open your mail app to email the contact
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        )}

        <ContactUserPicker
          value={contactUserId}
          onChange={setContactUserId}
          branchId={branch?.id}
          disabled={submitting}
        />

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href="/app/branches"
                variant="outline"
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                Cancel
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the branches list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText={isEditing ? "Saving…" : "Creating…"}
                  className="w-full md:w-auto"
                >
                  {isEditing ? "Save changes" : "Create branch"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the branches list"
                : "Create this branch and return to the list"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
