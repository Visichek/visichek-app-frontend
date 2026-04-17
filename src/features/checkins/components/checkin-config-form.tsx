"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/feedback/loading-button";
import { cn } from "@/lib/utils/cn";
import type {
  CheckinConfig,
  RequiredField,
  RequiredFieldCategory,
  RequiredFieldType,
} from "@/types/checkin";
import type {
  CheckinConfigCreateInput,
  CheckinConfigUpdateInput,
} from "../hooks/use-checkin-configs";

// ── Types ────────────────────────────────────────────────────────────

type FormValues = Omit<
  CheckinConfig,
  "id" | "createdAt" | "updatedAt"
>;

export interface CheckinConfigFormProps {
  /** Present when editing an existing config. */
  initial?: CheckinConfig;
  /** The tenant this config belongs to — locked once set. */
  tenantId: string;
  /** Called on save. Resolve when the write succeeds. */
  onSubmit: (
    values: CheckinConfigCreateInput | CheckinConfigUpdateInput
  ) => Promise<void>;
  /** Called when the user clicks Cancel. */
  onCancel?: () => void;
  /** Text on the submit button. */
  submitLabel?: string;
  /** Loading / pending submit state. */
  isSubmitting?: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_FIELDS: RequiredField[] = [
  {
    key: "full_name",
    label: "Full name",
    type: "string",
    required: true,
    category: "bio_data",
  },
  {
    key: "company",
    label: "Company",
    type: "string",
    required: false,
    category: "bio_data",
  },
  {
    key: "host_name",
    label: "Who are you here to see?",
    type: "string",
    required: true,
    category: "tenant_specific_data",
  },
];

const TYPE_OPTIONS: { value: RequiredFieldType; label: string }[] = [
  { value: "string", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Dropdown (choose one)" },
];

const CATEGORY_OPTIONS: {
  value: RequiredFieldCategory;
  label: string;
  helper: string;
}[] = [
  {
    value: "bio_data",
    label: "Visitor bio",
    helper: "Personal info — can be pre-filled from an ID scan.",
  },
  {
    value: "tenant_specific_data",
    label: "Custom field",
    helper: "Your own fields: host name, room number, NDA status, etc.",
  },
  {
    value: "purpose",
    label: "Visit purpose",
    helper: "Details about why the visitor is here.",
  },
];

function initialValues(
  tenantId: string,
  initial?: CheckinConfig
): FormValues {
  if (initial) {
    return {
      tenantId: initial.tenantId,
      name: initial.name,
      active: initial.active,
      idUploadEnabled: initial.idUploadEnabled,
      allowReturningVisitorLookup: initial.allowReturningVisitorLookup,
      autoApproveVerified: initial.autoApproveVerified ?? false,
      requiredFields: [...initial.requiredFields],
      departmentId: initial.departmentId,
      branchId: initial.branchId,
      logoUrl: initial.logoUrl,
    };
  }
  return {
    tenantId,
    name: "",
    active: true,
    idUploadEnabled: true,
    allowReturningVisitorLookup: true,
    autoApproveVerified: false,
    requiredFields: DEFAULT_FIELDS,
    departmentId: undefined,
    branchId: undefined,
    logoUrl: undefined,
  };
}

// ── Component ────────────────────────────────────────────────────────

export function CheckinConfigForm({
  initial,
  tenantId,
  onSubmit,
  onCancel,
  submitLabel = "Save config",
  isSubmitting = false,
}: CheckinConfigFormProps) {
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(tenantId, initial)
  );
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function addField() {
    const idx = values.requiredFields.length + 1;
    const fresh: RequiredField = {
      key: `custom_field_${idx}`,
      label: `Custom field ${idx}`,
      type: "string",
      required: false,
      category: "tenant_specific_data",
    };
    update("requiredFields", [...values.requiredFields, fresh]);
  }

  function updateField(index: number, patch: Partial<RequiredField>) {
    const next = [...values.requiredFields];
    next[index] = { ...next[index], ...patch };
    update("requiredFields", next);
  }

  function removeField(index: number) {
    const next = values.requiredFields.filter((_, i) => i !== index);
    update("requiredFields", next);
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= values.requiredFields.length) return;
    const next = [...values.requiredFields];
    [next[index], next[target]] = [next[target], next[index]];
    update("requiredFields", next);
  }

