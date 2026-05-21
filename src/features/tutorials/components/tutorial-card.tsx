"use client";

import { Play, RotateCcw, Check, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type { TutorialStatus } from "@/types/tutorial";
import type { TutorialDefinition } from "../lib/catalog";

interface StatusMeta {
  label: string;
  variant: "default" | "secondary" | "outline" | "success" | "warning" | "info";
}

const STATUS_META: Record<TutorialStatus, StatusMeta> = {
  idle: { label: "Not started", variant: "outline" },
  in_progress: { label: "In progress", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  dismissed: { label: "Skipped", variant: "secondary" },
};

/** Action button copy keyed by current status. */
function actionLabel(status: TutorialStatus): string {
  switch (status) {
    case "in_progress":
      return "Resume";
    case "completed":
      return "Replay";
    default:
      return "Start";
  }
}

export interface TutorialCardProps {
  definition: TutorialDefinition;
  status: TutorialStatus;
  selected: boolean;
  onToggleSelect: () => void;
  /** Launch the walkthrough for this tutorial. */
  onStart: () => void;
}

export function TutorialCard({
  definition,
  status,
  selected,
  onToggleSelect,
  onStart,
}: TutorialCardProps) {
  const Icon: LucideIcon = definition.icon;
  const meta = STATUS_META[status];
  const label = actionLabel(status);
  const isCompleted = status === "completed";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStart();
        }
      }}
      aria-label={`${label} the "${definition.title}" tutorial`}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors",
        "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected && "border-primary/60 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Selection checkbox — 44px hit area, stops row activation. */}
        <span
          className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center"
          data-row-click-ignore
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select the "${definition.title}" tutorial`}
          />
        </span>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {isCompleted ? (
            <Check className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Icon className="h-5 w-5" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold">
              {definition.title}
            </h3>
            <Badge variant={meta.variant} className="shrink-0">
              {meta.label}
            </Badge>
          </div>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {definition.description}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">
          {definition.steps.length} step
          {definition.steps.length === 1 ? "" : "s"}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={isCompleted ? "outline" : "default"}
              className="min-h-[44px] gap-1.5 md:min-h-0"
              data-row-click-ignore
              onClick={(e) => {
                e.stopPropagation();
                onStart();
              }}
            >
              {isCompleted ? (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isCompleted
              ? `Replay the "${definition.title}" walkthrough from the beginning`
              : `${label} the "${definition.title}" walkthrough — your progress is saved automatically`}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
