"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/feedback/loading-button";
import { PageHeader } from "@/components/recipes/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useSession } from "@/hooks/use-session";
import { TARGET_TYPE_LABEL } from "../lib/field-types";
import {
  useActiveTenantForm,
  useCreateTenantForm,
  useUpdateTenantForm,
} from "../hooks/use-tenant-forms";
import type {
  FormFieldDefinition,
  FormTargetType,
  TenantForm,
} from "../types";
import { FieldEditor } from "./field-editor";
import { FieldRow } from "./field-row";

interface FormBuilderProps {
  /** Defaults to "checkin" for the visitors page entry point. */
  defaultTarget?: FormTargetType;
}

const TARGET_TABS: FormTargetType[] = [
  "checkin",
  "appointment",
  "visit_session",
];

interface DraftState {
  name: string;
  description: string;
  fields: FormFieldDefinition[];
}

function emptyDraft(targetType: FormTargetType): DraftState {
  const meta = TARGET_TYPE_LABEL[targetType];
  return {
    name: meta.title,
    description: meta.description,
    fields: [],
  };
}

function formToDraft(form: TenantForm): DraftState {
  return {
    name: form.name,
    description: form.description ?? "",
    // Normalise order so the rendered list matches what the user sees.
    fields: [...form.fields].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.fieldId.localeCompare(b.fieldId);
    }),
  };
}

