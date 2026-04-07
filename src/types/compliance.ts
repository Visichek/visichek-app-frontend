// ── Compliance Register ───────────────────────────────────────────────
export interface ComplianceRegisterEntry {
  id: string;
  tenant_id: string;
  processing_activity: string;
  purpose: string;
  lawful_basis: string;
  data_categories?: string;
  created_at: number;
}

export interface CreateRegisterEntryRequest {
  processing_activity: string;
  purpose: string;
  lawful_basis: string;
  data_categories?: string;
}

// ── Consent Log ────────────────────────────────────────────────────
export interface ConsentLogEntry {
  id: string;
  tenant_id: string;
  visitor_profile_id: string;
  consent_granted: boolean;
  purpose: string;
  timestamp: number;
}

// ── Deletion Log ───────────────────────────────────────────────────
export interface DeletionLogEntry {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  executed_at: number;
}
