# VisiChek Frontend TODO

> **Last audited:** 2026-04-07
> **Status:** Pending frontend implementation for the new public registration, public rights, staged check-in, and compliance flows now available in the backend.
> Tasks are organized by functional phase with dependency chains, route scope, and expected frontend ownership.

---

## Phase 1: Public Visitor Registration Surface

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **1A** | Add public visitor route group and layout | High | — | `(public)` routes, middleware, public shell |
| **1B** | Build tenant-scoped registration page | High | 1A | Registration page, form, loading and error states |
| **1C** | Load tenant info, departments, and privacy notice | High | 1B | Public data hooks, API layer, types |
| **1D** | Submit visitor self-registration | High | 1B, 1C | Form submission, success handoff, validation |
| **1E** | Appointment prefill flow | High | 1B | Query-param driven prefill UX |

### 1A — Add public visitor route group and layout

- [ ] Add a dedicated unauthenticated public route group for visitor flows
- [ ] Keep these routes outside the authenticated tenant and platform shells
- [ ] Add a public layout for visitor-facing pages with no admin navigation chrome
- [ ] Update middleware so public visitor flows are never redirected to login
- [ ] Keep public registration pages reachable from QR codes without auth state

### 1B — Build tenant-scoped registration page

- [ ] Add a route for public registration:
  - `/register/[tenantId]`
- [ ] Support optional appointment-prefill entry via query params or QR payload
- [ ] Build a tablet-first registration form for:
  - full name
  - phone
  - company
  - email
  - purpose
  - department
- [ ] Make the public form usable on both visitor phones and reception tablets
- [ ] Add clear invalid-tenant, tenant-not-found, and no-departments states

### 1C — Load tenant info, departments, and privacy notice

- [ ] Add API methods and frontend types for:
  - `GET /v1/public/register/{tenant_id}/info`
  - `GET /v1/public/register/{tenant_id}/departments`
  - `GET /v1/public/register/{tenant_id}/privacy-notice`
- [ ] Load tenant company name and public branding context before rendering the form
- [ ] Display the privacy notice before any meaningful data capture step
- [ ] Show notice title, content, and version when present
- [ ] Handle the backend fallback response when no active notice exists

### 1D — Submit visitor self-registration

- [ ] Add API method and types for:
  - `POST /v1/public/register/{tenant_id}`
- [ ] Submit the public registration payload with backend field names correctly mapped
- [ ] Support consent fields when required:
  - `consentGranted`
  - `consentMethod`
  - `privacyNoticeVersionId`
- [ ] Show a clear success screen after registration
- [ ] Display the handoff message telling the visitor to proceed to reception
- [ ] Handle backend validation errors cleanly, especially consent-required failures

### 1E — Appointment prefill flow

- [ ] Add API method and types for:
  - `GET /v1/public/register/{tenant_id}/appointment/{appointment_id}`
- [ ] Pre-fill registration fields from appointment data where available:
  - host
  - department
  - purpose
  - scheduled time
- [ ] Keep prefilled fields editable when the UI should allow updates
- [ ] Handle invalid, expired, or tenant-mismatched appointment links gracefully

---

## Phase 2: Public Privacy, Consent, and Data Rights

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **2A** | Consent-aware public registration UX | High | 1C, 1D | Consent UI, validation, copy |
| **2B** | Public rights request flow | High | 1A | Visitor rights pages and forms |
| **2C** | Consent withdrawal flow | High | 2B | Public self-service action |
| **2D** | Profiling opt-out flow | Medium | 2B | Public self-service action |
| **2E** | DSR status check page | Medium | 2B | Token-based request-status UI |

### 2A — Consent-aware public registration UX

- [ ] Make the public form adapt to whether consent is required by backend policy
- [ ] Add an explicit consent control when the tenant requires consent
- [ ] Prevent submission until the required consent action is completed
- [ ] Pass through the privacy notice version shown to the visitor
- [ ] Surface backend consent or notice errors in plain language

