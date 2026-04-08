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
  type: "admin" | "system_user" | null;
  adminProfile: AdminProfile | null;
  systemUserProfile: SystemUserProfile | null;
}

const initialState: SessionState = {
  isAuthenticated: false,
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
  },
});

export const { setAdminSession, setSystemUserSession, clearSessionState } =
  sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────
export const selectIsAuthenticated = (state: { session: SessionState }) =>
  state.session.isAuthenticated;
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
