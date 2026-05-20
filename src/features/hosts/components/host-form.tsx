"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { NavButton } from "@/components/recipes/nav-button";
import { ImageUploadField } from "@/components/recipes/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PhoneInput } from "@/components/ui/phone-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import { useDepartments } from "@/features/departments/hooks/use-departments";
import { useSystemUsers } from "@/features/users/hooks/use-users";
import { useCreateHost, useUpdateHost } from "@/features/hosts/hooks/use-hosts";
import { ApiError } from "@/types/api";
import type {
  Host,
  HostWithSummary,
  HostCreateRequest,
  HostUpdateRequest,
} from "@/types/host";

const LIST_HREF = "/app/hosts";

interface HostFormProps {
  /** When set, the form is in edit mode. */
  host?: HostWithSummary | Host;
}

/**
 * Create / edit a host.
 *
 * A host can be a dedicated record (no login) or mirror a tenant system
 * user. The `sourceSystemUserId` link is chosen on create only — the
 * backend does not accept it on update — so the "mirror a system user"
 * picker is hidden when editing.
 */
export function HostForm({ host }: HostFormProps) {
  const router = useRouter();
  const { loadingHref } = useNavigationLoading();
  const { tenantId } = useSession();
  const createMutation = useCreateHost();
  const updateMutation = useUpdateHost();
  const isEditing = !!host;

  const departmentsQuery = useDepartments({ skip: 0, limit: 200, sort: "name" });
  // Only relevant when creating a mirrored host.
  const usersQuery = useSystemUsers({ limit: 200 });

  const [name, setName] = useState(host?.name ?? "");
  const [phone, setPhone] = useState(host?.phone ?? "");
  const [email, setEmail] = useState(host?.email ?? "");
  const [departmentId, setDepartmentId] = useState(host?.departmentId ?? "");
  const [pictureImageUrl, setPictureImageUrl] = useState(
    host?.pictureImageUrl ?? "",
  );
  const [signatureImageUrl, setSignatureImageUrl] = useState(
    host?.signatureImageUrl ?? "",
  );
  const [sourceSystemUserId, setSourceSystemUserId] = useState("");
  const [isActive, setIsActive] = useState(host?.isActive ?? true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const departmentOptions = useMemo(
    () =>
      departmentsQuery.data?.items
        ?.filter((d) => !!d?.id)
        .map((d) => ({ value: d.id, label: d.name })) ?? [],
    [departmentsQuery.data],
  );

  const userOptions = useMemo(
    () =>
      usersQuery.data?.items
        ?.filter((u) => !!u?.id)
        .map((u) => ({
          value: u.id,
          label: u.email ? `${u.fullName} (${u.email})` : u.fullName,
        })) ?? [],
    [usersQuery.data],
  );

  const submitting = createMutation.isPending || updateMutation.isPending;

  function clearError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  /** Prefill name/email from the chosen system user (phone isn't on the user). */
  function handleMirrorUser(userId: string) {
    setSourceSystemUserId(userId);
    const user = usersQuery.data?.items?.find((u) => u.id === userId);
    if (user) {
      if (!name.trim()) setName(user.fullName);
      if (!email.trim() && user.email) setEmail(user.email);
      if (!departmentId && user.departmentId) setDepartmentId(user.departmentId);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Host name is required";
    if (!phone.trim()) next.phone = "Phone number is required";
    if (!departmentId) next.departmentId = "Select a department";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) {
      toast.error("Fill every required field before submitting.");
      return;
    }

    try {
      if (isEditing && host) {
        const payload: HostUpdateRequest = {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          departmentId,
          pictureImageUrl: pictureImageUrl.trim() || undefined,
          signatureImageUrl: signatureImageUrl.trim() || undefined,
          isActive,
        };
        await updateMutation.mutateAsync({ hostId: host.id, data: payload });
        toast.success("Host updated");
        router.push(LIST_HREF);
      } else {
        const payload: HostCreateRequest = {
          name: name.trim(),
          phone: phone.trim(),
          departmentId,
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(pictureImageUrl.trim()
            ? { pictureImageUrl: pictureImageUrl.trim() }
            : {}),
          ...(signatureImageUrl.trim()
            ? { signatureImageUrl: signatureImageUrl.trim() }
            : {}),
          ...(sourceSystemUserId ? { sourceSystemUserId } : {}),
        };
        await createMutation.mutateAsync(payload);
        toast.success("Host created");
        router.push(LIST_HREF);
      }
    } catch (err) {
      // 409 duplicate name and 404 bad department / system user arrive
      // synchronously (before the 202). Pin them to the relevant field.
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setFieldErrors((prev) => ({
            ...prev,
            name: "A host with this name already exists",
          }));
          toast.error("A host with this name already exists.");
          return;
        }
        if (err.status === 404) {
          toast.error(err.message || "Department or linked user not found.");
          return;
        }
      }
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} host`,
      );
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <NavButton
              href={LIST_HREF}
              variant="ghost"
              size="sm"
              className="min-h-[44px]"
            >
              {loadingHref === LIST_HREF ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Back to hosts
            </NavButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the hosts list without saving
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title={isEditing ? "Edit host" : "New host"}
        description={
          isEditing
            ? "Update this host's contact details and availability."
            : "Add a person visitors can be scheduled to see. Hosts don't need a login account."
        }
      />

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Mirror a system user — create only */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="source-system-user">Mirror an existing user</Label>
            <SearchableSelect
              id="source-system-user"
              value={sourceSystemUserId}
              onValueChange={handleMirrorUser}
              options={userOptions}
              placeholder="Optional — link this host to a staff account"
              searchPlaceholder="Search users..."
              aria-label="Mirror an existing system user"
            />
            <p className="text-xs text-muted-foreground">
              Pick a staff member to pre-fill their details, or leave blank to
              create a dedicated host with no login.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            placeholder="e.g. Jane Host"
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? "error-name" : undefined}
            className="min-h-[44px] text-base md:text-sm"
          />
          {fieldErrors.name && (
            <p id="error-name" className="text-sm text-destructive" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <PhoneInput
            id="phone"
            value={phone}
            onChange={(v) => {
              setPhone(v);
              clearError("phone");
            }}
            ariaInvalid={!!fieldErrors.phone}
            ariaDescribedBy={fieldErrors.phone ? "error-phone" : undefined}
          />
          {fieldErrors.phone && (
            <p id="error-phone" className="text-sm text-destructive" role="alert">
              {fieldErrors.phone}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@acme.com"
            className="min-h-[44px] text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <SearchableSelect
            id="department"
            value={departmentId}
            onValueChange={(v) => {
              setDepartmentId(v);
              clearError("departmentId");
            }}
            options={departmentOptions}
            placeholder="Select a department"
            searchPlaceholder="Search departments..."
            aria-label="Department"
            aria-invalid={!!fieldErrors.departmentId}
            aria-describedby={
              fieldErrors.departmentId ? "error-department" : undefined
            }
          />
          {fieldErrors.departmentId && (
            <p
              id="error-department"
              className="text-sm text-destructive"
              role="alert"
            >
              {fieldErrors.departmentId}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="picture-url">Photo</Label>
          {/* A host portrait is non-sensitive and embedded on badges /
              appointment cards, so it goes to the public upload surface. */}
          <ImageUploadField
            id="picture-url"
            value={pictureImageUrl}
            onChange={setPictureImageUrl}
            previewUrl={host?.pictureUrl}
            visibility="public"
            tenantId={tenantId}
            purpose="host_photo"
            alt={`${name || "Host"} photo`}
            uploadLabel="Upload photo"
            uploadTooltip="Upload a portrait image for this host; it can be shown on badges and appointment cards"
            removeTooltip="Remove this host's photo"
            helpText="JPG, PNG, GIF or WebP."
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signature-url">Signature image</Label>
          {/* A signature is sensitive, so it goes to the private,
              access-controlled upload surface. */}
          <ImageUploadField
            id="signature-url"
            value={signatureImageUrl}
            onChange={setSignatureImageUrl}
            previewUrl={host?.signatureUrl}
            visibility="private"
            purpose="host_signature"
            alt={`${name || "Host"} signature`}
            uploadLabel="Upload signature"
            uploadTooltip="Upload this host's signature image; stored privately and used when signing off visits"
            removeTooltip="Remove this host's signature image"
            helpText="JPG, PNG, GIF or WebP. Stored privately."
            disabled={submitting}
          />
        </div>

        {/* Active toggle — edit only (soft enable/disable) */}
        {isEditing && (
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive hosts are hidden from new appointment pickers.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Switch
                    id="is-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    aria-label="Toggle whether this host is active"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isActive
                  ? "Host is active and selectable on new appointments"
                  : "Host is disabled and hidden from new appointment pickers"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <NavButton
                href={LIST_HREF}
                variant="outline"
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                Cancel
              </NavButton>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this draft and return to the hosts list
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
                  {isEditing ? "Save changes" : "Create host"}
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isEditing
                ? "Save changes and return to the hosts list"
                : "Create this host and return to the hosts list"}
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
