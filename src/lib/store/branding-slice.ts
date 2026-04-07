import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TenantBranding } from "@/types/tenant";

interface BrandingState {
  isLoaded: boolean;
  branding: TenantBranding | null;
}

const initialState: BrandingState = {
  isLoaded: false,
  branding: null,
};

const brandingSlice = createSlice({
  name: "branding",
  initialState,
  reducers: {
    setBranding(state, action: PayloadAction<TenantBranding>) {
      state.branding = action.payload;
      state.isLoaded = true;
    },
    clearBranding(state) {
      state.branding = null;
      state.isLoaded = false;
    },
  },
});

export const { setBranding, clearBranding } = brandingSlice.actions;
export const brandingReducer = brandingSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────
export const selectBranding = (state: { branding: BrandingState }) =>
  state.branding.branding;
export const selectIsBrandingLoaded = (state: { branding: BrandingState }) =>
  state.branding.isLoaded;
