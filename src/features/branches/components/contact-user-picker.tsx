"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSystemUsers } from "@/features/users/hooks/use-users";
import { cn } from "@/lib/utils/cn";
import type { SystemUser } from "@/types/user";

/** Human label for a system-user role in the picker rows. */
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  dept_admin: "Department admin",
  receptionist: "Receptionist",
  auditor: "Auditor",
  security_officer: "Security officer",
  dpo: "DPO",
};

function roleLabel(role: string | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export interface ContactUserPickerProps {
  /** Selected system-user id; null = no designated contact (org default). */
  value: string | null;
  onChange: (next: string | null) => void;
  /**
   * When editing an existing branch, its id — used to flag users whose
   * branch scope does not include this branch (the backend rejects a
   * branch-scoped contact who isn't assigned to the branch).
   */
  branchId?: string;
  disabled?: boolean;
}

/** Roles whose branch_ids must include the branch to be a valid contact. */
const BRANCH_SCOPED_ROLES = new Set([
  "dept_admin",
  "receptionist",
  "security_officer",
]);

/**
 * Searchable single-select of the organization's staff, used to pick a
 * branch's designated point of contact (WS4). Client-side filtered over
 * the first 200 users — same approach as the host mirror picker.
 */
export function ContactUserPicker({
  value,
  onChange,
  branchId,
  disabled,
}: ContactUserPickerProps) {
  const [query, setQuery] = useState("");
  const usersQuery = useSystemUsers({ limit: 200 });
  const users = useMemo(
    () => usersQuery.data?.items ?? [],
    [usersQuery.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.fullName, u.email, u.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [users, query]);

  const isOutOfScope = (user: SystemUser) =>
    !!branchId &&
    BRANCH_SCOPED_ROLES.has(user.role) &&
    Array.isArray(user.branchIds) &&
    user.branchIds.length > 0 &&
    !user.branchIds.includes(branchId);

  return (
    <div className="space-y-2">
      <Label htmlFor="contact-user-search">Point of contact</Label>
      <p className="text-xs text-muted-foreground">
        Who visitors and staff should reach for this location. Leave unset to
        use the branch email or your organization&apos;s main administrator.
      </p>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="contact-user-search"
          type="search"
          inputMode="search"
          placeholder="Search staff by name, email, or role"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          className="pl-9 min-h-[44px]"
          aria-label="Search staff for the point of contact"
        />
      </div>
      <div
        className="rounded-md border bg-card max-h-56 overflow-y-auto divide-y"
        role="listbox"
        aria-label="Point of contact"
      >
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          onClick={() => onChange(null)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center gap-3 p-2.5 text-left text-sm min-h-[44px] hover:bg-muted/50 transition-colors",
            value === null && "bg-muted/40",
          )}
        >
          <UserRound
            className="h-4 w-4 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <span className="flex-1">
            <span className="font-medium">No designated contact</span>
            <span className="block text-xs text-muted-foreground">
              Use the branch email or the main administrator
            </span>
          </span>
          {value === null && (
            <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          )}
        </button>
        {usersQuery.isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading staff…
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No staff match that search.
          </p>
        ) : (
          filtered.map((user) => {
            const selected = value === user.id;
            const outOfScope = isOutOfScope(user);
            const row = (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  if (outOfScope) return;
                  onChange(user.id);
                }}
                disabled={disabled || outOfScope}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 text-left text-sm min-h-[44px] hover:bg-muted/50 transition-colors",
                  selected && "bg-muted/40",
                  outOfScope && "opacity-50 cursor-not-allowed",
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="font-medium block truncate">
                    {user.fullName}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {[user.email, roleLabel(user.role)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {selected && (
                  <Check
                    className="h-4 w-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
            if (!outOfScope) return row;
            return (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>{row}</TooltipTrigger>
                <TooltipContent side="top">
                  This user&apos;s role is branch-scoped and they aren&apos;t
                  assigned to this branch — assign them to the branch first
                </TooltipContent>
              </Tooltip>
            );
          })
        )}
      </div>
    </div>
  );
}
