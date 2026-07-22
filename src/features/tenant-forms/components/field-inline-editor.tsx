"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Plus,
  Trash2,
  X,
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import {
  FIELD_TYPE_GROUPS,
  MAPS_TO_OPTIONS,
  fieldTypeMeta,
  isFileType,
  isNumericType,
  isOptionType,
  isStringType,
  isTemporalType,
} from "../lib/field-types";
import type {
  FormFieldDefinition,
  FormFieldOption,
  FormFieldType,
} from "../types";

interface FieldInlineEditorProps {
  field: FormFieldDefinition;
  index: number;
  focused: boolean;
  dragging: boolean;
  existingFieldIds: string[];
  onChange: (next: FormFieldDefinition) => void;
  onFocus: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function FieldInlineEditor({
  field,
  index,
  focused,
  dragging,
  existingFieldIds,
  onChange,
  onFocus,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: FieldInlineEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const idCollision = useMemo(() => {
    if (!field.fieldId) return false;
    return (
      existingFieldIds.filter((id) => id === field.fieldId).length > 1
    );
  }, [field.fieldId, existingFieldIds]);

  function update<K extends keyof FormFieldDefinition>(
    key: K,
    value: FormFieldDefinition[K],
  ) {
    onChange({ ...field, [key]: value });
  }

  function handleLabelChange(label: string) {
    // Don't touch fieldId here — it's the React key on the parent map. Mutating
    // it on every keystroke (auto-slug from label) unmounts the input and the
    // user loses focus after typing one character. Users who want a pretty id
    // can set it in Advanced settings.
    onChange({ ...field, label });
  }

  function handleTypeChange(type: FormFieldType) {
    const next: FormFieldDefinition = { ...field, type };
    if (type === "consent_checkbox") {
      next.required = true;
    }
    if (isOptionType(type) && (!next.options || next.options.length === 0)) {
      next.options = [{ key: "option_1", label: "Option 1" }];
    }
    onChange(next);
  }

  function addOption() {
    const existing = field.options ?? [];
    const idx = existing.length + 1;
    const key = ensureUniqueOptionKey(`option_${idx}`, existing);
    const next: FormFieldOption = { key, label: `Option ${idx}` };
    update("options", [...existing, next]);
  }

  function addOtherOption() {
    const existing = field.options ?? [];
    if (existing.some((o) => o.key === "other")) return;
    update("options", [...existing, { key: "other", label: "Other" }]);
  }

  function updateOption(idx: number, patch: Partial<FormFieldOption>) {
    update(
      "options",
      (field.options ?? []).map((option, i) =>
        i === idx ? { ...option, ...patch } : option,
      ),
    );
  }

  function removeOption(idx: number) {
    update(
      "options",
      (field.options ?? []).filter((_, i) => i !== idx),
    );
  }

  const labelInputId = `field-${field.fieldId || index}-label`;
  const descriptionInputId = `field-${field.fieldId || index}-description`;

  return (
    <article
      className={cn(
        "group relative rounded-lg border bg-card shadow-sm transition",
        focused
          ? "border-primary shadow-primary/10"
          : "hover:border-muted-foreground/40",
        dragging && "opacity-50",
      )}
      onClick={onFocus}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={`Field ${index + 1}: ${field.label || "Untitled"}`}
    >
      {focused && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-primary"
        />
      )}

      <div className="flex justify-center pt-2 text-muted-foreground opacity-50 group-hover:opacity-100">
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </div>

      <div className="space-y-4 px-5 pb-5 pt-2">
        {focused ? (
          <ExpandedEditor
            field={field}
            labelInputId={labelInputId}
            descriptionInputId={descriptionInputId}
            idCollision={idCollision}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
            onLabelChange={handleLabelChange}
            onTypeChange={handleTypeChange}
            onFieldIdChange={(value) => update("fieldId", slugify(value))}
            onUpdate={update}
            onAddOption={addOption}
            onAddOtherOption={addOtherOption}
            onUpdateOption={updateOption}
            onRemoveOption={removeOption}
          />
        ) : (
          <CollapsedPreview field={field} index={index} />
        )}

        {focused && (
          <div className="-mx-5 flex flex-wrap items-center justify-end gap-2 border-t px-5 pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicate();
                  }}
                  aria-label="Duplicate question"
                  className="min-h-[44px] min-w-[44px]"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Duplicate this question directly below the original
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete();
                  }}
                  aria-label="Delete question"
                  className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Remove this question from the working draft
              </TooltipContent>
            </Tooltip>
            <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-2 text-sm">
                  <span>Required</span>
                  <Switch
                    checked={field.required}
                    onCheckedChange={(value) => update("required", value)}
                    disabled={field.type === "consent_checkbox"}
                    aria-label="Required"
                  />
                </label>
              </TooltipTrigger>
              <TooltipContent side="top">
                {field.type === "consent_checkbox"
                  ? "Consent checkboxes are always required."
                  : "When on, the form cannot be submitted unless this question is filled."}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </article>
  );
}

