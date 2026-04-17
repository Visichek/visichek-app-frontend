# Public Shell Audit — Visitor Check-In Workflow

Scope: everything under `src/app/(public)/` that touches the visitor check-in flow, measured against the integration guide provided on 2026-04-17 (treated as the current source of truth; the older staged-flow description in `CLAUDE.md` is superseded).

Verdict up front: **the existing public shell implements the old `/v1/public/register/{tenant_id}` contract end-to-end. Almost none of the new `checkin-configs` / `id-extractions` / `badges/validate` flow is present.** This is a contract rewrite, not a patch.

---

## 1. Headline mismatches (what's wrong at the contract level)

| Area | Current code | New guide requires | Impact |
| --- | --- | --- | --- |
| Route key | `/register/[tenantId]` keyed by tenant UUID (`src/app/(public)/register/[tenantId]/page.tsx`) | `/checkin-configs/{checkin_config_id}` keyed by an opaque `cfg_...` config id | Every URL, route param, hook, and query-key in the flow is wrong. |
| QR payload | Parsed as a URL or bare tenant UUID in `scan/page.tsx` (`extractTenantFromPayload`) | JSON blob `{ "checkin_config_id": "cfg_..." }`; **must not** be treated as a URL | Kiosk will silently fail to parse new QR codes. |
| Config fetch | `GET /public/register/{tenantId}/info` + `/departments` + `/privacy-notice` as 3 separate calls | Single `GET /v1/checkin-configs/{cfg_id}` returning `required_fields[]`, `id_upload_enabled`, `allow_returning_visitor_lookup`, `logo_url`, `tenant_name` | The config-driven form (dynamic `required_fields`) does not exist yet. |
| Returning visitor lookup | `POST /public/register/{tenantId}/lookup` with `{ phone }`, returns `profileId`, `idVerifiedRecently` (operates on the tenant's profile store) | `GET /v1/checkin-configs/{cfg_id}/visitors/lookup?email=&phone=` returning `{ found, visitor: { id, bio_data, ... } }` | Wrong verb (POST vs GET), wrong path, different response shape; needs rewrite. |
| ID scan | One-shot `POST /public/register/{tenantId}/id-scan` with `multipart/form-data` (`usePublicOcrIdScan`) | Two-step: (1) existing document-upload endpoint → `document_id`; (2) `POST /v1/id-extractions` with `{ document_id, id_type, provider }`; returns `id_extraction_id`, `extracted_fields`, `portrait_url`, `unmatched_required_fields`, `confidence`, `verified` | Current code conflates upload + OCR and throws away `id_extraction_id`, which the new submit step requires. Complete rework. |
| Check-in submit | `POST /public/register/{tenantId}` with flat payload (`phone`, `fullName`, `departmentId`, `consentGranted`, ...) | `POST /v1/checkin-configs/{cfg_id}/checkins` with structured `{ visitor_id?, id_extraction_id?, bio_data, tenant_specific_data, purpose: { purpose, purpose_details, expected_duration_minutes } }` | Wrong path; wrong body shape; missing `purpose` object; no `tenant_specific_data` split. |
| Post-submit flow | Jumps to "receptionist code" finalize step (`usePublicFinalize`) then `RegistrationSuccess` | Shows **"waiting for approval"** screen that polls `GET /v1/checkins/{id}` every 3–5s; on `approved` show "collect badge at reception", on `rejected` show `rejection_reason` | Entire approval-polling UX is missing; the "receptionist code" step does not exist in the new contract. |
| Badge validation scanner | **Not implemented** anywhere in `(public)/` | `GET /v1/badges/validate?qr_code_value=...` — unauthenticated exit-gate scanner UI showing valid/expired/not_found/revoked | Whole screen missing. |
| Timestamps | `apptQ.data.scheduledDatetime` is multiplied by 1000 (correct — epoch seconds) | Guide confirms: **all timestamps are Unix epoch seconds**, including `badge.expires_at` which must be rendered in tenant local timezone | Code is directionally right; tenant-timezone formatting is not yet implemented for badges. |

---

## 2. Contract-layer mismatches (API client + envelope)

Location: `src/lib/api/interceptors.ts`, `src/types/api.ts`.

**Resolved 2026-04-17: the old envelope shape is correct.** The real error envelope is the one described in `CLAUDE.md` and matched by the current normalizer:

```json
{ "success": false, "message": "...", "data": { "code": "AUTH_INVALID_TOKEN", "details": { ... } } }
```

The new guide's example (`code` at the top level) is imprecise and should be ignored. **No change needed in `interceptors.ts` or `types/api.ts`.** New hooks will read `err.code` off `ApiError` and it will already carry the correct `VALIDATION_FAILED` / `RESOURCE_NOT_FOUND` / `UPSTREAM_ERROR` values from `envelope.data.code`.

Additional observations on `src/lib/api/client.ts`:

- `withCredentials: true` is set. The guide is silent on cookies for the public kiosk calls — sections 2–6 are explicitly unauthenticated. Sending credentials on public calls is not wrong, but should be confirmed with backend because some CORS configurations will reject unauthenticated preflights that include credentials.
- The default `Content-Type: application/json` header is fine for Axios + FormData (Axios strips it and sets multipart boundary), but the new flow no longer uploads multipart from the kiosk at all — OCR uses the existing document-upload endpoint, so FormData handling here may not matter for this feature.

---

## 3. Missing pieces (whole things that simply aren't there)

1. **`/v1/checkin-configs/{id}` query hook, types, and route.** Needs a new feature module — proposed `src/features/checkin/`.
2. **`POST /v1/id-extractions` hook.** Needs to be layered on top of the existing document-upload pattern documented in `CLAUDE.md` (`POST /v1/documents/upload-intents` → upload → `POST /v1/documents/complete`). Confirm with backend that the public kiosk can use that existing endpoint unauthenticated, or whether there's a public variant.
3. **"Waiting for approval" screen + `GET /v1/checkins/{id}` poll.** Replaces the current "receptionist code" modal.
4. **Badge-validation scanner route** under `(public)/` — e.g. `/scan-badge` or `/validate` — with camera/QR scan and the `valid`/`invalid` UX (red X + reason).
5. **Notification hooks** (`/v1/me/notifications`) for receptionists are a tenant-shell concern, but if any realtime push reaches the kiosk, it's not wired up today.
6. **Tenant-timezone formatting util** for `expires_at` on badges. Current code uses `new Date(epoch * 1000).toLocaleString()` which uses the browser's locale — acceptable on the kiosk but not on a server-rendered receptionist badge render.
7. **`id_upload_enabled` / `allow_returning_visitor_lookup` feature gating.** The new config endpoint drives whether the "Scan ID" and "Been here before?" affordances render. Current page shows both unconditionally, gated only by local state.

---

## 4. Existing files that will churn or retire

| Path | Disposition |
| --- | --- |
| `src/app/(public)/register/[tenantId]/page.tsx` | **Delete** in the same pass as shipping `(public)/checkin/[configId]/page.tsx`. No backwards-compat — old URLs are hard-cut. |
| `src/app/(public)/register/layout.tsx` | Keep — it's contract-agnostic chrome. Move under the new route. |
| `src/features/public-registration/hooks/use-public-registration.ts` | **Delete** the check-in-related hooks in the same pass: `usePublicTenantInfo`, `usePublicDepartments`, `usePublicPrivacyNotice`, `usePublicOcrIdScan`, `usePublicLookup`, `usePublicRegister`, `usePublicFinalize`, `useVerifyRegistrationToken`, `useAppointmentPrefill`. Keep `usePublicCheckout`, `usePublicRightsRequest`, `usePublicRightsStatus`, `usePublicConsentWithdrawal`, `usePublicProfilingOptOut` — those belong to different flows. |
| `src/types/public.ts` | Most of the types (`PublicTenantInfo`, `PublicRegistrationRequest`, `PublicOcrScanResponse`, `PublicLookupResponse`, `PublicFinalizeRequest`) map to the old endpoints. Need a parallel `src/types/checkin.ts` for the new contract. |
| `src/features/public-registration/components/registration-success.tsx` | Repurpose as the "waiting for approval" screen (the copy already points the visitor to reception). |
| `src/app/(public)/app/scan/page.tsx` | Rewrite `extractTenantFromPayload`: parse as JSON first, fall back to bare `cfg_...` id, drop URL parsing. Route push changes to `/checkin/${configId}`. |
| `src/middleware.ts` | Add `/checkin/` and `/validate-badge/` (or whatever the scanner route is named) to the public-route allowlist. |

---

## 5. VisiChek hard-rule compliance in the public shell

Ran against the hard-rule list in `CLAUDE.md`. Status as of current `(public)/register/[tenantId]/page.tsx`:

| Rule | Status | Notes |
| --- | --- | --- |
| Use only `lucide-react` icons, no inline SVG | Pass | All icons imported from `lucide-react`. |
| No `any` in TypeScript | Pass for this page; `BarcodeDetector` uses a proper `DetectorLike` type. |
| Every clickable wrapped in `<Tooltip>` | Pass — buttons on scan page and register page all have tooltips. New screens (waiting-for-approval, badge scanner) must follow the same pattern. |
| Loading indicator on click for navigation | Partial — `scan/page.tsx` uses a `status === "redirecting"` state, good. Register page submit uses `LoadingButton`, good. The "Look up" button uses an inline `Loader2`, good. New screens need the same discipline. |
| Handle loading / error / empty for every query | Pass on register page (`isInitialLoading`, `tenantQ.error`, `deptsQ.data.length === 0` each render a state). The new flow has two additional queries (config, checkin poll) that will need explicit states. |
| Design tokens for colors, spacing, z-index | Pass — uses Tailwind semantic tokens (`bg-primary/10`, `text-muted-foreground`, etc.). One place sets `--tenant-primary` directly on `documentElement` (line 170) — that's the branding bootstrap, which is fine per guide section on branding. |
| Input font size ≥ 16px on mobile | Pass — all inputs use `text-base md:text-sm`. |
| Tokens not in `localStorage`/`sessionStorage` | Pass — public flow is unauthenticated; no tokens stored. |
| `ALWAYS read api-docs/ before implementing` | **Can't verify** — the repo has no `api-docs/` or `frontend-docs/` folder. The only doc is `docs/micro-interactions.md`. Flag for the user: either the guide is the canonical spec (user's stated choice), or we need `api-docs/` added to the repo. |

