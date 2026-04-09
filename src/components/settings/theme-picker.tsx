"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun, desc: "Use a bright colour scheme" },
  { value: "dark", label: "Dark", icon: Moon, desc: "Use a dimmer colour scheme that's easier on the eyes" },
  { value: "system", label: "System", icon: Monitor, desc: "Automatically match your operating system preference" },
] as const;

interface ThemePickerProps {
  theme: string | undefined;
  setTheme: (t: string) => void;
  mounted: boolean;
}

export function ThemePicker({ theme, setTheme, mounted }: ThemePickerProps) {
  if (!mounted) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <Tooltip key={opt.value}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex flex-col items-center gap-2 h-auto py-4 min-h-[44px] transition-colors",
                  active && "border-primary bg-primary/5 text-primary ring-1 ring-primary",
                )}
                onClick={() => setTheme(opt.value)}
                aria-pressed={active}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium">{opt.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{opt.desc}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
