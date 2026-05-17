"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A single row in a `<RecordDetailList>`. `value` is rendered as-is — pass
 * a `<Badge>`, a formatted timestamp, an icon, or a plain string. `null` /
 * `undefined` / empty-string values are rendered as an em-dash so the
 * label still appears (consistent layout across records that share the
 * same field set but only sometimes populate them).
 */
export interface RecordDetailRow {
  label: string;
  value: React.ReactNode;
  /** When true, value spans both columns under the label (good for long text). */
  full?: boolean;
}

export function RecordDetailList({
  rows,
  className,
}: {
  rows: RecordDetailRow[];
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3", className)}>
      {rows.map((row) => {
        const empty = row.value === null || row.value === undefined || row.value === "";
        return (
          <React.Fragment key={row.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:col-span-1">
              {row.label}
            </dt>
            <dd
              className={cn(
                "text-sm text-foreground",
                row.full ? "sm:col-span-3 sm:-mt-2" : "sm:col-span-2",
              )}
            >
              {empty ? <span className="text-muted-foreground">—</span> : row.value}
            </dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
}
