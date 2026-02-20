import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "../features/ui/uiSlice";
import playerReducer from "../features/player/playerSlice";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    player: playerReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
