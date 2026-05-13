"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Layers3,
  Loader2,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingButton } from "@/components/feedback/loading-button";
import { ErrorState } from "@/components/feedback/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/hooks/use-session";
import {
  TARGET_TYPE_LABEL,
  isFileType,
  isNumericType,
  isOptionType,
  isStringType,
  isTemporalType,
} from "../lib/field-types";
import {
  useActiveTenantForm,
  useCreateTenantForm,
  useUpdateTenantForm,
} from "../hooks/use-tenant-forms";
import type {
  FormFieldDefinition,
  FormFieldType,
  FormTargetType,
  TenantForm,
} from "../types";
import { FieldInlineEditor } from "./field-inline-editor";

interface FormBuilderProps {
  defaultTarget?: FormTargetType;
  backHref?: string;
  backLabel?: string;
}

interface DraftState {
  name: string;
  description: string;
  fields: FormFieldDefinition[];
  focusedFieldId: string | null;
}

type DraftAction =
  | { type: "hydrate"; draft: DraftState }
  | { type: "setName"; value: string }
  | { type: "setDescription"; value: string }
  | { type: "focus"; fieldId: string | null }
  | { type: "addField"; field: FormFieldDefinition }
  | { type: "updateField"; field: FormFieldDefinition; previousFieldId: string }
  | { type: "removeField"; fieldId: string }
  | { type: "duplicateField"; fieldId: string }
  | { type: "moveField"; fieldId: string; toIndex: number };

const TARGET_TABS: FormTargetType[] = [
  "checkin",
  "appointment",
  "visit_session",
];

function ordered(fields: FormFieldDefinition[]): FormFieldDefinition[] {
  return [...fields].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.fieldId.localeCompare(b.fieldId);
  });
}

function restamp(fields: FormFieldDefinition[]): FormFieldDefinition[] {
  return fields.map((field, index) => ({ ...field, order: (index + 1) * 10 }));
}

function emptyDraft(targetType: FormTargetType): DraftState {
  const meta = TARGET_TYPE_LABEL[targetType];
  return {
    name: meta.title,
    description: meta.description,
    fields: [],
    focusedFieldId: null,
  };
}

function formToDraft(form: TenantForm): DraftState {
  return {
    name: form.name,
    description: form.description ?? "",
    fields: restamp(ordered(form.fields)),
    focusedFieldId: null,
  };
}

function uniqueFieldId(base: string, existing: string[]): string {
  const seed = base || "question";
  if (!existing.includes(seed)) return seed;
  let i = 2;
  while (existing.includes(`${seed}_${i}`)) {
    i += 1;
  }
  return `${seed}_${i}`;
}

function createBlankField(existingIds: string[]): FormFieldDefinition {
  const fieldId = uniqueFieldId("question", existingIds);
  return {
    fieldId,
    type: "text",
    label: "",
    helpText: "",
    placeholder: "",
    required: false,
    visible: true,
    order: 0,
    mapsTo: null,
    trim: true,
  };
}

