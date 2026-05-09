"use client";

import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fieldTypeMeta } from "../lib/field-types";
import type { FormFieldDefinition } from "../types";

interface FieldRowProps {
  field: FormFieldDefinition;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (field: FormFieldDefinition) => void;
  onRemove: (fieldId: string) => void;
  onMove: (fieldId: string, direction: "up" | "down") => void;
}

export function FieldRow({
  field,
  isFirst,
  isLast,
  onEdit,
  onRemove,
  onMove,
}: FieldRowProps) {
  const meta = fieldTypeMeta(field.type);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-sm truncate">{field.label}</h3>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {field.fieldId}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-xs">
              {meta.label}
            </Badge>
            {field.required && (
              <Badge className="text-xs">Required</Badge>
            )}
            {!field.visible && (
              <Badge variant="outline" className="gap-1 text-xs">
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                Hidden
              </Badge>
            )}
            {field.mapsTo && (
              <Badge variant="outline" className="gap-1 text-xs">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Mirrors {field.mapsTo}
              </Badge>
            )}
          </div>
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onMove(field.fieldId, "up")}
                disabled={isFirst}
                aria-label={`Move ${field.label} up`}
                className="min-h-[44px]"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Move this field higher in the rendering order
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onMove(field.fieldId, "down")}
                disabled={isLast}
                aria-label={`Move ${field.label} down`}
                className="min-h-[44px]"
              >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Move this field lower in the rendering order
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onEdit(field)}
                aria-label={`Edit ${field.label}`}
                className="min-h-[44px]"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Open the editor for this field
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(field.fieldId)}
                aria-label={`Remove ${field.label}`}
                className="min-h-[44px] text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Remove this field from the working draft
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
