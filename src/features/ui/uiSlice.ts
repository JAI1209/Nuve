import { createSlice } from "@reduxjs/toolkit";

interface UiState {
  hasEntered: boolean;
}

const initialState: UiState = {
  hasEntered: false
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    enterApp(state) {
      state.hasEntered = true;
    }
  }
});

export const { enterApp } = uiSlice.actions;
export default uiSlice.reducer;