### 2B — Public rights request flow

- [ ] Add public routes for visitor rights:
  - `/rights/request`
  - `/rights/request/[requestId]/status`
- [ ] Add API method and types for:
  - `POST /v1/public/rights/request`
- [ ] Build a visitor rights form supporting:
  - access request
  - correction request
  - deletion request
  - consent withdrawal request
- [ ] Allow identification by phone or email, matching backend rules
- [ ] Show the returned request ID, verification token, and due date clearly

### 2C — Consent withdrawal flow

- [ ] Add API method and types for:
  - `POST /v1/public/rights/withdraw-consent`
- [ ] Provide a lightweight public form for visitors to withdraw consent
- [ ] Reuse identification fields and validation from the rights flow
- [ ] Show how many sessions were updated when the request succeeds

### 2D — Profiling opt-out flow

- [ ] Add API method and types for:
  - `PATCH /v1/public/rights/profiling-opt-out`
- [ ] Add a public opt-out form or panel for repeat-visitor profiling preferences
- [ ] Explain the effect of opting out in plain language
- [ ] Show clear success and error states

### 2E — DSR status check page

- [ ] Add API method and types for:
  - `GET /v1/public/rights/request/{id}/status`
- [ ] Build a status page that reads `requestId` and `verificationToken`
- [ ] Support status lookup from a link or manual entry
- [ ] Show request status, due date, and next-step guidance

---

## Phase 3: Public Checkout and Badge-Linked Flows

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **3A** | Public self-checkout page | High | 1A | Visitor-facing checkout route |
| **3B** | Badge-QR driven checkout handling | High | 3A | Query-param/token UX |
| **3C** | Checkout confirmation UX | Medium | 3A | Success, failure, expired token states |

### 3A — Public self-checkout page

- [ ] Add a public route for badge self-checkout:
  - `/checkout`
- [ ] Add API method and types for:
  - `POST /v1/public/checkout`
- [ ] Accept the badge QR token from URL params, QR scan result, or manual paste
- [ ] Allow a one-tap checkout path when the token is already present in the URL

### 3B — Badge-QR driven checkout handling

- [ ] Read the signed badge token from the scanned URL consistently
- [ ] Submit the token using the backend request shape
- [ ] Handle missing-token and malformed-token states before hitting the API
- [ ] Keep the flow fast enough for visitor self-checkout on mobile

### 3C — Checkout confirmation UX

- [ ] Show checkout success with:
  - session status
  - visit duration
- [ ] Add clear states for:
  - invalid token
  - expired token
  - session not found
  - already checked-out session
- [ ] Make the completion screen understandable without staff assistance

---

## Phase 4: Reception Staged Check-In Workflow

> **Note:** Hooks for check-in, confirm, deny, OCR, host-approve, and draft-update already exist in `features/visitors/hooks/use-visitors.ts`. The visitors page at `/app/visitors` already has Active/Pending tabs. This phase focuses on improving and completing the UI layer.

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **4A** | Pending queue UI for reception | High | — | Tenant shell reception pages |
| **4B** | Draft/session resume flow | High | 4A | Session detail and edit forms |
| **4C** | Confirm check-in flow | High | 4B | Confirmation action, badge response |
| **4D** | Deny-entry flow | Medium | 4B | Denial modal and reason capture |
| **4E** | Badge download/print UX | Medium | 4C | Badge preview/download actions |

### 4A — Pending queue UI for reception

- [ ] Improve receptionist UI for pending sessions from `GET /v1/visitors/sessions/pending`
- [ ] Display sessions in `registered` and `pending_verification` states clearly
- [ ] Sort and label pending items so reception can resume work quickly
- [ ] Show origin cues for sessions created from public registration versus staff entry

### 4B — Draft/session resume flow