  async function handleSave() {
    setError(null);

    // Validation
    if (!values.name.trim()) {
      setError("Give this config a name so you can tell it apart later.");
      return;
    }
    const keys = values.requiredFields.map((f) => f.key.trim());
    const dupKey = keys.find((k, i) => k && keys.indexOf(k) !== i);
    if (dupKey) {
      setError(
        `Two fields share the key "${dupKey}". Each field key must be unique.`
      );
      return;
    }
    const invalidKey = values.requiredFields.find(
      (f) => !/^[a-z][a-z0-9_]*$/i.test(f.key.trim())
    );
    if (invalidKey) {
      setError(
        `Field "${invalidKey.label || invalidKey.key}" has an invalid key. Use letters, numbers, and underscores only; start with a letter.`
      );
      return;
    }

    try {
      await onSubmit(values);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save the config. Please try again."
      );
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name &amp; status</CardTitle>
          <CardDescription>
            Name this config so you can tell it apart from others (for example:
            &quot;Lagos HQ front desk&quot; or &quot;After-hours kiosk&quot;).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="config-name">Config name</Label>
            <Input
              id="config-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Lagos HQ front desk"
              className="text-base md:text-sm"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="config-active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Only active configs appear on the kiosk. Turn off to pause
                check-ins without losing your setup.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  id="config-active"
                  checked={values.active}
                  onCheckedChange={(checked) => update("active", checked)}
                  disabled={isSubmitting}
                />
              </TooltipTrigger>
              <TooltipContent side="left">
                Toggle whether this config is live on the kiosk right now
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Behaviour toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kiosk behaviour</CardTitle>
          <CardDescription>
            How the public kiosk behaves for visitors submitting a check-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="id-upload"
            label="Allow ID upload"
            description="Let visitors upload a government ID so the system can verify them automatically with OCR."
            checked={values.idUploadEnabled}
            onCheckedChange={(v) => update("idUploadEnabled", v)}
            disabled={isSubmitting}
            tooltip="Visitors can skip the ID step, but uploading one speeds up verification"
          />
          <ToggleRow
            id="returning-visitor"
            label="Returning-visitor lookup"
            description="If a visitor enters an email or phone we've seen before, greet them by name and pre-fill their details."
            checked={values.allowReturningVisitorLookup}
            onCheckedChange={(v) =>
              update("allowReturningVisitorLookup", v)
            }
            disabled={isSubmitting}
            tooltip="Speeds up check-in for repeat visitors"
          />
          <ToggleRow
            id="auto-approve"
            label="Auto-approve verified visitors"
            description="When a visitor's ID is successfully OCR-verified, approve their check-in without waiting for a receptionist."
            checked={values.autoApproveVerified ?? false}
            onCheckedChange={(v) => update("autoApproveVerified", v)}
            disabled={isSubmitting}
            tooltip="Skip the manual approval step for visitors whose ID the system could verify"
          />
        </CardContent>
      </Card>

      {/* Required fields editor */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Required fields</CardTitle>
            <CardDescription>
              What visitors fill in on the kiosk. Rearrange with the arrows.
            </CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addField}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                Add field
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Add a new field for visitors to fill in on the kiosk
            </TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="space-y-3">
          {values.requiredFields.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              No fields yet. Click &quot;Add field&quot; to get started.
            </p>
          )}

          {values.requiredFields.map((field, idx) => (
            <FieldRow
              key={idx}
              index={idx}
              field={field}
              disabled={isSubmitting}
              onUpdate={(patch) => updateField(idx, patch)}
              onRemove={() => removeField(idx)}
              onMove={(dir) => moveField(idx, dir)}
              canMoveUp={idx > 0}
              canMoveDown={idx < values.requiredFields.length - 1}
            />
          ))}
        </CardContent>
      </Card>

