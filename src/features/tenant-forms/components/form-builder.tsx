"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
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
import { NavButton } from "@/components/recipes/nav-button";
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

// Debounced autosave waits this long after the last change before sending
// a PATCH. Since the backend now writes to draft_* (no version bump per
// save), we can be more responsive than the old per-save-publishes flow
// would have allowed.
const AUTOSAVE_DEBOUNCE_MS = 1200;

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string }
  | { kind: "blocked"; reason: string };

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
  // The backend writes autosave PATCHes to `draft_*` columns and only
  // promotes them into the published columns on /publish. So whenever a
  // draft exists, it IS the working copy — read from it, not from the
  // (potentially empty) published fields.
  const draftFields = form.draftFields ?? null;
  const hasDraft =
    draftFields !== null ||
    form.draftName != null ||
    form.draftDescription != null;

  const sourceFields = hasDraft && draftFields ? draftFields : form.fields;
  const sourceName = hasDraft && form.draftName != null ? form.draftName : form.name;
  const sourceDescription =
    hasDraft && form.draftDescription !== undefined
      ? form.draftDescription
      : form.description;

  return {
    name: sourceName,
    description: sourceDescription ?? "",
    fields: restamp(ordered(sourceFields ?? [])),
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

interface SavablePayload {
  name: string;
  description: string;
  fields: FormFieldDefinition[];
}

function payloadFromDraft(draft: DraftState): SavablePayload {
  return {
    name: draft.name,
    description: draft.description,
    fields: restamp(ordered(draft.fields)),
  };
}

function payloadSignature(payload: SavablePayload): string {
  return JSON.stringify(payload);
}

function validatePayload(payload: SavablePayload): {
  blocked: boolean;
  reason?: string;
} {
  if (!payload.name.trim()) {
    return { blocked: true, reason: "Add a form title to enable autosave." };
  }
  if (payload.fields.length === 0) {
    return { blocked: true, reason: "Add a question to enable autosave." };
  }
  const missingLabel = payload.fields.find((field) => !field.label.trim());
  if (missingLabel) {
    return {
      blocked: true,
      reason: "Every question needs a title before autosave can run.",
    };
  }
  return { blocked: false };
}

export function FormBuilder({
  defaultTarget = "checkin",
  backHref = "/app/visitors",
  backLabel = "Back to visitors",
}: FormBuilderProps) {
  const { tenantId } = useSession();
  const { loadingHref } = useNavigationLoading();
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

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const lastSavedSignatureRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTarget(defaultTarget);
  }, [defaultTarget]);

  // Hydrate from the active form for the current target. Reset the saved
  // signature here so the first autosave isn't a no-op when the user starts
  // editing what we just loaded.
  //
  // Two subtleties:
  //   1. `formToDraft` reads `draftFields` when present — the backend writes
  //      autosave PATCHes there and leaves the published `fields` empty
  //      until /publish, so hydrating from `fields` would erase the
  //      working copy.
  //   2. After the FIRST autosave the form transitions from "none" to a
  //      real id, which trips the key check below. The user is usually
  //      still typing at that point; re-hydrating from the response would
  //      clobber every keystroke entered between the save going out and
  //      the refetch landing. We compare the incoming draft signature
  //      against `lastSavedSignatureRef` and skip the re-hydration when
  //      they match — the local state is already correct, just bump the
  //      key tracker.
  useEffect(() => {
    if (activeFormQuery.isLoading) return;
    const key = activeForm
      ? `${target}:${activeForm.formId}:${activeForm.version}`
      : `${target}:none`;
    if (hydratedKey === key) return;

    if (activeForm && lastSavedSignatureRef.current) {
      const incoming = formToDraft(activeForm);
      const incomingSignature = payloadSignature(payloadFromDraft(incoming));
      if (incomingSignature === lastSavedSignatureRef.current) {
        setHydratedKey(key);
        return;
      }
    }

    const next = activeForm ? formToDraft(activeForm) : emptyDraft(target);
    dispatchDraft({ type: "hydrate", draft: next });
    lastSavedSignatureRef.current = payloadSignature(payloadFromDraft(next));
    setSaveStatus({ kind: "idle" });
    setHydratedKey(key);
  }, [activeForm, activeFormQuery.isLoading, hydratedKey, target]);

  useEffect(() => {
    if (!isSwitchPending) setSwitchingTo(null);
  }, [isSwitchPending]);

  const runSave = useCallback(
    async (payload: SavablePayload) => {
      // Cancel any earlier in-flight save — we always want the most recent
      // payload to win, not the first to land.
      if (inflightAbortRef.current) inflightAbortRef.current.abort();
      const controller = new AbortController();
      inflightAbortRef.current = controller;

      setSaveStatus({ kind: "saving" });
      try {
        if (activeForm) {
          await updateMutation.mutateAsync({
            formId: activeForm.formId,
            name: payload.name.trim(),
            description: payload.description.trim() || null,
            fields: payload.fields,
          });
        } else {
          await createMutation.mutateAsync({
            targetType: target,
            name: payload.name.trim(),
            description: payload.description.trim() || null,
            fields: payload.fields,
          });
        }
        if (controller.signal.aborted) return;
        lastSavedSignatureRef.current = payloadSignature(payload);
        setSaveStatus({ kind: "saved", at: Date.now() });
      } catch (err) {
        if (controller.signal.aborted) return;
        setSaveStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Couldn't save changes.",
        });
      } finally {
        if (inflightAbortRef.current === controller) {
          inflightAbortRef.current = null;
        }
      }
    },
    [activeForm, createMutation, updateMutation, target],
  );

  // `runSave` is re-created every render because react-query's mutation
  // objects (`createMutation` / `updateMutation`) are not stable across
  // renders. Putting it in the autosave effect's dep array would trigger
  // the effect every render, which sets state, which re-renders → loop
  // (React error #185). Stash the latest closure in a ref instead so the
  // setTimeout always calls the current `runSave` without it appearing
  // as a dependency.
  const runSaveRef = useRef(runSave);
  useEffect(() => {
    runSaveRef.current = runSave;
  }, [runSave]);

  // Debounced autosave. Fires AUTOSAVE_DEBOUNCE_MS after the last change.
  // Skips when:
  //   - the form is still hydrating (no signature baseline)
  //   - the payload hasn't changed since the last successful save
  //   - validation gates it (missing name / labels / empty)
  useEffect(() => {
    if (lastSavedSignatureRef.current === null) return;

    const payload = payloadFromDraft(draft);
    const signature = payloadSignature(payload);
    if (signature === lastSavedSignatureRef.current) {
      return;
    }

    const validation = validatePayload(payload);
    if (validation.blocked) {
      const nextReason = validation.reason ?? "Autosave paused.";
      // Prev-check so we don't churn a new object identity on every render
      // (which would also cascade into the same #185 loop the ref above
      // already broke).
      setSaveStatus((prev) =>
        prev.kind === "blocked" && prev.reason === nextReason
          ? prev
          : { kind: "blocked", reason: nextReason },
      );
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void runSaveRef.current(payload);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [draft]);

  // Latest draft snapshot for the beforeunload flush. Same rationale as
  // `runSaveRef` above — we can't put `draft` in the effect's deps without
  // rebinding the listener every keystroke.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Best-effort flush on tab close. The browser kills in-flight XHRs after
  // ~1s but the standard mutation hits go through credentials:include axios
  // — sendBeacon would need a different transport. We just dispatch a sync
  // save attempt and let it race the unload.
  useEffect(() => {
    function onBeforeUnload() {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const payload = payloadFromDraft(draftRef.current);
        if (payloadSignature(payload) !== lastSavedSignatureRef.current) {
          const validation = validatePayload(payload);
          if (!validation.blocked) void runSaveRef.current(payload);
        }
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

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

  async function handlePublishClick() {
    const payload = payloadFromDraft(draft);
    const validation = validatePayload(payload);
    if (validation.blocked) {
      toast.error(validation.reason ?? "Form isn't ready to publish yet.");
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      await runSave(payload);
      toast.success(
        activeForm ? "Form updated. The new version is live." : "Form published.",
      );
    } catch {
      // runSave already set the error status; toast is redundant.
    }
  }

  const submitting =
    saveStatus.kind === "saving" ||
    createMutation.isPending ||
    updateMutation.isPending;

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-muted/20">
      <header className="sticky top-0 z-sticky -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <NavButton
                  href={backHref}
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px]"
                >
                  {loadingHref === backHref ? (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {backLabel}
                </NavButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Leave the builder and return to the previous workspace view
              </TooltipContent>
            </Tooltip>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Tenant form builder
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {draft.name || "Untitled form"}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SaveStatusPill status={saveStatus} />
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
                    onClick={handlePublishClick}
                    isLoading={submitting}
                    loadingText={activeForm ? "Saving…" : "Publishing…"}
                    className="min-h-[44px]"
                  >
                    {activeForm ? "Publish update" : "Publish form"}
                  </LoadingButton>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Force-save the draft and publish it as the active version
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_64px]">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div
            className="flex gap-2 overflow-x-auto border-b"
            role="tablist"
            aria-label="Form target"
          >
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
                        "inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {loading ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Layers3 className="h-4 w-4" aria-hidden="true" />
                      )}
                      {meta.title}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {meta.description}
                  </TooltipContent>
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
                  "relative overflow-hidden rounded-xl border bg-card shadow-sm transition",
                  draft.focusedFieldId === null
                    ? "ring-1 ring-primary/30"
                    : "hover:border-muted-foreground/30",
                )}
                onClick={() => dispatchDraft({ type: "focus", fieldId: null })}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20"
                  aria-hidden="true"
                />
                <div className="space-y-4 p-6">
                  <div className="space-y-1">
                    <Label
                      htmlFor="tenant-form-name"
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Form title
                    </Label>
                    <Input
                      id="tenant-form-name"
                      value={draft.name}
                      onChange={(event) =>
                        dispatchDraft({
                          type: "setName",
                          value: event.target.value,
                        })
                      }
                      placeholder="Untitled form"
                      className="min-h-[44px] border-0 border-b border-input bg-muted/40 px-3 text-lg font-semibold shadow-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring md:text-base"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="tenant-form-description"
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="tenant-form-description"
                      value={draft.description}
                      onChange={(event) =>
                        dispatchDraft({
                          type: "setDescription",
                          value: event.target.value,
                        })
                      }
                      placeholder="What does this form capture? (Optional)"
                      className="min-h-[80px] border-0 bg-muted/30 px-3 text-sm shadow-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      {TARGET_TYPE_LABEL[target].title}
                    </Badge>
                    {activeForm ? (
                      <span>Active version v{activeForm.version}</span>
                    ) : (
                      <span>New draft</span>
                    )}
                  </div>
                </div>
              </section>

              {activeFormQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((id) => (
                    <div
                      key={id}
                      className="h-28 animate-pulse rounded-xl bg-muted"
                    />
                  ))}
                </div>
              ) : fields.length === 0 ? (
                <section className="flex flex-col items-center rounded-xl border border-dashed bg-card/50 p-10 text-center">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold">
                    No questions yet
                  </h2>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Add a question to start configuring what this form captures.
                    Every change is autosaved.
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={addQuestion}
                        className="mt-5 min-h-[44px]"
                      >
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Add first question
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
                        dispatchDraft({
                          type: "focus",
                          fieldId: field.fieldId,
                        })
                      }
                      onDelete={() =>
                        dispatchDraft({
                          type: "removeField",
                          fieldId: field.fieldId,
                        })
                      }
                      onDuplicate={() =>
                        dispatchDraft({
                          type: "duplicateField",
                          fieldId: field.fieldId,
                        })
                      }
                      onDragStart={() => setDraggingFieldId(field.fieldId)}
                      onDragEnd={() => setDraggingFieldId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, index)}
                    />
                  ))}
                  {draggingFieldId && (
                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, fields.length)}
                      className="rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-4 text-center text-sm text-primary"
                    >
                      Drop here to move to the end
                    </div>
                  )}
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

        <aside className="hidden lg:flex lg:sticky lg:top-24 lg:h-fit lg:flex-col lg:gap-2">
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

