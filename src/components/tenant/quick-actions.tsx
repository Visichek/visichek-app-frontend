"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { cn } from "@/lib/utils/cn";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  UserPlus,
  UserMinus,
  CalendarPlus,
  Building2,
  MapPin,
  Users,
  AlertTriangle,
  GripVertical,
  Settings2,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCapabilities } from "@/hooks/use-capabilities";
import { CAPABILITIES, type Capability } from "@/lib/permissions/capabilities";

// ── Action definitions ────────────────────────────────────────────────

interface TenantQuickAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
  iconColor: string;
  /** Capability required to see this action. */
  capability: Capability;
}

const ALL_ACTIONS: TenantQuickAction[] = [
  {
    id: "register-visitor",
    label: "Register Visitor",
    description: "Start a new visitor check-in and capture their details",
    icon: UserPlus,
    href: "/app/visitors?action=create",
    color: "bg-blue-50",
    iconColor: "text-blue-600",
    capability: CAPABILITIES.VISITOR_CHECK_IN,
  },
  {
    id: "check-out-visitor",
    label: "Check Out Visitor",
    description: "Check out an active visitor and close their session",
    icon: UserMinus,
    href: "/app/visitors/checkout",
    color: "bg-rose-50",
    iconColor: "text-rose-600",
    capability: CAPABILITIES.VISITOR_CHECK_OUT,
  },
  {
    id: "new-appointment",
    label: "New Appointment",
    description: "Schedule a future appointment for a visitor with a host",
    icon: CalendarPlus,
    href: "/app/appointments/new",
    color: "bg-emerald-50",
    iconColor: "text-emerald-600",
    capability: CAPABILITIES.APPOINTMENT_CREATE,
  },
  {
    id: "invite-user",
    label: "Invite User",
    description: "Invite a teammate as a receptionist, dept admin or other staff role",
    icon: Users,
    href: "/app/users/new",
    color: "bg-violet-50",
    iconColor: "text-violet-600",
    capability: CAPABILITIES.USER_CREATE,
  },
  {
    id: "add-department",
    label: "Add Department",
    description: "Create a new department to organise hosts and visitors",
    icon: Building2,
    href: "/app/departments/new",
    color: "bg-amber-50",
    iconColor: "text-amber-600",
    capability: CAPABILITIES.DEPARTMENT_CREATE,
  },
  {
    id: "add-branch",
    label: "Add Branch",
    description: "Add a new physical office location for staff and visitors",
    icon: MapPin,
    href: "/app/branches/new",
    color: "bg-sky-50",
    iconColor: "text-sky-600",
    capability: CAPABILITIES.BRANCH_CREATE,
  },
  {
    id: "report-incident",
    label: "Report Incident",
    description: "Log a new security or data-protection incident for triage",
    icon: AlertTriangle,
    href: "/app/incidents/new",
    color: "bg-orange-50",
    iconColor: "text-orange-600",
    capability: CAPABILITIES.INCIDENT_CREATE,
  },
];

const STORAGE_KEY = "visichek_tenant_action_order";

function getPersistedOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function persistOrder(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function orderActions(
  actions: TenantQuickAction[],
  order: string[] | null
): TenantQuickAction[] {
  if (!order) return actions;
  const map = new Map(actions.map((a) => [a.id, a]));
  const ordered: TenantQuickAction[] = [];
  for (const id of order) {
    const action = map.get(id);
    if (action) {
      ordered.push(action);
      map.delete(id);
    }
  }
  for (const remaining of map.values()) {
    ordered.push(remaining);
  }
  return ordered;
}

// ── Component ─────────────────────────────────────────────────────────

export function QuickActions() {
  const { navigate } = useNavigationLoading();
  const { hasCapability } = useCapabilities();

  // Filter to only the actions the current role can perform.
  const visibleActions = useMemo(
    () => ALL_ACTIONS.filter((a) => hasCapability(a.capability)),
    [hasCapability]
  );

  const [actions, setActions] = useState<TenantQuickAction[]>(() =>
    orderActions(visibleActions, getPersistedOrder())
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef<Map<string, number>>(new Map());

  // Reconcile the visible action set when the user's role changes.
  useEffect(() => {
    setActions((prev) => {
      const visibleIds = new Set(visibleActions.map((a) => a.id));
      // Drop hidden, then merge in any newly visible actions.
      const filtered = prev.filter((a) => visibleIds.has(a.id));
      const known = new Set(filtered.map((a) => a.id));
      for (const action of visibleActions) {
        if (!known.has(action.id)) filtered.push(action);
      }
      return filtered;
    });
  }, [visibleActions]);

  // Persist order whenever it changes.
  useEffect(() => {
    persistOrder(actions.map((a) => a.id));
  }, [actions]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    const count = (dragCounter.current.get(id) || 0) + 1;
    dragCounter.current.set(id, count);
    if (count === 1) setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent, id: string) => {
      const count = (dragCounter.current.get(id) || 1) - 1;
      dragCounter.current.set(id, count);
      if (count <= 0) {
        dragCounter.current.delete(id);
        if (dragOverId === id) setDragOverId(null);
      }
    },
    [dragOverId]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      dragCounter.current.clear();
      setDragOverId(null);

      if (!draggedId || draggedId === targetId) {
        setDraggedId(null);
        return;
      }

      setActions((prev) => {
        const fromIndex = prev.findIndex((a) => a.id === draggedId);
        const toIndex = prev.findIndex((a) => a.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return prev;

        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });

      setDraggedId(null);
    },
    [draggedId]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    dragCounter.current.clear();
  }, []);

  const resetOrder = useCallback(() => {
    setActions([...visibleActions]);
    persistOrder(visibleActions.map((a) => a.id));
  }, [visibleActions]);

  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Quick Actions
        </h2>
        <div className="flex items-center gap-1">
          {isEditing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={resetOrder}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Reset actions to their default order
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs",
                  isEditing
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground"
                )}
                onClick={() => setIsEditing(!isEditing)}
              >
                <Settings2 className="h-3 w-3 mr-1" />
                {isEditing ? "Done" : "Customize"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isEditing
                ? "Finish customizing and lock the layout"
                : "Drag and drop to rearrange your quick actions"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Actions grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const isDragged = draggedId === action.id;
          const isDragOver = dragOverId === action.id && draggedId !== action.id;

          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  draggable={isEditing}
                  onDragStart={
                    isEditing ? (e) => handleDragStart(e, action.id) : undefined
                  }
                  onDragEnter={
                    isEditing ? (e) => handleDragEnter(e, action.id) : undefined
                  }
                  onDragLeave={
                    isEditing ? (e) => handleDragLeave(e, action.id) : undefined
                  }
                  onDragOver={isEditing ? handleDragOver : undefined}
                  onDrop={isEditing ? (e) => handleDrop(e, action.id) : undefined}
                  onDragEnd={isEditing ? handleDragEnd : undefined}
                  onClick={!isEditing ? () => navigate(action.href) : undefined}
                  onKeyDown={(e) => {
                    if (!isEditing && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      navigate(action.href);
                    }
                  }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border bg-card p-4 transition-all",
                    "min-h-[72px]",
                    !isEditing &&
                      "cursor-pointer hover:border-primary/30 hover:shadow-sm",
                    isEditing && "cursor-grab active:cursor-grabbing",
                    isDragged && "opacity-40 scale-95",
                    isDragOver &&
                      "border-primary border-dashed bg-primary/5 scale-[1.02]",
                    !isDragged && !isDragOver && "border-border"
                  )}
                >
                  {isEditing && (
                    <div className="absolute top-2 right-2 text-muted-foreground/40">
                      <GripVertical className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      action.color
                    )}
                  >
                    <Icon className={cn("h-5 w-5", action.iconColor)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {action.label}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {action.description}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[250px]">
                {action.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {isEditing && (
        <p className="text-xs text-muted-foreground text-center py-1">
          Drag cards to reorder. Your layout is saved automatically.
        </p>
      )}
    </div>
  );
}