---

## 6. Recommended migration plan (short form)

1. **Settle the contract.** Confirm with backend that the new guide is live in staging and the old `/public/register/...` endpoints are truly being retired. Envelope shape is already locked (old `data.code` shape is correct — no interceptor change needed).
2. **Add `src/types/checkin.ts`** for `CheckinConfig`, `CheckinConfigField`, `VisitorLookupResult`, `IdExtractionResult`, `CheckinCreateRequest`, `CheckinOut`, `Badge`, `BadgeValidationResult`.
3. **Add `src/features/checkin/hooks/use-checkin.ts`**: `useCheckinConfig`, `useVisitorLookup` (query, not mutation), `useIdExtraction`, `useCreateCheckin`, `useCheckinStatus` (polling via `refetchInterval`).
4. **Ship the kiosk UI** at `src/app/(public)/checkin/[configId]/page.tsx` driven by `required_fields` + feature flags. Keep the tooltip / loading / mobile-input discipline already present in the old page.
5. **Ship the "waiting for approval" screen** as a sub-state of the kiosk page (or a `/checkin/[configId]/waiting/[checkinId]` child route). Poll, branch on `state`.
6. **Rewrite `(public)/app/scan/page.tsx`** payload parser to prefer JSON, push to `/checkin/{configId}`.
7. **Add badge-validation route** under `(public)/validate-badge/page.tsx` — QR scan + `GET /v1/badges/validate`.
8. **Add `/checkin` and `/validate-badge` to `middleware.ts`** public allowlist.
9. **Retire old `public-registration` hooks/types in a second pass** once the new flow is proven in staging.