function SaveStatusPill({ status }: { status: SaveStatus }) {
  // Re-render every 20s while in saved state so "saved 2 minutes ago" stays
  // accurate. Idle/saving/error states don't need this tick.
  const [, force] = useState(0);
  useEffect(() => {
    if (status.kind !== "saved") return;
    const id = setInterval(() => force((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, [status.kind]);

  if (status.kind === "idle") return null;

  let label: string;
  let icon: ReactNode;
  let tone: string;
  switch (status.kind) {
    case "saving":
      label = "Saving…";
      icon = (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      );
      tone = "text-muted-foreground";
      break;
    case "saved":
      label = relativeSaveLabel(status.at);
      icon = <Check className="h-3.5 w-3.5" aria-hidden="true" />;
      tone = "text-emerald-600 dark:text-emerald-400";
      break;
    case "error":
      label = status.message || "Save failed";
      icon = <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />;
      tone = "text-destructive";
      break;
    case "blocked":
      label = status.reason;
      icon = <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />;
      tone = "text-amber-600 dark:text-amber-400";
      break;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium",
            tone,
          )}
          aria-live="polite"
        >
          {icon}
          <span className="max-w-[24ch] truncate">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {status.kind === "blocked"
          ? "Autosave is paused while the form is incomplete"
          : status.kind === "error"
            ? "Click Publish to retry, or keep editing — autosave will try again."
            : status.kind === "saving"
              ? "Changes are being saved automatically"
              : "Last saved time updates as you keep working"}
      </TooltipContent>
    </Tooltip>
  );
}

function relativeSaveLabel(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) return "Saved just now";
  if (seconds < 60) return `Saved ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Saved ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Saved ${hours}h ago`;
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
          className="min-h-[44px] min-w-[44px] shadow-sm"
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
        <option value="">Choose…</option>
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
      <div
        className="flex gap-1 text-lg text-muted-foreground"
        aria-hidden="true"
      >
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
