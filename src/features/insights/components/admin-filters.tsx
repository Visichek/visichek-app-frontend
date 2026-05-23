"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantList } from "@/features/auth/hooks/use-admin-dashboard";
import type { AdminTabId } from "@/types/insights";

/** Filter values that narrow the admin insights query. */
export interface AdminFilterValues {
  planTier?: string;
  subscriptionStatus?: string;
  billingCycle?: string;
  paymentProvider?: string;
  country?: string;
  tenantId?: string;
  incidentType?: string;
  incidentStatus?: string;
  supportStatus?: string;
  supportPriority?: string;
  onboardingStatus?: string;
}

const ALL = "__all";

function humanize(value: string): string {
  return value
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Short field labels for the active-filter chips. */
const FIELD_LABELS: Record<keyof AdminFilterValues, string> = {
  planTier: "Plan",
  subscriptionStatus: "Subscription",
  billingCycle: "Billing",
  paymentProvider: "Provider",
  country: "Country",
  tenantId: "Tenant",
  incidentType: "Incident type",
  incidentStatus: "Incident status",
  supportStatus: "Support status",
  supportPriority: "Priority",
  onboardingStatus: "Onboarding",
};

/** The set filters as `{ key, text }` chips for display below the controls. */
/** Fallback chips from raw values (tenant id shows as id) until the server
 *  populates `meta.appliedFilters`. */
export function activeFilterChips(
  values: AdminFilterValues,
): Array<{ key: string; text: string }> {
  return (Object.entries(values) as Array<[keyof AdminFilterValues, string | undefined]>)
    .filter(([, v]) => Boolean(v))
    .map(([key, v]) => ({ key, text: `${FIELD_LABELS[key]}: ${humanize(v as string)}` }));
}

/** Server-resolved chips from `meta.appliedFilters`. */
export function chipsFromApplied(
  applied: Array<{ key: string; label: string }>,
): Array<{ key: string; text: string }> {
  return applied.map(({ key, label }) => ({
    key,
    text: `${FIELD_LABELS[key as keyof AdminFilterValues] ?? key}: ${label}`,
  }));
}

type Option = { value: string; label: string };
const opts = (values: readonly string[]): Option[] =>
  values.map((v) => ({ value: v, label: humanize(v) }));

const PLAN_TIERS = opts(["free", "starter", "premium", "enterprise"]);
const SUB_STATUSES = opts(["active", "trialing", "past_due", "suspended", "cancelled", "expired"]);
const BILLING_CYCLES = opts(["monthly", "yearly"]);
const PAYMENT_PROVIDERS = opts(["paystack", "flutterwave", "stripe"]);
const COUNTRIES = opts(["Nigeria", "Ghana", "Kenya", "South Africa", "Egypt"]);
const INCIDENT_TYPES = opts([
  "data_breach",
  "unauthorized_access",
  "data_export_exposure",
  "device_loss",
  "misconfiguration",
  "third_party",
]);
const INCIDENT_STATUSES = opts(["open", "investigating", "contained", "reported_to_ndpc", "closed"]);
const SUPPORT_STATUSES = opts(["open", "acknowledged", "in_progress", "resolved", "closed"]);
const SUPPORT_PRIORITIES = opts(["low", "medium", "high", "urgent"]);
const ONBOARDING_STATUSES = opts(["new", "accepted", "completed", "rejected"]);

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
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
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

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

/** Per-tab filter set, matching admin-stats.txt § 6. */
export function AdminFilters({
  tab,
  values,
  onChange,
}: {
  tab: AdminTabId;
  values: AdminFilterValues;
  onChange: (next: AdminFilterValues) => void;
}) {
  const set = (patch: Partial<AdminFilterValues>) => onChange({ ...values, ...patch });

  switch (tab) {
    case "overview":
    case "tenants":
      return (
        <Row>
          <FilterSelect label="Plan tier" placeholder="All tiers" value={values.planTier} options={PLAN_TIERS} onChange={(v) => set({ planTier: v })} />
          <FilterSelect label="Subscription" placeholder="All statuses" value={values.subscriptionStatus} options={SUB_STATUSES} onChange={(v) => set({ subscriptionStatus: v })} />
          <FilterSelect label="Country" placeholder="All countries" value={values.country} options={COUNTRIES} onChange={(v) => set({ country: v })} />
        </Row>
      );
    case "billing":
      return (
        <Row>
          <FilterSelect label="Plan tier" placeholder="All tiers" value={values.planTier} options={PLAN_TIERS} onChange={(v) => set({ planTier: v })} />
          <FilterSelect label="Billing cycle" placeholder="All cycles" value={values.billingCycle} options={BILLING_CYCLES} onChange={(v) => set({ billingCycle: v })} />
          <FilterSelect label="Payment provider" placeholder="All providers" value={values.paymentProvider} options={PAYMENT_PROVIDERS} onChange={(v) => set({ paymentProvider: v })} />
          <FilterSelect label="Subscription" placeholder="All statuses" value={values.subscriptionStatus} options={SUB_STATUSES} onChange={(v) => set({ subscriptionStatus: v })} />
        </Row>
      );
    case "activity":
      return (
        <Row>
          <FilterSelect label="Country" placeholder="All countries" value={values.country} options={COUNTRIES} onChange={(v) => set({ country: v })} />
          <FilterSelect label="Plan tier" placeholder="All tiers" value={values.planTier} options={PLAN_TIERS} onChange={(v) => set({ planTier: v })} />
          <FilterSelect label="Onboarding" placeholder="All statuses" value={values.onboardingStatus} options={ONBOARDING_STATUSES} onChange={(v) => set({ onboardingStatus: v })} />
        </Row>
      );
    case "risk":
      return <RiskFilters values={values} onChange={onChange} />;
  }
}

function RiskFilters({
  values,
  onChange,
}: {
  values: AdminFilterValues;
  onChange: (next: AdminFilterValues) => void;
}) {
  const set = (patch: Partial<AdminFilterValues>) => onChange({ ...values, ...patch });
  const tenants = useTenantList({ limit: 100 });
  const tenantOpts: Option[] = (tenants.data?.items ?? []).map((t) => ({
    value: t.id,
    label: t.companyName,
  }));

  return (
    <Row>
      <FilterSelect label="Incident type" placeholder="All types" value={values.incidentType} options={INCIDENT_TYPES} onChange={(v) => set({ incidentType: v })} />
      <FilterSelect label="Incident status" placeholder="All statuses" value={values.incidentStatus} options={INCIDENT_STATUSES} onChange={(v) => set({ incidentStatus: v })} />
      <FilterSelect label="Support status" placeholder="All statuses" value={values.supportStatus} options={SUPPORT_STATUSES} onChange={(v) => set({ supportStatus: v })} />
      <FilterSelect label="Support priority" placeholder="All priorities" value={values.supportPriority} options={SUPPORT_PRIORITIES} onChange={(v) => set({ supportPriority: v })} />
      <FilterSelect label="Tenant" placeholder="All tenants" value={values.tenantId} options={tenantOpts} onChange={(v) => set({ tenantId: v })} />
    </Row>
  );
}
