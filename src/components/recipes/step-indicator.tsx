"use client";

import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ */
/* StepIndicator                                                        */
/* ------------------------------------------------------------------ */

export interface StepDef {
  id: number;
  label: string;
  icon: LucideIcon;
}

interface StepIndicatorProps {
  steps: StepDef[];
  currentStep: number;
  completedSteps: number[];
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = currentStep === step.id;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center flex-1">
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                  isCompleted &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent &&
                    !isCompleted &&
                    "border-primary bg-background text-primary",
                  !isCurrent &&
                    !isCompleted &&
                    "border-muted-foreground/30 bg-background text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector — not after the last step */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-2 mb-5 transition-colors",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ReviewRow — read-only label/value pair used in review steps         */
/* ------------------------------------------------------------------ */

interface ReviewRowProps {
  label: string;
  value: string;
}

export function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* useStepForm — shared step navigation logic                          */
/* ------------------------------------------------------------------ */

import { useState, useCallback } from "react";
import type { FieldValues, UseFormTrigger } from "react-hook-form";

interface UseStepFormOptions<T extends FieldValues> {
  totalSteps: number;
  stepFields: Record<number, (keyof T)[]>;
  trigger: UseFormTrigger<T>;
  onClose: () => void;
}

export function useStepForm<T extends FieldValues>({
  totalSteps,
  stepFields,
  trigger,
  onClose,
}: UseStepFormOptions<T>) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const handleNext = useCallback(async () => {
    const fields = (stepFields[currentStep] ?? []) as Parameters<typeof trigger>[0];
    const valid = await trigger(fields);
    if (!valid) return;
    setCompletedSteps((prev) =>
      prev.includes(currentStep) ? prev : [...prev, currentStep]
    );
    setCurrentStep((s) => Math.min(s + 1, totalSteps));
  }, [currentStep, stepFields, trigger, totalSteps]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps([]);
  }, []);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  return {
    currentStep,
    completedSteps,
    handleNext,
    handleBack,
    handleCancel,
    reset,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === totalSteps,
  };
}
