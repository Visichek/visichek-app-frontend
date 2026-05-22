"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/features/branches/hooks";
import { useDepartments } from "@/features/departments/hooks";
import { useHosts } from "@/features/hosts/hooks";
import type { SystemUserRole } from "@/types/enums";

/** Filter values that narrow the insights query (string-valued for selects). */
export interface InsightsFilterValues {
  departmentId?: string;
  branchId?: string;
  hostId?: string;
  operationType?: string;
  incidentType?: string;
  incidentStatus?: string;
  severity?: string;
  dsrType?: string;
  dsrStatus?: string;
  lawfulBasis?: string;
  statusFilter?: string;
}

const ALL = "__all";

function humanize(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type Option = { value: string; label: string };
const opts = (values: readonly string[]): Option[] =>
  values.map((v) => ({ value: v, label: humanize(v) }));

const OPERATION_TYPES = opts(["create", "read", "update", "delete"]);
const INCIDENT_TYPES = opts([
  "data_breach",
  "unauthorized_access",
  "data_export_exposure",
  "device_loss",
  "misconfiguration",
  "third_party",
]);
const INCIDENT_STATUSES = opts([
  "open",
  "investigating",
  "contained",
  "reported_to_ndpc",
  "closed",
]);
const SEVERITIES = opts(["low", "medium", "high", "critical"]);
const DSR_TYPES = opts(["access", "correction", "deletion", "consent_withdrawal"]);
const DSR_STATUSES = opts(["pending", "in_progress", "completed", "rejected"]);
const LAWFUL_BASES = opts(["consent", "legitimate_interest"]);
const VISIT_STATUSES = opts([
  "registered",
  "pending_verification",
  "checked_in",
  "checked_out",
  "denied",
  "cancelled",
]);

/** A labelled single select with an "All" reset option. */
function FilterSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Select
        value={value ?? ALL}
        onValueChange={(v) => onChange(v === ALL ? undefined : v)}
      >
        <SelectTrigger className="h-9 w-[10rem]" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

interface FiltersProps {
  values: InsightsFilterValues;
  onChange: (next: InsightsFilterValues) => void;
}

/** Routes to the role's filter set. Only the relevant role's hooks run. */
export function InsightsFilters({
  role,
  values,
  onChange,
}: FiltersProps & { role: SystemUserRole }) {
  switch (role) {
    case "super_admin":
      return <SuperAdminFilters values={values} onChange={onChange} />;
    case "dept_admin":
      return <DeptAdminFilters values={values} onChange={onChange} />;
    case "receptionist":
      return (
        <FilterRow>
          <FilterSelect
            label="Status"
            placeholder="All statuses"
            value={values.statusFilter}
            options={VISIT_STATUSES}
            onChange={(v) => onChange({ ...values, statusFilter: v })}
          />
        </FilterRow>
      );
    case "auditor":
      return (
        <FilterRow>
          <FilterSelect
            label="Operation"
            placeholder="All operations"
            value={values.operationType}
            options={OPERATION_TYPES}
            onChange={(v) => onChange({ ...values, operationType: v })}
          />
        </FilterRow>
      );
    case "security_officer":
      return (
        <FilterRow>
          <FilterSelect
            label="Incident type"
            placeholder="All types"
            value={values.incidentType}
            options={INCIDENT_TYPES}
            onChange={(v) => onChange({ ...values, incidentType: v })}
          />
          <FilterSelect
            label="Incident status"
            placeholder="All statuses"
            value={values.incidentStatus}
            options={INCIDENT_STATUSES}
            onChange={(v) => onChange({ ...values, incidentStatus: v })}
          />
          <FilterSelect
            label="Severity"
            placeholder="All severities"
            value={values.severity}
            options={SEVERITIES}
            onChange={(v) => onChange({ ...values, severity: v })}
          />
        </FilterRow>
      );
    case "dpo":
      return (
        <FilterRow>
          <FilterSelect
            label="Request type"
            placeholder="All types"
            value={values.dsrType}
            options={DSR_TYPES}
            onChange={(v) => onChange({ ...values, dsrType: v })}
          />
          <FilterSelect
            label="Request status"
            placeholder="All statuses"
            value={values.dsrStatus}
            options={DSR_STATUSES}
            onChange={(v) => onChange({ ...values, dsrStatus: v })}
          />
          <FilterSelect
            label="Lawful basis"
            placeholder="All bases"
            value={values.lawfulBasis}
            options={LAWFUL_BASES}
            onChange={(v) => onChange({ ...values, lawfulBasis: v })}
          />
        </FilterRow>
      );
  }
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

function SuperAdminFilters({ values, onChange }: FiltersProps) {
  const branches = useBranches({ limit: 100 });
  const departments = useDepartments({ limit: 100 });
  const hosts = useHosts({ limit: 100 });

  const branchOpts = (branches.data?.items ?? []).map((b) => ({ value: b.id, label: b.name }));
  const deptOpts = (departments.data?.items ?? []).map((d) => ({ value: d.id, label: d.name }));
  const hostOpts = (hosts.data?.items ?? []).map((h) => ({ value: h.id, label: h.name }));

  return (
    <FilterRow>
      <FilterSelect
        label="Branch"
        placeholder="All branches"
        value={values.branchId}
        options={branchOpts}
        onChange={(v) => onChange({ ...values, branchId: v })}
      />
      <FilterSelect
        label="Department"
        placeholder="All departments"
        value={values.departmentId}
        options={deptOpts}
        onChange={(v) => onChange({ ...values, departmentId: v })}
      />
      <FilterSelect
        label="Host"
        placeholder="All hosts"
        value={values.hostId}
        options={hostOpts}
        onChange={(v) => onChange({ ...values, hostId: v })}
      />
    </FilterRow>
  );
}

function DeptAdminFilters({ values, onChange }: FiltersProps) {
  const hosts = useHosts({ limit: 100 });
  const hostOpts = (hosts.data?.items ?? []).map((h) => ({ value: h.id, label: h.name }));

  return (
    <FilterRow>
      <FilterSelect
        label="Host"
        placeholder="All hosts"
        value={values.hostId}
        options={hostOpts}
        onChange={(v) => onChange({ ...values, hostId: v })}
      />
    </FilterRow>
  );
}