      {/* Error + actions */}
      {error && (
        <p
          role="alert"
          className="text-sm text-destructive text-center"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      <Separator />

      <div className="flex flex-col-reverse md:flex-row gap-2 md:justify-end">
        {onCancel && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard your changes and go back
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                loadingText="Saving…"
                className="w-full md:w-auto"
              >
                {submitLabel}
              </LoadingButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Save your check-in config so it takes effect on the kiosk
          </TooltipContent>
        </Tooltip>
      </div>
    </form>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  tooltip?: string;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  tooltip,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={onCheckedChange}
              disabled={disabled}
            />
          </TooltipTrigger>
          <TooltipContent side="left">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

interface FieldRowProps {
  index: number;
  field: RequiredField;
  disabled?: boolean;
  onUpdate: (patch: Partial<RequiredField>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function FieldRow({
  index,
  field,
  disabled,
  onUpdate,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: FieldRowProps) {
  const [showAdvanced, setShowAdvanced] = useState(field.type === "select");

  return (
    <div className="rounded-lg border p-3 md:p-4 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GripVertical className="h-4 w-4" aria-hidden="true" />
          Field {index + 1}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => onMove(-1)}
                disabled={disabled || !canMoveUp}
                aria-label="Move up"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Move this field up so visitors see it sooner
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => onMove(1)}
                disabled={disabled || !canMoveDown}
                aria-label="Move down"
              >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Move this field down so it appears later in the form
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                onClick={onRemove}
                disabled={disabled}
                aria-label="Remove field"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Remove this field from the kiosk form
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`field-${index}-label`}>Label</Label>
          <Input
            id={`field-${index}-label`}
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g. Full name"
            className="text-base md:text-sm"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`field-${index}-key`}>Key</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle
                  className="h-3.5 w-3.5 text-muted-foreground cursor-help"
                  aria-hidden="true"
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Used internally to identify this field. Stays the same even if
                you rename the label. Use letters, numbers, and underscores.
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id={`field-${index}-key`}
            value={field.key}
            onChange={(e) => onUpdate({ key: e.target.value })}
            placeholder="full_name"
            className="text-base md:text-sm font-mono"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`field-${index}-type`}>Type</Label>
          <Select
            value={field.type}
            onValueChange={(value) => {
              onUpdate({ type: value as RequiredFieldType });
              if (value === "select") setShowAdvanced(true);
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={`field-${index}-type`}
              className="text-base md:text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`field-${index}-category`}>Category</Label>
          <Select
            value={field.category}
            onValueChange={(value) =>
              onUpdate({ category: value as RequiredFieldCategory })
            }
            disabled={disabled}
          >
            <SelectTrigger
              id={`field-${index}-category`}
              className="text-base md:text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {opt.helper}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="min-w-0 flex-1">
          <Label
            htmlFor={`field-${index}-required`}
            className="cursor-pointer"
          >
            Required
          </Label>
          <p className="text-xs text-muted-foreground">
            Block submission until the visitor fills this in.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Switch
              id={`field-${index}-required`}
              checked={field.required}
              onCheckedChange={(checked) => onUpdate({ required: checked })}
              disabled={disabled}
            />
          </TooltipTrigger>
          <TooltipContent side="left">
            Toggle whether visitors must fill this field before submitting
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Advanced: placeholder, helper text, select options */}
      <div className="pt-1">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide" : "Show"} advanced options
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t">
          <div className="space-y-1.5">
            <Label htmlFor={`field-${index}-placeholder`}>Placeholder</Label>
            <Input
              id={`field-${index}-placeholder`}
              value={field.placeholder ?? ""}
              onChange={(e) =>
                onUpdate({ placeholder: e.target.value || undefined })
              }
              placeholder="Gray hint text shown inside the field"
              className="text-base md:text-sm"
              disabled={disabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`field-${index}-helper`}>Helper text</Label>
            <Textarea
              id={`field-${index}-helper`}
              value={field.helperText ?? ""}
              onChange={(e) =>
                onUpdate({ helperText: e.target.value || undefined })
              }
              placeholder="Short tooltip explaining why this field exists"
              className="text-base md:text-sm min-h-[60px]"
              disabled={disabled}
            />
          </div>

          {field.type === "select" && (
            <SelectOptionsEditor
              options={field.options ?? []}
              onChange={(next) => onUpdate({ options: next })}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface SelectOptionsEditorProps {
  options: Array<{ value: string; label: string }>;
  onChange: (next: Array<{ value: string; label: string }>) => void;
  disabled?: boolean;
}

function SelectOptionsEditor({
  options,
  onChange,
  disabled,
}: SelectOptionsEditorProps) {
  function addOption() {
    onChange([...options, { value: "", label: "" }]);
  }
  function updateOption(index: number, patch: Partial<{ value: string; label: string }>) {
    const next = [...options];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }
  function removeOption(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Dropdown options</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={disabled}
              className="h-9"
            >
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add option
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Add a new choice to this dropdown
          </TooltipContent>
        </Tooltip>
      </div>
      {options.length === 0 && (
        <p className="text-xs italic text-muted-foreground">
          No options yet — a dropdown needs at least one choice.
        </p>
      )}
      {options.map((opt, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            value={opt.label}
            onChange={(e) => updateOption(i, { label: e.target.value })}
            placeholder="Label shown to visitor"
            className={cn("text-base md:text-sm flex-1")}
            disabled={disabled}
          />
          <Input
            value={opt.value}
            onChange={(e) => updateOption(i, { value: e.target.value })}
            placeholder="Value stored"
            className={cn("text-base md:text-sm flex-1 font-mono")}
            disabled={disabled}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-destructive"
                onClick={() => removeOption(i)}
                disabled={disabled}
                aria-label="Remove option"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Remove this option</TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}
