// ── Compliance Register ───────────────────────────────────────────────
export interface ComplianceRegisterEntry {
  id: string;
  tenantId: string;
  processingActivity: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories?: string;
  createdAt: number;
}

export interface CreateRegisterEntryRequest {
  processingActivity: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories?: string;
}

// ── Consent Log ────────────────────────────────────────────────────
export interface ConsentLogEntry {
  id: string;
  tenantId: string;
  visitorProfileId: string;
  consentGranted: boolean;
  purpose: string;
  timestamp: number;
}

// ── Deletion Log ───────────────────────────────────────────────────
export interface DeletionLogEntry {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  executedAt: number;
}
