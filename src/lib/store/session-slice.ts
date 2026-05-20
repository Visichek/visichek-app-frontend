import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  Session,
  AdminSession,
  SystemUserSession,
  AdminProfile,
  SystemUserProfile,
} from "@/types/auth";

interface SessionState {
  isAuthenticated: boolean;
  // True until bootstrapSession() has settled (success or failure). Consumers
  // (PwaSplash, route guards) read this to distinguish "still loading" from
  // "definitely logged out" — both look like isAuthenticated=false otherwise.
  isBootstrapping: boolean;
  type: "admin" | "system_user" | null;
  adminProfile: AdminProfile | null;
  systemUserProfile: SystemUserProfile | null;
}

const initialState: SessionState = {
  isAuthenticated: false,
  isBootstrapping: true,
  type: null,
  adminProfile: null,
  systemUserProfile: null,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setAdminSession(state, action: PayloadAction<AdminSession>) {
      state.isAuthenticated = true;
      state.type = "admin";
      state.adminProfile = action.payload.profile;
      state.systemUserProfile = null;
    },
    setSystemUserSession(state, action: PayloadAction<SystemUserSession>) {
      state.isAuthenticated = true;
      state.type = "system_user";
      state.systemUserProfile = action.payload.profile;
      state.adminProfile = null;
    },
    clearSessionState(state) {
      state.isAuthenticated = false;
      state.type = null;
      state.adminProfile = null;
      state.systemUserProfile = null;
    },
    /**
     * Drop the temp-password flag after a successful forced change. The
     * server-side gate is already lifted by the change-password call; this
     * keeps the cached profile honest so nothing in the UI keeps treating
     * the user as gated before the next /me re-hydrates them.
     */
    clearMustChangePassword(state) {
      if (state.adminProfile) state.adminProfile.mustChangePassword = false;
      if (state.systemUserProfile)
        state.systemUserProfile.mustChangePassword = false;
    },
    markBootstrapDone(state) {
      state.isBootstrapping = false;
    },
  },
});

export const {
  setAdminSession,
  setSystemUserSession,
  clearSessionState,
  clearMustChangePassword,
  markBootstrapDone,
} = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────
export const selectIsAuthenticated = (state: { session: SessionState }) =>
  state.session.isAuthenticated;
export const selectIsBootstrapping = (state: { session: SessionState }) =>
  state.session.isBootstrapping;
export const selectSessionType = (state: { session: SessionState }) =>
  state.session.type;
export const selectAdminProfile = (state: { session: SessionState }) =>
  state.session.adminProfile;
export const selectSystemUserProfile = (state: { session: SessionState }) =>
  state.session.systemUserProfile;
export const selectCurrentRole = (state: { session: SessionState }) =>
  state.session.systemUserProfile?.role ?? null;
export const selectTenantId = (state: { session: SessionState }) =>
  state.session.systemUserProfile?.tenantId ?? null;
