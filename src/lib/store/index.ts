import { configureStore } from "@reduxjs/toolkit";
import { sessionReducer } from "./session-slice";
import { brandingReducer } from "./branding-slice";
import { writeAuthHint, clearAuthHint } from "@/lib/auth/auth-hint";

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    branding: brandingReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Single subscription that mirrors the session slice into a localStorage
// auth hint. Every login path eventually dispatches setAdminSession /
// setSystemUserSession and every logout path dispatches clearSessionState,
// so we don't need to sprinkle hint writes through callers — this one
// listener keeps them in sync. Tracking the previous "auth key" debounces
// updates to actual session-shape changes (branding updates won't churn
// localStorage).
if (typeof window !== "undefined") {
  let prevAuthKey: string | null = null;
  store.subscribe(() => {
    const session = store.getState().session;
    const role = session.systemUserProfile?.role ?? "";
    const key = session.isAuthenticated && session.type
      ? `${session.type}:${role}`
      : null;

    if (key === prevAuthKey) return;
    prevAuthKey = key;

    if (session.isAuthenticated && session.type) {
      writeAuthHint({
        sessionType: session.type,
        role: session.systemUserProfile?.role,
      });
    } else {
      clearAuthHint();
    }
  });
}