- [ ] Add receptionist detail view for pending sessions
- [ ] Improve draft update support using `PATCH /v1/visitors/sessions/{id}/update-draft`
- [ ] Allow reception to fill or update: department, host, purpose, visitor photo, ID image
- [ ] Reuse visitor profile search from `GET /v1/visitor-profiles/search`

### 4C — Confirm check-in flow

- [ ] Improve confirm action using `POST /v1/visitors/sessions/{id}/confirm`
- [ ] Support badge format selection (A6 or A7)
- [ ] Handle the confirm response: session, badgePdfBase64, badgeQrToken
- [ ] Transition the UI from draft state to checked-in state cleanly

### 4D — Deny-entry flow

- [ ] Improve deny action using `POST /v1/visitors/sessions/{id}/deny`
- [ ] Require a denial reason before submission
- [ ] Show denied sessions distinctly in reception and logs

### 4E — Badge download/print UX

- [ ] Add badge download action using `GET /v1/visitors/sessions/{id}/badge`
- [ ] Support immediate print/download after confirmation
- [ ] Add retry paths if the inline badge payload fails

---

## Phase 5: Verification and Identity Capture

> **Note:** Hooks for OCR verification, apply-id-scan, and host-approve already exist. This phase focuses on the UI layer for these flows.

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **5A** | OCR verification flow | High | 4B | ID upload and extraction UI |
| **5B** | Apply OCR results to session/profile | High | 5A | Review and confirm extracted data |
| **5C** | Host approval flow | High | 4B | Host action screen or prompt |
| **5D** | Verification status presentation | Medium | 4A, 4B | Shared badges and labels |

### 5A — OCR verification flow

- [ ] Add document upload UX for ID scanning using upload-intents flow
- [ ] Add OCR action using `POST /v1/visitors/verify/id-scan`
- [ ] Show extracted fields: full name, id number, id type, confidence
- [ ] Let reception review extracted values before applying them

### 5B — Apply OCR results to session/profile

- [ ] Add apply action using `POST /v1/visitors/sessions/{id}/apply-id-scan`
- [ ] Map OCR output into the session confirmation workflow
- [ ] Update the UI after apply so verification status changes are visible immediately

### 5C — Host approval flow

- [ ] Add host-approval action using `POST /v1/visitors/sessions/{id}/host-approve`
- [ ] Surface a clear host-approval path when ID-based verification is unavailable
- [ ] Distinguish host-approved verification from ID-scan verification in the UI

### 5D — Verification status presentation

- [ ] Add shared badges and labels for visit status, verification status, verification method
- [ ] Use backend enums from `api-docs/06-enums-reference.md`
- [ ] Do not invent frontend-only states or labels that conflict with backend values

---

## Phase 6: Tenant Operations and Dashboard Alignment

> **Note:** Hooks and pages exist for visitors, appointments, departments, branches, and dashboard. This phase focuses on alignment with backend contracts and adding missing features.

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **6A** | Visitor log alignment | High | — | Dashboard tables, filters, exports |
| **6B** | Active visitor monitoring | High | — | Reception and admin active views |
| **6C** | Appointment management alignment | Medium | — | Appointment forms and lists |
| **6D** | Visitor profile alignment | Medium | — | Profile list/detail/update |

### 6A — Visitor log alignment

- [ ] Ensure visitor log UI matches `GET /v1/dashboard/visitors`
- [ ] Add filters for host, verification status, date range
- [ ] Add export actions for CSV and XLSX via `GET /v1/dashboard/export`
- [ ] Show receptionist name, duration, and verification details

### 6B — Active visitor monitoring

- [ ] Add or update active visitor views using `GET /v1/visitors/active` and `GET /v1/dashboard/visitors/active`
- [ ] Make active visitors easy to scan for security and reception staff
- [ ] Add practical refresh behavior for near-real-time monitoring

### 6C — Appointment management alignment