Estimated surface area: ~2 new route files, ~6 new hooks, ~8 new types, one new badge-scanner page, and targeted deletions in the public-registration feature. No backend code, no interceptor changes, no tenant-shell changes.

---

## 7. Resolved decisions

All open questions have been answered. Captured here as implementation constraints the migration plan should honor.

- **Error envelope shape**: old shape (`data.code` nested) is correct. Interceptor and types stay as-is.
- **Receptionist realtime**: polling is the only option right now. When the receptionist dashboard is built, use React Query `refetchInterval` (~5s) against `GET /v1/tenants/{tenant_id}/checkins?state=pending_approval` rather than waiting on a push channel.
- **Document upload auth scope**: the existing `/v1/documents/upload-intents` → upload → `/v1/documents/complete` flow is callable **unauthenticated** from the kiosk. No public variant needed — reuse the same endpoints for the ID scan step, just without an `Authorization` header.
- **Old `/register/{tenantId}` deep-links**: **hard cut, not supported** during or after migration. The new kiosk lives only at `/checkin/{configId}`. Retire the old route, hooks, and types in the same pass. The `scan/page.tsx` QR parser drops URL parsing entirely — it only accepts JSON payloads (or a bare `cfg_...` id as a typed-in fallback).
- **`expected_duration_minutes`**: optional on the wire but the kiosk **must send a default**. Use `60` (one hour) as the fallback when the user does not specify a duration. Only omit the field entirely if the form explicitly collects a value and the user leaves it blank — in that case still send `60`. Never send `null` or `0`.
