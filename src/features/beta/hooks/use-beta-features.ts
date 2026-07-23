"use client";

/**
 * Beta-features gating (see docs/superpowers/specs/2026-07-23-beta-support-ux-design.md
 * at the workspace root).
 *
 * Two audiences, two persistence homes:
 *  - Tenant shell: org-wide `tenant_settings.beta_features_enabled`, mirrored
 *    to every role at boot via the /system-users/me tenant summary and cached
 *    on the Redux session slice — so the gate is synchronous (no flash).
 *  - Platform-admin shell: personal preference in the admin preferences
 *    key-value store, read through the existing settings hooks.
 */

import { useAppSelector } from "@/lib/store/hooks";
import {
  selectSessionType,
  selectTenantBetaFeaturesEnabled,
} from "@/lib/store/session-slice";
import { useUserPreferences } from "@/features/settings/hooks";

/**
 * Preference key holding the per-admin beta opt-in (admin preferences KV).
 *
 * MUST stay camelCase (no underscores): the backend's CaseConversionMiddleware
 * camelizes every JSON response key, including the dynamic keys of the
 * preferences dict. A snake_case key is stored verbatim on PATCH (it travels
 * as a string *value*) but comes back camelized on GET, so the lookup below
 * would never match and the toggle could never read as enabled.
 */
export const BETA_FEATURES_PREFERENCE_KEY = "betaFeaturesEnabled";

/**
 * Org-wide beta flag for tenant-shell pages. Synchronous — the value ships
 * with the /me bootstrap, so gated pages never flash the wrong variant.
 */
export function useTenantBetaFeatures(): { enabled: boolean } {
  const enabled = useAppSelector(selectTenantBetaFeaturesEnabled);
  return { enabled };
}

/**
 * Personal beta flag for platform-admin pages, backed by the admin
 * preferences KV. `isLoading` is true only on a cold cache — gated pages
 * show a neutral skeleton for that beat instead of flashing classic UI.
 */
export function useAdminBetaFeatures(): {
  enabled: boolean;
  isLoading: boolean;
} {
  const sessionType = useAppSelector(selectSessionType);
  const { data, isLoading } = useUserPreferences();
  const enabled =
    sessionType === "admin" && data?.[BETA_FEATURES_PREFERENCE_KEY] === true;
  return { enabled, isLoading: sessionType === "admin" && isLoading };
}