- [ ] Ensure appointment pages align with CRUD endpoints
- [ ] Make appointment creation support the later public registration prefill flow

### 6D — Visitor profile alignment

- [ ] Ensure profile pages align with profile CRUD endpoints
- [ ] Show profile-level verification fields and repeat-visitor context

---

## Phase 7: Compliance and Privacy Operations UI

> **Note:** Hooks exist for privacy notices, retention policies, sub-processors, DSR, incidents, audit logs, and compliance register. Pages exist for incidents, audit, and DPO. This phase focuses on completing and improving the UI layer.

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **7A** | Privacy notice management | High | — | Tenant compliance pages |
| **7B** | Retention policy management | High | — | Tenant compliance pages |
| **7C** | DSR management panel | High | — | DPO and super-admin pages |
| **7D** | Incident log module | High | — | Security/compliance pages |
| **7E** | Audit log viewer | Medium | — | Auditor and DPO views |
| **7F** | Compliance register and export UI | Medium | — | Compliance reporting pages |
| **7G** | Sub-processor management | Medium | — | Compliance settings |

### 7A — Privacy notice management

- [ ] Build or improve pages for privacy notice CRUD and activation
- [ ] Make it obvious which notice is active and what version is visitor-facing

### 7B — Retention policy management

- [ ] Build or improve pages for retention policy CRUD
- [ ] Show retention days and configured action clearly

### 7C — DSR management panel

- [ ] Build or improve pages for DSR CRUD with status, assignee workflow, and due-date visibility

### 7D — Incident log module

- [ ] Build or improve pages for incident CRUD
- [ ] Highlight incidents approaching the 72-hour notification deadline

### 7E — Audit log viewer

- [ ] Build audit log views with filtering by actor, action, entity, and date range

### 7F — Compliance register and export UI

- [ ] Build pages for compliance register, deletion logs, consent log, and ZIP export

### 7G — Sub-processor management

- [ ] Build pages for sub-processor CRUD with provider purpose, jurisdiction, and status

---

## Phase 8: Frontend Platform Work

| Task | Description | Priority | Depends | Frontend scope |
|------|-------------|:--------:|---------|----------------|
| **8A** | API client and type coverage | High | All prior phases | `lib/api`, `types/`, feature slices |
| **8B** | Shared components for public flows | Medium | 1A, 1B, 2A, 3A | Design system and recipes |
| **8C** | Responsive and accessibility QA | Medium | All visible flows | Public and tenant UIs |
| **8D** | End-to-end frontend testing | Medium | All major flows | Automated tests and manual QA |

### 8A — API client and type coverage

- [ ] Add frontend types for all new public registration and rights payloads/responses
- [ ] Add frontend types for staged check-in, compliance, and export responses not yet modeled
- [ ] Keep the API layer consistent with backend contracts and casing conventions
- [ ] Keep public calls outside auth-only request wrappers where appropriate

### 8B — Shared components for public flows

- [ ] Build reusable components for privacy notice display, consent capture, visitor success/error screens, badge-token checkout entry, request-status lookup

### 8C — Responsive and accessibility QA

- [ ] Verify public flows on mobile phone, reception tablet, and desktop
- [ ] Ensure touch targets and form spacing are adequate for tablet use
- [ ] Ensure keyboard and screen-reader support for public and compliance forms

### 8D — End-to-end frontend testing

- [ ] Add tests for all major public and tenant flows

---

## Suggested Delivery Order

1. Public route group, middleware allowances, and public layout
2. Public registration page with tenant info, departments, and privacy notice loading
3. Consent-aware registration submission and success handoff
4. Public self-checkout flow
5. Reception pending queue, draft resume, and confirm check-in flow
6. OCR verification and host approval UI
7. Dashboard alignment for logs, active visitors, profiles, and appointments
8. Public rights portal and DSR status flow
9. Compliance operations pages
10. Shared component cleanup, responsiveness, accessibility, and tests
