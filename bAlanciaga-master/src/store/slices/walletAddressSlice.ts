// slices/counterSlice.js
import { createSlice } from "@reduxjs/toolkit";

const walletAddressSlice = createSlice({
  name: "walletAddress",
  initialState: { value: "0x0000000000000000000000000000000000000000" },
  reducers: {
    changeState: (state, action) => {
      state.value = action.payload;
    },
  },
});

// Export actions
export const { changeState } = walletAddressSlice.actions;

// Export reducer
export default walletAddressSlice.reducer;
