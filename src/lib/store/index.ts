import { configureStore } from "@reduxjs/toolkit";
import { sessionReducer } from "./session-slice";
import { brandingReducer } from "./branding-slice";

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    branding: brandingReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
