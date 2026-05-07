"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { apiGet, apiPatch } from "@/lib/api/request";
import { useAppSelector } from "@/lib/store/hooks";
import { selectSessionType } from "@/lib/store/session-slice";
import type {
  SettingsManifest,
  SettingsSection,
  SettingsSectionKey,
  UserSettings,
  UserSettingsUpdate,
  UserPreferences,
  UserPreferenceUpdate,
  TenantSettings,
  TenantSettingsUpdate,
  PlatformSettings,
  PlatformSettingsUpdate,
} from "@/types/settings";

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Read paths from the current Redux session. Hooks calling these are
 * always inside an authenticated shell (the session was hydrated from
 * `GET /me` on boot), so `sessionType` will be set.
 */
function useSettingsBasePath(): string {
  const sessionType = useAppSelector(selectSessionType);
  return sessionType === "admin"
    ? "/admins/settings"
    : "/system-users/settings";
}

function usePreferencesBasePath(): string {
  const sessionType = useAppSelector(selectSessionType);
  return sessionType === "admin"
    ? "/admins/preferences"
    : "/system-users/preferences";
}

// ── Query Keys ───────────────────────────────────────────────────────

export const settingsKeys = {
  manifest: ["settings", "manifest"] as const,
  user: ["settings", "user"] as const,
  preferences: ["settings", "preferences"] as const,
  tenant: (tenantId: string) => ["settings", "tenant", tenantId] as const,
  platform: ["settings", "platform"] as const,
};

// ── Settings Manifest ───────────────────────────────────────────────

/**
 * Fetches the settings manifest once on settings page mount.
 * Returns which sections to show, their endpoints, and enforcement state.
 */
export function useSettingsManifest() {
  return useQuery({
    queryKey: settingsKeys.manifest,
    queryFn: () => apiGet<SettingsManifest>("/settings"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Returns the section from the manifest if present, or null if the user
 * doesn't have access. This is the primary way to decide what to render.
 */
export function useSettingsSection(
  manifest: SettingsManifest | undefined,
  key: SettingsSectionKey,
): SettingsSection | null {
  return useMemo(() => {
    if (!manifest) return null;
    return manifest.sections.find((s) => s.key === key) ?? null;
  }, [manifest, key]);
}

/**
 * Returns a map of all section keys present in the manifest for quick lookup.
 */
export function useVisibleSections(
  manifest: SettingsManifest | undefined,
): Set<SettingsSectionKey> {
  return useMemo(() => {
    if (!manifest) return new Set<SettingsSectionKey>();
    return new Set(manifest.sections.map((s) => s.key));
  }, [manifest]);
}

// ── User Settings ────────────────────────────────────────────────────

export function useUserSettings() {
  const basePath = useSettingsBasePath();
  return useQuery({
    queryKey: settingsKeys.user,
    queryFn: () => apiGet<UserSettings>(basePath),
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  const basePath = useSettingsBasePath();

  return useMutation({
    mutationFn: (data: UserSettingsUpdate) =>
      apiPatch<UserSettings>(basePath, data),
    onSuccess: (data) => {
      // Only prime the cache when the worker returned a complete settings
      // object. Fall back to an invalidation so the UI always reflects the
      // authoritative state after the queued write settles.
      if (data && typeof data === "object") {
        queryClient.setQueryData(settingsKeys.user, data);
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.user });
    },
  });
}

// ── User Preferences (Key-Value Store) ───────────────────────────────

export function useUserPreferences() {
  const basePath = usePreferencesBasePath();
  return useQuery({
    queryKey: settingsKeys.preferences,
    queryFn: () => apiGet<UserPreferences>(basePath),
  });
}

export function useUpdateUserPreference() {
  const queryClient = useQueryClient();
  const basePath = usePreferencesBasePath();

  return useMutation({
    mutationFn: (data: UserPreferenceUpdate) =>
      apiPatch<UserPreferences>(basePath, data),
    onSuccess: (data) => {
      if (data && typeof data === "object") {
        queryClient.setQueryData(settingsKeys.preferences, data);
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.preferences });
    },
  });
}

// ── Tenant Settings (super_admin only) ───────────────────────────────

export function useTenantSettings(tenantId: string) {
  return useQuery({
    queryKey: settingsKeys.tenant(tenantId),
    queryFn: () => apiGet<TenantSettings>(`/tenants/${tenantId}/settings`),
    enabled: !!tenantId,
  });
}

export function useUpdateTenantSettings(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TenantSettingsUpdate) =>
      apiPatch<TenantSettings>(`/tenants/${tenantId}/settings`, data),
    onSuccess: (data) => {
      if (data && typeof data === "object") {
        queryClient.setQueryData(settingsKeys.tenant(tenantId), data);
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.tenant(tenantId) });
    },
  });
}

// ── Platform Settings (admin only) ───────────────────────────────────

export function usePlatformSettings() {
  return useQuery({
    queryKey: settingsKeys.platform,
    queryFn: () => apiGet<PlatformSettings>("/admins/platform-settings"),
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PlatformSettingsUpdate) =>
      apiPatch<PlatformSettings>("/admins/platform-settings", data),
    onSuccess: (data) => {
      if (data && typeof data === "object") {
        queryClient.setQueryData(settingsKeys.platform, data);
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.platform });
    },
  });
}
