"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface CopyableIdProps {
  label: string;
  value: string;
}

export function CopyableId({ label, value }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors min-h-[52px]">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-mono text-muted-foreground select-all">
          {value}
        </code>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied!" : `Copy ${label} to clipboard`}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