export function FormBuilder({ defaultTarget = "checkin" }: FormBuilderProps) {
  const { tenantId } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();

  const [target, setTarget] = useState<FormTargetType>(defaultTarget);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormFieldDefinition | null>(
    null,
  );
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft(defaultTarget));
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const activeFormQuery = useActiveTenantForm(tenantId ?? undefined, target);
  const createMutation = useCreateTenantForm(tenantId ?? undefined);
  const updateMutation = useUpdateTenantForm(tenantId ?? undefined);

  const activeForm = activeFormQuery.data ?? null;

  // Hydrate the working draft when the resolved form for `target` changes.
  // We track which (target, formId, version) we last hydrated from so user
  // edits survive incidental re-renders but a tab switch or remote update
  // resets cleanly.
  useEffect(() => {
    if (activeFormQuery.isLoading) return;
    const key = activeForm
      ? `${target}:${activeForm.formId}:${activeForm.version}`
      : `${target}:none`;
    if (hydratedKey === key) return;
    setDraft(activeForm ? formToDraft(activeForm) : emptyDraft(target));
    setHydratedKey(key);
  }, [activeForm, activeFormQuery.isLoading, hydratedKey, target]);

  const orderedFields = useMemo(
    () =>
      [...draft.fields].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.fieldId.localeCompare(b.fieldId);
      }),
    [draft.fields],
  );

  function openNewField() {
    setEditingField(null);
    setEditorOpen(true);
  }

  function openEditField(field: FormFieldDefinition) {
    setEditingField(field);
    setEditorOpen(true);
  }

  function persistField(field: FormFieldDefinition) {
    setDraft((prev) => {
      const existingIdx = prev.fields.findIndex(
        (f) => f.fieldId === (editingField?.fieldId ?? field.fieldId),
      );
      const nextField: FormFieldDefinition = {
        ...field,
        order:
          existingIdx >= 0
            ? prev.fields[existingIdx].order
            : (prev.fields.at(-1)?.order ?? 0) + 10,
      };
      const fields =
        existingIdx >= 0
          ? prev.fields.map((f, i) => (i === existingIdx ? nextField : f))
          : [...prev.fields, nextField];
      return { ...prev, fields };
    });
    setEditorOpen(false);
    setEditingField(null);
  }

  function removeField(fieldId: string) {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.fieldId !== fieldId),
    }));
  }

  function moveField(fieldId: string, direction: "up" | "down") {
    setDraft((prev) => {
      const sorted = [...prev.fields].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.fieldId.localeCompare(b.fieldId);
      });
      const idx = sorted.findIndex((f) => f.fieldId === fieldId);
      if (idx < 0) return prev;
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapWith];
      // Re-stamp orders so a save sends a clean ascending sequence.
      const reordered = sorted.map((f, i) => {
        if (i === idx) return { ...b, order: (i + 1) * 10 };
        if (i === swapWith) return { ...a, order: (i + 1) * 10 };
        return { ...f, order: (i + 1) * 10 };
      });
      return { ...prev, fields: reordered };
    });
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      toast.error("Form name is required.");
      return;
    }
    if (orderedFields.length === 0) {
      toast.error("Add at least one field before saving.");
      return;
    }
    // Re-stamp orders on save so the submitted body is canonical.
    const payloadFields = orderedFields.map((f, i) => ({
      ...f,
      order: (i + 1) * 10,
    }));
    try {
      if (activeForm) {
        await updateMutation.mutateAsync({
          formId: activeForm.formId,
          name: draft.name,
          description: draft.description || null,
          fields: payloadFields,
        });
        toast.success("Form updated. A new version is now active.");
      } else {
        await createMutation.mutateAsync({
          targetType: target,
          name: draft.name,
          description: draft.description || null,
          fields: payloadFields,
        });
        toast.success("Form published.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save the form.",
      );
    }
  }

  const submitting =
    createMutation.isPending || updateMutation.isPending;
  const isLoadingForm = activeFormQuery.isLoading;
  const errorLoading = activeFormQuery.isError ? activeFormQuery.error : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="min-h-[44px]"
            >
              <Link
                href="/app/visitors"
                onClick={() => handleNavClick("/app/visitors")}
              >
                {loadingHref === "/app/visitors" ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft
                    className="mr-2 h-4 w-4"
                    aria-hidden="true"
                  />
                )}
                Back to visitors
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the visitors list without saving any changes
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="Visitor form-builder"
        description="Configure the questions visitors and your team answer for each visit type. Saving creates a new version and keeps history readable."
        actions={
          activeForm ? (
            <span className="text-xs text-muted-foreground">
              Active version v{activeForm.version}
            </span>
          ) : null
        }
      />

      {/* Target tabs */}
      <div
        className="flex gap-2 border-b overflow-x-auto"
        role="tablist"
        aria-label="Form target"
      >
        {TARGET_TABS.map((id) => {
          const isActive = target === id;
          const meta = TARGET_TYPE_LABEL[id];
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setTarget(id)}
                  className={[
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 min-h-[44px]",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {meta.title}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{meta.description}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {errorLoading ? (
        <ErrorState
          error={errorLoading}
          message="Couldn't load the form for this target. Try again, or check your permissions."
          onRetry={() => activeFormQuery.refetch()}
        />
      ) : (
        <>
          {/* Form metadata */}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Form name</Label>
              <Input
                id="form-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Standard appointment"
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-description">Description (optional)</Label>
              <Textarea
                id="form-description"
                value={draft.description}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Internal note about when this form is used."
                className="text-base md:text-sm"
              />
            </div>
          </div>

          {/* Fields list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Fields</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={openNewField}
                    className="min-h-[44px]"
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Add field
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Add a new question to this form. Changes only go live when
                  you click Save form.
                </TooltipContent>
              </Tooltip>
            </div>

            {isLoadingForm ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : orderedFields.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm font-medium">No fields yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click <span className="font-medium">Add field</span> to start
                  building this form.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {orderedFields.map((field, idx) => (
                  <FieldRow
                    key={field.fieldId}
                    field={field}
                    isFirst={idx === 0}
                    isLast={idx === orderedFields.length - 1}
                    onEdit={openEditField}
                    onRemove={removeField}
                    onMove={moveField}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Save bar */}
          <div className="flex flex-col gap-2 border-t pt-4 md:flex-row md:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    type="button"
                    onClick={handleSave}
                    isLoading={submitting}
                    loadingText={activeForm ? "Publishing…" : "Creating…"}
                    className="w-full md:w-auto"
                  >
                    {activeForm ? "Save form (creates new version)" : "Publish form"}
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {activeForm
                  ? "Publish this draft as a new active version. The previous version becomes superseded but historical submissions still resolve."
                  : "Publish this form so the receptionist UI and kiosk can render it for new visits."}
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}

      <FieldEditor
        open={editorOpen}
        initialField={editingField}
        existingFieldIds={draft.fields.map((f) => f.fieldId)}
        onClose={() => {
          setEditorOpen(false);
          setEditingField(null);
        }}
        onSave={persistField}
      />
    </div>
  );
}
