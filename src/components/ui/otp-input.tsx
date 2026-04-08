"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  type ChangeEvent,
} from "react";
import { cn } from "@/lib/utils/cn";

interface OtpInputProps {
  /** Number of digit slots (default 6) */
  length?: number;
  /** Current value — controlled */
  value: string;
  /** Called with the full string whenever any slot changes */
  onChange: (value: string) => void;
  /** Called when all slots are filled */
  onComplete?: (value: string) => void;
  /** Disable all slots */
  disabled?: boolean;
  /** Auto-focus the first slot on mount */
  autoFocus?: boolean;
  /** aria-label for the group */
  "aria-label"?: string;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  "aria-label": ariaLabel = "One-time password",
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Split value into individual characters
  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const focusInput = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, length - 1));
      inputRefs.current[clamped]?.focus();
    },
    [length]
  );

  const updateValue = useCallback(
    (newDigits: string[]) => {
      const joined = newDigits.join("").slice(0, length);
      onChange(joined);
      if (joined.length === length && onComplete) {
        onComplete(joined);
      }
    },
    [length, onChange, onComplete]
  );

  function handleChange(e: ChangeEvent<HTMLInputElement>, index: number) {
    const inputVal = e.target.value.replace(/\D/g, "");
    if (!inputVal) return;

    const newDigits = [...digits];

    if (inputVal.length === 1) {
      // Single digit typed
      newDigits[index] = inputVal;
      updateValue(newDigits);
      // Move to next slot
      if (index < length - 1) {
        focusInput(index + 1);
      }
    } else {
      // Multiple digits (e.g. from Android auto-fill) — fill from current index
      const chars = inputVal.split("");
      for (let i = 0; i < chars.length && index + i < length; i++) {
        newDigits[index + i] = chars[i];
      }
      updateValue(newDigits);
      const nextIndex = Math.min(index + chars.length, length - 1);
      focusInput(nextIndex);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];

      if (digits[index]) {
        // Clear current slot
        newDigits[index] = "";
        updateValue(newDigits);
      } else if (index > 0) {
        // Move back and clear previous slot
        newDigits[index - 1] = "";
        updateValue(newDigits);
        focusInput(index - 1);
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      const newDigits = [...digits];
      newDigits[index] = "";
      updateValue(newDigits);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (index > 0) focusInput(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < length - 1) focusInput(index + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    updateValue(newDigits);
    focusInput(Math.min(pasted.length, length - 1));
  }

  function handleFocus(index: number) {
    setFocusedIndex(index);
    // Select the content so typing replaces it
    inputRefs.current[index]?.select();
  }

  function handleBlur() {
    setFocusedIndex(-1);
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center justify-center gap-2 sm:gap-3"
    >
      {Array.from({ length }).map((_, index) => (
        <div key={index} className="relative">
          {/* Decorative separator after 3rd digit */}
          {index === Math.floor(length / 2) && (
            <div
              className="absolute -left-[7px] sm:-left-[9px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-600"
              aria-hidden="true"
            />
          )}
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={length} // allow paste to work
            autoComplete={index === 0 ? "one-time-code" : "off"}
            disabled={disabled}
            value={digits[index] || ""}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={cn(
              "w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-semibold",
              "bg-zinc-950/50 border rounded-xl text-zinc-100",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500",
              "transition-all duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "placeholder:text-zinc-700",
              focusedIndex === index
                ? "border-emerald-500 ring-2 ring-emerald-500/30 scale-105"
                : digits[index]
                  ? "border-zinc-600"
                  : "border-zinc-800",
              // Caret color
              "caret-emerald-500"
            )}
          />
        </div>
      ))}
    </div>
  );
}