function ensureUniqueOptionKey(
  candidate: string,
  options: FormFieldOption[],
): string {
  if (!options.some((option) => option.key === candidate)) return candidate;
  let i = 2;
  while (options.some((option) => option.key === `${candidate}_${i}`)) {
    i += 1;
  }
  return `${candidate}_${i}`;
}

interface ExpandedEditorProps {
  field: FormFieldDefinition;
  labelInputId: string;
  descriptionInputId: string;
  idCollision: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onLabelChange: (value: string) => void;
  onTypeChange: (type: FormFieldType) => void;
  onFieldIdChange: (value: string) => void;
  onUpdate: <K extends keyof FormFieldDefinition>(
    key: K,
    value: FormFieldDefinition[K],
  ) => void;
  onAddOption: () => void;
  onAddOtherOption: () => void;
  onUpdateOption: (idx: number, patch: Partial<FormFieldOption>) => void;
  onRemoveOption: (idx: number) => void;
}

function ExpandedEditor({
  field,
  labelInputId,
  descriptionInputId,
  idCollision,
  showAdvanced,
  onToggleAdvanced,
  onLabelChange,
  onTypeChange,
  onFieldIdChange,
  onUpdate,
  onAddOption,
  onAddOtherOption,
  onUpdateOption,
  onRemoveOption,
}: ExpandedEditorProps) {
  const showPlaceholder =
    isStringType(field.type) ||
    isNumericType(field.type) ||
    isTemporalType(field.type);

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex-1 space-y-1">
          <Label htmlFor={labelInputId} className="sr-only">
            Question
          </Label>
          <Input
            id={labelInputId}
            value={field.label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder="Question"
            className="min-h-[44px] border-0 border-b border-input bg-muted/40 px-3 text-base shadow-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
        <div className="md:w-56">
          <Label htmlFor={`${labelInputId}-type`} className="sr-only">
            Question type
          </Label>
          <Select
            value={field.type}
            onValueChange={(value) => onTypeChange(value as FormFieldType)}
          >
            <SelectTrigger
              id={`${labelInputId}-type`}
              className="min-h-[44px] text-base md:text-sm"
              onClick={(event) => event.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPE_GROUPS.map((group) => (
                <div key={group.group}>
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.group}
                  </p>
                  {group.items.map((item) => (
                    <SelectItem key={item.type} value={item.type}>
                      {item.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={descriptionInputId} className="sr-only">
          Description
        </Label>
        <Textarea
          id={descriptionInputId}
          value={field.helpText ?? ""}
          onChange={(event) => onUpdate("helpText", event.target.value)}
          placeholder="Description (optional)"
          rows={1}
          className="min-h-0 resize-none border-0 bg-transparent px-1 py-1 text-sm text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      <FieldTypeBody
        field={field}
        showPlaceholder={showPlaceholder}
        onUpdate={onUpdate}
        onAddOption={onAddOption}
        onAddOtherOption={onAddOtherOption}
        onUpdateOption={onUpdateOption}
        onRemoveOption={onRemoveOption}
      />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleAdvanced();
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Advanced settings
      </button>

      {showAdvanced && (
        <AdvancedSettings
          field={field}
          idCollision={idCollision}
          onFieldIdChange={onFieldIdChange}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}

function FieldTypeBody({
  field,
  showPlaceholder,
  onUpdate,
  onAddOption,
  onAddOtherOption,
  onUpdateOption,
  onRemoveOption,
}: {
  field: FormFieldDefinition;
  showPlaceholder: boolean;
  onUpdate: <K extends keyof FormFieldDefinition>(
    key: K,
    value: FormFieldDefinition[K],
  ) => void;
  onAddOption: () => void;
  onAddOtherOption: () => void;
  onUpdateOption: (idx: number, patch: Partial<FormFieldOption>) => void;
  onRemoveOption: (idx: number) => void;
}) {
  if (isOptionType(field.type)) {
    const options = field.options ?? [];
    const hasOther = options.some((o) => o.key === "other");
    const isMulti = field.type === "multi_select";
    return (
      <div className="space-y-2">
        {options.map((option, idx) => (
          <div key={option.key} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0 border border-muted-foreground/60 text-muted-foreground",
                isMulti ? "rounded-sm" : "rounded-full",
              )}
            />
            <Input
              value={option.label}
              onChange={(event) =>
                onUpdateOption(idx, { label: event.target.value })
              }
              placeholder={`Option ${idx + 1}`}
              className="min-h-[40px] flex-1 border-0 border-b border-transparent bg-transparent px-1 text-sm shadow-none focus-visible:border-input focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={(event) => event.stopPropagation()}
            />
            {options.length > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveOption(idx);
                    }}
                    aria-label={`Remove option ${idx + 1}`}
                    className="min-h-[40px] min-w-[40px] text-muted-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Remove this option from the question
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1 pl-7 text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddOption();
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add option
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Append a new selectable option to this question
            </TooltipContent>
          </Tooltip>
          {!hasOther && (
            <>
              <span className="text-muted-foreground">or</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddOtherOption();
                    }}
                    className="rounded-md px-2 py-1 font-medium text-primary hover:bg-primary/10"
                  >
                    add &quot;Other&quot;
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Add an &quot;Other&quot; option so respondents can write in a custom answer
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "consent_checkbox") {
    return (
      <div className="space-y-2">
        <Label htmlFor={`consent-${field.fieldId}`} className="text-xs">
          Consent text
        </Label>
        <Textarea
          id={`consent-${field.fieldId}`}
          value={field.consentText ?? ""}
          onChange={(event) => onUpdate("consentText", event.target.value)}
          placeholder="I have read the privacy notice and agree to the processing of my information."
          rows={3}
          className="text-base md:text-sm"
          onClick={(event) => event.stopPropagation()}
        />
        <p className="text-xs text-muted-foreground">
          Stored verbatim with every submission so the organization can prove which version was agreed to.
        </p>
      </div>
    );
  }

  if (isFileType(field.type) || field.type === "id_document") {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        Respondents will upload a file here. Configure size and type limits under Advanced settings.
      </div>
    );
  }

  if (field.type === "rating") {
    return (
      <div className="text-xs text-muted-foreground">
        Star scale shown to respondents. Configure the range under Advanced settings.
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="text-xs text-muted-foreground">
        Yes / No toggle shown to respondents.
      </div>
    );
  }

  if (showPlaceholder) {
    return (
      <div>
        <Input
          value={field.placeholder ?? ""}
          onChange={(event) => onUpdate("placeholder", event.target.value)}
          placeholder="Placeholder shown inside the input (optional)"
          className="min-h-[40px] border-0 border-b border-dashed border-input bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    );
  }

  return null;
}

function AdvancedSettings({
  field,
  idCollision,
  onFieldIdChange,
  onUpdate,
}: {
  field: FormFieldDefinition;
  idCollision: boolean;
  onFieldIdChange: (value: string) => void;
  onUpdate: <K extends keyof FormFieldDefinition>(
    key: K,
    value: FormFieldDefinition[K],
  ) => void;
}) {
  const meta = fieldTypeMeta(field.type);

  return (
    <div
      className="space-y-4 rounded-md border bg-muted/30 p-4"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="space-y-2">
        <Label htmlFor={`field-${field.fieldId}-id`} className="text-xs">
          Field id
        </Label>
        <FieldIdInput
          id={`field-${field.fieldId}-id`}
          fieldId={field.fieldId}
          onCommit={onFieldIdChange}
        />
        <p className="text-xs text-muted-foreground">
          Stable identifier across versions. Once a form is published with this id, don&apos;t change it — that&apos;s how historical submissions resolve.
        </p>
        {idCollision && (
          <p className="text-xs text-destructive" role="alert">
            Another question is already using this id.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={field.visible}
                onCheckedChange={(value) => onUpdate("visible", value)}
              />
              <span>Visible</span>
            </label>
          </TooltipTrigger>
          <TooltipContent side="top">
            Hide the field at render time without erasing existing submissions.
          </TooltipContent>
        </Tooltip>
      </div>

      {isStringType(field.type) && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Min length"
            value={field.minLength}
            onChange={(value) => onUpdate("minLength", value)}
          />
          <NumberField
            label="Max length"
            value={field.maxLength}
            onChange={(value) => onUpdate("maxLength", value)}
          />
          <div className="col-span-2 space-y-1">
            <Label htmlFor={`field-${field.fieldId}-pattern`} className="text-xs">
              Regex pattern (optional)
            </Label>
            <Input
              id={`field-${field.fieldId}-pattern`}
              value={field.pattern ?? ""}
              onChange={(event) => onUpdate("pattern", event.target.value || null)}
              placeholder="^\\+?[1-9]\\d{7,14}$"
              className="min-h-[40px] text-base md:text-sm"
            />
          </div>
        </div>
      )}

      {isNumericType(field.type) && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Min"
            value={field.min}
            onChange={(value) => onUpdate("min", value)}
          />
          <NumberField
            label="Max"
            value={field.max}
            onChange={(value) => onUpdate("max", value)}
          />
          <NumberField
            label="Step"
            value={field.step}
            onChange={(value) => onUpdate("step", value)}
          />
          <div className="space-y-1">
            <Label htmlFor={`field-${field.fieldId}-unit`} className="text-xs">
              Unit
            </Label>
            <Input
              id={`field-${field.fieldId}-unit`}
              value={field.unit ?? ""}
              onChange={(event) => onUpdate("unit", event.target.value || null)}
              placeholder="mins, kg"
              className="min-h-[40px] text-base md:text-sm"
            />
          </div>
        </div>
      )}

      {isTemporalType(field.type) && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Earliest offset (seconds)"
            value={field.minOffsetSeconds}
            onChange={(value) => onUpdate("minOffsetSeconds", value)}
          />
          <NumberField
            label="Latest offset (seconds)"
            value={field.maxOffsetSeconds}
            onChange={(value) => onUpdate("maxOffsetSeconds", value)}
          />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Switch
              checked={field.allowPast ?? true}
              onCheckedChange={(value) => onUpdate("allowPast", value)}
            />
            <span>Allow past values</span>
          </label>
        </div>
      )}

      {isFileType(field.type) && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Max file size (bytes)"
            value={field.maxBytes}
            onChange={(value) => onUpdate("maxBytes", value)}
            placeholder="10485760"
          />
          <div className="col-span-2 space-y-1">
            <Label
              htmlFor={`field-${field.fieldId}-mime`}
              className="text-xs"
            >
              Allowed MIME types (comma separated)
            </Label>
            <Input
              id={`field-${field.fieldId}-mime`}
              value={(field.allowedMimeTypes ?? []).join(", ")}
              onChange={(event) =>
                onUpdate(
                  "allowedMimeTypes",
                  event.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              placeholder="image/jpeg, image/png, application/pdf"
              className="min-h-[40px] text-base md:text-sm"
            />
          </div>
        </div>
      )}

      {field.type === "multi_select" && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Min selections"
            value={field.multiMin}
            onChange={(value) => onUpdate("multiMin", value)}
          />
          <NumberField
            label="Max selections"
            value={field.multiMax}
            onChange={(value) => onUpdate("multiMax", value)}
          />
        </div>
      )}

      {field.type === "consent_checkbox" && (
        <div className="space-y-1">
          <Label
            htmlFor={`field-${field.fieldId}-lawful`}
            className="text-xs"
          >
            Lawful basis
          </Label>
          <Select
            value={field.lawfulBasis ?? "consent"}
            onValueChange={(value) =>
              onUpdate("lawfulBasis", value as "consent" | "legitimate_interest")
            }
          >
            <SelectTrigger
              id={`field-${field.fieldId}-lawful`}
              className="min-h-[40px] text-base md:text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consent">Consent</SelectItem>
              <SelectItem value="legitimate_interest">
                Legitimate interest
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {meta.mappable && (
        <div className="space-y-1">
          <Label
            htmlFor={`field-${field.fieldId}-mapsto`}
            className="text-xs"
          >
            Mirror onto record
          </Label>
          <Select
            value={field.mapsTo ?? "__none"}
            onValueChange={(value) =>
              onUpdate(
                "mapsTo",
                value === "__none"
                  ? null
                  : (value as NonNullable<FormFieldDefinition["mapsTo"]>),
              )
            }
          >
            <SelectTrigger
              id={`field-${field.fieldId}-mapsto`}
              className="min-h-[40px] text-base md:text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAPS_TO_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value || "__none"}
                  value={option.value || "__none"}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            When set, this value is also written to the parent record so search and dashboards can use it without diving into the form submission.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Field-id input that buffers keystrokes locally and only commits on blur
 * (or Enter). Committing changes `field.fieldId`, which is the React key on
 * the parent field list — so committing per-keystroke would unmount this
 * editor and steal focus after a single character. Buffering means the user
 * types the whole id freely; the slugified value is pushed up once when they
 * leave the field, which also keeps autosave from firing mid-edit.
 */
function FieldIdInput({
  id,
  fieldId,
  onCommit,
}: {
  id: string;
  fieldId: string;
  onCommit: (value: string) => void;
}) {
  const [local, setLocal] = useState(fieldId);
  // Track the last value we know the parent holds so we can re-sync the
  // buffer when the id changes from elsewhere (duplicate, hydrate, defaults)
  // without clobbering what the user is currently typing.
  const committedRef = useRef(fieldId);
  useEffect(() => {
    if (fieldId !== committedRef.current) {
      committedRef.current = fieldId;
      setLocal(fieldId);
    }
  }, [fieldId]);

  function commit() {
    const slug = slugify(local);
    setLocal(slug);
    committedRef.current = slug;
    if (slug !== fieldId) onCommit(slug);
  }

  return (
    <Input
      id={id}
      value={local}
      onChange={(event) => setLocal(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onClick={(event) => event.stopPropagation()}
      placeholder="snake_case_id"
      className="min-h-[40px] text-base md:text-sm"
    />
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  const id = `num-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
        placeholder={placeholder}
        className="min-h-[40px] text-base md:text-sm"
      />
    </div>
  );
}

function CollapsedPreview({
  field,
  index,
}: {
  field: FormFieldDefinition;
  index: number;
}) {
  const meta = fieldTypeMeta(field.type);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Question {index + 1}</span>
        <span aria-hidden="true">•</span>
        <span>{meta.label}</span>
        {field.required && (
          <>
            <span aria-hidden="true">•</span>
            <span className="text-destructive">Required</span>
          </>
        )}
      </div>
      <h3 className="truncate text-base font-medium">
        {field.label || (
          <span className="text-muted-foreground">Untitled question</span>
        )}
      </h3>
      {field.helpText && (
        <p className="text-sm text-muted-foreground">{field.helpText}</p>
      )}
      {isOptionType(field.type) && (
        <ul className="space-y-1 pl-1">
          {(field.options ?? []).slice(0, 4).map((option) => (
            <li
              key={option.key}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 border border-muted-foreground/50",
                  field.type === "multi_select" ? "rounded-sm" : "rounded-full",
                )}
              />
              {option.label}
            </li>
          ))}
          {(field.options ?? []).length > 4 && (
            <li className="pl-5 text-xs text-muted-foreground">
              +{(field.options ?? []).length - 4} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
