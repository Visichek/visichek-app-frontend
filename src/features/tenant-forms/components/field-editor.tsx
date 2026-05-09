"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
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

interface FieldEditorProps {
  open: boolean;
  initialField: FormFieldDefinition | null;
  existingFieldIds: string[];
  onClose: () => void;
  onSave: (field: FormFieldDefinition) => void;
}

const DEFAULT_FIELD: FormFieldDefinition = {
  fieldId: "",
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function FieldEditor({
  open,
  initialField,
  existingFieldIds,
  onClose,
  onSave,
}: FieldEditorProps) {
  const [draft, setDraft] = useState<FormFieldDefinition>(
    initialField ?? DEFAULT_FIELD,
  );
  const [autoIdFromLabel, setAutoIdFromLabel] = useState<boolean>(
    !initialField,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialField ?? { ...DEFAULT_FIELD, fieldId: "" });
      setAutoIdFromLabel(!initialField);
      setError(null);
    }
  }, [open, initialField]);

  const meta = fieldTypeMeta(draft.type);

  const idCollision = useMemo(() => {
    if (!draft.fieldId) return false;
    if (initialField && initialField.fieldId === draft.fieldId) return false;
    return existingFieldIds.includes(draft.fieldId);
  }, [draft.fieldId, existingFieldIds, initialField]);

  function update<K extends keyof FormFieldDefinition>(
    key: K,
    value: FormFieldDefinition[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleLabelChange(label: string) {
    setDraft((prev) => ({
      ...prev,
      label,
      fieldId: autoIdFromLabel ? slugify(label) : prev.fieldId,
    }));
  }

  function handleTypeChange(type: FormFieldType) {
    setDraft((prev) => {
      const next: FormFieldDefinition = { ...prev, type };
      if (type === "consent_checkbox") {
        next.required = true;
      }
      if (isOptionType(type) && (!next.options || next.options.length === 0)) {
        next.options = [
          { key: "option_1", label: "Option 1" },
          { key: "option_2", label: "Option 2" },
        ];
      }
      return next;
    });
  }

  function addOption() {
    setDraft((prev) => {
      const idx = (prev.options?.length ?? 0) + 1;
      const opt: FormFieldOption = {
        key: `option_${idx}`,
        label: `Option ${idx}`,
      };
      return { ...prev, options: [...(prev.options ?? []), opt] };
    });
  }

  function updateOption(index: number, patch: Partial<FormFieldOption>) {
    setDraft((prev) => ({
      ...prev,
      options: (prev.options ?? []).map((o, i) =>
        i === index ? { ...o, ...patch } : o,
      ),
    }));
  }

  function removeOption(index: number) {
    setDraft((prev) => ({
      ...prev,
      options: (prev.options ?? []).filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    if (!draft.label.trim()) {
      setError("Label is required.");
      return;
    }
    if (!draft.fieldId.trim()) {
      setError("Field id is required.");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(draft.fieldId)) {
      setError(
        "Field id must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.",
      );
      return;
    }
    if (idCollision) {
      setError("Another field is already using this id.");
      return;
    }
    if (
      draft.type === "consent_checkbox" &&
      !(draft.consentText ?? "").trim()
    ) {
      setError("Consent text is required for a consent checkbox.");
      return;
    }
    if (isOptionType(draft.type) && (draft.options ?? []).length < 1) {
      setError("Add at least one option.");
      return;
    }
    setError(null);
    onSave(draft);
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={initialField ? "Edit field" : "Add field"}
      description="Configure how this question is captured and stored on every submission."
    >
      <div className="space-y-5 px-1 pb-1">
        {/* Type */}
        <div className="space-y-2">
          <Label htmlFor="field-type">Field type</Label>
          <Select
            value={draft.type}
            onValueChange={(value) => handleTypeChange(value as FormFieldType)}
          >
            <SelectTrigger
              id="field-type"
              className="min-h-[44px] text-base md:text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPE_GROUPS.flatMap((group) => group.items).map((item) => (
                <SelectItem key={item.type} value={item.type}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>

        {/* Label & id */}
        <div className="space-y-2">
          <Label htmlFor="field-label">Label</Label>
          <Input
            id="field-label"
            value={draft.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g. Mobile phone"
            className="min-h-[44px] text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="field-id">Field id</Label>
          <Input
            id="field-id"
            value={draft.fieldId}
            onChange={(e) => {
              setAutoIdFromLabel(false);
              update("fieldId", slugify(e.target.value));
            }}
            placeholder="snake_case_id"
            className="min-h-[44px] text-base md:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Stable identifier for this field across versions. Once a form is
            published with this id, don't change it — that's how historical
            submissions resolve.
          </p>
        </div>

        {/* Help & placeholder */}
        <div className="space-y-2">
          <Label htmlFor="field-help">Help text (optional)</Label>
          <Textarea
            id="field-help"
            value={draft.helpText ?? ""}
            onChange={(e) => update("helpText", e.target.value)}
            placeholder="Shown beneath the input."
            className="text-base md:text-sm"
          />
        </div>

        {(isStringType(draft.type) ||
          isNumericType(draft.type) ||
          isTemporalType(draft.type)) && (
          <div className="space-y-2">
            <Label htmlFor="field-placeholder">Placeholder (optional)</Label>
            <Input
              id="field-placeholder"
              value={draft.placeholder ?? ""}
              onChange={(e) => update("placeholder", e.target.value)}
              className="min-h-[44px] text-base md:text-sm"
            />
          </div>
        )}

        {/* Required + visible */}
        <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:gap-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="flex items-center gap-3">
                <Switch
                  checked={draft.required}
                  onCheckedChange={(v) => update("required", v)}
                  disabled={draft.type === "consent_checkbox"}
                />
                <span className="text-sm">Required</span>
              </label>
            </TooltipTrigger>
            <TooltipContent side="top">
              {draft.type === "consent_checkbox"
                ? "Consent checkboxes are always required."
                : "When on, the form cannot be submitted unless this field is filled."}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="flex items-center gap-3">
                <Switch
                  checked={draft.visible}
                  onCheckedChange={(v) => update("visible", v)}
                />
                <span className="text-sm">Visible</span>
              </label>
            </TooltipTrigger>
            <TooltipContent side="top">
              Hide the field at render time without erasing existing
              submissions. Use this to retire a field gracefully.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* String validation */}
        {isStringType(draft.type) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="min-length">Min length</Label>
              <Input
                id="min-length"
                type="number"
                inputMode="numeric"
                value={draft.minLength ?? ""}
                onChange={(e) =>
                  update(
                    "minLength",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-length">Max length</Label>
              <Input
                id="max-length"
                type="number"
                inputMode="numeric"
                value={draft.maxLength ?? ""}
                onChange={(e) =>
                  update(
                    "maxLength",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="pattern">Regex pattern (optional)</Label>
              <Input
                id="pattern"
                value={draft.pattern ?? ""}
                onChange={(e) => update("pattern", e.target.value || null)}
                placeholder="^\\+?[1-9]\\d{7,14}$"
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
          </div>
        )}

        {/* Numeric validation */}
        {isNumericType(draft.type) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="min">Min</Label>
              <Input
                id="min"
                type="number"
                inputMode="decimal"
                value={draft.min ?? ""}
                onChange={(e) =>
                  update(
                    "min",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max</Label>
              <Input
                id="max"
                type="number"
                inputMode="decimal"
                value={draft.max ?? ""}
                onChange={(e) =>
                  update(
                    "max",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step">Step</Label>
              <Input
                id="step"
                type="number"
                inputMode="decimal"
                value={draft.step ?? ""}
                onChange={(e) =>
                  update(
                    "step",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={draft.unit ?? ""}
                onChange={(e) => update("unit", e.target.value || null)}
                placeholder="mins, kg, °C"
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
          </div>
        )}

        {/* Temporal validation */}
        {isTemporalType(draft.type) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="min-offset">Earliest (offset seconds)</Label>
              <Input
                id="min-offset"
                type="number"
                inputMode="numeric"
                value={draft.minOffsetSeconds ?? ""}
                onChange={(e) =>
                  update(
                    "minOffsetSeconds",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-offset">Latest (offset seconds)</Label>
              <Input
                id="max-offset"
                type="number"
                inputMode="numeric"
                value={draft.maxOffsetSeconds ?? ""}
                onChange={(e) =>
                  update(
                    "maxOffsetSeconds",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="col-span-2 flex items-center gap-3">
                  <Switch
                    checked={draft.allowPast ?? true}
                    onCheckedChange={(v) => update("allowPast", v)}
                  />
                  <span className="text-sm">Allow past values</span>
                </label>
              </TooltipTrigger>
              <TooltipContent side="top">
                When off, dates and times before the current moment are
                rejected.
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Options */}
        {isOptionType(draft.type) && (
          <div className="space-y-2">
            <Label>Options</Label>
            <div className="space-y-2">
              {(draft.options ?? []).map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    aria-label={`Option ${idx + 1} key`}
                    value={opt.key}
                    onChange={(e) =>
                      updateOption(idx, { key: slugify(e.target.value) })
                    }
                    placeholder="key"
                    className="min-h-[44px] text-base md:text-sm"
                  />
                  <Input
                    aria-label={`Option ${idx + 1} label`}
                    value={opt.label}
                    onChange={(e) =>
                      updateOption(idx, { label: e.target.value })
                    }
                    placeholder="Label shown to user"
                    className="min-h-[44px] text-base md:text-sm"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(idx)}
                        aria-label={`Remove option ${idx + 1}`}
                        className="min-h-[44px]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      Remove this option from the dropdown
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  className="min-h-[44px]"
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add option
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Add a new selectable option to this field
              </TooltipContent>
            </Tooltip>
            {draft.type === "multi_select" && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="multi-min">Min selections</Label>
                  <Input
                    id="multi-min"
                    type="number"
                    inputMode="numeric"
                    value={draft.multiMin ?? ""}
                    onChange={(e) =>
                      update(
                        "multiMin",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="min-h-[44px] text-base md:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="multi-max">Max selections</Label>
                  <Input
                    id="multi-max"
                    type="number"
                    inputMode="numeric"
                    value={draft.multiMax ?? ""}
                    onChange={(e) =>
                      update(
                        "multiMax",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="min-h-[44px] text-base md:text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Files */}
        {isFileType(draft.type) && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="max-bytes">Max file size (bytes)</Label>
              <Input
                id="max-bytes"
                type="number"
                inputMode="numeric"
                value={draft.maxBytes ?? ""}
                onChange={(e) =>
                  update(
                    "maxBytes",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="10485760 (10MB)"
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mime">Allowed MIME types (comma separated)</Label>
              <Input
                id="mime"
                value={(draft.allowedMimeTypes ?? []).join(", ")}
                onChange={(e) =>
                  update(
                    "allowedMimeTypes",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="image/jpeg, image/png, application/pdf"
                className="min-h-[44px] text-base md:text-sm"
              />
            </div>
          </div>
        )}

        {/* Consent */}
        {draft.type === "consent_checkbox" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="consent-text">Consent text</Label>
              <Textarea
                id="consent-text"
                value={draft.consentText ?? ""}
                onChange={(e) => update("consentText", e.target.value)}
                placeholder="I have read the visitor privacy notice and agree to the processing of my information."
                rows={4}
                className="text-base md:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Stored verbatim with every submission so the tenant can prove
                which version was agreed to.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lawful-basis">Lawful basis</Label>
              <Select
                value={draft.lawfulBasis ?? "consent"}
                onValueChange={(v) =>
                  update("lawfulBasis", v as "consent" | "legitimate_interest")
                }
              >
                <SelectTrigger
                  id="lawful-basis"
                  className="min-h-[44px] text-base md:text-sm"
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
          </div>
        )}

        {/* Calculated stub */}
        {draft.type === "calculated" && (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Formula editing isn't available yet. Save the field as calculated
            and an admin can configure the formula via the API for now.
          </div>
        )}

        {/* Maps to */}
        {fieldTypeMeta(draft.type).mappable && (
          <div className="space-y-2">
            <Label htmlFor="maps-to">Mirror onto record</Label>
            <Select
              value={draft.mapsTo ?? "__none"}
              onValueChange={(v) =>
                update(
                  "mapsTo",
                  v === "__none"
                    ? null
                    : (v as NonNullable<FormFieldDefinition["mapsTo"]>),
                )
              }
            >
              <SelectTrigger
                id="maps-to"
                className="min-h-[44px] text-base md:text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAPS_TO_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value || "__none"}
                    value={opt.value || "__none"}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When set, this value is also written to the parent record so
              search and dashboards can use it without diving into the form
              submission.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard changes to this field and close the dialog
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={handleSave}
                className="min-h-[44px]"
              >
                {initialField ? "Save field" : "Add field"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Apply this field to the working draft. The form is only
              published once you click Save form.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </ResponsiveModal>
  );
}
