import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";

/** Typed dispatch hook. Use this instead of plain `useDispatch`. */
export const useAppDispatch: () => AppDispatch = useDispatch;

/** Typed selector hook. Use this instead of plain `useSelector`. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