function duplicateId(fieldId: string, existingIds: string[]): string {
  const base = `${fieldId}_copy`.slice(0, 58);
  let candidate = base;
  let index = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${base}_${index}`.slice(0, 64);
    index += 1;
  }
  return candidate;
}

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "hydrate":
      return action.draft;
    case "setName":
      return { ...state, name: action.value };
    case "setDescription":
      return { ...state, description: action.value };
    case "focus":
      return { ...state, focusedFieldId: action.fieldId };
    case "addField": {
      const fields = [
        ...state.fields,
        { ...action.field, order: (state.fields.length + 1) * 10 },
      ];
      return {
        ...state,
        fields: restamp(ordered(fields)),
        focusedFieldId: action.field.fieldId,
      };
    }
    case "updateField": {
      const index = state.fields.findIndex(
        (field) => field.fieldId === action.previousFieldId,
      );
      if (index < 0) return state;
      const fields = state.fields.map((field, i) =>
        i === index ? { ...action.field, order: field.order } : field,
      );
      return {
        ...state,
        fields: restamp(ordered(fields)),
        focusedFieldId: action.field.fieldId,
      };
    }
    case "removeField":
      return {
        ...state,
        fields: restamp(
          ordered(state.fields).filter((field) => field.fieldId !== action.fieldId),
        ),
        focusedFieldId:
          state.focusedFieldId === action.fieldId ? null : state.focusedFieldId,
      };
    case "duplicateField": {
      const fields = ordered(state.fields);
      const index = fields.findIndex((field) => field.fieldId === action.fieldId);
      if (index < 0) return state;
      const source = fields[index];
      const fieldId = duplicateId(
        source.fieldId,
        fields.map((field) => field.fieldId),
      );
      const clone: FormFieldDefinition = {
        ...structuredClone(source),
        fieldId,
        label: source.label ? `${source.label} (copy)` : "Untitled question",
      };
      const next = [...fields.slice(0, index + 1), clone, ...fields.slice(index + 1)];
      return { ...state, fields: restamp(next), focusedFieldId: fieldId };
    }
    case "moveField": {
      const fields = ordered(state.fields);
      const index = fields.findIndex((field) => field.fieldId === action.fieldId);
      if (index < 0) return state;
      const [field] = fields.splice(index, 1);
      const toIndex = Math.max(0, Math.min(action.toIndex, fields.length));
      fields.splice(toIndex, 0, field);
      return { ...state, fields: restamp(fields), focusedFieldId: field.fieldId };
    }
  }
}

export function FormBuilder({
  defaultTarget = "checkin",
  backHref = "/app/visitors",
  backLabel = "Back to visitors",
}: FormBuilderProps) {
  const { tenantId } = useSession();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const [target, setTarget] = useState<FormTargetType>(defaultTarget);
  const [isSwitchPending, startSwitch] = useTransition();
  const [switchingTo, setSwitchingTo] = useState<FormTargetType | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [draft, dispatchDraft] = useReducer(
    draftReducer,
    emptyDraft(defaultTarget),
  );

  const activeFormQuery = useActiveTenantForm(tenantId ?? undefined, target);
  const createMutation = useCreateTenantForm(tenantId ?? undefined);
  const updateMutation = useUpdateTenantForm(tenantId ?? undefined);
  const activeForm = activeFormQuery.data ?? null;
  const fields = useMemo(() => ordered(draft.fields), [draft.fields]);

  useEffect(() => {
    setTarget(defaultTarget);
  }, [defaultTarget]);

  useEffect(() => {
    if (activeFormQuery.isLoading) return;
    const key = activeForm
      ? `${target}:${activeForm.formId}:${activeForm.version}`
      : `${target}:none`;
    if (hydratedKey === key) return;
    dispatchDraft({
      type: "hydrate",
      draft: activeForm ? formToDraft(activeForm) : emptyDraft(target),
    });
    setHydratedKey(key);
  }, [activeForm, activeFormQuery.isLoading, hydratedKey, target]);

  useEffect(() => {
    if (!isSwitchPending) setSwitchingTo(null);
  }, [isSwitchPending]);

  function switchTarget(nextTarget: FormTargetType) {
    if (nextTarget === target) return;
    setSwitchingTo(nextTarget);
    startSwitch(() => setTarget(nextTarget));
  }

  function addQuestion() {
    const field = createBlankField(draft.fields.map((f) => f.fieldId));
    dispatchDraft({ type: "addField", field });
  }

  function updateField(next: FormFieldDefinition, previousFieldId: string) {
    dispatchDraft({ type: "updateField", field: next, previousFieldId });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, toIndex: number) {
    event.preventDefault();
    if (!draggingFieldId) return;
    dispatchDraft({ type: "moveField", fieldId: draggingFieldId, toIndex });
    setDraggingFieldId(null);
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      toast.error("Form name is required.");
      return;
    }
    if (fields.length === 0) {
      toast.error("Add at least one question before saving.");
      return;
    }
    const missingLabel = fields.find((field) => !field.label.trim());
    if (missingLabel) {
      toast.error("Every question needs a label before saving.");
      dispatchDraft({ type: "focus", fieldId: missingLabel.fieldId });
      return;
    }

    const payloadFields = restamp(fields);
    try {
      if (activeForm) {
        await updateMutation.mutateAsync({
          formId: activeForm.formId,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          fields: payloadFields,
        });
        toast.success("Form updated. A new version is now active.");
      } else {
        await createMutation.mutateAsync({
          targetType: target,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          fields: payloadFields,
        });
        toast.success("Form published.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save form.");
    }
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-[calc(100vh-7rem)]">
      <div className="sticky top-0 z-sticky -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
                  <Link href={backHref} onClick={() => handleNavClick(backHref)}>
                    {loadingHref === backHref ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {backLabel}
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Leave the builder and return to the previous workspace view
              </TooltipContent>
            </Tooltip>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Tenant form builder
              </p>
              <input
                value={draft.name}
                onChange={(event) =>
                  dispatchDraft({ type: "setName", value: event.target.value })
                }
                aria-label="Form name"
                className="min-h-[44px] w-full min-w-0 bg-transparent text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  className="min-h-[44px]"
                >
                  <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                  Preview
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open a respondent preview of the current draft fields
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <LoadingButton
                    type="button"
                    onClick={handleSave}
                    isLoading={submitting}
                    loadingText={activeForm ? "Publishing..." : "Creating..."}
                    className="min-h-[44px]"
                  >
                    {activeForm ? "Save form" : "Publish form"}
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Publish this draft as the active version for the selected form target
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="grid gap-4 py-6 lg:grid-cols-[minmax(0,1fr)_64px]">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto border-b" role="tablist" aria-label="Form target">
            {TARGET_TABS.map((id) => {
              const meta = TARGET_TYPE_LABEL[id];
              const isActive = target === id;
              const loading = switchingTo === id && isSwitchPending;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => switchTarget(id)}
                      className={cn(
                        "inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Layers3 className="h-4 w-4" aria-hidden="true" />
                      )}
                      {meta.title}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{meta.description}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {activeFormQuery.isError ? (
            <ErrorState
              error={activeFormQuery.error}
              message="Couldn't load the active form for this target."
              onRetry={() => activeFormQuery.refetch()}
            />
          ) : (
            <>
              <section
                className={cn(
                  "rounded-lg border bg-card p-5 shadow-sm",
                  draft.focusedFieldId === null && "border-primary shadow-primary/10",
                )}
                onClick={() => dispatchDraft({ type: "focus", fieldId: null })}
              >
                <div className="mb-4 h-2 rounded-t-md bg-primary" />
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-form-name">Form title</Label>
                    <Input
                      id="tenant-form-name"
                      value={draft.name}
                      onChange={(event) =>
                        dispatchDraft({ type: "setName", value: event.target.value })
                      }
                      className="min-h-[44px] text-base md:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenant-form-description">Description</Label>
                    <Textarea
                      id="tenant-form-description"
                      value={draft.description}
                      onChange={(event) =>
                        dispatchDraft({
                          type: "setDescription",
                          value: event.target.value,
                        })
                      }
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{TARGET_TYPE_LABEL[target].title}</Badge>
                    {activeForm ? <span>Active version v{activeForm.version}</span> : <span>New draft</span>}
                  </div>
                </div>
              </section>

              {activeFormQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((id) => (
                    <div key={id} className="h-28 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : fields.length === 0 ? (
                <section className="rounded-lg border border-dashed bg-card p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <h2 className="mt-3 text-base font-semibold">No questions yet</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a question to start configuring what this form captures.
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" onClick={addQuestion} className="mt-4 min-h-[44px]">
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Add question
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Add the first question to this form draft
                    </TooltipContent>
                  </Tooltip>
                </section>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <FieldInlineEditor
                      key={field.fieldId}
                      field={field}
                      index={index}
                      focused={draft.focusedFieldId === field.fieldId}
                      dragging={draggingFieldId === field.fieldId}
                      existingFieldIds={draft.fields.map((f) => f.fieldId)}
                      onChange={(next) => updateField(next, field.fieldId)}
                      onFocus={() =>
                        dispatchDraft({ type: "focus", fieldId: field.fieldId })
                      }
                      onDelete={() =>
                        dispatchDraft({ type: "removeField", fieldId: field.fieldId })
                      }
                      onDuplicate={() =>
                        dispatchDraft({ type: "duplicateField", fieldId: field.fieldId })
                      }
                      onDragStart={() => setDraggingFieldId(field.fieldId)}
                      onDragEnd={() => setDraggingFieldId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, index)}
                    />
                  ))}
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, fields.length)}
                    className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
                  >
                    Drop here to move a question to the end
                  </div>
                  <div className="flex justify-center pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addQuestion}
                          className="min-h-[44px]"
                        >
                          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                          Add question
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Append a new blank question to the form draft
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="flex gap-2 lg:sticky lg:top-24 lg:h-fit lg:flex-col">
          <SideRailButton
            label="Add question"
            description="Append a new blank question to the form draft and focus it"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={addQuestion}
          />
          <SideRailButton
            label="Preview"
            description="Preview how the current draft will render to respondents"
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setPreviewOpen(true)}
          />
        </aside>
      </div>

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={draft.name}
        description={draft.description}
        fields={fields}
      />
    </div>
  );
}

function SideRailButton({
  label,
  description,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className="min-h-[44px] min-w-[44px]"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{description}</TooltipContent>
    </Tooltip>
  );
}

function PreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fields: FormFieldDefinition[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Untitled form"}</DialogTitle>
          <DialogDescription>
            {description || "Preview how this draft renders for respondents."}
          </DialogDescription>
        </DialogHeader>
        {fields.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Add at least one question to preview the form.
          </div>
        ) : (
          <div className="space-y-5">
            {fields.map((field) => (
              <PreviewField key={field.fieldId} field={field} />
            ))}
            <div className="flex justify-end border-t pt-4">
              <Button type="button" className="min-h-[44px]">
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Submit preview
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewField({ field }: { field: FormFieldDefinition }) {
  const commonLabel = (
    <Label htmlFor={`preview-${field.fieldId}`}>
      {field.label || "Untitled question"}
      {field.required ? <span className="text-destructive"> *</span> : null}
    </Label>
  );

  return (
    <div className="space-y-2">
      {commonLabel}
      {field.helpText ? (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      ) : null}
      <PreviewControl field={field} />
    </div>
  );
}

function PreviewControl({ field }: { field: FormFieldDefinition }) {
  if (field.type === "long_text") {
    return (
      <Textarea
        id={`preview-${field.fieldId}`}
        placeholder={field.placeholder ?? ""}
        className="text-base md:text-sm"
      />
    );
  }

  if (field.type === "boolean" || field.type === "consent_checkbox") {
    return (
      <label className="flex min-h-[44px] items-center gap-3 rounded-md border p-3 text-sm">
        <input type="checkbox" />
        <span>{field.consentText || "Yes"}</span>
      </label>
    );
  }

  if (isOptionType(field.type)) {
    return (
      <select
        id={`preview-${field.fieldId}`}
        multiple={field.type === "multi_select"}
        className="min-h-[44px] w-full rounded-md border bg-background px-3 py-2 text-base md:text-sm"
      >
        <option value="">Choose...</option>
        {(field.options ?? []).map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (isFileType(field.type) || field.type === "id_document") {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        File upload preview only
      </div>
    );
  }

  if (field.type === "rating") {
    return (
      <div className="flex gap-1 text-lg text-muted-foreground" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index}>*</span>
        ))}
      </div>
    );
  }

  const inputType = getInputType(field.type);
  return (
    <Input
      id={`preview-${field.fieldId}`}
      type={inputType}
      placeholder={field.placeholder ?? ""}
      inputMode={isNumericType(field.type) ? "decimal" : undefined}
      className="min-h-[44px] text-base md:text-sm"
    />
  );
}

function getInputType(type: FormFieldType): string {
  if (isTemporalType(type)) {
    if (type === "datetime") return "datetime-local";
    return type;
  }
  if (isStringType(type)) {
    if (type === "email") return "email";
    if (type === "phone") return "tel";
    if (type === "url") return "url";
  }
  if (isNumericType(type)) return "number";
  return "text";
}
